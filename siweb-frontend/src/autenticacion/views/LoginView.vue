<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { iniciarSesion } from '../services/authApi'
import { ErrorApi } from '@/shared/services/apiCliente'
import logo from '@/assets/logo.png'

const email = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

const router = useRouter()
const route = useRoute()

// true si venimos de verificar el email en el registro
const recienVerificado = route.query.verificado === '1'

async function enviar() {
  error.value = ''
  cargando.value = true
  try {
    await iniciarSesion(email.value, password.value)
    router.push('/materiales')
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 401) {
      error.value = 'Email o contraseña incorrectos'
    } else {
      error.value = 'No se pudo conectar con el servidor. Intentá de nuevo.'
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <main class="pantalla">
    <form class="tarjeta" @submit.prevent="enviar">
      <img :src="logo" alt="Logo" class="logo" />
      <p class="nombre">Comunidad Facultad de Informática</p>

      <h1>Iniciar sesión</h1>
      <p class="subtitulo">Los materiales de estudio de la Facultad de Informática, en un solo lugar.</p>

      <p v-if="recienVerificado && !error" class="aviso">¡Cuenta verificada! Ya podés iniciar sesión.</p>
      <p v-if="error" class="error">{{ error }}</p>

      <label>
        Email institucional
        <input v-model="email" type="email" placeholder="nombre.apellido@fi.uncoma.edu.ar" required />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" placeholder="••••••••" required />
      </label>

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Ingresando…' : 'Iniciar sesión' }}
      </button>

      <p class="enlace">
        <RouterLink to="/registro">¿No tenés cuenta? Registrate</RouterLink>
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
    url('../../assets/fondo-login.jpg') center / cover;
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

.aviso {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #e6f4ea;
  color: #1e6b34;
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