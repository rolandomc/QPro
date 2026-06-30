/**
 * SPEI Service — flujo con comprobante + OCR automático
 *
 * Flujo completo:
 *  1. registrarIntencionSPEI  — marca participación 'spei_pendiente'
 *  2. subirComprobante        — sube imagen a Supabase Storage → guarda URL
 *  3. validarYConfirmar       — llama Edge Function `validar-spei` (server-side)
 *                               que invoca apiCEP con OCR y valida contra Banxico
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { ApiCepService } from './apicep.service';

function pickFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const SpeiService = {
  async registrarIntencionSPEI(participacionId: string): Promise<void> {
    const { error } = await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente', metodo_pago: 'spei' })
      .eq('id', participacionId);
    if (error) throw error;
  },

  async subirComprobante(participacionId: string): Promise<string | null> {
    let path: string;
    let mime: string;
    let fileData: ArrayBuffer;

    if (Platform.OS === 'web') {
      const file = await pickFileWeb();
      if (!file) return null;
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      mime       = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
      path       = `spei/${participacionId}_${Date.now()}.${ext}`;
      fileData   = await file.arrayBuffer();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Necesitas dar permiso para acceder a tu galería.');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality:    0.9,
        base64:     true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];
      const ext   = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      mime        = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      path        = `spei/${participacionId}_${Date.now()}.${ext}`;
      fileData    = decode(asset.base64!);
    }

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(path, fileData, { contentType: mime, upsert: true });

    if (uploadError) throw new Error(`Error al subir comprobante: ${uploadError.message}`);

    const { data: signedData } = await supabase.storage
      .from('comprobantes')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    const url = signedData?.signedUrl ?? path;

    await supabase
      .from('participaciones')
      .update({
        comprobante_url:        url,
        comprobante_enviado_at: new Date().toISOString(),
      })
      .eq('id', participacionId);

    return url;
  },

  async validarYConfirmar(
    participacionId: string,
    comprobanteUrl:  string,
    monto:           number,
  ) {
    const result = await ApiCepService.validarComprobante(
      participacionId,
      comprobanteUrl,
      monto,
    );

    // Si la Edge Function dio error de red, puede que igual haya procesado y aprobado en el servidor.
    // Esperamos 4s para que termine de escribir en BD y luego consultamos el estado real.
    let estadoReal: string | null = null;
    if (!result.valid) {
      await sleep(4000);
      const { data: part } = await supabase
        .from('participaciones')
        .select('estado, comprobante_validado')
        .eq('id', participacionId)
        .single();
      estadoReal = part?.estado ?? null;
    }

    const aprobado   = result.valid || estadoReal === 'pagado';
    const enRevision = !aprobado && (
      estadoReal === 'spei_pendiente' ||
      result.errorMsg?.toLowerCase().includes('manual') ||
      (result.missingFields?.length ?? 0) > 0
    );

    if (aprobado) {
      await SpeiService.notificarUsuario(
        participacionId,
        '✅ Pago confirmado',
        'Tu transferencia SPEI fue validada exitosamente. ¡Ya estás dentro de la quiniela!',
      );
    } else if (enRevision) {
      await SpeiService.notificarUsuario(
        participacionId,
        '⏳ Comprobante en revisión',
        'No pudimos validar tu comprobante automáticamente. Un administrador lo revisará en breve (15–60 min).',
      );
    } else {
      await SpeiService.notificarUsuario(
        participacionId,
        '❌ Comprobante rechazado',
        result.errorMsg ?? 'Tu comprobante no pudo ser validado. Contacta a soporte si crees que es un error.',
      );
    }

    // Solo notificar al admin si realmente no fue aprobado en BD
    if (!aprobado) {
      await SpeiService.notificarAdmin(
        participacionId,
        result.errorMsg ?? 'Validación fallida',
      );
    }

    return result;
  },

  async notificarUsuario(
    participacionId: string,
    titulo: string,
    mensaje: string,
  ): Promise<void> {
    const { data: part } = await supabase
      .from('participaciones')
      .select('user_id')
      .eq('id', participacionId)
      .single();
    if (!part?.user_id) return;

    await supabase.from('notificaciones').insert({
      user_id: part.user_id,
      tipo:    'spei',
      titulo,
      mensaje,
      leida:   false,
    });
  },

  async marcarPendienteRevision(participacionId: string, motivo?: string): Promise<void> {
    const msg = motivo ?? 'Comprobante no procesable por OCR — revisión manual requerida';
    await supabase
      .from('participaciones')
      .update({
        estado:               'spei_pendiente',
        comprobante_validado: false,
        ultimo_error_spei:    msg,
      })
      .eq('id', participacionId);
    await SpeiService.notificarAdmin(participacionId, msg);
  },

  async notificarAdmin(participacionId: string, mensaje: string): Promise<void> {
    await supabase.from('admin_notificaciones').insert({
      tipo:             'spei_pendiente',
      participacion_id: participacionId,
      mensaje,
      leida:            false,
      created_at:       new Date().toISOString(),
    });
  },
};
