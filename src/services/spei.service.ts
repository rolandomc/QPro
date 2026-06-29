/**
 * SPEI Service
 * Orquesta el flujo completo de pago por transferencia:
 *  1. Registra la intención de pago SPEI en Supabase
 *  2. Llama a apiCEP para validar el comprobante
 *  3. Confirma o rechaza la participación
 */
import { supabase } from '../config/supabase';
import { ApiCepService } from './apicep.service';

export const SpeiService = {
  /**
   * Guarda la intención de pago SPEI (estado = 'spei_pendiente').
   * Se llama cuando el usuario elige SPEI antes de transferir.
   */
  async registrarIntенcionSPEI(participacionId: string): Promise<void> {
    const { error } = await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente', metodo_pago: 'spei' })
      .eq('id', participacionId);
    if (error) throw error;
  },

  /**
   * Valida el comprobante CEP y, si es válido, confirma la participación.
   * Devuelve el resultado de la validación.
   */
  async validarYConfirmar(
    participacionId: string,
    claveRastreo: string,
    monto: number,
  ) {
    const result = await ApiCepService.validarCEP(claveRastreo, monto);

    if (result.valid) {
      const { error } = await supabase
        .from('participaciones')
        .update({
          estado:          'pagado',
          metodo_pago:     'spei',
          clave_rastreo:   claveRastreo,
          fecha_pago_spei: new Date().toISOString(),
        })
        .eq('id', participacionId);
      if (error) throw error;
    } else {
      // Guarda intento fallido para auditoría pero no bloquea
      await supabase
        .from('participaciones')
        .update({ ultimo_error_spei: result.errorMsg })
        .eq('id', participacionId);
    }

    return result;
  },
};
