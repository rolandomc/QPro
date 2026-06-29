/**
 * SPEI Service — flujo con comprobante
 *
 * Flujo completo:
 *  1. registrarIntencionSPEI  — guarda picks y marca participación 'spei_pendiente'
 *  2. subirComprobante        — abre picker → sube a Supabase Storage → guarda URL
 *  3. validarYConfirmar       — llama apiCEP con clave de rastreo; si válido → 'pagado'
 *  4. notificarAdmin          — inserta notificación para revisión manual si apiCEP falla
 */
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
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
   * Abre el picker de imágenes/documentos, sube a Supabase Storage
   * y guarda la URL en la participación.
   * Devuelve la URL pública firmada o null si el usuario canceló.
   */
  async subirComprobante(participacionId: string): Promise<string | null> {
    let path: string;
    let mime: string;
    let fileData: ArrayBuffer;

    if (Platform.OS === 'web') {
      // En web usamos DocumentPicker para aceptar XML e imágenes
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/xml', 'text/xml'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return null;

      const asset  = result.assets[0];
      const ext    = asset.name?.split('.').pop()?.toLowerCase() ?? 'jpg';
      mime         = asset.mimeType ?? (ext === 'xml' ? 'application/xml' : 'image/jpeg');
      path         = `spei/${participacionId}_${Date.now()}.${ext}`;

      // Fetch the local URI to get ArrayBuffer
      const response = await fetch(asset.uri);
      fileData       = await response.arrayBuffer();
    } else {
      // En nativo usamos ImagePicker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Necesitas dar permiso para acceder a tu galería.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality:    0.85,
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

    // URL firmada válida por 7 días
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
   * Valida el pago con apiCEP.
   * - Si válido   → estado = 'pagado'  + graba datos CEP
   * - Si inválido → estado sigue 'spei_pendiente', guarda último error e inserta notif admin
   */
  async validarYConfirmar(
    participacionId: string,
    claveRastreo:    string,
    monto:           number,
  ) {
    const result = await ApiCepService.validarCEP(claveRastreo, monto);

    if (result.valid && result.cep) {
      const { error } = await supabase
        .from('participaciones')
        .update({
          estado:               'pagado',
          metodo_pago:          'spei',
          clave_rastreo:        claveRastreo,
          monto_pagado:         result.cep.monto,
          fecha_pago:           result.cep.fechaOperacion,
          comprobante_validado: true,
          ultimo_error_spei:    null,
        })
        .eq('id', participacionId);
      if (error) throw error;
    } else {
      // Guarda el error y notifica al admin para revisión manual
      await supabase
        .from('participaciones')
        .update({
          ultimo_error_spei:    result.errorMsg,
          comprobante_validado: false,
        })
        .eq('id', participacionId);

      await SpeiService.notificarAdmin(participacionId, result.errorMsg ?? 'Validación fallida');
    }

    return result;
  },

  /**
   * Cuando el usuario sube comprobante sin clave de rastreo
   * queda en 'spei_pendiente' para revisión manual del admin.
   */
  async marcarPendienteRevision(participacionId: string): Promise<void> {
    await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente', comprobante_validado: false })
      .eq('id', participacionId);
    await SpeiService.notificarAdmin(participacionId, 'Comprobante subido sin clave de rastreo — revisión manual requerida');
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
    // Silencioso — no lanzamos error si la tabla no existe aún
  },
};
