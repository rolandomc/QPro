/**
 * apiCEP Service
 * Valida un comprobante SPEI contra Banxico vía apiCEP.
 * Docs: https://www.apicep.cloud
 *
 * Variables de entorno necesarias:
 *   EXPO_PUBLIC_APICEP_API_KEY  → tu API key de apiCEP
 *   EXPO_PUBLIC_CLABE_DESTINO  → tu CLABE donde recibes los pagos
 */

const APICEP_BASE = 'https://www.apicep.cloud/api/v1';

export interface CepResult {
  claveRastreo: string;
  monto: number;           // en pesos
  emisor: string;
  receptor: string;
  fechaOperacion: string;  // ISO
  estado: 'LIQUIDADA' | 'DEVUELTA' | string;
  cuentaBeneficiario: string; // CLABE destino
}

export const ApiCepService = {
  /**
   * Consulta un CEP por clave de rastreo.
   * Lanza error si no existe o no está liquidada.
   */
  async consultarCEP(claveRastreo: string): Promise<CepResult> {
    const apiKey = process.env.EXPO_PUBLIC_APICEP_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_APICEP_API_KEY no configurada');

    const res = await fetch(
      `${APICEP_BASE}/cep?claveRastreo=${encodeURIComponent(claveRastreo)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? 'Error al consultar CEP');
    return json as CepResult;
  },

  /**
   * Valida que el CEP:
   * 1. Exista y esté LIQUIDADA
   * 2. El monto sea >= montoEsperado
   * 3. La cuenta beneficiario sea nuestra CLABE
   */
  async validarPago(claveRastreo: string, montoEsperado: number): Promise<CepResult> {
    const cep = await ApiCepService.consultarCEP(claveRastreo);
    const clabeDestino = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '';

    if (cep.estado !== 'LIQUIDADA') {
      throw new Error(`La transferencia aún no está liquidada (estado: ${cep.estado})`);
    }
    if (clabeDestino && cep.cuentaBeneficiario !== clabeDestino) {
      throw new Error('La transferencia no está dirigida a la cuenta correcta');
    }
    if (cep.monto < montoEsperado) {
      throw new Error(`Monto insuficiente. Se esperaban $${montoEsperado} MXN, se recibieron $${cep.monto}`);
    }

    return cep;
  },
};
