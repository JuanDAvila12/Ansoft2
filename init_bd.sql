-- ============================================================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS
-- Proyecto: Vía Dorada - Sistema de Gestión Médica
-- Plataforma: Supabase (PostgreSQL)
-- Fecha: 03/08/2026
-- ============================================================================
-- Instrucciones:
--   1. Abre el "SQL Editor" en el panel de Supabase
--   2. Copia y pega TODO este script
--   3. Ejecuta (Ctrl + Enter o botón "Run")
--   4. Verifica que no haya errores en la pestaña "Results"
-- ============================================================================

-- ============================================================================
-- PASO 1: EXTENSIONES
-- ============================================================================
-- Habilitar uuid-ossp para generar UUIDs automáticamente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar pgcrypto para hashing de contraseñas (recomendado a futuro)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- PASO 2: TIPOS ENUM
-- ============================================================================

-- Roles de usuario dentro del sistema
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('admin', 'doctor', 'paciente', 'recepcionista');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Estatus de las citas médicas
DO $$ BEGIN
    CREATE TYPE estatus_cita AS ENUM ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Días de la semana para horarios de doctores
DO $$ BEGIN
    CREATE TYPE dia_semana AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de consulta
DO $$ BEGIN
    CREATE TYPE tipo_consulta AS ENUM ('presencial', 'videollamada', 'telefonica');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- PASO 3: TABLAS PRINCIPALES
-- ============================================================================

