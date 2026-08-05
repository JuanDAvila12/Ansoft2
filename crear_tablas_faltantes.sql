-- ============================================================================
-- SCRIPT MÍNIMO: Solo crea las 3 tablas que faltan en el esquema actual
-- No modifica ninguna tabla existente
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. TABLA: sesiones (tokens de autenticación)
CREATE TABLE IF NOT EXISTS sesiones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      INTEGER NOT NULL REFERENCES usuariosd(id) ON DELETE CASCADE,
    token           VARCHAR(255) NOT NULL UNIQUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

-- 2. TABLA: configuracion (hero, parámetros dinámicos)
CREATE TABLE IF NOT EXISTS configuracion (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave           VARCHAR(100) NOT NULL UNIQUE,
    valor           TEXT,
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_configuracion_clave ON configuracion(clave);

-- 3. TABLA: seguros (catálogo de seguros médicos)
CREATE TABLE IF NOT EXISTS seguros (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(150) NOT NULL UNIQUE,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- Datos semilla de seguros
INSERT INTO seguros (nombre) VALUES
    ('AXA'),
    ('GNP'),
    ('MetLife'),
    ('Seguros Monterrey'),
    ('Mapfre'),
    ('Particular / Sin seguro')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================================
-- FIN DEL SCRIPT
-- Verificación:
--   SELECT * FROM sesiones;
--   SELECT * FROM configuracion;
--   SELECT * FROM seguros;
-- ============================================================================