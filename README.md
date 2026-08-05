<<<<<<< HEAD
# 🏥 Vía Dorada — Sistema de Gestión Médica

Sistema web integral para la gestión de clínicas médicas, pacientes, doctores, especialidades, seguros y citas. Incluye panel de administración con control de acceso basado en roles (admin, doctor, paciente, recepcionista).

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Node.js + Express 5 |
| **Base de datos** | PostgreSQL (Supabase) |
| **Frontend** | HTML5 + CSS3 + JavaScript vanilla |
| **Autenticación** | Token-based (UUID) vía tabla `sesiones` |
| **Dependencias** | `@supabase/supabase-js`, `cors`, `dotenv`, `express`, `postgres` |

---

## 📁 Estructura del proyecto

```
Clinica_Ansoft/
├── .gitignore                      # Archivos ignorados por Git
├── package.json                    # Dependencias raíz (Supabase client)
├── README.md                       # Este archivo
├── init_bd.sql                     # Script completo de inicialización de BD
├── crear_tablas_faltantes.sql      # Script mínimo para tablas pendientes
│
├── backend/
│   ├── .gitignore                  # Ignora .env local
│   ├── package.json                # Dependencias y scripts del backend
│   ├── index.js                    # Servidor Express + todos los endpoints
│   ├── db.js                       # Conexión a Supabase
│   ├── check_schema.js             # Verificación del esquema de BD
│   ├── migrate.js                  # Script de migración
│   ├── test_db.js                  # Pruebas de conexión
│   └── .env                        # Variables de entorno (NO incluido en Git)
│
└── frontend/
    ├── index.html                  # Landing page con hero dinámico
    ├── login.html                  # Inicio de sesión
    ├── especialidades.html         # Catálogo de especialidades médicas
    ├── clinicas.html               # Directorio de clínicas/sedes
    ├── seguros.html                # Catálogo de seguros médicos
    ├── admin.html                  # Panel de administración
    ├── admin.js                    # Lógica del panel admin
    ├── app.js                      # Lógica compartida (auth, sesión)
    └── style.css                   # Estilos globales
```

---

