-- ──────────────────────────────────────────────────────────────────────────
-- MIGRACIÓN: pg_cron → invoca cerrar-quinielas cada minuto
--
-- REQUISITOS PREVIOS (hacer una sola vez en Supabase Dashboard):
--   1. Dashboard → Database → Extensions → Activar "pg_cron"
--   2. Dashboard → Database → Extensions → Activar "pg_net"
--   3. Dashboard → Settings → Edge Functions → Copiar la URL base
--      (ej: https://xxxxxxxxxxx.supabase.co/functions/v1)
--   4. Crear un Secret en Edge Functions llamado CRON_SECRET con un
--      valor seguro (ej: openssl rand -hex 32)
--   5. Reemplazar los dos placeholders de abajo con tus valores reales.
-- ──────────────────────────────────────────────────────────────────────────

-- Habilitar extensiones (si no están activas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar job anterior si ya existía
SELECT cron.unschedule('cerrar-quinielas-auto')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cerrar-quinielas-auto'
);

-- Crear el job: ejecuta cada minuto
SELECT cron.schedule(
  'cerrar-quinielas-auto',   -- nombre único del job
  '* * * * *',               -- cada minuto (cron expression)
  $$
  SELECT net.http_post(
    url     := 'https://TU_PROJECT_REF.supabase.co/functions/v1/cerrar-quinielas',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer TU_CRON_SECRET'
    ),
    body    := '{}'
  );
  $$
);

-- Verificar que quedó creado
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'cerrar-quinielas-auto';