-- ----------------------------------------
-- 3.1 TABLA: especialidades
-- Catálogo de especialidades médicas
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS especialidades (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(150) NOT NULL UNIQUE,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------
-- 3.2 TABLA: clinicas
-- Sedes/sucursales de la clínica
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS clinicas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    direccion       TEXT,
    telefono        VARCHAR(20),
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------
-- 3.3 TABLA: seguros
-- Catálogo de seguros médicos aceptados
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS seguros (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(150) NOT NULL UNIQUE,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------
-- 3.4 TABLA: usuariosd
-- Usuarios del sistema (doctores, pacientes, admin, recepcionistas)
-- NOTA: Las contraseñas deben hashearse con bcrypt en producción.
--       Actualmente se comparan en texto plano en el backend.
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS usuariosd (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_completo VARCHAR(200) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    contraseña      VARCHAR(255) NOT NULL,           -- TODO: Migrar a hash con bcrypt
    telefono        VARCHAR(20),
    rol             rol_usuario NOT NULL DEFAULT 'paciente',
    activo          BOOLEAN DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por email (login)
CREATE INDEX IF NOT EXISTS idx_usuariosd_email ON usuariosd(email);
-- Índice para filtrar por rol
CREATE INDEX IF NOT EXISTS idx_usuariosd_rol ON usuariosd(rol);

-- ----------------------------------------
-- 3.5 TABLA: pacientes
-- Datos específicos de pacientes (extiende usuariosd)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID NOT NULL UNIQUE REFERENCES usuariosd(id) ON DELETE CASCADE,
    fecha_nacimiento    DATE,
    sexo                VARCHAR(1),                  -- M / F
    tipo_sangre         VARCHAR(5),
    alergias            TEXT,
    padecimientos       TEXT,
    contacto_emergencia VARCHAR(200),
    telefono_emergencia VARCHAR(20),
    seguro_id           UUID REFERENCES seguros(id) ON DELETE SET NULL,
    numero_poliza       VARCHAR(100),
    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_usuario ON pacientes(usuario_id);

-- ----------------------------------------
-- 3.6 TABLA: doctores
-- Datos específicos de doctores (extiende usuariosd)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS doctores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID NOT NULL UNIQUE REFERENCES usuariosd(id) ON DELETE CASCADE,
    especialidad_id     UUID REFERENCES especialidades(id) ON DELETE SET NULL,
    clinica_id          UUID REFERENCES clinicas(id) ON DELETE SET NULL,
    cedula_profesional  VARCHAR(50),
    consultorio         VARCHAR(50),
    activo              BOOLEAN DEFAULT TRUE,
    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctores_usuario ON doctores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_doctores_especialidad ON doctores(especialidad_id);

-- ----------------------------------------
-- 3.7 TABLA: horarios_doctor
-- Horarios de atención por doctor
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS horarios_doctor (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id       UUID NOT NULL REFERENCES doctores(id) ON DELETE CASCADE,
    dia             dia_semana NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, dia)                          -- Un horario por día por doctor
);

CREATE INDEX IF NOT EXISTS idx_horarios_doctor ON horarios_doctor(doctor_id);

-- ----------------------------------------
-- 3.8 TABLA: citas
-- Citas médicas (tabla principal del negocio)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS citas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id     UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctores(id) ON DELETE CASCADE,
    clinica_id      UUID REFERENCES clinicas(id) ON DELETE SET NULL,
    fecha_hora      TIMESTAMPTZ NOT NULL,
    tipo            tipo_consulta DEFAULT 'presencial',
    estatus         estatus_cita DEFAULT 'pendiente',
    motivo          TEXT,
    notas_medicas   TEXT,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------
-- 3.9 TABLA: sesiones
-- Tokens de sesión para autenticación
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuariosd(id) ON DELETE CASCADE,
    token           VARCHAR(255) NOT NULL UNIQUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

-- ----------------------------------------
-- 3.10 TABLA: configuracion
-- Configuración dinámica del sistema (hero, parámetros, etc.)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave           VARCHAR(100) NOT NULL UNIQUE,
    valor           TEXT,
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_configuracion_clave ON configuracion(clave);

-- Índices críticos para las consultas de citas
CREATE INDEX IF NOT EXISTS idx_citas_fecha      ON citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estatus    ON citas(estatus);
CREATE INDEX IF NOT EXISTS idx_citas_paciente   ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_doctor     ON citas(doctor_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_est  ON citas(estatus, fecha_hora);   -- Para la agenda (pendientes ordenadas por fecha)


-- ============================================================================
-- PASO 4: POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY)
-- Nota: RLS se habilita por tabla para compatibilidad con Supabase
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE especialidades   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuariosd        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_doctor  ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas            ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir lectura autenticada en catálogos públicos
CREATE POLICY "Lectura pública de especialidades" ON especialidades
    FOR SELECT USING (true);

CREATE POLICY "Lectura pública de clínicas" ON clinicas
    FOR SELECT USING (true);

CREATE POLICY "Lectura pública de seguros" ON seguros
    FOR SELECT USING (true);

-- Políticas: usuariosd (acceso según rol)
CREATE POLICY "Usuarios ven su propio perfil" ON usuariosd
    FOR SELECT USING (auth.uid() = id);

-- Políticas: pacientes
CREATE POLICY "Doctores y admin ven todos los pacientes" ON pacientes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM usuariosd WHERE id = auth.uid() AND rol IN ('admin', 'doctor', 'recepcionista'))
    );

CREATE POLICY "Pacientes ven su propio perfil" ON pacientes
    FOR SELECT USING (usuario_id = auth.uid());

-- Políticas: doctores (perfil público del doctor)
CREATE POLICY "Lectura pública de doctores" ON doctores
    FOR SELECT USING (true);

-- Políticas: citas
CREATE POLICY "Doctores ven sus citas" ON citas
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM doctores WHERE id = doctor_id AND usuario_id = auth.uid())
        OR
        EXISTS (SELECT 1 FROM usuariosd WHERE id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "Pacientes ven sus propias citas" ON citas
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM pacientes WHERE id = paciente_id AND usuario_id = auth.uid())
    );


-- ============================================================================
-- PASO 5: FUNCIONES ÚTILES Y TRIGGERS
-- ============================================================================

