<script setup lang="ts">
import { ref, watch } from 'vue'
import '@/shared/styles/paginasContenido.css'
import { useRoute } from 'vue-router'
import { obtenerMaterias, type Materia } from '@/materias/services/materiasApi'
import { ErrorApi } from '@/shared/services/apiCliente'
import {
  obtenerDetalleMaterial,
  descargarArchivoMaterial,
  obtenerComentariosMaterial,
  publicarComentarioMaterial,
  reportarMaterial,
  reportarComentario,
  type Material,
  type ComentarioMaterial
} from '../services/materialesApi'

const route = useRoute()
const material = ref<Material | null>(null)
const materias = ref<Materia[]>([])
const comentarios = ref<ComentarioMaterial[]>([])
const cargando = ref(false)
const cargandoComentarios = ref(false)
const descargando = ref(false)
const enviandoComentario = ref(false)
const enviandoReporte = ref(false)
const enviandoReporteComentario = ref(false)
const error = ref('')
const errorDescarga = ref('')
const errorComentarios = ref('')
const errorComentario = ref('')
const avisoComentario = ref('')
const errorReporte = ref('')
const avisoReporte = ref('')
const errorReporteComentario = ref('')
const avisoReporteComentario = ref('')
const nuevoComentario = ref('')
const mostrarReporte = ref(false)
const motivoReporte = ref('')
const comentarioParaReportar = ref<number | null>(null)
const motivoReporteComentario = ref('')
let cargaActual = 0

async function cargarComentarios(idMaterial: number) {
  cargandoComentarios.value = true
  errorComentarios.value = ''
  try {
    comentarios.value = await obtenerComentariosMaterial(idMaterial)
  } catch {
    comentarios.value = []
    errorComentarios.value = 'No se pudieron cargar los comentarios.'
  } finally {
    cargandoComentarios.value = false
  }
}

async function cargarDetalle() {
  const id = Number(route.params.id)
  const carga = ++cargaActual
  material.value = null
  comentarios.value = []
  error.value = ''
  errorDescarga.value = ''
  errorComentarios.value = ''
  errorComentario.value = ''
  avisoComentario.value = ''
  errorReporte.value = ''
  avisoReporte.value = ''
  errorReporteComentario.value = ''
  avisoReporteComentario.value = ''
  nuevoComentario.value = ''
  motivoReporte.value = ''
  mostrarReporte.value = false
  comentarioParaReportar.value = null
  motivoReporteComentario.value = ''

  if (!Number.isInteger(id) || id <= 0) {
    error.value = 'El identificador del material no es válido.'
    return
  }

  cargando.value = true
  try {
    const [detalle, listaMaterias] = await Promise.all([
      obtenerDetalleMaterial(id),
      obtenerMaterias().catch((): Materia[] => [])
    ])
    if (carga !== cargaActual) return
    material.value = detalle
    materias.value = listaMaterias
    await cargarComentarios(id)
  } catch (e) {
    if (carga !== cargaActual) return
    error.value = e instanceof ErrorApi && e.estado === 404
      ? 'El material no existe o ya no está publicado.'
      : 'No se pudo cargar el detalle del material.'
  } finally {
    if (carga === cargaActual) cargando.value = false
  }
}

watch(() => route.params.id, () => { void cargarDetalle() }, { immediate: true })

function nombreMateria(id: number): string {
  return materias.value.find((m) => m.id_materia === id)?.nombre_materia ?? 'Materia no disponible'
}

function nombreTipo(tipo: string): string {
  if (tipo === 'tp') return 'Trabajo práctico'
  if (tipo === 'resumen') return 'Resumen'
  if (tipo === 'apunte') return 'Apunte'
  return tipo
}

function fechaPublicacion(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? 'Fecha no disponible' : valor.toLocaleDateString('es-AR')
}

function fechaComentario(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? '' : valor.toLocaleDateString('es-AR')
}

function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function tipoArchivo(formato: string): string {
  if (formato.includes('pdf')) return 'PDF'
  if (formato.includes('wordprocessingml')) return 'DOCX'
  if (formato.startsWith('image/')) return 'Imagen'
  if (formato.includes('zip')) return 'ZIP'
  return formato || 'Archivo'
}

function mensajeError(e: unknown, texto: string): string {
  if (e instanceof ErrorApi && e.estado === 401) return 'Iniciá sesión para realizar esta acción.'
  if (e instanceof ErrorApi && e.estado === 404) return 'El contenido ya no está disponible.'
  if (e instanceof ErrorApi && e.estado === 400) return e.message
  return texto
}

async function descargar() {
  if (!material.value || descargando.value) return
  errorDescarga.value = ''
  descargando.value = true
  try {
    await descargarArchivoMaterial(material.value)
  } catch (e) {
    errorDescarga.value = mensajeError(e, 'No se pudo descargar el archivo.')
  } finally {
    descargando.value = false
  }
}

