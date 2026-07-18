-- Habilita y corrige políticas RLS para notificaciones
-- Objetivo: permitir que cada usuario borre solo sus notificaciones

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas para evitar reglas ambiguas o incompletas
DROP POLICY IF EXISTS "usuarios leen sus notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "usuarios actualizan sus notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "usuarios borran sus notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "usuarios insertan sus notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "admins gestionan notificaciones" ON notificaciones;

-- Usuarios: solo ven lo suyo
CREATE POLICY "usuarios leen sus notificaciones"
  ON notificaciones FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios: solo actualizan lo suyo (ej. marcar leida)
CREATE POLICY "usuarios actualizan sus notificaciones"
  ON notificaciones FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuarios: solo borran lo suyo
CREATE POLICY "usuarios borran sus notificaciones"
  ON notificaciones FOR DELETE
  USING (auth.uid() = user_id);

-- Usuarios: pueden insertar para si mismos
CREATE POLICY "usuarios insertan sus notificaciones"
  ON notificaciones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins: acceso total desde app admin
CREATE POLICY "admins gestionan notificaciones"
  ON notificaciones FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
