<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { publicarMaterial } from '../services/materialesApi'
import { obtenerMaterias, type Materia } from '@/materias/services/materiasApi'
import { ErrorApi } from '@/shared/services/apiCliente'

const FORMATOS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.zip']
const TAMANO_MAXIMO = 20 * 1024 * 1024 // 20 MB en bytes

// Datos del formulario
const archivo = ref<File | null>(null)
const idMateria = ref<number | null>(null)
const tipo = ref('')
const descripcion = ref('')

// Lista de materias para el selector
const materias = ref<Materia[]>([])

// Estado de la pantalla
const error = ref('')
const exito = ref('')
const cargando = ref(false)
const arrastrando = ref(false)

const router = useRouter()

// Al abrir la pantalla, se cargan las materias desde la API
onMounted(async () => {
  try {
    materias.value = await obtenerMaterias()
  } catch {
    error.value = 'No se pudieron cargar las materias.'
  }
})

// Revisa formato y tamaño antes de aceptar el archivo
function elegirArchivo(nuevo: File | undefined) {
  error.value = ''
  if (!nuevo) return
  const extension = nuevo.name.slice(nuevo.name.lastIndexOf('.')).toLowerCase()
  if (!FORMATOS.includes(extension)) {
    error.value = 'Formato no permitido. Usá PDF, DOCX, PNG, JPG o ZIP.'
    return
  }
  if (nuevo.size > TAMANO_MAXIMO) {
    error.value = 'El archivo supera los 20 MB.'
    return
  }
  archivo.value = nuevo
}

// Cuando se elige el archivo con el explorador
function alSeleccionar(evento: Event) {
  const input = evento.target as HTMLInputElement
  elegirArchivo(input.files?.[0])
}

// Cuando se suelta el archivo arrastrándolo
function alSoltar(evento: DragEvent) {
  arrastrando.value = false
  elegirArchivo(evento.dataTransfer?.files[0])
}

async function publicar() {
  error.value = ''
  exito.value = ''
  if (!archivo.value || !idMateria.value || !tipo.value) {
    error.value = 'Completá el archivo, la materia y el tipo.'
    return
  }
  cargando.value = true
  try {
    await publicarMaterial(archivo.value, idMateria.value, tipo.value, descripcion.value)
    exito.value = '¡Material publicado!'
    archivo.value = null
    descripcion.value = ''
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 401) {
      router.push('/login')
    } else if (e instanceof ErrorApi && e.estado === 400) {
      error.value = e.message
    } else {
      error.value = 'No se pudo publicar. Intentá de nuevo.'
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <main class="pantalla">
    <form class="tarjeta" @submit.prevent="publicar">
      <h1>Publicar material</h1>
      <p class="subtitulo">Compartí tus apuntes, resúmenes o trabajos prácticos con otros estudiantes.</p>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="exito" class="aviso">{{ exito }}</p>

      <!-- Zona para elegir o arrastrar el archivo -->
      <label
        class="zona"
        :class="{ activa: arrastrando }"
        @dragover.prevent="arrastrando = true"
        @dragleave="arrastrando = false"
        @drop.prevent="alSoltar"
      >
        <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.zip" hidden @change="alSeleccionar" />
        <span v-if="archivo" class="zona-titulo">📄 {{ archivo.name }}</span>
        <span v-else class="zona-titulo">Arrastrá tu archivo o hacé clic para elegirlo</span>
        <span class="zona-ayuda">PDF, DOCX, PNG, JPG o ZIP · máximo 20 MB</span>
      </label>

      <div class="fila">
        <label>
          Materia
          <select v-model="idMateria" required>
            <option :value="null" disabled>Seleccionar materia</option>
            <option v-for="m in materias" :key="m.id_materia" :value="m.id_materia">
              {{ m.nombre_materia }}
            </option>
          </select>
        </label>

        <label>
          Tipo de material
          <select v-model="tipo" required>
            <option value="" disabled>Seleccionar tipo</option>
            <option value="apunte">Apunte</option>
            <option value="resumen">Resumen</option>
            <option value="tp">Trabajo práctico</option>
          </select>
        </label>
      </div>

      <label>
        Descripción
        <textarea v-model="descripcion" rows="4" placeholder="Contá de qué se trata el material" required></textarea>
      </label>


      <div class="acciones">
        <RouterLink to="/materiales" class="boton-secundario">Cancelar</RouterLink>
        <button type="submit" :disabled="cargando">
          {{ cargando ? 'Publicando…' : 'Publicar' }}
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 40px 16px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)),
    url('../../assets/fondo-publicar.png') center / cover fixed;
}

.tarjeta {
  width: 100%;
  max-width: 720px;
  height: fit-content;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 40px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

h1 {
  margin: 0;
  font-size: 28px;
}

.subtitulo,
.nota {
  margin: 0;
  color: #666666;
}

.nota {
  font-size: 13px;
}

.error,
.aviso {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
}

.error {
  background: #d50000;
  color: #ffffff;
}

.aviso {
  background: #e6f4ea;
  color: #1e6b34;
}

.zona {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  padding: 24px;
  border: 2px dashed #b3b3b3;
  border-radius: 12px;
  background: #fafafa;
  cursor: pointer;
  text-align: center;
}

.zona.activa {
  border-color: #0047ff;
  background: #eef3ff;
}

.zona-titulo {
  font-weight: 600;
}

.zona-ayuda {
  font-size: 13px;
  color: #666666;
}

.fila {
  display: flex;
  gap: 16px;
}

.fila label {
  flex: 1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

select,
textarea {
  padding: 12px 16px;
  font-size: 15px;
  font-family: inherit;
  border: 1px solid #b3b3b3;
  border-radius: 8px;
  background: #ffffff;
}

.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

button,
.boton-secundario {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
}

button {
  color: #ffffff;
  background: #0047ff;
  border: none;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.boton-secundario {
  color: #333333;
  background: #ffffff;
  border: 1px solid #333333;
}
</style>