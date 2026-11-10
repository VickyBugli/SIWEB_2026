<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { obtenerMaterias, type Materia } from '../services/materiasApi'
import { buscarLibros, type Libro } from '../services/openLibraryApi'
import { obtenerMaterialesDeMateria, type Material } from '@/materiales/services/materialesApi'

const route = useRoute()
const idMateria = Number(route.params.id)

const materia = ref<Materia | null>(null)
const libros = ref<Libro[]>([])
const materiales = ref<Material[]>([])

const cargando = ref(true)
const cargandoLibros = ref(true)
const errorMateria = ref('')
const errorLibros = ref('')

onMounted(async () => {
  // 1) Datos de la materia (desde nuestra API)
  try {
    const todas = await obtenerMaterias()
    materia.value = todas.find((m) => m.id_materia === idMateria) ?? null
  } catch {
    errorMateria.value = 'No se pudo cargar la materia.'
  }
  cargando.value = false
  if (!materia.value) {
    errorMateria.value ||= 'La materia no existe.'
    return
  }

  // 2) Bibliografía: Open Library (servicio externo, directo desde el navegador)
  buscarLibros(materia.value.nombre_materia)
    .then((l) => (libros.value = l))
    .catch(() => (errorLibros.value = 'La bibliografía no está disponible en este momento.'))
    .finally(() => (cargandoLibros.value = false))

  // 3) Materiales de la materia (desde nuestra API)
  obtenerMaterialesDeMateria(idMateria)
    .then((m) => (materiales.value = m))
    .catch(() => (materiales.value = []))
})

// "1.er año", "2.º año", "3.er año"...
function textoAnio(anio: number) {
  return anio === 1 || anio === 3 ? `${anio}.er año` : `${anio}.º año`
}

// "resumen" → "Resumen", "tp" → "TP"
function textoTipo(tipo: string) {
  const nombres: Record<string, string> = { apunte: 'Apunte', resumen: 'Resumen', tp: 'TP' }
  return nombres[tipo] ?? tipo
}

// "TP1 Algebra resuelto.pdf" → "TP1 Algebra resuelto"
function sinExtension(nombre: string) {
  const punto = nombre.lastIndexOf('.')
  return punto > 0 ? nombre.slice(0, punto) : nombre
}

// "PDF", "DOCX", "PNG"... para la miniatura
function formato(nombre: string) {
  return nombre.slice(nombre.lastIndexOf('.') + 1).toUpperCase()
}

// "02/04/2025"
function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <main class="pantalla">
    <p v-if="cargando">Cargando…</p>
    <p v-else-if="errorMateria" class="error">{{ errorMateria }}</p>

    <template v-else-if="materia">
      <!-- Migas de pan -->
      <p class="migas">
        <RouterLink to="/materiales">Materias</RouterLink>
        <span>/</span>
        {{ materia.nombre_materia }}
      </p>

      <!-- Encabezado -->
      <div class="encabezado">
        <h1>{{ materia.nombre_materia }}</h1>
        <span class="etiqueta">{{ textoAnio(materia.anio_carrera) }}</span>
      </div>

      <!-- Bibliografía: Open Library (servicio externo consumido desde el navegador) -->
      <section class="seccion">
        <div class="titulo-seccion">
          <h2>Bibliografía sugerida</h2>
          <span class="etiqueta oscura">Servicio externo: Open Library</span>
        </div>

        <p v-if="cargandoLibros" class="nota">Buscando libros…</p>
        <p v-else-if="errorLibros" class="nota">{{ errorLibros }}</p>
        <p v-else-if="libros.length === 0" class="nota">No se encontraron libros para esta materia.</p>

        <div v-else class="libros">
          <a
            v-for="libro in libros"
            :key="libro.enlace"
            :href="libro.enlace"
            target="_blank"
            rel="noopener"
            class="libro"
          >
            <div class="portada">
              <img v-if="libro.portada" :src="libro.portada" :alt="libro.titulo" />
              <span v-else>Portada</span>
            </div>
            <strong>{{ libro.titulo }}</strong>
            <span class="gris">{{ libro.autores.join(', ') }}</span>
            <span v-if="libro.anio" class="gris">{{ libro.anio }}</span>
          </a>
        </div>
      </section>

      <!-- Materiales de esta materia (desde nuestra API) -->
      <section class="seccion">
        <h2 class="azul">Materiales de esta materia ({{ materiales.length }})</h2>
        <p v-if="materiales.length === 0" class="nota">Todavía no hay materiales publicados.</p>

        <div class="materiales">
          <RouterLink
            v-for="m in materiales"
            :key="m.id_material"
            :to="`/materiales/${m.id_material}`"
            class="tarjeta"
          >
            <div class="miniatura">{{ formato(m.nombre_archivo) }}</div>
            <span class="etiqueta chica">{{ textoTipo(m.tipo_material) }}</span>
            <h3>{{ sinExtension(m.nombre_archivo) }}</h3>
            <span class="gris">{{ materia.nombre_materia }}</span>
            <div class="pie">
              <span class="estrellas">
                <span
                  v-for="n in 5"
                  :key="n"
                  :class="{ llena: n <= Math.round(m.valoracion_promedio ?? 0) }"
                >★</span>
              </span>
              <strong v-if="m.valoracion_promedio">{{ m.valoracion_promedio.toFixed(1) }}</strong>
              <span v-else class="gris">Sin votos</span>
              <span class="gris">· {{ fecha(m.fecha_publicacion) }}</span>
            </div>
          </RouterLink>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.pantalla {
  min-height: calc(100vh - 69px);
  padding: 32px 80px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #e5e9f0;
}

/* Migas de pan */
.migas {
  margin: 0;
  display: flex;
  gap: 8px;
  font-size: 14px;
  color: #767676;
}

.migas a {
  color: #767676;
  text-decoration: none;
}

.migas a:hover {
  color: #0047ff;
}

/* Títulos */
.encabezado,
.titulo-seccion {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
}

h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

h2.azul {
  color: #0047ff;
}

h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

/* Etiquetas tipo píldora */
.etiqueta {
  padding: 4px 12px;
  border-radius: 999px;
  background: #d9d9d9;
  color: #333333;
  font-size: 13px;
  font-weight: 600;
}

.etiqueta.oscura {
  background: #333333;
  color: #ffffff;
}

.etiqueta.chica {
  align-self: flex-start;
  padding: 3px 10px;
  font-size: 12px;
}

.seccion {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nota {
  margin: 0;
  color: #767676;
}

.gris {
  color: #767676;
  font-size: 14px;
}

/* Libros */
.libros {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.libro {
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #1a1a1a;
  text-decoration: none;
  font-size: 14px;
}

.libro strong {
  margin-top: 8px;
}

.portada {
  width: 160px;
  height: 208px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #dcdcdc;
  color: #767676;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
}

.portada img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Tarjetas de materiales */
.materiales {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.miniatura {
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eceef2;
  color: #767676;
  font-size: 13px;
  font-weight: 600;
}

.pie {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.estrellas span {
  color: #cccccc;
  font-size: 15px;
}

.estrellas span.llena {
  color: #4d4d4d;
}

.error {
  padding: 12px 16px;
  border-radius: 8px;
  background: #d50000;
  color: #ffffff;
}

.tarjeta {
  width: 240px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.tarjeta:hover {
  border-color: #0047ff;
  box-shadow: 0 4px 12px rgba(0, 71, 255, 0.12);
}

</style>