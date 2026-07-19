-- Stats y ranking públicos consistentes (evita sesgo por RLS en cliente)

CREATE OR REPLACE FUNCTION get_quinielas_stats_public(
  p_quiniela_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  titulo TEXT,
  descripcion TEXT,
  liga TEXT,
  deporte TEXT,
  precio_entrada NUMERIC,
  premio_total NUMERIC,
  estado TEXT,
  fecha_cierre TIMESTAMPTZ,
  jugadores_minimos INTEGER,
  porcentaje_admin NUMERIC,
  cierre_automatico BOOLEAN,
  primer_partido TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  total_partidos BIGINT,
  jugadores_count BIGINT,
  fecha_primer_partido TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_liga BOOLEAN;
  has_deporte BOOLEAN;
  has_jugadores_minimos BOOLEAN;
  has_porcentaje_admin BOOLEAN;
  has_cierre_automatico BOOLEAN;
  has_primer_partido BOOLEAN;
  liga_expr TEXT;
  deporte_expr TEXT;
  jugadores_minimos_expr TEXT;
  porcentaje_admin_expr TEXT;
  cierre_automatico_expr TEXT;
  primer_partido_expr TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'liga'
  ) INTO has_liga;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'deporte'
  ) INTO has_deporte;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'jugadores_minimos'
  ) INTO has_jugadores_minimos;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'porcentaje_admin'
  ) INTO has_porcentaje_admin;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'cierre_automatico'
  ) INTO has_cierre_automatico;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quinielas'
      AND column_name = 'primer_partido'
  ) INTO has_primer_partido;

  liga_expr = CASE WHEN has_liga THEN 'q.liga' ELSE 'NULL::text' END;
  deporte_expr = CASE WHEN has_deporte THEN 'q.deporte' ELSE 'NULL::text' END;
  jugadores_minimos_expr = CASE WHEN has_jugadores_minimos THEN 'q.jugadores_minimos' ELSE '0::integer' END;
  porcentaje_admin_expr = CASE WHEN has_porcentaje_admin THEN 'q.porcentaje_admin' ELSE '0::numeric' END;
  cierre_automatico_expr = CASE WHEN has_cierre_automatico THEN 'q.cierre_automatico' ELSE 'false::boolean' END;
  primer_partido_expr = CASE WHEN has_primer_partido THEN 'q.primer_partido' ELSE 'NULL::timestamptz' END;

  RETURN QUERY EXECUTE format(
    'SELECT
      q.id,
      q.titulo,
      q.descripcion,
      %s AS liga,
      %s AS deporte,
      q.precio_entrada,
      q.premio_total,
      q.estado,
      q.fecha_cierre,
      %s AS jugadores_minimos,
      %s AS porcentaje_admin,
      %s AS cierre_automatico,
      %s AS primer_partido,
      q.created_at,
      COALESCE(pt.total_partidos, 0) AS total_partidos,
      COALESCE(pg.jugadores_count, 0) AS jugadores_count,
      COALESCE(pp.fecha_primer_partido, q.fecha_cierre) AS fecha_primer_partido
    FROM quinielas q
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total_partidos
      FROM partidos p
      WHERE p.quiniela_id = q.id
    ) pt ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS jugadores_count
      FROM participaciones pa
      WHERE pa.quiniela_id = q.id
        AND pa.estado IN (''pagado'', ''ganador'', ''perdedor'')
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT MIN(p2.fecha_partido) AS fecha_primer_partido
      FROM partidos p2
      WHERE p2.quiniela_id = q.id
    ) pp ON true
    WHERE ($1 IS NULL OR q.id = ANY($1))
    ORDER BY q.created_at DESC',
    liga_expr,
    deporte_expr,
    jugadores_minimos_expr,
    porcentaje_admin_expr,
    cierre_automatico_expr,
    primer_partido_expr
  ) USING p_quiniela_ids;
END;
$$;

REVOKE ALL ON FUNCTION get_quinielas_stats_public(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quinielas_stats_public(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quinielas_stats_public(UUID[]) TO anon;

CREATE OR REPLACE FUNCTION get_quiniela_ranking_public(
  p_quiniela_id UUID,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  aciertos INTEGER,
  estado TEXT,
  pos BIGINT,
  total_participants BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      p.user_id,
      COALESCE(pr.username, 'usuario') AS username,
      COALESCE(p.aciertos, 0) AS aciertos,
      p.estado,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(p.aciertos, 0) DESC, p.created_at ASC, p.user_id
      ) AS pos
    FROM participaciones p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.quiniela_id = p_quiniela_id
      AND p.estado IN ('pagado', 'ganador', 'perdedor')
  )
  SELECT
    r.user_id,
    r.username,
    r.aciertos,
    r.estado,
    r.pos,
    COUNT(*) OVER () AS total_participants
  FROM ranked r
  ORDER BY r.pos
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
$$;

REVOKE ALL ON FUNCTION get_quiniela_ranking_public(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quiniela_ranking_public(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quiniela_ranking_public(UUID, INTEGER) TO anon;