-- Función para actualizar automáticamente el campo actualizado_en
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a todas las tablas con actualizado_en
CREATE TRIGGER tg_actualizar_usuariosd     BEFORE UPDATE ON usuariosd       FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER tg_actualizar_pacientes     BEFORE UPDATE ON pacientes       FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER tg_actualizar_doctores      BEFORE UPDATE ON doctores        FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER tg_actualizar_citas         BEFORE UPDATE ON citas           FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER tg_actualizar_especialidades BEFORE UPDATE ON especialidades FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER tg_actualizar_clinicas      BEFORE UPDATE ON clinicas        FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Función para evitar solapamiento de citas en el mismo doctor y horario
CREATE OR REPLACE FUNCTION verificar_solapamiento_cita()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM citas
        WHERE doctor_id = NEW.doctor_id
          AND id != NEW.id
          AND estatus NOT IN ('cancelada')
          AND fecha_hora = NEW.fecha_hora
    ) THEN
        RAISE EXCEPTION 'El doctor ya tiene una cita en este horario (%).', NEW.fecha_hora;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_solapamiento_citas
    BEFORE INSERT OR UPDATE ON citas
    FOR EACH ROW
    EXECUTE FUNCTION verificar_solapamiento_cita();


-- ============================================================================
-- PASO 6: VISTAS ÚTILES
-- ============================================================================

-- Vista: Agenda de citas (usada por el endpoint GET /api/agenda)
CREATE OR REPLACE VIEW vista_agenda AS
SELECT
    c.id AS folio,
    u_pac.nombre_completo AS paciente,
    u_doc.nombre_completo AS doctor,
    e.nombre AS especialidad,
    cl.nombre AS clinica,
    c.fecha_hora,
    c.tipo,
    c.estatus,
    c.motivo
FROM citas c
JOIN pacientes p ON c.paciente_id = p.id
JOIN usuariosd u_pac ON p.usuario_id = u_pac.id
JOIN doctores d ON c.doctor_id = d.id
JOIN usuariosd u_doc ON d.usuario_id = u_doc.id
LEFT JOIN especialidades e ON d.especialidad_id = e.id
LEFT JOIN clinicas cl ON c.clinica_id = cl.id
ORDER BY c.fecha_hora ASC;

-- Vista: Doctores con su especialidad
CREATE OR REPLACE VIEW vista_doctores AS
SELECT
    u.id AS usuario_id,
    u.nombre_completo,
    u.email,
    u.telefono,
    e.nombre AS especialidad,
    d.cedula_profesional,
    d.consultorio,
    cl.nombre AS clinica
FROM doctores d
JOIN usuariosd u ON d.usuario_id = u.id
LEFT JOIN especialidades e ON d.especialidad_id = e.id
LEFT JOIN clinicas cl ON d.clinica_id = cl.id
WHERE u.activo = TRUE AND d.activo = TRUE;


-- ============================================================================
-- PASO 7: DATOS SEMILLA (SEED DATA)
-- Descomenta y personaliza según necesites
-- ============================================================================

-- Especialidades médicas comunes
INSERT INTO especialidades (nombre, descripcion) VALUES
    ('Medicina General',     'Atención primaria y diagnóstico general.'),
    ('Pediatría',            'Atención médica para niños y adolescentes.'),
    ('Ginecología',          'Salud reproductiva femenina.'),
    ('Cardiología',          'Diagnóstico y tratamiento de enfermedades del corazón.'),
    ('Dermatología',         'Enfermedades de la piel.'),
    ('Oftalmología',         'Salud visual y enfermedades oculares.'),
    ('Traumatología',        'Lesiones del sistema musculoesquelético.'),
    ('Odontología',          'Salud bucal y dental.'),
    ('Psicología',           'Salud mental y terapia psicológica.'),
    ('Nutrición',            'Planes de alimentación y dietética.')
ON CONFLICT (nombre) DO NOTHING;

-- Clínicas de ejemplo
INSERT INTO clinicas (nombre, direccion, telefono) VALUES
    ('Vía Dorada - Sede Centro',   'Av. Reforma #123, Centro, CDMX',         '55-1234-5678'),
    ('Vía Dorada - Sede Norte',    'Blvd. Insurgentes #456, Zona Norte',     '55-2345-6789'),
    ('Vía Dorada - Sede Sur',      'Calz. Tlalpan #789, Zona Sur',           '55-3456-7890')
ON CONFLICT DO NOTHING;

