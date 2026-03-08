import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/cards',
    name: 'Cards',
    component: () => import('../views/CardList.vue')
  },
  {
    path: '/cards/create',
    name: 'CardCreate',
    component: () => import('../views/CardCreate.vue')
  },
  {
    path: '/cards/:id',
    name: 'CardDetail',
    component: () => import('../views/CardDetail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
