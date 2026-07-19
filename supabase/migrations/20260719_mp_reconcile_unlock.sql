-- Desbloqueo de eventos MP mal cerrados: permite reconciliar pagos aprobados
-- donde payment_events quedó en processed pero la participacion sigue pendiente.

UPDATE payment_events pe
SET
  status = 'failed',
  error_message = 'Reconciliacion: participacion no pagada con evento processed',
  updated_at = now()
WHERE pe.source = 'mercadopago-webhook'
  AND pe.status = 'processed'
  AND pe.reference_id ~* '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM participaciones p
    WHERE p.id = pe.reference_id::uuid
      AND p.estado <> 'pagado'
  );