import { pedir } from '@/shared/services/apiCliente'
import { guardarToken, borrarToken } from '@/shared/services/sesion'

// qué pedirle a la API al iniciar sesión

type RespuestaLogin = {
  token: string
  tipo: string
  expira_en_segundos: number
}

export async function iniciarSesion(email: string, password: string) {
  const datos = await pedir<RespuestaLogin>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  guardarToken(datos.token)
}

// para el  registrarse

// Paso 1: POST /api/auth/registro. La cuenta queda pendiente hasta verificar el email.
export async function registrar(
  nombre_apellido: string,
  email: string,
  password: string,
  es_avanzado: boolean,
) {
  await pedir('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre_apellido, email, password, es_avanzado }),
  })
}

// Paso 2: POST /api/auth/verificar-email. Si el código es correcto, se crea la cuenta.
export async function verificarEmail(email: string, codigo: string) {
  await pedir('/auth/verificar-email', {
    method: 'POST',
    body: JSON.stringify({ email, codigo }),
  })
}

// POST /api/auth/reenviar-verificacion: manda un código nuevo.
export async function reenviarCodigo(email: string) {
  await pedir('/auth/reenviar-verificacion', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// POST /api/auth/logout: cierra la sesión en el servidor y borra el token del navegador.
export async function cerrarSesion() {
  try {
    await pedir('/auth/logout', { method: 'POST' })
  } finally {
    borrarToken()
  }
}