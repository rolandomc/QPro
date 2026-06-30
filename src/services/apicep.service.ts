/**
 * apiCEP Service — cliente
 *
 * NO llama a apiCEP directamente (la API key no puede estar en el cliente).
 * Delega todo a la Edge Function `validar-spei` en Supabase,
 * que tiene la key segura en variables de entorno del servidor.
 */
import { supabase } from '../config/supabase';

export interface CepResult {
  claveRastreo:       string;
  monto:              number;
  emisor:             string;
  receptor:           string;
  fechaOperacion:     string;
  estado:             string;
  cuentaBeneficiario: string;
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
   * Valida un comprobante SPEI invocando la Edge Function `validar-spei`.
   * La Edge Function llama a apiCEP con la key segura en el servidor.
   *
   * @param participacionId  ID de la participación a actualizar en BD
   * @param imageUrl         URL pre-firmada del PNG/JPG del comprobante en Storage
   * @param montoEsperado    Monto que debe haberse pagado (MXN)
   */
  async validarComprobante(
    participacionId: string,
    imageUrl:        string,
    montoEsperado:   number,
  ): Promise<ValidarResult> {
    const { data, error } = await supabase.functions.invoke('validar-spei', {
      body: {
        participacion_id: participacionId,
        comprobante_url:  imageUrl,
        monto:            montoEsperado,
      },
    });

    if (error) {
      return { valid: false, errorMsg: error.message ?? 'Error al invocar validar-spei' };
    }

    return data as ValidarResult;
  },
};

// v2
