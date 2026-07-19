-- Cambiar defaults para que nuevas quinielas usen Top 3 por defecto
-- (protección para clientes viejos que no envían configuración explícita)

ALTER TABLE public.quinielas
  ALTER COLUMN num_ganadores SET DEFAULT 3,
  ALTER COLUMN porcentajes_premios SET DEFAULT '[60,25,15]'::jsonb;