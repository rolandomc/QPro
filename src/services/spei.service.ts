/**
 * SPEI Service
 * Flujo:
 *  1. registrarIntencionSPEI  — marca participación como 'spei_pendiente'
 *  2. subirComprobante        — sube imagen a Supabase Storage
 *  3. validarYConfirmar       — llama apiCEP con clave rastreo; si válido → 'pagado'
 *  4. notificarAdminPendiente — cuando el usuario no tiene clave, manda registro para revisión manual
 */
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { ApiCepService } from './apicep.service';

export const SpeiService = {
  /** Marca la participación como spei_pendiente */
  async registrarIntencionSPEI(participacionId: string): Promise<void> {
    const { error } = await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente', metodo_pago: 'spei' })
      .eq('id', participacionId);
    if (error) throw error;
  },

  /**
   * Abre el picker de imágenes, sube el archivo a Supabase Storage
   * y guarda la URL en la participación.
   * Devuelve la URL pública firmada (o null si el usuario canceló).
   */
  async subirComprobante(participacionId: string): Promise<string | null> {
    // Pedir permiso
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Necesitas dar permiso para acceder a tu galería.');
    }

    // Abrir galería
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    const ext   = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime  = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const path  = `spei/${participacionId}_${Date.now()}.${ext}`;

    // Subir a Storage
    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(path, decode(asset.base64!), { contentType: mime, upsert: true });

    if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

    // URL firmada válida por 7 días (para que admin la vea)
    const { data: signedData } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    const url = signedData?.signedUrl ?? null;

    // Guardar URL y timestamp en la participación
    await supabase
      .from('participaciones')
      .update({
        comprobante_url:       url ?? path,
        comprobante_enviado_at: new Date().toISOString(),
      })
      .eq('id', participacionId);

    return url;
  },

  /**
   * Valida el comprobante con apiCEP y, si es válido, confirma la participación.
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
          estado:                'pagado',
          metodo_pago:           'spei',
          clave_rastreo:         claveRastreo,
          fecha_pago_spei:       new Date().toISOString(),
          comprobante_validado:  true,
        })
        .eq('id', participacionId);
      if (error) throw error;
    } else {
      // Guarda el último error para auditoría
      await supabase
        .from('participaciones')
        .update({
          ultimo_error_spei:    result.errorMsg,
          comprobante_validado: false,
        })
        .eq('id', participacionId);
    }

    return result;
  },

  /**
   * Cuando el usuario sube comprobante pero no tiene clave de rastreo,
   * deja la participación en 'spei_pendiente' para revisión manual del admin.
   * (El admin ve la imagen en el panel y puede aprobar manualmente.)
   */
  async marcarPendienteRevision(participacionId: string): Promise<void> {
    await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente' })
      .eq('id', participacionId);
  },
};
