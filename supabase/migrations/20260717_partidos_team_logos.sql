-- Guardar logos de equipos para UI premium
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS logo_local TEXT,
  ADD COLUMN IF NOT EXISTS logo_visitante TEXT;
