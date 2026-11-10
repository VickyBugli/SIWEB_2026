<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import '@/shared/styles/paginasContenido.css'
import { ErrorApi } from '@/shared/services/apiCliente'
import {
  obtenerReportes,
  obtenerSesionActual,
  obtenerNombreMaterial,
  registrarAccionReporte,
  type Reporte,
  type AccionReporte
} from '../services/reportesApi'

type Pestana = 'pendientes' | 'solicitudes' | 'resueltos'

const pestana = ref<Pestana>('pendientes')
const reportes = ref<Reporte[]>([])
const nombresMateriales = ref<Record<number, string>>({})
const cargando = ref(false)
const accionEnCurso = ref<number | null>(null)
const error = ref('')
const aviso = ref('')
const necesitaLogin = ref(false)
const sinPermiso = ref(false)
const rolUsuario = ref('')
const esAdministrador = computed(() => rolUsuario.value === 'administrador')

const pendientes = computed(() => reportes.value.filter(r => r.estado === 'pendiente'))
const solicitudes = computed(() => reportes.value.filter(r => r.estado === 'solicitud_eliminacion'))
const resueltos = computed(() => reportes.value.filter(r =>
  ['desestimado', 'eliminado', 'rechazado'].includes(r.estado)
))

const reportesVisibles = computed(() => {
  if (pestana.value === 'pendientes') return pendientes.value
  if (pestana.value === 'solicitudes') return solicitudes.value
  return resueltos.value
})

async function completarNombres(lista: Reporte[]) {
  const ids = [...new Set(lista.map(r => r.id_material))]
  await Promise.all(ids.map(async id => {
    if (nombresMateriales.value[id]) return
    const nombre = await obtenerNombreMaterial(id)
    if (nombre) nombresMateriales.value[id] = nombre
  }))
}

async function cargarReportes() {
  cargando.value = true
  error.value = ''
  necesitaLogin.value = false
  sinPermiso.value = false

  try {
    const [lista, sesion] = await Promise.all([obtenerReportes(), obtenerSesionActual()])
    rolUsuario.value = sesion.rol
    reportes.value = lista
    void completarNombres(lista)
  } catch (e) {
    reportes.value = []
    rolUsuario.value = ''
    if (e instanceof ErrorApi && e.estado === 401) {
      necesitaLogin.value = true
      error.value = 'Necesitás iniciar sesión para consultar los reportes.'
    } else if (e instanceof ErrorApi && e.estado === 403) {
      sinPermiso.value = true
      error.value = 'Esta sección está disponible para moderadores y administradores.'
    } else {
      error.value = 'No se pudieron cargar los reportes.'
    }
  } finally {
    cargando.value = false
  }
}

onMounted(() => { void cargarReportes() })

function nombreContenido(reporte: Reporte): string {
  const nombre = nombresMateriales.value[reporte.id_material] ?? `Material #${reporte.id_material}`
  return reporte.id_comentario === null ? `Material · ${nombre}` : `Comentario #${reporte.id_comentario} · ${nombre}`
}

function fechaRelativa(fecha: string): string {
  const valor = new Date(fecha).getTime()
  if (Number.isNaN(valor)) return 'Fecha no disponible'
  const dias = Math.max(0, Math.floor((Date.now() - valor) / 86400000))
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

function fechaCompleta(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? '' : valor.toLocaleDateString('es-AR')
}

function textoEstado(estado: string): string {
  const etiquetas: Record<string, string> = {
    pendiente: 'Pendiente',
    solicitud_eliminacion: 'Solicitud de eliminación',
    desestimado: 'Desestimado',
    eliminado: 'Eliminado',
    rechazado: 'Rechazado'
  }
  return etiquetas[estado] ?? estado
}

async function ejecutarAccion(reporte: Reporte, accion: AccionReporte) {
  if (accionEnCurso.value !== null) return
  if (['aprobar_eliminacion', 'rechazar_eliminacion'].includes(accion) && !esAdministrador.value) {
    error.value = 'Solo un administrador puede aprobar o rechazar eliminaciones.'
    return
  }
  if (accion === 'aprobar_eliminacion' && !window.confirm('¿Confirmás la eliminación del contenido reportado?')) return

  accionEnCurso.value = reporte.id_observacion
  error.value = ''
  aviso.value = ''

  try {
    await registrarAccionReporte(reporte.id_observacion, accion)
    await cargarReportes()
    aviso.value = 'El reporte se actualizó correctamente.'
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 403) {
      error.value = 'No tenés permisos para realizar esta acción.'
    } else if (e instanceof ErrorApi && e.estado === 409) {
      error.value = 'El reporte ya cambió de estado. Actualizá el listado.'
    } else if (e instanceof ErrorApi && e.estado === 401) {
      error.value = 'Tu sesión venció. Volvé a iniciar sesión.'
      necesitaLogin.value = true
    } else {
      error.value = 'No se pudo actualizar el reporte.'
    }
  } finally {
    accionEnCurso.value = null
  }
}
</script>

