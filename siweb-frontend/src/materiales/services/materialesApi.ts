import { pedir } from '@/shared/services/apiCliente'

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