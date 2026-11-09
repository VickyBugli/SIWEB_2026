
// guarda el token del login en el navegador

const CLAVE = 'siweb_token' // nombre

export function guardarToken(token: string) {
  localStorage.setItem(CLAVE, token) // no se borra aunque se cierre la pantalla
}

export function obtenerToken() {
  return localStorage.getItem(CLAVE)
}

export function borrarToken() {
  localStorage.removeItem(CLAVE)
}