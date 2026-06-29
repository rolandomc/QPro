/**
 * SPEI Service — flujo con comprobante
 *
 * Flujo completo:
 *  1. registrarIntencionSPEI  — guarda picks y marca participación 'spei_pendiente'
 *  2. subirComprobante        — abre picker → sube a Supabase Storage → guarda URL
 *  3. validarYConfirmar       — llama apiCEP con clave de rastreo; si válido → 'pagado'
 *  4. notificarAdmin          — inserta notificación para revisión manual si apiCEP falla
 *
 * ⚠️  Variable de entorno requerida:
 *      EXPO_PUBLIC_APICEP_API_KEY=apicep_665deccc1cb8f1a87b05e7f58850c31150cd4ce778a04a7f08af2bae8e9799f3
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { ApiCepService } from './apicep.service';

/**
 * Prefijos de claves de rastreo que NO pertenecen al sistema CEP de Banxico.
 * Estas claves son generadas por wallets/fintechs y no pueden consultarse en apiCEP.
 * El pago debe revisarse manualmente.
 */
const PREFIJOS_NO_CEP = ['REVO', 'CLBE', 'SPIN', 'PREX', 'NVIO', 'MPIN', 'CUEN'];

/**
 * Devuelve true si la clave de rastreo pertenece al sistema CEP de Banxico
 * y puede consultarse con apiCEP.
 */
function esClaveCEPConsultable(clave: string): boolean {
  if (!clave || clave.trim().length === 0) return false;
  const upper = clave.trim().toUpperCase();
  return !PREFIJOS_NO_CEP.some((prefix) => upper.startsWith(prefix));
}

/** Abre un <input type="file"> nativo en web y devuelve el archivo seleccionado */
function pickFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/xml,text/xml';
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
   * Devuelve la URL firmada o null si el usuario canceló.
   */
  async subirComprobante(participacionId: string): Promise<string | null> {
    let path: string;
    let mime: string;
    let fileData: ArrayBuffer;

    if (Platform.OS === 'web') {
      const file = await pickFileWeb();
      if (!file) return null;

      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      mime       = file.type || (ext === 'xml' ? 'application/xml' : 'image/jpeg');
      path       = `spei/${participacionId}_${Date.now()}.${ext}`;
      fileData   = await file.arrayBuffer();
    } else {
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
   * - Si la clave NO es consultable en CEP (ej. Revolut REVO...) → revisión manual
   * - Si válido   → estado = 'pagado'  + graba datos CEP
   * - Si inválido → estado sigue 'spei_pendiente', guarda último error e inserta notif admin
   */
  async validarYConfirmar(
    participacionId: string,
    claveRastreo:    string,
    monto:           number,
  ) {
    // ── Detección de clave no-CEP (Revolut, otros fintechs) ──────────────────
    if (!esClaveCEPConsultable(claveRastreo)) {
      const prefijo = claveRastreo.trim().substring(0, 4).toUpperCase();
      const msg = `Clave de rastreo con prefijo '${prefijo}' no consultable en CEP/Banxico. Revisión manual requerida.`;

      await supabase
        .from('participaciones')
        .update({
          estado:               'spei_pendiente',
          clave_rastreo:        claveRastreo,
          comprobante_validado: false,
          ultimo_error_spei:    msg,
        })
        .eq('id', participacionId);

      await SpeiService.notificarAdmin(participacionId, msg);

      return { valid: false, errorMsg: msg, requiereRevisionManual: true };
    }

    // ── Validación normal con apiCEP ──────────────────────────────────────────
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
   * Cuando el usuario sube comprobante sin clave de rastreo,
   * deja la participación en 'spei_pendiente' para revisión manual del admin.
   */
  async marcarPendienteRevision(participacionId: string): Promise<void> {
    await supabase
      .from('participaciones')
      .update({ estado: 'spei_pendiente', comprobante_validado: false })
      .eq('id', participacionId);
    await SpeiService.notificarAdmin(
      participacionId,
      'Comprobante subido sin clave de rastreo — revisión manual requerida',
    );
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
