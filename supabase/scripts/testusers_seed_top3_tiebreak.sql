-- Seed de testusers con picks + goles para desempate Top 1 / Top 3

-- 1) Crear participaciones pagadas para testusers en quiniela abierta activa
WITH quiniela_activa AS (
  SELECT id, precio_entrada
  FROM public.quinielas
  WHERE estado = 'abierta'
  ORDER BY created_at DESC
  LIMIT 1
),
usuarios_test AS (
  SELECT id
  FROM public.profiles
  WHERE username LIKE 'testuser%'
)
INSERT INTO public.participaciones (
  user_id,
  quiniela_id,
  monto_pagado,
  estado,
  fecha_pago,
  total_goles_predichos,
  created_at
)
SELECT
  u.id,
  q.id,
  q.precio_entrada,
  'pagado',
  now(),
  0,
  now()
FROM usuarios_test u
CROSS JOIN quiniela_activa q
WHERE NOT EXISTS (
  SELECT 1
  FROM public.participaciones p
  WHERE p.user_id = u.id
    AND p.quiniela_id = q.id
);

-- 2) Asegurar estado pagado para todos los testusers de esa quiniela
WITH quiniela_activa AS (
  SELECT id, precio_entrada
  FROM public.quinielas
  WHERE estado = 'abierta'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE public.participaciones p
SET
  estado = 'pagado',
  monto_pagado = q.precio_entrada,
  fecha_pago = now()
FROM quiniela_activa q, public.profiles pr
WHERE p.quiniela_id = q.id
  AND pr.id = p.user_id
  AND pr.username LIKE 'testuser%'
  AND p.estado <> 'pagado';

-- 3) Crear/actualizar selecciones con goles y recalcular total_goles_predichos
WITH quiniela_activa AS (
  SELECT id, COALESCE(deporte, 'futbol') AS deporte
  FROM public.quinielas
  WHERE estado = 'abierta'
  ORDER BY created_at DESC
  LIMIT 1
),
participaciones_test AS (
  SELECT
    p.id AS participacion_id,
    p.user_id,
    pr.username
  FROM public.participaciones p
  JOIN public.profiles pr ON pr.id = p.user_id
  JOIN quiniela_activa q ON q.id = p.quiniela_id
  WHERE pr.username LIKE 'testuser%'
    AND p.estado = 'pagado'
),
partidos_activos AS (
  SELECT
    pa.id AS partido_id,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(pa.orden, 999999), pa.fecha_partido, pa.id
    ) AS idx
  FROM public.partidos pa
  JOIN quiniela_activa q ON q.id = pa.quiniela_id
),
picks AS (
  SELECT
    pt.participacion_id,
    pa.partido_id,
    CASE
      WHEN q.deporte = 'beisbol' THEN
        CASE
          WHEN ((RIGHT(pt.username, 1)::int + pa.idx) % 2) = 0 THEN 'local'
          ELSE 'visitante'
        END
      ELSE
        CASE ((RIGHT(pt.username, 1)::int + pa.idx) % 3)
          WHEN 0 THEN 'local'
          WHEN 1 THEN 'empate'
          ELSE 'visitante'
        END
    END::text AS prediccion,
    CASE
      WHEN q.deporte = 'beisbol' THEN
        CASE WHEN ((RIGHT(pt.username, 1)::int + pa.idx) % 2) = 0 THEN 5 ELSE 3 END
      ELSE
        CASE ((RIGHT(pt.username, 1)::int + pa.idx) % 3)
          WHEN 0 THEN 2
          WHEN 1 THEN 1
          ELSE 0
        END
    END::int AS goles_local_predichos,
    CASE
      WHEN q.deporte = 'beisbol' THEN
        CASE WHEN ((RIGHT(pt.username, 1)::int + pa.idx) % 2) = 0 THEN 3 ELSE 5 END
      ELSE
        CASE ((RIGHT(pt.username, 1)::int + pa.idx) % 3)
          WHEN 0 THEN 1
          WHEN 1 THEN 1
          ELSE 2
        END
    END::int AS goles_visitante_predichos
  FROM participaciones_test pt
  CROSS JOIN partidos_activos pa
  CROSS JOIN quiniela_activa q
),
upd AS (
  UPDATE public.selecciones s
  SET
    prediccion = p.prediccion,
    goles_local_predichos = p.goles_local_predichos,
    goles_visitante_predichos = p.goles_visitante_predichos
  FROM picks p
  WHERE s.participacion_id = p.participacion_id
    AND s.partido_id = p.partido_id
  RETURNING s.participacion_id
),
ins AS (
  INSERT INTO public.selecciones (
    participacion_id,
    partido_id,
    prediccion,
    goles_local_predichos,
    goles_visitante_predichos
  )
  SELECT
    p.participacion_id,
    p.partido_id,
    p.prediccion,
    p.goles_local_predichos,
    p.goles_visitante_predichos
  FROM picks p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.selecciones s
    WHERE s.participacion_id = p.participacion_id
      AND s.partido_id = p.partido_id
  )
  RETURNING participacion_id
),
recalc AS (
  UPDATE public.participaciones p
  SET total_goles_predichos = x.total_goles
  FROM (
    SELECT
      s.participacion_id,
      COALESCE(SUM(COALESCE(s.goles_local_predichos,0) + COALESCE(s.goles_visitante_predichos,0)), 0) AS total_goles
    FROM public.selecciones s
    JOIN participaciones_test pt ON pt.participacion_id = s.participacion_id
    GROUP BY s.participacion_id
  ) x
  WHERE p.id = x.participacion_id
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM participaciones_test) AS participaciones_test_pagadas,
  (SELECT COUNT(*) FROM partidos_activos) AS partidos_en_quiniela_activa,
  (SELECT COUNT(*) FROM upd) AS selecciones_actualizadas,
  (SELECT COUNT(*) FROM ins) AS selecciones_insertadas,
  (SELECT COUNT(*) FROM recalc) AS participaciones_recalculadas;