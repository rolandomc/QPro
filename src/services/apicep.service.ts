/**
 * apiCEP Service
 * Valida un comprobante SPEI usando OCR + Banxico vía apiCEP.
 * Docs: https://www.apicep.cloud
 *
 * El flujo correcto:
 *  1. El usuario sube la imagen del comprobante a Supabase Storage
 *  2. Se envía la URL de la imagen a POST /validate-transfer
 *  3. apiCEP hace OCR, extrae clave de rastreo, monto, fecha y valida contra Banxico
 *  4. Si válido y beneficiario coincide → pago confirmado
 *
 * Variables de entorno necesarias en .env:
 *   EXPO_PUBLIC_APICEP_API_KEY   = apicep_665deccc1cb8f1a87b05e7f58850c31150cd4ce778a04a7f08af2bae8e9799f3
 *   EXPO_PUBLIC_CLABE_DESTINO    = tu CLABE de 18 dígitos
 */

const APICEP_BASE = 'https://api.apicep.cloud';

export interface CepExtracted {
  senderBank?:    string;
  receiverBank?:  string;
  trackingKey:    string;   // clave de rastreo extraída por OCR
  referenceNumber?: string;
  amount:         number;   // en pesos
  date:           string;   // ISO date
  paymentConcept?: string;
}

export interface CepResult {
  claveRastreo:       string;
  monto:              number;
  emisor:             string;
  receptor:           string;
  fechaOperacion:     string;
  estado:             'LIQUIDADA' | 'DEVUELTA' | string;
  cuentaBeneficiario: string;
}

export interface ValidarResult {
  valid:       boolean;
  cep?:        CepResult;
  extracted?:  CepExtracted;
  confidence?: number;
  errorMsg?:   string;
}

export const ApiCepService = {
  /**
   * Valida un comprobante SPEI enviando la imagen (URL pública) a apiCEP.
   * apiCEP hace OCR sobre la imagen, extrae los datos y valida contra Banxico.
   *
   * @param imageUrl      URL pública de la imagen del comprobante (Supabase Storage)
   * @param montoEsperado Monto que debe haberse pagado (en pesos MXN)
   */
  async validarComprobante(imageUrl: string, montoEsperado: number): Promise<ValidarResult> {
    const apiKey      = process.env.EXPO_PUBLIC_APICEP_API_KEY;
    const clabe       = process.env.EXPO_PUBLIC_CLABE_DESTINO ?? '';

    if (!apiKey) return { valid: false, errorMsg: 'EXPO_PUBLIC_APICEP_API_KEY no configurada' };
    if (!clabe)  return { valid: false, errorMsg: 'EXPO_PUBLIC_CLABE_DESTINO no configurada' };

    try {
      const res = await fetch(`${APICEP_BASE}/validate-transfer`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          beneficiary: { clabe },
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        return { valid: false, errorMsg: json.message ?? `apiCEP error ${res.status}` };
      }

      // Respuesta exitosa de apiCEP
      const extracted: CepExtracted = json.extracted;
      const status: string          = json.status;      // 'valid' | 'invalid' | ...
      const confidence: number      = json.confidence ?? 1;

      if (status !== 'valid') {
        return {
          valid:      false,
          extracted,
          confidence,
          errorMsg:   json.message ?? 'Comprobante no válido según apiCEP',
        };
      }

      if (extracted.amount < montoEsperado) {
        return {
          valid:      false,
          extracted,
          confidence,
          errorMsg:   `Monto insuficiente. Esperado: $${montoEsperado} MXN, recibido: $${extracted.amount} MXN`,
        };
      }

      // Construimos CepResult compatible con el resto del código
      const cep: CepResult = {
        claveRastreo:       extracted.trackingKey,
        monto:              extracted.amount,
        emisor:             extracted.senderBank   ?? '',
        receptor:           extracted.receiverBank ?? '',
        fechaOperacion:     extracted.date,
        estado:             'LIQUIDADA',
        cuentaBeneficiario: clabe,
      };

      return { valid: true, cep, extracted, confidence };

    } catch (e: any) {
      return { valid: false, errorMsg: e.message ?? 'Error al consultar apiCEP' };
    }
  },

  /** @deprecated Usar validarComprobante(imageUrl, monto) en su lugar */
  async validarCEP(claveRastreo: string, montoEsperado: number): Promise<ValidarResult> {
    return { valid: false, errorMsg: 'Método obsoleto. Usa validarComprobante() con la URL del comprobante.' };
  },

  /** @deprecated Alias obsoleto */
  async validarPago(claveRastreo: string, montoEsperado: number): Promise<ValidarResult> {
    return ApiCepService.validarCEP(claveRastreo, montoEsperado);
  },
};