async function enviarComentario() {
  if (!material.value || enviandoComentario.value) return
  const texto = nuevoComentario.value.trim()
  errorComentario.value = ''
  avisoComentario.value = ''
  if (!texto || texto.length > 500) {
    errorComentario.value = 'Escribí un comentario de hasta 500 caracteres.'
    return
  }
  enviandoComentario.value = true
  try {
    await publicarComentarioMaterial(material.value.id_material, texto)
    nuevoComentario.value = ''
    avisoComentario.value = 'Tu comentario se publicó correctamente.'
    await cargarComentarios(material.value.id_material)
  } catch (e) {
    errorComentario.value = mensajeError(e, 'No se pudo publicar el comentario.')
  } finally {
    enviandoComentario.value = false
  }
}

function alternarReporte() {
  mostrarReporte.value = !mostrarReporte.value
  errorReporte.value = ''
  if (!mostrarReporte.value) motivoReporte.value = ''
}

async function enviarReporte() {
  if (!material.value || enviandoReporte.value) return
  const motivo = motivoReporte.value.trim()
  errorReporte.value = ''
  avisoReporte.value = ''
  if (!motivo) {
    errorReporte.value = 'Indicá el motivo del reporte.'
    return
  }
  enviandoReporte.value = true
  try {
    await reportarMaterial(material.value.id_material, motivo)
    avisoReporte.value = 'El reporte se envió correctamente.'
    motivoReporte.value = ''
    mostrarReporte.value = false
  } catch (e) {
    errorReporte.value = mensajeError(e, 'No se pudo enviar el reporte.')
  } finally {
    enviandoReporte.value = false
  }
}

function alternarReporteComentario(id: number) {
  comentarioParaReportar.value = comentarioParaReportar.value === id ? null : id
  motivoReporteComentario.value = ''
  errorReporteComentario.value = ''
  avisoReporteComentario.value = ''
}

async function enviarReporteComentario() {
  const id = comentarioParaReportar.value
  if (id === null || enviandoReporteComentario.value) return
  const motivo = motivoReporteComentario.value.trim()
  errorReporteComentario.value = ''
  avisoReporteComentario.value = ''
  if (!motivo) {
    errorReporteComentario.value = 'Indicá el motivo del reporte.'
    return
  }
  enviandoReporteComentario.value = true
  try {
    await reportarComentario(id, motivo)
    avisoReporteComentario.value = 'Se reportó el comentario correctamente.'
    motivoReporteComentario.value = ''
    comentarioParaReportar.value = null
  } catch (e) {
    errorReporteComentario.value = mensajeError(e, 'No se pudo reportar el comentario.')
  } finally {
    enviandoReporteComentario.value = false
  }
}
</script>

