/**
 * apiCEP Service
 * Valida un comprobante SPEI usando OCR + Banxico vía apiCEP.
 * Docs: https://www.apicep.cloud/documentacion
 *
 * Flujo:
 *  POST /validate-transfer con imageUrl + beneficiary (clabe, bank, name)
 *  apiCEP descarga la imagen, hace OCR, extrae clave de rastreo y valida contra Banxico.
 *
 * Variables de entorno requeridas:
 *   EXPO_PUBLIC_APICEP_API_KEY   = apicep_665deccc...
 *   EXPO_PUBLIC_CLABE_DESTINO    = CLABE de 18 dígitos
 *   EXPO_PUBLIC_BANCO_DESTINO    = Nombre exacto del banco (ej. "BBVA MEXICO")
 *   EXPO_PUBLIC_TITULAR_DESTINO  = Nombre del titular (ej. "Rolando Martinez")
 */

const APICEP_BASE = 'https://api.apicep.cloud';

export interface CepDetails {
  operationDate?:         string;
  processingDate?:        string;
  processingTime?:        string;
  trackingKey?:           string;
  senderBank?:            string;
  senderName?:            string;
  receiverBank?:          string;
  beneficiaryName?:       string;
  beneficiaryAccount?:    string;
  amount?:                number;
  paymentConcept?:        string;
  digitalSignature?:      string;
}

export interface CepResult {
  claveRastreo:       string;
  monto:              number;
  emisor:             string;
  receptor:           string;
  fechaOperacion:     string;
  estado:             'LIQUIDADA' | 'DEVUELTA' | string;
  cuentaBeneficiario: string;
  cepDetails?:        CepDetails;
  cepXml?:            string;
  cepPdf?:            string;
}

export interface ValidarResult {
  valid:          boolean;
  cep?:           CepResult;
  confidence?:    number;
  missingFields?: string[];
  errorMsg?:      string;
}

export const ApiCepService = {
  /**
   * Valida un comprobante SPEI enviando su URL a apiCEP.
   * apiCEP descarga la imagen, hace OCR, extrae los datos y valida contra Banxico.
   *
   * @param imageUrl      URL pública (o pre-firmada vigente) del PNG/JPG del comprobante
   * @param montoEsperado Monto que debe haberse pagado (MXN)
   */
  async validarComprobante(imageUrl: string, montoEsperado: number): Promise<ValidarResult> {
    const apiKey  = process.env.EXPO_PUBLIC_APICEP_API_KEY;
    const clabe   = process.env.EXPO_PUBLIC_CLABE_DESTINO   ?? '';
    const banco   = process.env.EXPO_PUBLIC_BANCO_DESTINO   ?? 'BBVA MEXICO';
    const titular = process.env.EXPO_PUBLIC_TITULAR_DESTINO ?? 'Rolando Martinez';

    if (!apiKey) return { valid: false, errorMsg: 'EXPO_PUBLIC_APICEP_API_KEY no configurada' };
    if (!clabe)  return { valid: false, errorMsg: 'EXPO_PUBLIC_CLABE_DESTINO no configurada' };

    try {
      const res = await fetch(`${APICEP_BASE}/validate-transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          beneficiary: {
            clabe,
            bank: banco,
            name: titular,
          },
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json.message ?? json.error ?? `apiCEP HTTP ${res.status}`;
        return { valid: false, errorMsg: msg };
      }

      const status:     string = json.status;
      const confidence: number = json.confidence ?? 0;
      const extracted          = json.extracted  ?? {};
      const validation         = json.validation ?? {};
      const downloads          = json.downloads  ?? {};

      if (status === 'error') {
        return {
          valid:         false,
          confidence,
          missingFields: json.missingFields ?? [],
          errorMsg:      json.error ?? 'El OCR no pudo leer el comprobante. Intenta con una imagen más clara.',
        };
      }

      if (status !== 'valid' || !validation.banxicoConfirmed) {
        return {
          valid:     false,
          confidence,
          errorMsg:  `Transferencia no confirmada por Banxico (status: ${status})`,
        };
      }

      const montoRecibido: number = extracted.amount ?? validation.cepDetails?.amount ?? 0;
      if (montoRecibido < montoEsperado) {
        return {
          valid:     false,
          confidence,
          errorMsg:  `Monto insuficiente. Esperado: $${montoEsperado} MXN, recibido: $${montoRecibido} MXN`,
        };
      }

      const cepD = validation.cepDetails ?? {};
      const cep: CepResult = {
        claveRastreo:       extracted.trackingKey   ?? cepD.trackingKey   ?? '',
        monto:              montoRecibido,
        emisor:             extracted.senderBank    ?? cepD.senderBank    ?? '',
        receptor:           extracted.receiverBank  ?? cepD.receiverBank  ?? '',
        fechaOperacion:     extracted.date          ?? cepD.operationDate ?? '',
        estado:             validation.cepStatus    ?? 'LIQUIDADA',
        cuentaBeneficiario: clabe,
        cepDetails:         cepD,
        cepXml:             downloads.cepXml,
        cepPdf:             downloads.cepPdf,
      };

      return { valid: true, cep, confidence };

    } catch (e: any) {
      return { valid: false, errorMsg: e.message ?? 'Error al conectar con apiCEP' };
    }
  },
};