-- Seguros médicos comunes
INSERT INTO seguros (nombre) VALUES
    ('AXA'),
    ('GNP'),
    ('MetLife'),
    ('Seguros Monterrey'),
    ('Mapfre'),
    ('Particular / Sin seguro')
ON CONFLICT (nombre) DO NOTHING;

-- Usuario administrador de prueba
-- Contraseña: admin123  (CAMBIAR EN PRODUCCIÓN)
INSERT INTO usuariosd (nombre_completo, email, contraseña, rol) VALUES
    ('Administrador Principal', 'admin@viadorada.com', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Doctor de prueba
-- Contraseña: doctor123  (CAMBIAR EN PRODUCCIÓN)
INSERT INTO usuariosd (nombre_completo, email, contraseña, telefono, rol) VALUES
    ('Dr. Carlos Mendoza', 'carlos.mendoza@viadorada.com', 'doctor123', '55-1111-2222', 'doctor')
ON CONFLICT (email) DO NOTHING;

-- Paciente de prueba
-- Contraseña: paciente123  (CAMBIAR EN PRODUCCIÓN)
INSERT INTO usuariosd (nombre_completo, email, contraseña, telefono, rol) VALUES
    ('María García López', 'maria.garcia@email.com', 'paciente123', '55-3333-4444', 'paciente')
ON CONFLICT (email) DO NOTHING;

-- Vincular doctor con su tabla doctores
INSERT INTO doctores (usuario_id, especialidad_id, clinica_id, cedula_profesional, consultorio)
SELECT
    u.id,
    (SELECT id FROM especialidades WHERE nombre = 'Medicina General' LIMIT 1),
    (SELECT id FROM clinicas WHERE nombre ILIKE '%Centro%' LIMIT 1),
    'CED-1234567',
    'Consultorio 101'
FROM usuariosd u
WHERE u.email = 'carlos.mendoza@viadorada.com'
ON CONFLICT (usuario_id) DO NOTHING;

-- Vincular paciente con su tabla pacientes
INSERT INTO pacientes (usuario_id, fecha_nacimiento, sexo, tipo_sangre, seguro_id, numero_poliza)
SELECT
    u.id,
    '1990-05-15',
    'F',
    'O+',
    (SELECT id FROM seguros WHERE nombre = 'GNP' LIMIT 1),
    'GNP-99887766'
FROM usuariosd u
WHERE u.email = 'maria.garcia@email.com'
ON CONFLICT (usuario_id) DO NOTHING;

-- Horarios del doctor de prueba
INSERT INTO horarios_doctor (doctor_id, dia, hora_inicio, hora_fin)
SELECT
    d.id,
    dia,
    '09:00'::TIME,
    '14:00'::TIME
FROM doctores d
JOIN usuariosd u ON d.usuario_id = u.id
CROSS JOIN (VALUES ('lunes'), ('martes'), ('miercoles'), ('jueves'), ('viernes')) AS dias(dia)
WHERE u.email = 'carlos.mendoza@viadorada.com'
ON CONFLICT (doctor_id, dia) DO NOTHING;

-- Cita de ejemplo
INSERT INTO citas (paciente_id, doctor_id, clinica_id, fecha_hora, tipo, estatus, motivo)
SELECT
    (SELECT id FROM pacientes WHERE usuario_id = (SELECT id FROM usuariosd WHERE email = 'maria.garcia@email.com')),
    (SELECT id FROM doctores WHERE usuario_id = (SELECT id FROM usuariosd WHERE email = 'carlos.mendoza@viadorada.com')),
    (SELECT id FROM clinicas WHERE nombre ILIKE '%Centro%' LIMIT 1),
    NOW() + INTERVAL '2 days' + TIME '10:00',
    'presencial',
    'pendiente',
    'Revisión general y chequeo de rutina.'
WHERE NOT EXISTS (SELECT 1 FROM citas LIMIT 1);


-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Verificación rápida:
--   SELECT * FROM especialidades;
--   SELECT * FROM usuariosd;
--   SELECT * FROM vista_agenda;
-- ============================================================================