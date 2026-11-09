import { pedir } from '@/shared/services/apiCliente'

export type Materia = {
  id_materia: number
  nombre_materia: string
  anio_carrera: number
}

// GET /api/materias: todas las materias
export function obtenerMaterias() {
  return pedir<Materia[]>('/materias')
}