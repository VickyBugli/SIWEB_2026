import { obtenerToken } from './sesion'

// pedidos a la API

export class ErrorApi extends Error {
// guarda el código de error para ver que mensaje mostrar
  estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const encabezados = new Headers(opciones.headers)
  if (opciones.body && !(opciones.body instanceof FormData)) {
    encabezados.set('Content-Type', 'application/json')
  }
  const token = obtenerToken()
  if (token) {
    encabezados.set('Authorization', `Bearer ${token}`)
  }

  const respuesta = await fetch(`/api${ruta}`, { ...opciones, headers: encabezados })

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}))
    throw new ErrorApi(respuesta.status, datos.error ?? 'Ocurrió un error')
  }
  if (respuesta.status === 204) {
    return undefined as T
  }
  return respuesta.json() as Promise<T>
}