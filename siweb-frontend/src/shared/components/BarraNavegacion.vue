<script setup lang="ts">
import { useRouter } from 'vue-router'
import { cerrarSesion } from '@/autenticacion/services/authApi'
import logo from '@/assets/logo.png'

const router = useRouter()

async function salir() {
  try {
    await cerrarSesion()
  } catch {
    // Si el servidor ya no tenía la sesión, igual salimos
  }
  router.push('/login')
}
</script>

<template>
  <header class="barra">
    <RouterLink to="/materiales" class="marca">
      <img :src="logo" alt="Logo" />
      <span>Comunidad Facultad de Informática</span>
    </RouterLink>

    <nav class="enlaces">
      <RouterLink to="/materiales">Materiales</RouterLink>
      <RouterLink to="/publicar">Publicar</RouterLink>
      <RouterLink to="/reportes">Reportes</RouterLink>
    </nav>

    <button class="salir" @click="salir">Cerrar sesión</button>
  </header>
</template>

<style scoped>
.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 40px;
  background: #ffffff;
  border-bottom: 1px solid #d9d9d9;
}

.marca {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1a1a1a;
  font-weight: 700;
  text-decoration: none;
}

.marca img {
  width: 36px;
  height: 36px;
}

.enlaces {
  display: flex;
  gap: 32px;
}

.enlaces a {
  color: #4d4d4d;
  font-weight: 600;
  text-decoration: none;
}

.enlaces a.router-link-active {
  color: #0047ff;
}

.salir {
  padding: 8px 16px;
  font-size: 14px;
  color: #4d4d4d;
  background: none;
  border: 1px solid #b3b3b3;
  border-radius: 8px;
  cursor: pointer;
}
</style>