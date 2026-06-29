-- Columnas para soporte de pago SPEI
alter table participaciones
  add column if not exists metodo_pago       text default 'mp',
  add column if not exists clave_rastreo     text,
  add column if not exists fecha_pago_spei   timestamptz,
  add column if not exists ultimo_error_spei text;

-- Nuevo estado permitido
-- (si usas un check constraint en estado, agrégalo aquí)
-- alter table participaciones drop constraint if exists participaciones_estado_check;
-- alter table participaciones add constraint participaciones_estado_check
--   check (estado in ('pendiente','pagado','spei_pendiente','cancelado'));
