import { pedir } from '@/shared/services/apiCliente'

export type Reporte = {
  id_observacion: number
  id_material: number
  id_reportante: number
  fecha_creacion: string
  id_comentario: number | null
  motivo_reporte: string
  estado: string
  fecha_resolucion: string | null
}

export type AccionReporte =
  | 'desestimar_reporte'
  | 'solicitar_eliminacion'
  | 'aprobar_eliminacion'
  | 'rechazar_eliminacion'

export function obtenerReportes(): Promise<Reporte[]> {
  return pedir<Reporte[]>('/reportes')
}

export function registrarAccionReporte(idReporte: number, tipo_accion: AccionReporte) {
  return pedir<{ id_reporte: number; estado: string }>(`/reportes/${idReporte}/acciones`, {
    method: 'POST',
    body: JSON.stringify({ tipo_accion })
  })
}

export async function obtenerNombreMaterial(idMaterial: number): Promise<string | null> {
  try {
    const material = await pedir<{ nombre_archivo: string }>(`/materiales/${idMaterial}`)
    return material.nombre_archivo
  } catch {
    return null
  }
}

export type SesionActual = {
  id_usuario: number
  rol: string
}

export function obtenerSesionActual(): Promise<SesionActual> {
  return pedir<SesionActual>('/auth/yo')
}
