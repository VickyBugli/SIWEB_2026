<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { obtenerMaterias, type Materia } from '@/materias/services/materiasApi'
import { obtenerMateriales, type FiltrosMateriales, type Material } from '../services/materialesApi'
import TarjetaMaterial from '../../shared/components/TarjetaMaterial.vue'

const route = useRoute()
const router = useRouter()

function valorQuery(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

const busqueda = ref('')
const materiaSeleccionada = ref('')
const tipoSeleccionado = ref('')
const anioSeleccionado = ref('')

const materias = ref<Materia[]>([])
const materiales = ref<Material[]>([])
const cargando = ref(false)
const error = ref('')
const errorMaterias = ref('')
let numeroSolicitud = 0

function sincronizarFiltrosConUrl() {
  busqueda.value = valorQuery(route.query.texto_buscado)
  materiaSeleccionada.value = valorQuery(route.query.id_materia)
  tipoSeleccionado.value = valorQuery(route.query.tipo_material)
  anioSeleccionado.value = valorQuery(route.query.anio_carrera)
}

function filtrosDeLaUrl(): FiltrosMateriales {
  const texto = valorQuery(route.query.texto_buscado).trim()
  const materia = Number(valorQuery(route.query.id_materia))
  const tipo = valorQuery(route.query.tipo_material)
  const anio = Number(valorQuery(route.query.anio_carrera))

  return {
    texto_buscado: texto || undefined,
    id_materia: Number.isInteger(materia) && materia > 0 ? materia : undefined,
    tipo_material: tipo || undefined,
    anio_carrera: Number.isInteger(anio) && anio > 0 ? anio : undefined
  }
}

async function cargarMateriales() {
  const solicitud = ++numeroSolicitud
  cargando.value = true
  error.value = ''

  try {
    const lista = await obtenerMateriales(filtrosDeLaUrl())
    if (solicitud === numeroSolicitud) materiales.value = lista
  } catch {
    if (solicitud === numeroSolicitud) {
      materiales.value = []
      error.value = 'No se pudieron cargar los materiales. Intentá nuevamente.'
    }
  } finally {
    if (solicitud === numeroSolicitud) cargando.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    sincronizarFiltrosConUrl()
    void cargarMateriales()
  },
  { immediate: true }
)

onMounted(async () => {
  try {
    materias.value = await obtenerMaterias()
  } catch {
    errorMaterias.value = 'No se pudo cargar el listado de materias.'
  }
})

async function aplicarFiltros() {
  const query: Record<string, string> = {}

  if (busqueda.value.trim()) query.texto_buscado = busqueda.value.trim()
  if (materiaSeleccionada.value) query.id_materia = materiaSeleccionada.value
  if (tipoSeleccionado.value) query.tipo_material = tipoSeleccionado.value
  if (anioSeleccionado.value) query.anio_carrera = anioSeleccionado.value

  const claves = ['texto_buscado', 'id_materia', 'tipo_material', 'anio_carrera']
  const esLaMismaBusqueda = claves.every(
    (clave) => valorQuery(route.query[clave]) === (query[clave] ?? '')
  )

  if (esLaMismaBusqueda) {
    await cargarMateriales()
  } else {
    await router.replace({ path: '/materiales', query })
  }
}

function nombreMateria(idMateria: number): string {
  return materias.value.find((materia) => materia.id_materia === idMateria)?.nombre_materia
    ?? 'Materia no disponible'
}

function formatearFecha(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? 'Fecha no disponible' : valor.toLocaleDateString('es-AR')
}
</script>

<template>
  <main class="pantalla">
    <div class="contenedor">
      <div class="encabezado">
        <h1>Materiales</h1>
        <RouterLink to="/publicar" class="boton-publicar">+ Publicar material</RouterLink>
      </div>

      <form class="filtros" @submit.prevent="aplicarFiltros">
        <label class="campo campo-busqueda">
          <span>Buscar</span>
          <input
            v-model="busqueda"
            type="search"
            placeholder="Buscar por título o descripción"
          />
        </label>

        <label class="campo">
          <span>Materia</span>
          <select v-model="materiaSeleccionada">
            <option value="">Todas las materias</option>
            <option
              v-for="materia in materias"
              :key="materia.id_materia"
              :value="String(materia.id_materia)"
            >
              {{ materia.nombre_materia }}
            </option>
          </select>
        </label>

        <label class="campo">
          <span>Tipo</span>
          <select v-model="tipoSeleccionado">
            <option value="">Todos</option>
            <option value="apunte">Apunte</option>
            <option value="resumen">Resumen</option>
            <option value="tp">Trabajo práctico</option>
          </select>
        </label>

        <label class="campo">
          <span>Año de la carrera</span>
          <select v-model="anioSeleccionado">
            <option value="">Todos</option>
            <option value="1">1° año</option>
            <option value="2">2° año</option>
            <option value="3">3° año</option>
            <option value="4">4° año</option>
            <option value="5">5° año</option>
          </select>
        </label>

        <button type="submit" class="boton-buscar" :disabled="cargando">
          {{ cargando ? 'Buscando…' : 'Buscar' }}
        </button>
      </form>

      <p v-if="errorMaterias" class="advertencia" role="status">{{ errorMaterias }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <section class="resultados" aria-live="polite">
        <p v-if="cargando" class="estado">Cargando materiales...</p>

        <template v-else-if="!error">
          <p class="contador">{{ materiales.length }} materiales encontrados</p>

          <div v-if="materiales.length > 0" class="grilla-materiales">
            <TarjetaMaterial
              v-for="material in materiales"
              :key="material.id_material"
              :id="material.id_material"
              :titulo="material.nombre_archivo"
              :descripcion="material.descripcion"
              :materia="nombreMateria(material.id_materia)"
              :tipo="material.tipo_material"
              :promedio="material.valoracion_promedio ?? null"
              :votos="material.cantidad_votos ?? 0"
              :fecha="formatearFecha(material.fecha_publicacion)"
            />
          </div>

          <p v-else class="sin-resultados">
            No se encontraron materiales. Probá quitando filtros.
          </p>
        </template>
      </section>
    </div>
  </main>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  padding: 36px 24px 60px;
  background: #e5e9f0;
}

.contenedor {
  max-width: 1200px;
  margin: 0 auto;
}

.encabezado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}

