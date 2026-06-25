-- Agregar columnas para jugadores mínimos y comisión del admin
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS jugadores_minimos  INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS porcentaje_admin   NUMERIC(5,2) NOT NULL DEFAULT 10;

-- Función para calcular el premio_total automáticamente cuando cambia una participación
CREATE OR REPLACE FUNCTION calcular_premio_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_precio       NUMERIC;
  v_pct_admin    NUMERIC;
  v_total_pagado NUMERIC;
BEGIN
  SELECT precio_entrada, porcentaje_admin
    INTO v_precio, v_pct_admin
    FROM quinielas
   WHERE id = COALESCE(NEW.quiniela_id, OLD.quiniela_id);

  SELECT COALESCE(SUM(monto_pagado), 0)
    INTO v_total_pagado
    FROM participaciones
   WHERE quiniela_id = COALESCE(NEW.quiniela_id, OLD.quiniela_id)
     AND estado IN ('pagado', 'ganador', 'perdedor');

  UPDATE quinielas
     SET premio_total = ROUND(v_total_pagado * (1 - v_pct_admin / 100.0), 2)
   WHERE id = COALESCE(NEW.quiniela_id, OLD.quiniela_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_premio ON participaciones;
CREATE TRIGGER trg_calcular_premio
  AFTER INSERT OR UPDATE OF monto_pagado, estado OR DELETE
  ON participaciones
  FOR EACH ROW EXECUTE FUNCTION calcular_premio_total();
