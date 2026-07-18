-- Idempotencia para pagos y reembolsos

CREATE TABLE IF NOT EXISTS payment_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  reference_id   TEXT,
  reference_type TEXT,
  error_message  TEXT,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_source_external
  ON payment_events (source, external_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_reference
  ON payment_events (reference_id, reference_type);

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS referencia_id TEXT,
  ADD COLUMN IF NOT EXISTS referencia_tipo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_dedup
  ON notificaciones (user_id, tipo, referencia_id, referencia_tipo)
  WHERE referencia_id IS NOT NULL AND referencia_tipo IS NOT NULL;