h1 {
  margin: 0;
  font-size: 28px;
  color: #0040FF;
}

.boton-publicar {
  padding: 12px 20px;
  background: #0040FF;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}

.filtros {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.2fr) minmax(0, 0.95fr) minmax(0, 0.95fr) auto;
  gap: 12px;
  align-items: end;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}

.campo input,
.campo select {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 44px;
  padding: 10px 12px;
  border: 1px solid #bcbcbc;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-weight: 400;
}

.boton-buscar {
  box-sizing: border-box;
  height: 44px;
  padding: 0 20px;
  background: #070707;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.boton-buscar:disabled {
  cursor: wait;
  opacity: 0.7;
}

.resultados { margin-top: 30px; }
.contador, .estado { color: #76767F; margin: 0 0 16px; }
.error { color: #D80A0A; margin-top: 16px; }
.advertencia { color: #795600; margin-top: 16px; }

.grilla-materiales {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.sin-resultados {
  padding: 18px;
  border: 1px dashed #aaa;
  border-radius: 8px;
  text-align: center;
  color: #76767F;
}

@media (max-width: 1000px) {
  .filtros { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .campo-busqueda { grid-column: 1 / -1; }
  .boton-buscar { grid-column: 1 / -1; }
}

@media (max-width: 900px) {
  .grilla-materiales { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 550px) {
  .pantalla { padding: 24px 16px 40px; }
  .encabezado { align-items: flex-start; flex-direction: column; }
  .filtros { grid-template-columns: minmax(0, 1fr); }
  .campo-busqueda, .boton-buscar { grid-column: auto; }
  .grilla-materiales { grid-template-columns: minmax(0, 1fr); }
}
</style>