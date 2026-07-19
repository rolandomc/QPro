-- Backfill de notificaciones de resultado para quinielas finalizadas
-- Inserta SOLO faltantes (ON CONFLICT DO NOTHING)

WITH ranked AS (
  SELECT
    p.id AS participacion_id,
    p.user_id,
    p.quiniela_id,
    COALESCE(p.aciertos, 0) AS aciertos,
    p.estado,
    COALESCE(p.premio_ganado, 0) AS premio_ganado,
    q.titulo,
    ROW_NUMBER() OVER (
      PARTITION BY p.quiniela_id
      ORDER BY
        COALESCE(p.aciertos, 0) DESC,
        COALESCE(p.total_goles_predichos, 0) DESC,
        p.created_at ASC,
        p.id
    ) AS pos
  FROM public.participaciones p
  JOIN public.quinielas q ON q.id = p.quiniela_id
  WHERE q.estado = 'finalizada'
    AND p.user_id IS NOT NULL
    AND p.estado IN ('ganador', 'perdedor')
),
ins_ganador AS (
  INSERT INTO public.notificaciones (
    user_id,
    tipo,
    titulo,
    mensaje,
    leida,
    referencia_id,
    referencia_tipo
  )
  SELECT
    r.user_id,
    'ganador',
    '🏆 ¡Ganaste en ' || r.titulo || '!',
    'Terminaste en la posición #' || r.pos::text ||
      ' con ' || r.aciertos || ' acierto' || CASE WHEN r.aciertos = 1 THEN '' ELSE 's' END ||
      '. Premio: $' || TO_CHAR(r.premio_ganado, 'FM999G999G999G990D00') || '.',
    false,
    r.participacion_id::text,
    'participacion_premio'
  FROM ranked r
  WHERE r.estado = 'ganador'
  ON CONFLICT DO NOTHING
  RETURNING id
),
ins_perdedor AS (
  INSERT INTO public.notificaciones (
    user_id,
    tipo,
    titulo,
    mensaje,
    leida,
    referencia_id,
    referencia_tipo
  )
  SELECT
    r.user_id,
    'perdedor',
    '📉 Resultado en ' || r.titulo,
    'Terminaste en la posición #' || r.pos::text ||
      ' con ' || r.aciertos || ' acierto' || CASE WHEN r.aciertos = 1 THEN '' ELSE 's' END ||
      '. Esta vez no alcanzó premio. ¡Suerte en la próxima!',
    false,
    r.participacion_id::text,
    'participacion_resultado'
  FROM ranked r
  WHERE r.estado = 'perdedor'
  ON CONFLICT DO NOTHING
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM ins_ganador) AS notifs_ganador_insertadas,
  (SELECT COUNT(*) FROM ins_perdedor) AS notifs_perdedor_insertadas;