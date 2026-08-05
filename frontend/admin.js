// ============================================
// PANEL DE ADMINISTRACIÓN - VÍA DORADA
// ============================================

const API = '/api/admin';
let token = '';

document.addEventListener('DOMContentLoaded', () => {
    token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

    if (!token || !usuario || usuario.rol !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // Cargar datos de la primera pestaña activa
    cargarUsuarios();
    cargarHeroConfig();

    // Event listeners de formularios
    document.getElementById('form-hero').addEventListener('submit', guardarHeroConfig);
    document.getElementById('form-especialidad').addEventListener('submit', guardarEspecialidad);
    document.getElementById('form-clinica').addEventListener('submit', guardarClinica);
    document.getElementById('form-seguro').addEventListener('submit', guardarSeguro);
});

// ============================================
// TABS
// ============================================
function mostrarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    document.querySelector(`[onclick="mostrarTab('${tab}')"]`).classList.add('active');
    document.getElementById('tab-' + tab).classList.remove('hidden');

    if (tab === 'usuarios') cargarUsuarios();
    if (tab === 'hero') cargarHeroConfig();
    if (tab === 'especialidades') cargarEspecialidades();
    if (tab === 'clinicas') cargarClinicas();
    if (tab === 'seguros') cargarSeguros();
}

function cerrarSesion() {
    fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    }).finally(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    });
}

// ============================================
// USUARIOS
// ============================================
async function cargarUsuarios() {
    try {
        const r = await fetch(API + '/usuarios', { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        if (!d.exito) return;
        const tbody = document.getElementById('tbody-usuarios');
        tbody.innerHTML = d.datos.map(u => `
            <tr>
                <td>${u.nombre_completo}</td>
                <td>${u.email}</td>
                <td>
                    <select onchange="actualizarUsuario('${u.id}', 'rol', this.value)">
                        <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="doctor" ${u.rol === 'doctor' ? 'selected' : ''}>Doctor</option>
                        <option value="paciente" ${u.rol === 'paciente' ? 'selected' : ''}>Paciente</option>
                        <option value="recepcionista" ${u.rol === 'recepcionista' ? 'selected' : ''}>Recepcionista</option>
                    </select>
                </td>
                <td>
                    <input type="checkbox" ${u.activo ? 'checked' : ''} onchange="actualizarUsuario('${u.id}', 'activo', this.checked)">
                </td>
                <td>${u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                <td><span class="badge badge-${u.rol}">${u.rol}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error cargando usuarios:', e);
    }
}

async function actualizarUsuario(id, campo, valor) {
    try {
        const body = {};
        body[campo] = campo === 'activo' ? Boolean(valor) : valor;
        const r = await fetch(API + '/usuarios/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        const msg = document.getElementById('mensaje-usuarios');
        msg.textContent = d.mensaje || 'Actualizado.';
        msg.className = 'mensaje ' + (d.exito ? 'exito' : 'error');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2000);
    } catch (e) {
        console.error('Error actualizando usuario:', e);
    }
}

// ============================================
// HERO CONFIG
// ============================================
async function cargarHeroConfig() {
    try {
        const r = await fetch('/api/hero-config');
        const d = await r.json();
        if (d.exito) {
            document.getElementById('hero-titulo-input').value = d.titulo;
            document.getElementById('hero-subtitulo-input').value = d.subtitulo;
        }
    } catch (e) {
        console.error('Error cargando hero config:', e);
    }
}

async function guardarHeroConfig(e) {
    e.preventDefault();
    const titulo = document.getElementById('hero-titulo-input').value.trim();
    const subtitulo = document.getElementById('hero-subtitulo-input').value.trim();

    if (!titulo && !subtitulo) {
        mostrarMensajeHero('Debes ingresar al menos un campo.', 'error');
        return;
    }

    try {
        const r = await fetch(API + '/hero-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ titulo: titulo || undefined, subtitulo: subtitulo || undefined })
        });
        const d = await r.json();
        mostrarMensajeHero(d.mensaje, d.exito ? 'exito' : 'error');
    } catch (e) {
        mostrarMensajeHero('Error al guardar.', 'error');
    }
}

function mostrarMensajeHero(texto, tipo) {
    const msg = document.getElementById('mensaje-hero');
    msg.textContent = texto;
    msg.className = 'mensaje ' + tipo;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

// ============================================
// ESPECIALIDADES (CRUD)
// ============================================
async function cargarEspecialidades() {
    try {
        const r = await fetch('/api/especialidades');
        const d = await r.json();
        const tbody = document.getElementById('tbody-especialidades');
        if (!d.datos || d.datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Sin especialidades.</td></tr>';
            return;
        }
        tbody.innerHTML = d.datos.map(e => `
            <tr>
                <td>${e.nombre}</td>
                <td>${e.descripcion || ''}</td>
                <td>✅</td>
                <td>
                    <button class="btn-sm" onclick="editarEspecialidad('${e.id}', '${e.nombre.replace(/'/g, "\\'")}', '${(e.descripcion || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="eliminarEspecialidad('${e.id}')">Eliminar</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

function editarEspecialidad(id, nombre, descripcion) {
    document.getElementById('esp-id').value = id;
    document.getElementById('esp-nombre').value = nombre;
    document.getElementById('esp-descripcion').value = descripcion;
}

function cancelarEdicionEsp() {
    document.getElementById('esp-id').value = '';
    document.getElementById('esp-nombre').value = '';
    document.getElementById('esp-descripcion').value = '';
}

async function guardarEspecialidad(e) {
    e.preventDefault();
    const id = document.getElementById('esp-id').value;
    const nombre = document.getElementById('esp-nombre').value.trim();
    const descripcion = document.getElementById('esp-descripcion').value.trim();
    if (!nombre) return;

    const url = id ? API + '/especialidades/' + id : API + '/especialidades';
    const method = id ? 'PUT' : 'POST';

    try {
        const r = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ nombre, descripcion: descripcion || undefined })
        });
        const d = await r.json();
        const msg = document.getElementById('mensaje-esp');
        msg.textContent = d.mensaje;
        msg.className = 'mensaje ' + (d.exito ? 'exito' : 'error');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2000);
        if (d.exito) {
            cancelarEdicionEsp();
            cargarEspecialidades();
        }
    } catch (e) { console.error(e); }
}

