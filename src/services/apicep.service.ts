/**
 * apiCEP Service
 * Valida un comprobante SPEI contra Banxico vía apiCEP.
 * Docs: https://www.apicep.cloud
 *
 * Variables de entorno necesarias en .env:
 *   EXPO_PUBLIC_APICEP_API_KEY   = apicep_665deccc1cb8f1a87b05e7f58850c31150cd4ce778a04a7f08af2bae8e9799f3
 *   EXPO_PUBLIC_CLABE_DESTINO    = tu CLABE de 18 dígitos
 */

const APICEP_BASE = 'https://www.apicep.cloud/api/v1';

export interface CepResult {
  claveRastreo:       string;
  monto:              number;           // en pesos
  emisor:             string;
  receptor:           string;
  fechaOperacion:     string;           // ISO date
  estado:             'LIQUIDADA' | 'DEVUELTA' | string;
  cuentaBeneficiario: string;           // CLABE destino
}

export interface ValidarResult {
  valid:      boolean;
  cep?:       CepResult;
  errorMsg?:  string;
}

export const ApiCepService = {
  /** Consulta un CEP por clave de rastreo. Lanza error si HTTP no es OK. */
  async consultarCEP(claveRastreo: string): Promise<CepResult> {
    const apiKey = process.env.EXPO_PUBLIC_APICEP_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_APICEP_API_KEY no configurada');

    const res = await fetch(
      `${APICEP_BASE}/cep?claveRastreo=${encodeURIComponent(claveRastreo)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? `apiCEP error ${res.status}`);
    return json as CepResult;
  },

  /**
   * Valida que el CEP:
   *  1. Exista y esté LIQUIDADA
   *  2. El monto sea >= montoEsperado
   *  3. La CLABE beneficiario coincida con EXPO_PUBLIC_CLABE_DESTINO
   *
   * Devuelve { valid, cep?, errorMsg? } — nunca lanza excepción.
   */
  async validarCEP(claveRastreo: string, montoEsperado: number): Promise<ValidarResult> {
    try {
      const cep          = await ApiCepService.consultarCEP(claveRastreo);
      const clabeDestino = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '';

      if (cep.estado !== 'LIQUIDADA') {
        return { valid: false, errorMsg: `Transferencia no liquidada (estado: ${cep.estado})` };
      }
      if (clabeDestino && cep.cuentaBeneficiario !== clabeDestino) {
        return { valid: false, errorMsg: 'La transferencia no fue enviada a la cuenta correcta' };
      }
      if (cep.monto < montoEsperado) {
        return {
          valid:    false,
          errorMsg: `Monto insuficiente. Esperado: $${montoEsperado} MXN, recibido: $${cep.monto} MXN`,
        };
      }

      return { valid: true, cep };
    } catch (e: any) {
      return { valid: false, errorMsg: e.message ?? 'Error al consultar apiCEP' };
    }
  },

  /** Alias semántico para compatibilidad. */
  async validarPago(claveRastreo: string, montoEsperado: number): Promise<ValidarResult> {
    return ApiCepService.validarCEP(claveRastreo, montoEsperado);
  },
};
