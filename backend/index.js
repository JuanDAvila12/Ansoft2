const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const supabase = require('./db');

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND
// ============================================
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ============================================
// MIDDLEWARE: Verificar token de sesión
// ============================================
async function autenticar(req, res, next) {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ exito: false, mensaje: 'Token requerido. Inicia sesión.' });
    }

    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select('usuario_id')
      .eq('token', token)
      .limit(1);

    if (error || !sesiones || sesiones.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Sesión inválida o expirada.' });
    }

    const { data: usuario } = await supabase
      .from('usuariosd')
      .select('id, rol_id')
      .eq('id', sesiones[0].usuario_id)
      .limit(1);

    if (!usuario || usuario.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Usuario no encontrado.' });
    }

    req.usuario = {
      usuario_id: sesiones[0].usuario_id,
      rol: usuario[0].rol_id
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno de autenticación.' });
  }
}

// ============================================
// MIDDLEWARE: Solo administradores
// ============================================
function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ exito: false, mensaje: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

// ============================================
// ENDPOINT: Health Check
// ============================================
app.get('/api', (req, res) => {
  res.json({
    exito: true,
    mensaje: 'API Vía Dorada funcionando correctamente.',
    version: '1.0.0',
    endpoints: {
      login: 'POST /api/login',
      logout: 'POST /api/logout',
      agenda: 'GET /api/agenda',
      hero: 'GET /api/hero-config',
      especialidades: 'GET /api/especialidades',
      clinicas: 'GET /api/clinicas',
      seguros: 'GET /api/seguros',
      adminUsuarios: 'GET /api/admin/usuarios',
      adminActualizarUsuario: 'PUT /api/admin/usuarios/:id',
      adminHeroConfig: 'PUT /api/admin/hero-config',
      adminEspecialidades: 'POST,PUT,DELETE /api/admin/especialidades',
      adminClinicas: 'POST,PUT,DELETE /api/admin/clinicas',
      adminSeguros: 'POST,PUT,DELETE /api/admin/seguros'
    }
  });
});

