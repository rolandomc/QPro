-- Compatibilidad legacy: sincronizar reembolsos de wallet_movimientos -> wallet_transactions + notificaciones
-- Evita que un flujo viejo deje saldos/notificaciones desincronizados.

-- 1) Backfill inmediato de movimientos legacy ya creados
WITH legacy AS (
  SELECT
    wm.id              AS wm_id,
    wm.user_id,
    wm.monto,
    wm.descripcion,
    wm.quiniela_id,
    wm.created_at,
    p.id               AS participacion_id
  FROM wallet_movimientos wm
  LEFT JOIN participaciones p
    ON p.quiniela_id = wm.quiniela_id
   AND p.user_id = wm.user_id
   AND p.estado = 'reembolsado'
  WHERE wm.tipo = 'reembolso'
)
INSERT INTO wallet_transactions (
  user_id,
  tipo,
  monto,
  descripcion,
  referencia_id,
  created_at
)
SELECT
  l.user_id,
  'ajuste_admin',
  l.monto,
  l.descripcion,
  l.participacion_id,
  l.created_at
FROM legacy l
LEFT JOIN wallet_transactions wt
  ON wt.user_id = l.user_id
 AND wt.tipo IN ('reembolso', 'ajuste_admin')
 AND (
   (l.participacion_id IS NOT NULL AND wt.referencia_id = l.participacion_id)
   OR
   (l.participacion_id IS NULL AND wt.descripcion = l.descripcion AND wt.monto = l.monto)
 )
WHERE wt.id IS NULL;

WITH legacy AS (
  SELECT
    wm.id              AS wm_id,
    wm.user_id,
    wm.monto,
    wm.quiniela_id,
    q.titulo,
    p.id               AS participacion_id
  FROM wallet_movimientos wm
  LEFT JOIN quinielas q
    ON q.id = wm.quiniela_id
  LEFT JOIN participaciones p
    ON p.quiniela_id = wm.quiniela_id
   AND p.user_id = wm.user_id
   AND p.estado = 'reembolsado'
  WHERE wm.tipo = 'reembolso'
)
INSERT INTO notificaciones (
  user_id,
  tipo,
  titulo,
  mensaje,
  leida,
  referencia_id,
  referencia_tipo
)
SELECT
  l.user_id,
  'reembolso',
  '💸 Reembolso acreditado',
  'La quiniela "' || COALESCE(l.titulo, 'sin título') || '" fue anulada por no alcanzar el mínimo de jugadores. Se te reembolsaron $' || l.monto || ' MXN a tu wallet.',
  false,
  COALESCE(l.participacion_id::text, l.wm_id::text),
  CASE WHEN l.participacion_id IS NOT NULL THEN 'participacion_reembolso' ELSE 'legacy_wallet_reembolso' END
FROM legacy l
LEFT JOIN notificaciones n
  ON n.user_id = l.user_id
 AND n.tipo = 'reembolso'
 AND n.referencia_id = COALESCE(l.participacion_id::text, l.wm_id::text)
 AND n.referencia_tipo = CASE WHEN l.participacion_id IS NOT NULL THEN 'participacion_reembolso' ELSE 'legacy_wallet_reembolso' END
WHERE n.id IS NULL;

-- 2) Trigger para futuros inserts legacy
CREATE OR REPLACE FUNCTION sync_wallet_movimientos_reembolso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participacion_id UUID;
  v_titulo TEXT;
BEGIN
  IF NEW.tipo <> 'reembolso' THEN
    RETURN NEW;
  END IF;

  SELECT p.id
    INTO v_participacion_id
    FROM participaciones p
   WHERE p.quiniela_id = NEW.quiniela_id
     AND p.user_id = NEW.user_id
   ORDER BY p.created_at DESC
   LIMIT 1;

  INSERT INTO wallet_transactions (
    user_id,
    tipo,
    monto,
    descripcion,
    referencia_id,
    created_at
  )
  SELECT
    NEW.user_id,
    'ajuste_admin',
    NEW.monto,
    NEW.descripcion,
    v_participacion_id,
    NEW.created_at
  WHERE NOT EXISTS (
    SELECT 1
      FROM wallet_transactions wt
     WHERE wt.user_id = NEW.user_id
       AND wt.tipo IN ('reembolso', 'ajuste_admin')
       AND (
         (v_participacion_id IS NOT NULL AND wt.referencia_id = v_participacion_id)
         OR
         (v_participacion_id IS NULL AND wt.descripcion = NEW.descripcion AND wt.monto = NEW.monto)
       )
  );

  SELECT q.titulo INTO v_titulo FROM quinielas q WHERE q.id = NEW.quiniela_id;

  INSERT INTO notificaciones (
    user_id,
    tipo,
    titulo,
    mensaje,
    leida,
    referencia_id,
    referencia_tipo
  )
  SELECT
    NEW.user_id,
    'reembolso',
    '💸 Reembolso acreditado',
    'La quiniela "' || COALESCE(v_titulo, 'sin título') || '" fue anulada por no alcanzar el mínimo de jugadores. Se te reembolsaron $' || NEW.monto || ' MXN a tu wallet.',
    false,
    COALESCE(v_participacion_id::text, NEW.id::text),
    CASE WHEN v_participacion_id IS NOT NULL THEN 'participacion_reembolso' ELSE 'legacy_wallet_reembolso' END
  WHERE NOT EXISTS (
    SELECT 1
      FROM notificaciones n
     WHERE n.user_id = NEW.user_id
       AND n.tipo = 'reembolso'
       AND n.referencia_id = COALESCE(v_participacion_id::text, NEW.id::text)
       AND n.referencia_tipo = CASE WHEN v_participacion_id IS NOT NULL THEN 'participacion_reembolso' ELSE 'legacy_wallet_reembolso' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_movimientos_reembolso ON wallet_movimientos;
CREATE TRIGGER trg_sync_wallet_movimientos_reembolso
AFTER INSERT ON wallet_movimientos
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_movimientos_reembolso();
