-- Ranking público con desempate por goles predichos

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
        ORDER BY
          COALESCE(p.aciertos, 0) DESC,
          COALESCE(p.total_goles_predichos, 0) DESC,
          p.created_at ASC,
          p.user_id
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