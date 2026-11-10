<script setup lang="ts">
defineProps<{
  titulo: string
  materia: string
  tipo: string
  descripcion: string
  promedio: number | null
  votos: number
  fecha: string
  id: number
}>()

function nombreTipo(tipo: string) {
  if (tipo === 'tp') return 'TP'
  if (tipo === 'resumen') return 'Resumen'
  if (tipo === 'apunte') return 'Apunte'
  return tipo
}
</script>

<template>
  <RouterLink
    :to="`/materiales/${id}`"
    class="tarjeta-material"
  >
    <div class="vista-previa">
      <p v-if="descripcion">{{ descripcion }}</p>
      <span v-else>Archivo</span>
    </div>

    <span class="etiqueta">
      {{ nombreTipo(tipo) }}
    </span>

    <h3>{{ titulo }}</h3>

    <p class="materia">{{ materia }}</p>

    <div class="valoracion">
      <span v-if="promedio !== null">
        ★ {{ promedio.toFixed(1) }}
      </span>

      <span v-else>Sin votos</span>

      <span>·</span>

      <span>{{ fecha }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.tarjeta-material {
  padding: 12px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
  transition: box-shadow 0.2s;
}

.tarjeta-material:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10);
}

.vista-previa {
  height: 120px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eeeeee;
  border-radius: 7px;
  color: #777777;
  font-size: 12px;
  overflow: hidden;
}

.vista-previa p {
  margin: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.etiqueta {
  align-self: flex-start;
  background: #eeeeee;
  padding: 4px 9px;
  border-radius: 14px;
  font-size: 12px;
}

h3 {
  margin: 0;
  color: #222222;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.materia {
  margin: 0;
  font-size: 13px;
  color: #777777;
}

.valoracion {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  color: #555555;
  font-size: 12px;
}
</style>