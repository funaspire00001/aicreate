import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/feedback',
    name: 'FeedbackList',
    component: () => import('../views/FeedbackList.vue')
  },
  {
    path: '/requests',
    name: 'RequestTracker',
    component: () => import('../views/RequestTracker.vue')
  },
  {
    path: '/requests/:id',
    name: 'RequestDetail',
    component: () => import('../views/RequestDetail.vue')
  },
  {
    path: '/knowledge',
    name: 'KnowledgeBase',
    component: () => import('../views/KnowledgeBase.vue')
  },
  {
    path: '/knowledge/:id',
    name: 'KnowledgeDetail',
    component: () => import('../views/KnowledgeDetail.vue')
  },
  {
    path: '/agents',
    name: 'AgentManagement',
    component: () => import('../views/AgentManagement.vue')
  },
  {
    path: '/demands',
    name: 'DemandList',
    component: () => import('../views/DemandList.vue')
  },
  {
    path: '/workspaces',
    name: 'WorkspaceManagement',
    component: () => import('../views/WorkspaceManagement.vue')
  },
  {
    path: '/agent-monitor',
    name: 'AgentMonitor',
    component: () => import('../views/AgentMonitor.vue')
  },
  {
    path: '/local-cards',
    name: 'LocalCards',
    component: () => import('../views/LocalCards.vue')
  },
  {
    path: '/models',
    name: 'ModelManagement',
    component: () => import('../views/ModelManagement.vue')
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
  },
  {
    path: '/data',
    name: 'DataManager',
    component: () => import('../views/DataManager.vue')
  },
  {
    path: '/skills',
    name: 'SkillConfig',
    component: () => import('../views/SkillConfig.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router