## 🔧 Requisitos previos

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- Cuenta en **[Supabase](https://supabase.com)** con un proyecto creado
- PostgreSQL (gestionado por Supabase)

---

## ⚙️ Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/usuario/via-dorada.git
cd via-dorada/Clinica_Ansoft
```

### 2. Configurar variables de entorno

Crea el archivo `backend/.env` con las credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...      # service_role key (NO la anon key)
```

> ⚠️ **Importante:** Usa la **service_role key** de Supabase (Settings → API → service_role secret). Esta clave tiene acceso total a la base de datos y **nunca** debe exponerse en el frontend.

### 3. Inicializar la base de datos

Abre el **SQL Editor** en el dashboard de Supabase y ejecuta (en orden):

1. **`init_bd.sql`** — Crea todas las tablas, tipos enum, políticas RLS, triggers, vistas y datos semilla.
2. **`crear_tablas_faltantes.sql`** — Solo si `init_bd.sql` no se ejecutó completo (crea `sesiones`, `configuracion`, `seguros`).

### 4. Instalar dependencias e iniciar

```bash
# Instalar dependencias del backend
cd backend
npm install

# Iniciar servidor en modo desarrollo (con --watch)
npm run dev

# O iniciar en producción
npm start
```

El servidor estará disponible en **`http://localhost:3000`**.

### 5. Abrir el frontend

El backend sirve los archivos estáticos del frontend automáticamente. Abre **`http://localhost:3000`** en tu navegador.

Alternativamente, puedes abrir `frontend/index.html` directamente, pero la API requiere que el backend esté corriendo.

---

## 🔑 Credenciales de prueba

El script `init_bd.sql` crea los siguientes usuarios de prueba:

| Rol | Email | Contraseña |
|---|---|---|
| **Admin** | `admin@viadorada.com` | `admin123` |
| **Doctor** | `carlos.mendoza@viadorada.com` | `doctor123` |
| **Paciente** | `maria.garcia@email.com` | `paciente123` |

> ⚠️ **Cambia estas contraseñas en producción.** Las contraseñas actualmente se almacenan en texto plano. Se recomienda migrar a bcrypt (ver sección de mejoras pendientes).

---

## 📡 Endpoints de la API

### Endpoints públicos (sin autenticación)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api` | Health check y lista de endpoints |
| `GET` | `/api/hero-config` | Obtener título y subtítulo del hero |
| `GET` | `/api/especialidades` | Listar especialidades médicas |
| `GET` | `/api/clinicas` | Listar clínicas / sedes |
| `GET` | `/api/seguros` | Listar seguros médicos |
| `POST` | `/api/login` | Iniciar sesión |
| `GET` | `/api/agenda` | Obtener citas pendientes |

### Endpoints protegidos (requieren token)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/logout` | Token | Cerrar sesión |
| `GET` | `/api/sesion` | Token | Verificar sesión activa |

### Panel de administración (requiere token + rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/usuarios` | Listar todos los usuarios |
| `PUT` | `/api/admin/usuarios/:id` | Actualizar rol/estatus de usuario |
| `PUT` | `/api/admin/hero-config` | Actualizar texto del hero |
| `POST` | `/api/admin/especialidades` | Crear especialidad |
| `PUT` | `/api/admin/especialidades/:id` | Actualizar especialidad |
| `DELETE` | `/api/admin/especialidades/:id` | Eliminar especialidad |
| `POST` | `/api/admin/clinicas` | Crear clínica |
| `PUT` | `/api/admin/clinicas/:id` | Actualizar clínica |
| `DELETE` | `/api/admin/clinicas/:id` | Eliminar clínica |
| `POST` | `/api/admin/seguros` | Crear seguro |
| `PUT` | `/api/admin/seguros/:id` | Actualizar seguro |
| `DELETE` | `/api/admin/seguros/:id` | Eliminar seguro |

### Formato de autenticación

Incluye el token en el header `Authorization`:

```
Authorization: Bearer <token>
```

El token se obtiene al hacer login (`POST /api/login`).

---

## 🗄️ Esquema de base de datos

| Tabla | Descripción |
|---|---|
| `especialidades` | Catálogo de especialidades médicas |
| `clinicas` | Sedes / sucursales |
| `seguros` | Seguros médicos aceptados |
| `usuariosd` | Usuarios del sistema (admin, doctor, paciente, recepcionista) |
| `pacientes` | Datos específicos de pacientes |
| `doctores` | Datos específicos de doctores |
| `horarios_doctor` | Horarios de atención por doctor |
| `citas` | Citas médicas |
| `sesiones` | Tokens de sesión activa |
| `configuracion` | Parámetros dinámicos del sistema |

La base de datos incluye:
- **Row Level Security (RLS)** habilitado en todas las tablas
- **Triggers** para actualización automática de timestamps y prevención de solapamiento de citas
- **Vistas** predefinidas: `vista_agenda` y `vista_doctores`
- **Índices** en columnas de búsqueda frecuente (email, fechas, estatus)

---

## 🔒 Variables de entorno

| Variable | Descripción | Ubicación |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase | `backend/.env` |
| `PORT` | Puerto del servidor (opcional, default: 3000) | `backend/.env` |

---

## 🚧 Mejoras pendientes (TODO)

- [ ] Implementar hashing de contraseñas con **bcrypt**
- [ ] Agregar validación de email y formato en registro
- [ ] Paginación en endpoints de listado
- [ ] Subida de imágenes/avatar para doctores
- [ ] Notificaciones por email para confirmación de citas
- [ ] Tests unitarios y de integración
- [ ] Rate limiting en el endpoint de login
- [ ] Migrar frontend a un framework moderno (React/Vue)
- [ ] Implementar refresh tokens para sesiones persistentes

---

## 🤝 Contribuciones

¿Interesado en contribuir? Revisa las mejoras pendientes o abre un issue con tu propuesta. Toda colaboración es bienvenida.

---

## 📝 Licencia

Proyecto privado — **Vía Dorada**. Todos los derechos reservados.

---

## 👥 Créditos

Desarrollado para **Vía Dorada** — Gestión Médica Integral.

Documentación y estructura del proyecto generada con asistencia de [Cline](https://github.com/cline/cline), un agente de ingeniería de software autónomo.
=======
# Ansoft2
>>>>>>> bd8104f2db1ed618864a6efda9db25a0a4a63d1e
