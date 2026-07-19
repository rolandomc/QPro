-- Stats consistentes para quinielas abiertas (mismo conteo para admin y usuarios)

CREATE OR REPLACE FUNCTION get_quinielas_abiertas_public()
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
  ya_participo BOOLEAN,
  fecha_primer_partido TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_liga BOOLEAN;
  has_deporte BOOLEAN;
  liga_expr TEXT;
  deporte_expr TEXT;
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

  liga_expr = CASE WHEN has_liga THEN 'q.liga' ELSE 'NULL::text' END;
  deporte_expr = CASE WHEN has_deporte THEN 'q.deporte' ELSE 'NULL::text' END;

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
      q.jugadores_minimos,
      q.porcentaje_admin,
      q.cierre_automatico,
      q.primer_partido,
      q.created_at,
      COALESCE(pt.total_partidos, 0) AS total_partidos,
      COALESCE(pg.jugadores_count, 0) AS jugadores_count,
      EXISTS (
        SELECT 1
        FROM participaciones pu
        WHERE pu.quiniela_id = q.id
          AND pu.user_id = auth.uid()
      ) AS ya_participo,
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
    WHERE q.estado = ''abierta''
    ORDER BY q.created_at DESC',
    liga_expr,
    deporte_expr
  );
END;
$$;

REVOKE ALL ON FUNCTION get_quinielas_abiertas_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quinielas_abiertas_public() TO authenticated;
GRANT EXECUTE ON FUNCTION get_quinielas_abiertas_public() TO anon;