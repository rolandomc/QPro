-- ============================================================
-- MIGRACIÓN: Soporte multi-deporte (Fútbol + Béisbol MLB)
-- Fecha: 2026-07-01
-- ============================================================

-- ─── 1. Tipo ENUM para deportes ──────────────────────────────
DO $$ BEGIN
  CREATE TYPE deporte_tipo AS ENUM ('futbol', 'beisbol');
EXCEPTION
  WHEN duplicate_object THEN NULL; -- ya existe, no hacer nada
END $$;

-- ─── 2. Columna deporte en quinielas ─────────────────────────
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS deporte deporte_tipo NOT NULL DEFAULT 'futbol';

-- ─── 3. Columnas MLB en partidos ─────────────────────────────
-- mlb_game_pk : ID único del juego en la MLB Stats API (gamePk)
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS mlb_game_pk  BIGINT   DEFAULT NULL;

-- deporte en partidos (para queries directas sin JOIN a quinielas)
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS deporte deporte_tipo NOT NULL DEFAULT 'futbol';

-- marcador_local / marcador_visitante como enteros (MLB usa carreras)
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS marcador_local     INTEGER DEFAULT NULL;
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS marcador_visitante INTEGER DEFAULT NULL;

-- estado_juego: estado detallado de MLB ('Preview','Live','Final', etc.)
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS estado_juego TEXT DEFAULT NULL;

-- ─── 4. Índice para búsquedas rápidas por mlb_game_pk ────────
CREATE INDEX IF NOT EXISTS idx_partidos_mlb_game_pk
  ON partidos (mlb_game_pk)
  WHERE mlb_game_pk IS NOT NULL;

-- ─── 5. Índice para filtrar quinielas por deporte ────────────
CREATE INDEX IF NOT EXISTS idx_quinielas_deporte
  ON quinielas (deporte);

-- ─── 6. Comentarios descriptivos ─────────────────────────────
COMMENT ON COLUMN quinielas.deporte IS
  'Deporte de la quiniela: futbol (football-data.org) o beisbol (MLB Stats API)';

COMMENT ON COLUMN partidos.mlb_game_pk IS
  'ID del juego en la MLB Stats API (campo gamePk). NULL para partidos de fútbol.';

COMMENT ON COLUMN partidos.marcador_local IS
  'Carreras anotadas por equipo local (béisbol) o goles (fútbol en futuras versiones)';

COMMENT ON COLUMN partidos.marcador_visitante IS
  'Carreras anotadas por equipo visitante (béisbol)';

COMMENT ON COLUMN partidos.estado_juego IS
  'Estado detallado del juego: Preview | Live | Final | Postponed | Cancelled (MLB)';
