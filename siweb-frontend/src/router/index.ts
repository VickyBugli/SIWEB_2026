import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/autenticacion/views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView },
    { path: '/registro', component: () => import('@/autenticacion/views/RegistroView.vue') },
    { path: '/materiales', component: () => import('@/materiales/views/BuscarView.vue') },
    { path: '/materiales/:id', component: () => import('@/materiales/views/DetalleMaterialView.vue')},
    { path: '/publicar', component: () => import('@/materiales/views/PublicarView.vue') },
    { path: '/materias/:id', component: () => import('@/materias/views/MateriaView.vue') },
    { path: '/reportes', component: () => import('@/reportes/views/ReportesView.vue') }
  ],
})

export default router