async function eliminarEspecialidad(id) {
    if (!confirm('¿Eliminar esta especialidad?')) return;
    try {
        await fetch(API + '/especialidades/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        cargarEspecialidades();
    } catch (e) { console.error(e); }
}

// ============================================
// CLÍNICAS (CRUD)
// ============================================
async function cargarClinicas() {
    try {
        const r = await fetch('/api/clinicas');
        const d = await r.json();
        const tbody = document.getElementById('tbody-clinicas');
        if (!d.datos || d.datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Sin clínicas.</td></tr>';
            return;
        }
        tbody.innerHTML = d.datos.map(c => `
            <tr>
                <td>${c.nombre}</td>
                <td>${c.direccion || ''}</td>
                <td>${c.telefono || ''}</td>
                <td>✅</td>
                <td>
                    <button class="btn-sm" onclick="editarClinica('${c.id}', '${c.nombre.replace(/'/g, "\\'")}', '${(c.direccion || '').replace(/'/g, "\\'")}', '${(c.telefono || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="eliminarClinica('${c.id}')">Eliminar</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

function editarClinica(id, nombre, direccion, telefono) {
    document.getElementById('cli-id').value = id;
    document.getElementById('cli-nombre').value = nombre;
    document.getElementById('cli-direccion').value = direccion;
    document.getElementById('cli-telefono').value = telefono;
}

function cancelarEdicionCli() {
    document.getElementById('cli-id').value = '';
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-direccion').value = '';
    document.getElementById('cli-telefono').value = '';
}

async function guardarClinica(e) {
    e.preventDefault();
    const id = document.getElementById('cli-id').value;
    const nombre = document.getElementById('cli-nombre').value.trim();
    const direccion = document.getElementById('cli-direccion').value.trim();
    const telefono = document.getElementById('cli-telefono').value.trim();
    if (!nombre) return;

    const url = id ? API + '/clinicas/' + id : API + '/clinicas';
    const method = id ? 'PUT' : 'POST';

    try {
        const r = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ nombre, direccion: direccion || undefined, telefono: telefono || undefined })
        });
        const d = await r.json();
        const msg = document.getElementById('mensaje-cli');
        msg.textContent = d.mensaje;
        msg.className = 'mensaje ' + (d.exito ? 'exito' : 'error');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2000);
        if (d.exito) {
            cancelarEdicionCli();
            cargarClinicas();
        }
    } catch (e) { console.error(e); }
}

async function eliminarClinica(id) {
    if (!confirm('¿Eliminar esta clínica?')) return;
    try {
        await fetch(API + '/clinicas/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        cargarClinicas();
    } catch (e) { console.error(e); }
}

// ============================================
// SEGUROS (CRUD)
// ============================================
async function cargarSeguros() {
    try {
        const r = await fetch('/api/seguros');
        const d = await r.json();
        const tbody = document.getElementById('tbody-seguros');
        if (!d.datos || d.datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Sin seguros.</td></tr>';
            return;
        }
        tbody.innerHTML = d.datos.map(s => `
            <tr>
                <td>${s.nombre}</td>
                <td>${s.descripcion || ''}</td>
                <td>✅</td>
                <td>
                    <button class="btn-sm" onclick="editarSeguro('${s.id}', '${s.nombre.replace(/'/g, "\\'")}', '${(s.descripcion || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-sm btn-danger" onclick="eliminarSeguro('${s.id}')">Eliminar</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

function editarSeguro(id, nombre, descripcion) {
    document.getElementById('seg-id').value = id;
    document.getElementById('seg-nombre').value = nombre;
    document.getElementById('seg-descripcion').value = descripcion;
}

function cancelarEdicionSeg() {
    document.getElementById('seg-id').value = '';
    document.getElementById('seg-nombre').value = '';
    document.getElementById('seg-descripcion').value = '';
}

async function guardarSeguro(e) {
    e.preventDefault();
    const id = document.getElementById('seg-id').value;
    const nombre = document.getElementById('seg-nombre').value.trim();
    const descripcion = document.getElementById('seg-descripcion').value.trim();
    if (!nombre) return;

    const url = id ? API + '/seguros/' + id : API + '/seguros';
    const method = id ? 'PUT' : 'POST';

    try {
        const r = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ nombre, descripcion: descripcion || undefined })
        });
        const d = await r.json();
        const msg = document.getElementById('mensaje-seg');
        msg.textContent = d.mensaje;
        msg.className = 'mensaje ' + (d.exito ? 'exito' : 'error');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2000);
        if (d.exito) {
            cancelarEdicionSeg();
            cargarSeguros();
        }
    } catch (e) { console.error(e); }
}

async function eliminarSeguro(id) {
    if (!confirm('¿Eliminar este seguro?')) return;
    try {
        await fetch(API + '/seguros/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        cargarSeguros();
    } catch (e) { console.error(e); }
}