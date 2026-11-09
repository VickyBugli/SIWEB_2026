<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import BarraNavegacion from '@/shared/components/BarraNavegacion.vue'

const route = useRoute()

// En el login y el registro no se muestra la barra
const mostrarBarra = computed(() => !['/login', '/registro'].includes(route.path))
</script>

<template>
  <BarraNavegacion v-if="mostrarBarra" />
  <RouterView />
</template>