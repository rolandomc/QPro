import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const APICEP_BASE = 'https://api.apicep.cloud';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { participacion_id, comprobante_url, monto } = await req.json();

    if (!participacion_id || !comprobante_url || !monto) {
      return Response.json({ valid: false, errorMsg: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Obtener precio_entrada real de la quiniela (fuente de verdad) ──────
    const { data: part } = await supabase
      .from('participaciones')
      .select('quiniela_id')
      .eq('id', participacion_id)
      .single();

    const { data: quiniela } = part?.quiniela_id
      ? await supabase
          .from('quinielas')
          .select('precio_entrada')
          .eq('id', part.quiniela_id)
          .single()
      : { data: null };

    // precio_entrada de BD tiene prioridad; el `monto` del cliente es fallback
    const montoEsperado: number = quiniela?.precio_entrada
      ? Number(quiniela.precio_entrada)
      : Number(monto);

    const apiKey  = Deno.env.get('APICEP_API_KEY');
    const clabe   = Deno.env.get('CLABE_DESTINO');
    const banco   = Deno.env.get('BANCO_DESTINO')   ?? 'BBVA MEXICO';
    const titular = Deno.env.get('TITULAR_DESTINO') ?? 'Rolando Martinez';

    if (!apiKey) return Response.json({ valid: false, errorMsg: 'APICEP_API_KEY no configurada en Supabase' }, { status: 500 });
    if (!clabe)  return Response.json({ valid: false, errorMsg: 'CLABE_DESTINO no configurada en Supabase' }, { status: 500 });

    // ── Llamada a apiCEP ──────────────────────────────────────────────────
    const cepRes = await fetch(`${APICEP_BASE}/validate-transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        imageUrl: comprobante_url,
        beneficiary: {
          clabe,
          bank: banco,
          name: titular,
        },
      }),
    });

    const cepJson = await cepRes.json();

    if (!cepRes.ok) {
      const msg = cepJson.message ?? cepJson.error ?? `apiCEP HTTP ${cepRes.status}`;
      await actualizarError(supabase, participacion_id, msg);
      return Response.json({ valid: false, errorMsg: msg });
    }

    const status     = cepJson.status;
    const confidence = cepJson.confidence ?? 0;
    const extracted  = cepJson.extracted  ?? {};
    const validation = cepJson.validation ?? {};
    const downloads  = cepJson.downloads  ?? {};

    if (status === 'error') {
      const msg = cepJson.error ?? 'El OCR no pudo leer el comprobante. Intenta con una imagen más clara.';
      await actualizarError(supabase, participacion_id, msg);
      return Response.json({ valid: false, confidence, missingFields: cepJson.missingFields ?? [], errorMsg: msg });
    }

    if (status !== 'valid' || !validation.banxicoConfirmed) {
      const msg = `Transferencia no confirmada por Banxico (status: ${status})`;
      await actualizarError(supabase, participacion_id, msg);
      return Response.json({ valid: false, confidence, errorMsg: msg });
    }

    // ── Validación de monto con tolerancia del 5% ─────────────────────────
    // Si el OCR no pudo leer el monto (0 o null), confiamos en Banxico y no bloqueamos
    const montoOcr: number = extracted.amount ?? validation.cepDetails?.amount ?? 0;
    if (montoOcr > 0) {
      const tolerancia = montoEsperado * 0.05; // 5% de tolerancia por errores de OCR
      if (montoOcr < montoEsperado - tolerancia) {
        const msg = `Monto insuficiente. Esperado: $${montoEsperado} MXN, recibido: $${montoOcr} MXN`;
        await actualizarError(supabase, participacion_id, msg);
        return Response.json({ valid: false, confidence, errorMsg: msg });
      }
    }
    // Si montoOcr === 0: Banxico confirmó la transferencia pero OCR no leyó el monto;
    // se aprueba y se guarda el precio_entrada real como monto_pagado.

    // ✅ Válido — construir datos OCR para guardar en BD
    const cepD         = validation.cepDetails ?? {};
    const claveRastreo = extracted.trackingKey  ?? cepD.trackingKey    ?? '';
    const fechaPago    = extracted.date          ?? cepD.operationDate  ?? new Date().toISOString();

    const datosOcr: Record<string, string | number> = {};
    if (claveRastreo)                                    datosOcr['Clave rastreo']   = claveRastreo;
    if (montoOcr)                                        datosOcr['Monto OCR']       = `$${montoOcr} MXN`;
    datosOcr['Monto pagado']   = `$${montoEsperado} MXN`;
    if (fechaPago)                                       datosOcr['Fecha operación'] = fechaPago;
    if (extracted.senderBank   ?? cepD.senderBank)       datosOcr['Banco emisor']    = extracted.senderBank   ?? cepD.senderBank;
    if (extracted.receiverBank ?? cepD.receiverBank)     datosOcr['Banco receptor']  = extracted.receiverBank ?? cepD.receiverBank;
    if (extracted.senderName   ?? cepD.senderName)       datosOcr['Ordenante']       = extracted.senderName   ?? cepD.senderName;
    if (extracted.receiverName ?? cepD.receiverName)     datosOcr['Beneficiario']    = extracted.receiverName ?? cepD.receiverName;
    if (validation.cepStatus)                            datosOcr['Estado CEP']      = validation.cepStatus;
    if (confidence)                                      datosOcr['Confianza OCR']   = `${Math.round(confidence * 100)}%`;
    if (downloads.cepXml)                                datosOcr['CEP XML']         = downloads.cepXml;
    if (downloads.cepPdf)                                datosOcr['CEP PDF']         = downloads.cepPdf;

    // monto_pagado usa siempre precio_entrada de la quiniela (fuente de verdad)
    await supabase
      .from('participaciones')
      .update({
        estado:               'pagado',
        metodo_pago:          'spei',
        clave_rastreo:        claveRastreo,
        monto_pagado:         montoEsperado,   // ← precio_entrada real, nunca el OCR
        fecha_pago:           fechaPago,
        comprobante_validado: true,
        ultimo_error_spei:    null,
        spei_datos_ocr:       datosOcr,
      })
      .eq('id', participacion_id);

    return Response.json({
      valid: true,
      confidence,
      cep: {
        claveRastreo,
        monto:              montoEsperado,
        emisor:             extracted.senderBank   ?? cepD.senderBank   ?? '',
        receptor:           extracted.receiverBank ?? cepD.receiverBank ?? '',
        fechaOperacion:     fechaPago,
        estado:             validation.cepStatus   ?? 'LIQUIDADA',
        cuentaBeneficiario: clabe,
        cepXml:             downloads.cepXml,
        cepPdf:             downloads.cepPdf,
      },
    });

  } catch (e: any) {
    return Response.json({ valid: false, errorMsg: e.message ?? 'Error interno' }, { status: 500 });
  }
});

async function actualizarError(supabase: ReturnType<typeof createClient>, participacionId: string, msg: string) {
  try {
    await supabase
      .from('participaciones')
      .update({ ultimo_error_spei: msg, comprobante_validado: false })
      .eq('id', participacionId);
  } catch (_) {}
}
