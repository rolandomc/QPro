/**
 * apiCEP Service
 * Valida comprobantes SPEI contra Banxico vía apiCEP.
 * Docs: https://www.apicep.cloud
 *
 * Variables de entorno requeridas:
 *   EXPO_PUBLIC_APICEP_API_KEY  — tu API key de apiCEP
 *   EXPO_PUBLIC_CLABE_DESTINO   — tu CLABE personal para recibir transferencias
 */

const APICEP_BASE = 'https://api.apicep.cloud/v1';

export interface CepValidationResult {
  valid: boolean;
  amount?: number;
  sender?: string;
  trackingKey?: string;
  date?: string;
  errorMsg?: string;
}

export const ApiCepService = {
  /**
   * Valida una clave de rastreo SPEI (CEP) contra Banxico.
   * Devuelve si el pago es válido, el monto y el emisor.
   */
  async validarCEP(claveRastreo: string, monto: number): Promise<CepValidationResult> {
    const apiKey = process.env.EXPO_PUBLIC_APICEP_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_APICEP_API_KEY no configurada');

    try {
      const res = await fetch(`${APICEP_BASE}/cep/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          tracking_key: claveRastreo.trim(),
          amount: monto,
          destination_clabe: process.env.EXPO_PUBLIC_CLABE_DESTINO,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        return { valid: false, errorMsg: json.message ?? 'No se pudo validar el comprobante' };
      }

      return {
        valid:       json.valid === true,
        amount:      json.amount,
        sender:      json.sender_name,
        trackingKey: json.tracking_key,
        date:        json.operation_date,
        errorMsg:    json.valid ? undefined : 'El comprobante no coincide con el pago esperado',
      };
    } catch (e: any) {
      return { valid: false, errorMsg: e.message ?? 'Error de red al validar CEP' };
    }
  },
};