// ============================================
// ENDPOINT: Hero Config (PÚBLICO)
// Usa tabla configuracion (se crea si no existe)
// ============================================
app.get('/api/hero-config', async (req, res) => {
  try {
    const { data: config, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['hero_titulo', 'hero_subtitulo']);

    // Si la tabla no existe, devolver valores por defecto
    if (error && error.code === 'PGRST205') {
      return res.json({
        exito: true,
        titulo: 'Encuentra tu bienestar en un solo lugar.',
        subtitulo: 'Gestión integral para pacientes y especialistas.'
      });
    }

    if (error) throw error;

    const resultado = {};
    (config || []).forEach(c => { resultado[c.clave] = c.valor; });

    res.json({
      exito: true,
      titulo: resultado.hero_titulo || 'Encuentra tu bienestar en un solo lugar.',
      subtitulo: resultado.hero_subtitulo || 'Gestión integral para pacientes y especialistas.'
    });
  } catch (error) {
    console.error('Error al obtener hero-config:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Especialidades (PÚBLICO)
// Usa tabla specialties (esquema real con columnas: id, name, description, created_at)
// ============================================
app.get('/api/especialidades', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('specialties')
      .select('id, name, description')
      .order('name', { ascending: true });

    if (error) throw error;

    // Mapear columnas en inglés a español para compatibilidad con frontend
    const datos = (data || []).map(e => ({
      id: e.id,
      nombre: e.name,
      descripcion: e.description
    }));

    res.json({ exito: true, datos });
  } catch (error) {
    console.error('Error al obtener especialidades:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Clínicas (PÚBLICO)
// Esquema real: id, nombre_clinica, direccion, telefono, ciudad, email_contacto, fecha_registro
// ============================================
app.get('/api/clinicas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('id, nombre_clinica, direccion, telefono, ciudad, email_contacto')
      .order('nombre_clinica', { ascending: true });

    if (error) throw error;

    // Mapear a nombres esperados por el frontend
    const datos = (data || []).map(c => ({
      id: c.id,
      nombre: c.nombre_clinica,
      direccion: c.direccion,
      telefono: c.telefono
    }));

    res.json({ exito: true, datos });
  } catch (error) {
    console.error('Error al obtener clínicas:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Seguros (PÚBLICO)
// Tabla seguros hay que crearla. Si no existe, devolvemos array vacío.
// ============================================
app.get('/api/seguros', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seguros')
      .select('id, nombre, descripcion')
      .order('nombre', { ascending: true });

    if (error && error.code === 'PGRST205') {
      return res.json({ exito: true, datos: [] });
    }
    if (error) throw error;

    res.json({ exito: true, datos: data || [] });
  } catch (error) {
    console.error('Error al obtener seguros:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Login
// Esquema real usuariosd: id, rol_id, nombre_completo, correo, contrasena_hash, estatus, fecha_registro
// ============================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ exito: false, mensaje: 'Correo y contraseña son requeridos.' });
    }

    const { data: usuarios, error } = await supabase
      .from('usuariosd')
      .select('id, nombre_completo, correo, rol_id, contrasena_hash, estatus')
      .eq('correo', email)
      .limit(1);

    if (error) throw error;

    if (!usuarios || usuarios.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Credenciales incorrectas.' });
    }

    const usuario = usuarios[0];

    if (usuario.estatus !== 'activo') {
      return res.status(403).json({ exito: false, mensaje: 'Cuenta desactivada. Contacta al administrador.' });
    }

    // Comparar contraseña (en este esquema se usa contrasena_hash)
    if (usuario.contrasena_hash !== password) {
      return res.status(401).json({ exito: false, mensaje: 'Credenciales incorrectas.' });
    }

    // Generar token
    const token = crypto.randomUUID();

    // Insertar sesión (la tabla sesiones puede no existir aún)
    const { error: insertError } = await supabase
      .from('sesiones')
      .insert({ usuario_id: usuario.id, token: token });

    if (insertError) {
      // Si la tabla no existe, crear sesión en memoria (modo degraded)
      if (insertError.code === 'PGRST205') {
        console.warn('Tabla sesiones no existe. El token no se persistirá.');
      } else {
        throw insertError;
      }
    }

    res.json({
      exito: true,
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre_completo,
        email: usuario.correo,
        rol: usuario.rol_id
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

// ============================================
// ENDPOINT: Logout
// ============================================
app.post('/api/logout', autenticar, async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');

    const { error } = await supabase
      .from('sesiones')
      .delete()
      .eq('token', token);

    // Si la tabla no existe, ignorar error
    if (error && error.code !== 'PGRST205') throw error;

    res.json({ exito: true, mensaje: 'Sesión cerrada correctamente.' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Verificar sesión
// ============================================
app.get('/api/sesion', autenticar, async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuariosd')
      .select('id, nombre_completo, correo, rol_id')
      .eq('id', req.usuario.usuario_id)
      .limit(1);

    if (error) throw error;
    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ exito: false, mensaje: 'Usuario no encontrado.' });
    }

    res.json({
      exito: true,
      usuario: {
        id: usuarios[0].id,
        nombre_completo: usuarios[0].nombre_completo,
        email: usuarios[0].correo,
        rol: usuarios[0].rol_id
      }
    });
  } catch (error) {
    console.error('Error en sesion:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// ENDPOINT: Agenda de citas
// Esquema real citas: id, doctor_id, paciente_id, fecha_hora, motivo_consulta, estatus, creado_en, clinica_id
// ============================================
app.get('/api/agenda', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        fecha_hora,
        estatus,
        motivo_consulta,
        paciente:pacientes (
          usuario:usuariosd (nombre_completo)
        ),
        doctor:doctores (
          usuario:usuariosd (nombre_completo)
        )
      `)
      .eq('estatus', 'pendiente')
      .order('fecha_hora', { ascending: true });

    if (error) throw error;

    const resultado = (data || []).map(c => ({
      folio: c.id,
      paciente: c.paciente?.usuario?.nombre_completo || 'N/A',
      doctor: c.doctor?.usuario?.nombre_completo || 'N/A',
      fecha_hora: c.fecha_hora,
      estatus: c.estatus,
      motivo: c.motivo_consulta
    }));

    res.json({
      exito: true,
      total_citas: resultado.length,
      datos: resultado
    });

  } catch (error) {
    console.error('Error al consultar la agenda:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
  }
});

// ============================================
// === PANEL DE ADMINISTRACIÓN ===
// ============================================

// --- USUARIOS ---
// Listar todos los usuarios
// Esquema real: id, rol_id, nombre_completo, correo, contrasena_hash, estatus, fecha_registro
app.get('/api/admin/usuarios', autenticar, soloAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuariosd')
      .select('id, nombre_completo, correo, rol_id, estatus, fecha_registro')
      .order('fecha_registro', { ascending: false });

    if (error) throw error;

    // Mapear a nombres esperados por el frontend
    const datos = (data || []).map(u => ({
      id: u.id,
      nombre_completo: u.nombre_completo,
      email: u.correo,
      rol: u.rol_id,
      activo: u.estatus === 'activo',
      creado_en: u.fecha_registro
    }));

    res.json({ exito: true, datos });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// Actualizar usuario (rol, estatus)
app.put('/api/admin/usuarios/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, activo } = req.body;

    const updates = {};
    if (rol !== undefined) updates.rol_id = rol;
    if (activo !== undefined) updates.estatus = activo ? 'activo' : 'inactivo';

    const { data, error } = await supabase
      .from('usuariosd')
      .update(updates)
      .eq('id', id)
      .select('id, nombre_completo, correo, rol_id, estatus');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ exito: false, mensaje: 'Usuario no encontrado.' });
    }

    res.json({
      exito: true,
      mensaje: 'Usuario actualizado.',
      usuario: {
        id: data[0].id,
        nombre_completo: data[0].nombre_completo,
        email: data[0].correo,
        rol: data[0].rol_id,
        activo: data[0].estatus === 'activo'
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// --- HERO CONFIG ---
app.put('/api/admin/hero-config', autenticar, soloAdmin, async (req, res) => {
  try {
    const { titulo, subtitulo } = req.body;

    if (titulo) {
      const { error } = await supabase
        .from('configuracion')
        .upsert({ clave: 'hero_titulo', valor: titulo }, { onConflict: 'clave' });
      if (error) throw error;
    }
    if (subtitulo) {
      const { error } = await supabase
        .from('configuracion')
        .upsert({ clave: 'hero_subtitulo', valor: subtitulo }, { onConflict: 'clave' });
      if (error) throw error;
    }

    res.json({ exito: true, mensaje: 'Configuración del hero actualizada.' });
  } catch (error) {
    console.error('Error al actualizar hero-config:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// --- ESPECIALIDADES (CRUD admin) ---
// Usa tabla specialties (columnas: id, name, description, created_at)
app.post('/api/admin/especialidades', autenticar, soloAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ exito: false, mensaje: 'El nombre es requerido.' });

    const { data, error } = await supabase
      .from('specialties')
      .insert({ name: nombre, description: descripcion || null })
      .select();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ exito: false, mensaje: 'Ya existe una especialidad con ese nombre.' });
      throw error;
    }

    res.status(201).json({
      exito: true,
      mensaje: 'Especialidad creada.',
      especialidad: { id: data[0].id, nombre: data[0].name, descripcion: data[0].description }
    });
  } catch (error) {
    console.error('Error al crear especialidad:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.put('/api/admin/especialidades/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const updates = {};
    if (nombre !== undefined) updates.name = nombre;
    if (descripcion !== undefined) updates.description = descripcion;

    const { data, error } = await supabase
      .from('specialties')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ exito: false, mensaje: 'Especialidad no encontrada.' });

    res.json({
      exito: true,
      mensaje: 'Especialidad actualizada.',
      especialidad: { id: data[0].id, nombre: data[0].name, descripcion: data[0].description }
    });
  } catch (error) {
    console.error('Error al actualizar especialidad:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.delete('/api/admin/especialidades/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('specialties')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ exito: true, mensaje: 'Especialidad eliminada.' });
  } catch (error) {
    console.error('Error al eliminar especialidad:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// --- CLÍNICAS (CRUD admin) ---
// Esquema real: id, nombre_clinica, direccion, telefono, ciudad, email_contacto, fecha_registro
app.post('/api/admin/clinicas', autenticar, soloAdmin, async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;
    if (!nombre) return res.status(400).json({ exito: false, mensaje: 'El nombre es requerido.' });

    const { data, error } = await supabase
      .from('clinicas')
      .insert({
        nombre_clinica: nombre,
        direccion: direccion || null,
        telefono: telefono || null
      })
      .select();

    if (error) throw error;

    res.status(201).json({
      exito: true,
      mensaje: 'Clínica creada.',
      clinica: { id: data[0].id, nombre: data[0].nombre_clinica, direccion: data[0].direccion, telefono: data[0].telefono }
    });
  } catch (error) {
    console.error('Error al crear clínica:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.put('/api/admin/clinicas/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono } = req.body;

    const updates = {};
    if (nombre !== undefined) updates.nombre_clinica = nombre;
    if (direccion !== undefined) updates.direccion = direccion;
    if (telefono !== undefined) updates.telefono = telefono;

    const { data, error } = await supabase
      .from('clinicas')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ exito: false, mensaje: 'Clínica no encontrada.' });

    res.json({
      exito: true,
      mensaje: 'Clínica actualizada.',
      clinica: { id: data[0].id, nombre: data[0].nombre_clinica, direccion: data[0].direccion, telefono: data[0].telefono }
    });
  } catch (error) {
    console.error('Error al actualizar clínica:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.delete('/api/admin/clinicas/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('clinicas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ exito: true, mensaje: 'Clínica eliminada.' });
  } catch (error) {
    console.error('Error al eliminar clínica:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// --- SEGUROS (CRUD admin) ---
// Tabla seguros (se crea con el script SQL; si no existe da error PGRST205)
app.post('/api/admin/seguros', autenticar, soloAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ exito: false, mensaje: 'El nombre es requerido.' });

    const { data, error } = await supabase
      .from('seguros')
      .insert({ nombre, descripcion: descripcion || null })
      .select();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ exito: false, mensaje: 'Ya existe un seguro con ese nombre.' });
      throw error;
    }

    res.status(201).json({ exito: true, mensaje: 'Seguro creado.', seguro: data[0] });
  } catch (error) {
    console.error('Error al crear seguro:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.put('/api/admin/seguros/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (descripcion !== undefined) updates.descripcion = descripcion;

    const { data, error } = await supabase
      .from('seguros')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ exito: false, mensaje: 'Seguro no encontrado.' });

    res.json({ exito: true, mensaje: 'Seguro actualizado.', seguro: data[0] });
  } catch (error) {
    console.error('Error al actualizar seguro:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

app.delete('/api/admin/seguros/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('seguros')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ exito: true, mensaje: 'Seguro eliminado.' });
  } catch (error) {
    console.error('Error al eliminar seguro:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno.' });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Vía Dorada corriendo en http://localhost:${PORT}`);
});