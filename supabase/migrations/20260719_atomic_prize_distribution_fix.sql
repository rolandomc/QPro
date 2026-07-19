-- Fix: distribución de premios idempotente y tolerante a quinielas ya finalizadas

CREATE OR REPLACE FUNCTION distribuir_premios_quiniela(
  p_quiniela_id UUID,
  p_ganador_ids UUID[],
  p_monto_por_ganador NUMERIC,
  p_premio_total NUMERIC,
  p_max_aciertos INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo TEXT;
  v_estado TEXT;
  v_total_ganadores INTEGER;
BEGIN
  IF p_quiniela_id IS NULL THEN
    RAISE EXCEPTION 'La quiniela es obligatoria';
  END IF;

  IF p_ganador_ids IS NULL OR array_length(p_ganador_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes enviar al menos un ganador';
  END IF;

  IF p_monto_por_ganador IS NULL OR p_monto_por_ganador <= 0 THEN
    RAISE EXCEPTION 'El monto por ganador debe ser mayor a 0';
  END IF;

  IF p_premio_total IS NULL OR p_premio_total <= 0 THEN
    RAISE EXCEPTION 'El premio total debe ser mayor a 0';
  END IF;

  SELECT titulo, estado
    INTO v_titulo, v_estado
    FROM quinielas
   WHERE id = p_quiniela_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiniela no encontrada';
  END IF;

  IF v_estado NOT IN ('cerrada', 'finalizada') THEN
    RAISE EXCEPTION 'La quiniela debe estar cerrada o finalizada para distribuir premios';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(p_ganador_ids) AS ganador_id
      LEFT JOIN participaciones p
        ON p.id = ganador_id
       AND p.quiniela_id = p_quiniela_id
     WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uno o más ganadores no pertenecen a esta quiniela';
  END IF;

  SELECT COUNT(*)
    INTO v_total_ganadores
    FROM participaciones
   WHERE quiniela_id = p_quiniela_id
     AND id = ANY(p_ganador_ids);

  IF v_total_ganadores <> array_length(p_ganador_ids, 1) THEN
    RAISE EXCEPTION 'La lista de ganadores tiene duplicados o referencias inválidas';
  END IF;

  UPDATE participaciones
     SET estado = 'ganador',
         premio_ganado = p_monto_por_ganador
   WHERE quiniela_id = p_quiniela_id
     AND id = ANY(p_ganador_ids);

  UPDATE participaciones
     SET estado = 'perdedor'
   WHERE quiniela_id = p_quiniela_id
     AND NOT (id = ANY(p_ganador_ids));

  INSERT INTO wallet_transactions (
    user_id,
    tipo,
    monto,
    descripcion,
    referencia_id
  )
  SELECT
    p.user_id,
    'premio',
    p_monto_por_ganador,
    'Premio quiniela: ' || v_titulo,
    p.id
  FROM participaciones p
  WHERE p.quiniela_id = p_quiniela_id
    AND p.id = ANY(p_ganador_ids)
    AND p.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM wallet_transactions wt
      WHERE wt.tipo = 'premio'
        AND wt.referencia_id = p.id
    );

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
    'ganador',
    '🏆 ¡Ganaste en ' || v_titulo || '! ',
    'Tuviste ' || COALESCE(p_max_aciertos, 0) || ' aciertos y ganaste $' || TO_CHAR(p_monto_por_ganador, 'FM999G999G999G990D00') || '. Ya está en tu billetera.',
    false,
    p.id::text,
    'participacion_premio'
  FROM participaciones p
  WHERE p.quiniela_id = p_quiniela_id
    AND p.id = ANY(p_ganador_ids)
    AND p.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

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
    'perdedor',
    'Resultado en ' || v_titulo,
    'Terminaste con ' || COALESCE(p.aciertos, 0) || ' acierto' || CASE WHEN COALESCE(p.aciertos, 0) = 1 THEN '' ELSE 's' END || '. ¡Suerte en la próxima!',
    false,
    p.id::text,
    'participacion_resultado'
  FROM participaciones p
  WHERE p.quiniela_id = p_quiniela_id
    AND NOT (p.id = ANY(p_ganador_ids))
    AND p.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  UPDATE quinielas
     SET estado = 'finalizada',
         premio_total = p_premio_total
   WHERE id = p_quiniela_id;
END;
$$;