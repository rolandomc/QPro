-- Backfill: reembolsos históricos a wallet_transactions + notificaciones
-- Caso cubierto: participaciones ya marcadas como reembolsado que nunca se reflejaron en wallet del usuario.

INSERT INTO wallet_transactions (
  user_id,
  tipo,
  monto,
  descripcion,
  referencia_id
)
SELECT
  p.user_id,
  'ajuste_admin',
  COALESCE(NULLIF(p.monto_pagado, 0), q.precio_entrada) AS monto,
  'Reembolso: quiniela "' || q.titulo || '" anulada por no alcanzar el mínimo de jugadores',
  p.id
FROM participaciones p
JOIN quinielas q ON q.id = p.quiniela_id
LEFT JOIN wallet_transactions wt
  ON wt.referencia_id = p.id
 AND wt.tipo IN ('reembolso', 'ajuste_admin')
WHERE p.estado = 'reembolsado'
  AND p.user_id IS NOT NULL
  AND wt.id IS NULL;

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
  p.user_id,
  'reembolso',
  '💸 Reembolso acreditado',
  'La quiniela "' || q.titulo || '" fue anulada por no alcanzar el mínimo de jugadores. Se te reembolsaron $' || COALESCE(NULLIF(p.monto_pagado, 0), q.precio_entrada) || ' MXN a tu wallet.',
  false,
  p.id::text,
  'participacion_reembolso'
FROM participaciones p
JOIN quinielas q ON q.id = p.quiniela_id
LEFT JOIN notificaciones n
  ON n.user_id = p.user_id
 AND n.tipo = 'reembolso'
 AND n.referencia_id = p.id::text
 AND n.referencia_tipo = 'participacion_reembolso'
WHERE p.estado = 'reembolsado'
  AND p.user_id IS NOT NULL
  AND n.id IS NULL;