<template>
  <main class="pantalla-reportes">
    <div class="contenedor">
      <div class="titulo">
        <h1>Reportes</h1>
        <span class="identificador">Moderación</span>
      </div>

      <div class="pestanas" role="tablist" aria-label="Estado de reportes">
        <button type="button" role="tab" :aria-selected="pestana === 'pendientes'"
          :class="{ activa: pestana === 'pendientes' }" @click="pestana = 'pendientes'">
          Pendientes ({{ pendientes.length }})
        </button>
        <button type="button" role="tab" :aria-selected="pestana === 'solicitudes'"
          :class="{ activa: pestana === 'solicitudes' }" @click="pestana = 'solicitudes'">
          Solicitud de eliminación ({{ solicitudes.length }})
        </button>
        <button type="button" role="tab" :aria-selected="pestana === 'resueltos'"
          :class="{ activa: pestana === 'resueltos' }" @click="pestana = 'resueltos'">
          Resueltos ({{ resueltos.length }})
        </button>
      </div>

      <p v-if="error" class="mensaje error" role="alert">
        {{ error }}
        <RouterLink v-if="necesitaLogin" to="/login">Iniciar sesión</RouterLink>
      </p>
      <p v-if="aviso" class="mensaje exito" role="status">{{ aviso }}</p>

      <p v-if="cargando" class="estado-carga">Cargando reportes...</p>

      <template v-else-if="!sinPermiso && !necesitaLogin && (!error || reportes.length > 0)">
        <div class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Contenido reportado</th>
                <th>Motivo</th>
                <th>Reportado por</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="reporte in reportesVisibles" :key="reporte.id_observacion">
                <td class="contenido">
                  <RouterLink v-if="reporte.estado !== 'eliminado'" :to="`/materiales/${reporte.id_material}`">
                    {{ nombreContenido(reporte) }}
                  </RouterLink>
                  <span v-else>{{ nombreContenido(reporte) }}</span>
                </td>
                <td>{{ reporte.motivo_reporte }}</td>
                <td>Usuario #{{ reporte.id_reportante }}</td>
                <td :title="fechaCompleta(reporte.fecha_creacion)">{{ fechaRelativa(reporte.fecha_creacion) }}</td>
                <td>
                  <span class="estado-etiqueta" :class="reporte.estado">
                    {{ textoEstado(reporte.estado) }}
                  </span>
                </td>
                <td>
                  <div v-if="reporte.estado === 'pendiente'" class="acciones">
                    <button type="button" class="boton-secundario"
                      :disabled="accionEnCurso !== null" @click="ejecutarAccion(reporte, 'desestimar_reporte')">
                      <span class="material-symbols-outlined" aria-hidden="true">check_circle</span> Desestimar
                    </button>
                    <button type="button" class="boton-primario"
                      :disabled="accionEnCurso !== null" @click="ejecutarAccion(reporte, 'solicitar_eliminacion')">
                      <span class="material-symbols-outlined" aria-hidden="true">flag</span> Solicitar eliminación
                    </button>
                  </div>
                  <div v-else-if="reporte.estado === 'solicitud_eliminacion'" class="acciones">
                    <template v-if="esAdministrador">
                      <button type="button" class="boton-destructivo"
                        :disabled="accionEnCurso !== null" @click="ejecutarAccion(reporte, 'aprobar_eliminacion')">
                        <span class="material-symbols-outlined" aria-hidden="true">delete</span> Aprobar eliminación
                      </button>
                      <button type="button" class="boton-secundario"
                        :disabled="accionEnCurso !== null" @click="ejecutarAccion(reporte, 'rechazar_eliminacion')">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span> Rechazar
                      </button>
                    </template>
                    <span v-else class="sin-acciones">Pendiente de administrador</span>
                  </div>
                  <span v-else class="sin-acciones">—</span>
                </td>
              </tr>
              <tr v-if="reportesVisibles.length === 0">
                <td colspan="6" class="vacio">No hay reportes en esta categoría.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="pestana === 'solicitudes' && !esAdministrador" class="nota">
          Las solicitudes deben ser aprobadas o rechazadas por un administrador.
        </p>
      </template>
      <button v-if="error && !cargando && !sinPermiso && !necesitaLogin" class="reintentar" type="button" @click="cargarReportes">
        Reintentar
      </button>
    </div>
  </main>
</template>
