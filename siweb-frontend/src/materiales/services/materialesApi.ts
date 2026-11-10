import { pedir, ErrorApi } from '@/shared/services/apiCliente'
import { obtenerToken } from '@/shared/services/sesion'

export type Material = {
  id_material: number
  nombre_archivo: string
  formato_archivo: string
  fecha_publicacion: string
  tipo_material: string
  descripcion: string
  tamano: number
  estado: string
  id_materia: number
  id_usuario: number
  valoracion_promedio?: number | null
  cantidad_votos?: number
}

// GET /api/materiales?id_materia=X: materiales publicados de una materia
export function obtenerMaterialesDeMateria(idMateria: number) {
  return pedir<Material[]>(`/materiales?id_materia=${idMateria}`)
}

// POST /api/materiales: publica un material con su archivo (multipart/form-data)
export function publicarMaterial(
  archivo: File,
  idMateria: number,
  tipoMaterial: string,
  descripcion: string,
) {
  const formulario = new FormData()
  formulario.append('id_materia', String(idMateria))
  formulario.append('tipo_material', tipoMaterial)
  formulario.append('descripcion', descripcion)
  formulario.append('archivo', archivo)
  return pedir<{ id_material: number }>('/materiales', { method: 'POST', body: formulario })
}

export type FiltrosMateriales = {
  texto_buscado?: string
  id_materia?: number
  tipo_material?: string
  anio_carrera?: number
}

// Listado general o filtrado: GET /api/materiales
export function obtenerMateriales(filtros: FiltrosMateriales = {}): Promise<Material[]> {
  const parametros = new URLSearchParams()
  if (filtros.texto_buscado) parametros.set('texto_buscado', filtros.texto_buscado)
  if (filtros.id_materia !== undefined) parametros.set('id_materia', String(filtros.id_materia))
  if (filtros.tipo_material) parametros.set('tipo_material', filtros.tipo_material)
  if (filtros.anio_carrera !== undefined) parametros.set('anio_carrera', String(filtros.anio_carrera))

  const query = parametros.toString()
  return pedir<Material[]>(`/materiales${query ? `?${query}` : ''}`)
}

// GET /api/materiales/:id
export function obtenerDetalleMaterial(idMaterial: number): Promise<Material> {
  return pedir<Material>(`/materiales/${idMaterial}`)
}

// La descarga requiere el token de sesión y devuelve un archivo, no JSON.
export async function descargarArchivoMaterial(material: Material): Promise<void> {
  const token = obtenerToken()
  if (!token) throw new ErrorApi(401, 'Iniciá sesión para descargar el material.')

  const respuesta = await fetch(`/api/materiales/${material.id_material}/descargar`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({})) as { error?: string }
    throw new ErrorApi(respuesta.status, datos.error ?? 'No se pudo descargar el material.')
  }

  const archivo = await respuesta.blob()
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = material.nombre_archivo
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ComentarioMaterial = {
  id_comentario: number
  id_usuario: number
  autor: string
  contenido: string
  fecha_creacion: string
}

export function obtenerComentariosMaterial(idMaterial: number): Promise<ComentarioMaterial[]> {
  return pedir<ComentarioMaterial[]>(`/materiales/${idMaterial}/comentarios`)
}

export function publicarComentarioMaterial(idMaterial: number, contenido: string) {
  return pedir<{ id_observacion: number; subtipo: string }>(`/materiales/${idMaterial}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ contenido })
  })
}

export function reportarMaterial(idMaterial: number, motivo_reporte: string) {
  return pedir<{ id_observacion: number; subtipo: string }>(`/materiales/${idMaterial}/reportes`, {
    method: 'POST',
    body: JSON.stringify({ motivo_reporte })
  })
}

export function reportarComentario(idComentario: number, motivo_reporte: string) {
  return pedir<{ id_observacion: number; subtipo: string }>(`/comentarios/${idComentario}/reportes`, {
    method: 'POST',
    body: JSON.stringify({ motivo_reporte })
  })
}