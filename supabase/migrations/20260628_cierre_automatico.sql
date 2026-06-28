-- ──────────────────────────────────────────────────────────────────────────
-- MIGRACIÓN: Soporte para cierre automático + anulación + reembolso wallet
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Nuevas columnas en quinielas
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS cierre_automatico BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS primer_partido    TIMESTAMPTZ;

-- 2. Nuevo estado 'reembolsado' en participaciones
ALTER TABLE participaciones
  DROP CONSTRAINT IF EXISTS participaciones_estado_check;
ALTER TABLE participaciones
  ADD CONSTRAINT participaciones_estado_check
  CHECK (estado IN ('pendiente','pagado','ganador','perdedor','reembolsado'));

-- 3. Tabla wallet_movimientos (si no existe)
CREATE TABLE IF NOT EXISTS wallet_movimientos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('deposito','retiro','entrada','premio','reembolso')),
  monto        NUMERIC(12,2) NOT NULL,
  descripcion  TEXT,
  quiniela_id  UUID REFERENCES quinielas(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_mov_user     ON wallet_movimientos(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_mov_quiniela ON wallet_movimientos(quiniela_id);

-- RLS
ALTER TABLE wallet_movimientos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_movimientos' AND policyname = 'usuarios ven sus propios movimientos'
  ) THEN
    CREATE POLICY "usuarios ven sus propios movimientos"
      ON wallet_movimientos FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_movimientos' AND policyname = 'admins ven todos'
  ) THEN
    CREATE POLICY "admins ven todos"
      ON wallet_movimientos FOR ALL
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- 4. Función incrementar_wallet
CREATE OR REPLACE FUNCTION incrementar_wallet(p_user_id UUID, p_monto NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
     SET saldo = COALESCE(saldo, 0) + p_monto
   WHERE id = p_user_id;
END;
$$;

-- 5. Estado 'anulada' en quinielas
ALTER TABLE quinielas
  DROP CONSTRAINT IF EXISTS quinielas_estado_check;
ALTER TABLE quinielas
  ADD CONSTRAINT quinielas_estado_check
  CHECK (estado IN ('abierta','cerrada','finalizada','anulada'));
