/**
 * SPEI Service — flujo con comprobante + OCR automático
 *
 * Flujo completo:
 *  1. registrarIntencionSPEI  — guarda picks y marca participación 'spei_pendiente'
 *  2. subirComprobante        — abre picker → sube a Supabase Storage → guarda URL
 *  3. validarYConfirmar       — envía URL a apiCEP; el OCR extrae la clave de rastreo
 *                               y valida contra Banxico automáticamente
 *  4. notificarAdmin          — inserta notificación para revisión manual si apiCEP falla
 *
 * ⚠️  Variables de entorno requeridas:
 *      EXPO_PUBLIC_APICEP_API_KEY  = apicep_665deccc1cb8f1a87b05e7f58850c31150cd4ce778a04a7f08af2bae8e9799f3
 *      EXPO_PUBLIC_CLABE_DESTINO   = tu CLABE de 18 dígitos
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { ApiCepService } from './apicep.service';

/** Abre un <input type="file"> nativo en web y devuelve el archivo seleccionado */
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
   * Abre el picker de imágenes/documentos, sube a Supabase Storage
   * y guarda la URL en la participación.
   * Devuelve la URL pública firmada o null si el usuario canceló.
   */
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
      if (status !== 'granted') {
        throw new Error('Necesitas dar permiso para acceder a tu galería.');
      }

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

    // URL firmada con 7 días de vigencia — suficiente para que apiCEP la descargue
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

  /**
   * Valida el comprobante enviando su URL a apiCEP.
   * apiCEP hace OCR sobre la imagen, extrae la clave de rastreo y valida contra Banxico.
   *
   * - Si válido   → estado = 'pagado' + graba clave de rastreo y datos CEP
   * - Si inválido → estado sigue 'spei_pendiente', guarda último error + notifica admin
   */
  async validarYConfirmar(
    participacionId: string,
    comprobanteUrl:  string,   // URL de la imagen en Storage
    monto:           number,
  ) {
    const result = await ApiCepService.validarComprobante(comprobanteUrl, monto);

    if (result.valid && result.cep) {
      const { error } = await supabase
        .from('participaciones')
        .update({
          estado:               'pagado',
          metodo_pago:          'spei',
          clave_rastreo:        result.cep.claveRastreo,
          monto_pagado:         result.cep.monto,
          fecha_pago:           result.cep.fechaOperacion,
          comprobante_validado: true,
          ultimo_error_spei:    null,
        })
        .eq('id', participacionId);
      if (error) throw error;
    } else {
      await supabase
        .from('participaciones')
        .update({
          ultimo_error_spei:    result.errorMsg ?? 'Validación fallida',
          comprobante_validado: false,
        })
        .eq('id', participacionId);

      await SpeiService.notificarAdmin(
        participacionId,
        result.errorMsg ?? 'Validación fallida',
      );
    }

    return result;
  },

  /**
   * Cuando el OCR de apiCEP no puede procesar el comprobante,
   * deja la participación en 'spei_pendiente' para revisión manual del admin.
   */
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

  /** Inserta una notificación en la tabla admin_notificaciones */
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
