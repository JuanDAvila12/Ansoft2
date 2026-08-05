// ============================================
// VÍA DORADA - Lógica de Login
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');
    const mensajeDiv = document.getElementById('mensaje');

    if (!loginForm) return; // No estamos en la página de login

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            mostrarMensaje('Por favor completa todos los campos.', 'error');
            return;
        }

        mensajeDiv.style.display = 'none';
        mensajeDiv.className = 'mensaje';

        try {
            const respuesta = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const datos = await respuesta.json();

            if (datos.exito) {
                mostrarMensaje('Inicio de sesión exitoso. Redirigiendo...', 'exito');
                // Guardar token y datos del usuario
                localStorage.setItem('token', datos.token);
                localStorage.setItem('usuario', JSON.stringify(datos.usuario));

                // Redirigir según rol
                setTimeout(() => {
                    if (datos.usuario.rol === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 800);
            } else {
                mostrarMensaje(datos.mensaje || 'Credenciales incorrectas.', 'error');
            }

        } catch (error) {
            console.error('Error de conexión:', error);
            mostrarMensaje('Error de conexión con el servidor.', 'error');
        }
    });

    function mostrarMensaje(texto, tipo) {
        mensajeDiv.textContent = texto;
        mensajeDiv.className = 'mensaje ' + tipo;
        mensajeDiv.style.display = 'block';
    }

});