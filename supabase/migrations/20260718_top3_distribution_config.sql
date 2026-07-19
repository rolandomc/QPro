-- Soporte para configuración de premios Top 1 / Top 3
-- 1) Persistir configuración en quinielas
-- 2) Permitir distribución con montos distintos por ganador

ALTER TABLE public.quinielas
  ADD COLUMN IF NOT EXISTS num_ganadores INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS porcentajes_premios JSONB NOT NULL DEFAULT '[100]'::jsonb;

ALTER TABLE public.quinielas
  DROP CONSTRAINT IF EXISTS quinielas_num_ganadores_check;

ALTER TABLE public.quinielas
  ADD CONSTRAINT quinielas_num_ganadores_check
  CHECK (num_ganadores IN (1, 3));

CREATE OR REPLACE FUNCTION public.distribuir_premios_quiniela(
  p_quiniela_id UUID,
  p_ganador_ids UUID[],
  p_montos_ganador NUMERIC[],
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
  v_suma_montos NUMERIC;
BEGIN
  IF p_quiniela_id IS NULL THEN
    RAISE EXCEPTION 'La quiniela es obligatoria';
  END IF;

  IF p_ganador_ids IS NULL OR array_length(p_ganador_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes enviar al menos un ganador';
  END IF;

  IF p_montos_ganador IS NULL OR array_length(p_montos_ganador, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes enviar montos de ganadores';
  END IF;

  IF array_length(p_ganador_ids, 1) <> array_length(p_montos_ganador, 1) THEN
    RAISE EXCEPTION 'La cantidad de ganadores y montos no coincide';
  END IF;

  IF p_premio_total IS NULL OR p_premio_total <= 0 THEN
    RAISE EXCEPTION 'El premio total debe ser mayor a 0';
  END IF;

  SELECT COALESCE(SUM(m), 0)
    INTO v_suma_montos
  FROM unnest(p_montos_ganador) AS m;

  IF v_suma_montos <= 0 THEN
    RAISE EXCEPTION 'La suma de montos debe ser mayor a 0';
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
     SET estado = 'perdedor',
         premio_ganado = 0
   WHERE quiniela_id = p_quiniela_id;

  UPDATE participaciones p
     SET estado = 'ganador',
         premio_ganado = g.monto
    FROM (
      SELECT ganador_id, monto
      FROM unnest(p_ganador_ids, p_montos_ganador) AS t(ganador_id, monto)
    ) g
   WHERE p.id = g.ganador_id
     AND p.quiniela_id = p_quiniela_id;

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
    g.monto,
    'Premio quiniela: ' || v_titulo,
    p.id
  FROM participaciones p
  JOIN (
    SELECT ganador_id, monto
    FROM unnest(p_ganador_ids, p_montos_ganador) AS t(ganador_id, monto)
  ) g
    ON g.ganador_id = p.id
  WHERE p.quiniela_id = p_quiniela_id
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
    'Tuviste ' || COALESCE(p_max_aciertos, 0) || ' aciertos y ganaste $' || TO_CHAR(g.monto, 'FM999G999G999G990D00') || '. Ya está en tu billetera.',
    false,
    p.id::text,
    'participacion_premio'
  FROM participaciones p
  JOIN (
    SELECT ganador_id, monto
    FROM unnest(p_ganador_ids, p_montos_ganador) AS t(ganador_id, monto)
  ) g
    ON g.ganador_id = p.id
  WHERE p.quiniela_id = p_quiniela_id
    AND p.user_id IS NOT NULL;

  UPDATE quinielas
     SET estado = 'finalizada',
         premio_total = p_premio_total
   WHERE id = p_quiniela_id;
END;
$$;