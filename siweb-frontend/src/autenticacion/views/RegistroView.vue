<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { registrar, verificarEmail, reenviarCodigo } from '../services/authApi'
import { ErrorApi } from '@/shared/services/apiCliente'
import logo from '@/assets/logo.png'

// En qué paso estamos: 1 = crear cuenta, 2 = verificar email
const paso = ref<1 | 2>(1)

// Datos del formulario del paso 1
const nombre = ref('')
const email = ref('')
const password = ref('')
const esAvanzado = ref(false)

// Dato del paso 2
const codigo = ref('')

// Estado de la pantalla
const error = ref('')
const aviso = ref('')
const cargando = ref(false)

const router = useRouter()

// Convierte un error de la API en un mensaje para mostrar
function mensajeDeError(e: unknown) {
  if (e instanceof ErrorApi && (e.estado === 400 || e.estado === 409)) {
    return e.message
  }
  return 'No se pudo conectar con el servidor. Intentá de nuevo.'
}

// Paso 1: crear la cuenta
async function enviarRegistro() {
  error.value = ''
  cargando.value = true
  try {
    await registrar(nombre.value, email.value, password.value, esAvanzado.value)
    paso.value = 2
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

// Paso 2: verificar el código
async function enviarCodigo() {
  error.value = ''
  aviso.value = ''
  cargando.value = true
  try {
    await verificarEmail(email.value, codigo.value.trim())
    router.push({ path: '/login', query: { verificado: '1' } })
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

// Paso 2: pedir un código nuevo
async function reenviar() {
  error.value = ''
  try {
    await reenviarCodigo(email.value)
    aviso.value = 'Te enviamos un código nuevo.'
  } catch (e) {
    error.value = mensajeDeError(e)
  }
}
</script>

<template>
  <main class="pantalla">
    <!-- PASO 1: crear cuenta -->
    <form v-if="paso === 1" class="tarjeta" @submit.prevent="enviarRegistro">
      <img :src="logo" alt="Logo" class="logo" />
      <p class="nombre">Comunidad Facultad de Informática</p>

      <h1>Crear cuenta</h1>
      <p class="subtitulo">Solo con tu email institucional de la facultad.</p>

      <p v-if="error" class="error">{{ error }}</p>

      <label>
        Nombre y apellido
        <input v-model="nombre" type="text" placeholder="Valentina Gómez" required />
      </label>

      <label>
        Email institucional
        <input v-model="email" type="email" placeholder="nombre.apellido@fi.uncoma.edu.ar" required />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" placeholder="Mínimo 8 caracteres" minlength="8" required />
      </label>

      <label class="casilla">
        <input v-model="esAvanzado" type="checkbox" />
        Soy estudiante avanzado/a
      </label>

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Registrando…' : 'Registrarme' }}
      </button>

      <p class="enlace">
        <RouterLink to="/login">¿Ya tenés cuenta? Iniciá sesión</RouterLink>
      </p>
    </form>

    <!-- PASO 2: verificar email -->
    <form v-else class="tarjeta" @submit.prevent="enviarCodigo">
      <img :src="logo" alt="Logo" class="logo" />

      <h1>Verificá tu email</h1>
      <p class="subtitulo">
        Te enviamos un código a <b>{{ email }}</b>. Vence en 30 minutos.
      </p>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="aviso" class="aviso">{{ aviso }}</p>

      <label>
        Código de verificación
        <input v-model="codigo" type="text" placeholder="Pegá el código que recibiste" required />
      </label>

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Verificando…' : 'Verificar' }}
      </button>

      <p class="enlace">
        ¿No te llegó?
        <a href="#" @click.prevent="reenviar">Reenviar código</a>
      </p>
    </form>
  </main>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)),
    url('../../assets/fondo-registro.png') center / cover;
}

.tarjeta {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 40px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.logo {
  width: 56px;
  height: 56px;
}

.nombre {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

h1 {
  margin: 16px 0 0;
  font-size: 28px;
}

.subtitulo {
  margin: 0;
  color: #666666;
}

.error {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #d50000;
  color: #ffffff;
}

.aviso {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #e6f4ea;
  color: #1e6b34;
}

label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

input {
  padding: 12px 16px;
  font-size: 15px;
  border: 1px solid #b3b3b3;
  border-radius: 8px;
}

.casilla {
  flex-direction: row;
  align-items: center;
  font-weight: 400;
  font-size: 15px;
}

.casilla input {
  width: 18px;
  height: 18px;
  padding: 0;
}

button {
  padding: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  background: #0047ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.enlace {
  margin: 0;
  text-align: center;
}

.enlace a {
  color: #0047ff;
  font-weight: 600;
  text-decoration: none;
}
</style>