<template>
  <main class="pantalla-detalle">
    <div class="contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <RouterLink to="/materiales">Materiales</RouterLink>
        <span>/</span>
                <RouterLink v-if="material" :to="`/materias/${material.id_materia}`">
          {{ nombreMateria(material.id_materia) }}
        </RouterLink>
        <span v-if="material">/</span>
        <span>{{ material?.nombre_archivo ?? 'Detalle del material' }}</span>
      </nav>

      <p v-if="cargando" class="estado">Cargando material...</p>

      <div v-else-if="error" class="error" role="alert">
        <p>{{ error }}</p>
        <RouterLink to="/materiales">Volver a materiales</RouterLink>
      </div>

      <div v-else-if="material" class="distribucion">
        <div class="columna-principal">
          <div class="etiquetas">
            <span class="etiqueta">{{ nombreTipo(material.tipo_material) }}</span>
                        <RouterLink :to="`/materias/${material.id_materia}`" class="etiqueta etiqueta-enlace">
              {{ nombreMateria(material.id_materia) }}
            </RouterLink>
          </div>

          <h1>{{ material.nombre_archivo }}</h1>
          <p class="metadatos">
            Publicado el {{ fechaPublicacion(material.fecha_publicacion) }}
            · {{ tipoArchivo(material.formato_archivo) }}
            · {{ tamanoArchivo(material.tamano) }}
          </p>

          <p class="descripcion">{{ material.descripcion || 'Este material no tiene descripción.' }}</p>

          <div class="vista-previa">
            <span class="material-symbols-outlined icono-archivo" aria-hidden="true">description</span>
            <strong>{{ material.nombre_archivo }}</strong>
            <p>Descargá el archivo para visualizar su contenido completo.</p>
          </div>

          <section class="seccion-comentarios">
            <h2><span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span> Comentarios ({{ comentarios.length }})</h2>

            <p v-if="cargandoComentarios" class="estado">Cargando comentarios...</p>

            <div v-else-if="errorComentarios" class="mensaje-error" role="alert">
              <span>{{ errorComentarios }}</span>
              <button type="button" class="enlace" @click="cargarComentarios(material.id_material)">Reintentar</button>
            </div>

            <p v-else-if="comentarios.length === 0" class="estado">Todavía no hay comentarios.</p>

            <div v-else class="lista-comentarios">
              <article v-for="comentario in comentarios" :key="comentario.id_comentario" class="comentario">
                <div class="comentario-encabezado">
                  <strong>{{ comentario.autor }}</strong>
                  <span>{{ fechaComentario(comentario.fecha_creacion) }}</span>
                </div>
                <p>{{ comentario.contenido }}</p>
                <button type="button" class="enlace enlace-reporte"
                  @click="alternarReporteComentario(comentario.id_comentario)">
                  <span class="material-symbols-outlined" aria-hidden="true">flag</span>
                  {{ comentarioParaReportar === comentario.id_comentario ? 'Cancelar reporte' : 'Reportar comentario' }}
                </button>
                <form v-if="comentarioParaReportar === comentario.id_comentario"
                  class="formulario-reporte-comentario" @submit.prevent="enviarReporteComentario">
                  <label :for="`motivo-comentario-${comentario.id_comentario}`">Motivo del reporte</label>
                  <textarea :id="`motivo-comentario-${comentario.id_comentario}`" v-model="motivoReporteComentario"
                    rows="2" maxlength="500" placeholder="Describí el motivo" required></textarea>
                  <button type="submit" class="boton-primario" :disabled="enviandoReporteComentario">
                    {{ enviandoReporteComentario ? 'Enviando...' : 'Enviar reporte' }}
                  </button>
                  <p v-if="errorReporteComentario" class="mensaje-error" role="alert">{{ errorReporteComentario }}</p>
                </form>
              </article>
            </div>

            <p v-if="avisoReporteComentario" class="mensaje-exito" role="status">{{ avisoReporteComentario }}</p>

            <form class="formulario-comentario" @submit.prevent="enviarComentario">
              <label for="nuevo-comentario">Agregar un comentario</label>
              <div class="fila-comentario">
                <textarea id="nuevo-comentario" v-model="nuevoComentario" rows="2" maxlength="500"
                  placeholder="Escribí tu comentario (máximo 500 caracteres)" required></textarea>
                <button type="submit" class="boton-primario" :disabled="enviandoComentario || !nuevoComentario.trim()">
                  {{ enviandoComentario ? 'Enviando...' : 'Comentar' }}
                </button>
              </div>
              <p v-if="errorComentario" class="mensaje-error" role="alert">{{ errorComentario }}</p>
              <p v-if="avisoComentario" class="mensaje-exito" role="status">{{ avisoComentario }}</p>
            </form>
          </section>
        </div>

        <aside class="columna-lateral">
          <section class="panel">
            <button type="button" class="boton-descargar" :disabled="descargando" @click="descargar">
              <span class="material-symbols-outlined" aria-hidden="true">download</span>
              {{ descargando ? 'Descargando…' : 'Descargar material' }}
            </button>
            <p class="ayuda">La descarga requiere haber iniciado sesión.</p>
            <p v-if="errorDescarga" class="mensaje-error" role="alert">{{ errorDescarga }}</p>
            <RouterLink v-if="errorDescarga.includes('Iniciá sesión')" to="/login" class="acceso">
              Ir a iniciar sesión
            </RouterLink>
          </section>

          <section class="panel">
            <h2>Información del archivo</h2>
            <dl>
              <dt>Tipo</dt><dd>{{ nombreTipo(material.tipo_material) }}</dd>
              <dt>Formato</dt><dd>{{ tipoArchivo(material.formato_archivo) }}</dd>
              <dt>Tamaño</dt><dd>{{ tamanoArchivo(material.tamano) }}</dd>
                            <dt>Materia</dt>
              <dd>
                <RouterLink :to="`/materias/${material.id_materia}`">
                  {{ nombreMateria(material.id_materia) }}
                </RouterLink>
              </dd>
            </dl>
          </section>

          <section class="panel panel-reporte">
            <button type="button" class="boton-reportar" @click="alternarReporte">
              <span class="material-symbols-outlined" aria-hidden="true">flag</span>
              {{ mostrarReporte ? 'Cancelar reporte' : 'Reportar material' }}
            </button>
            <p class="ayuda">Si el contenido es inapropiado, un moderador lo va a revisar.</p>
            <form v-if="mostrarReporte" class="formulario-reporte" @submit.prevent="enviarReporte">
              <label for="motivo-reporte">Motivo del reporte</label>
              <textarea id="motivo-reporte" v-model="motivoReporte" rows="4" maxlength="500"
                placeholder="Explicá por qué querés reportarlo" required></textarea>
              <button type="submit" class="boton-primario" :disabled="enviandoReporte">
                {{ enviandoReporte ? 'Enviando...' : 'Enviar reporte' }}
              </button>
            </form>
            <p v-if="errorReporte" class="mensaje-error" role="alert">{{ errorReporte }}</p>
            <p v-if="avisoReporte" class="mensaje-exito" role="status">{{ avisoReporte }}</p>
            <RouterLink v-if="errorReporte.includes('Iniciá sesión')" to="/login" class="acceso">Iniciar sesión</RouterLink>
          </section>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.etiqueta-enlace {
  text-decoration: none;
  color: inherit;
}

.etiqueta-enlace:hover {
  color: #0047ff;
}

.pantalla-detalle {
  background: #e5e9f0;
}
</style>


