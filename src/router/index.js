import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/workspaces',
    name: 'WorkspaceManagement',
    component: () => import('../views/WorkspaceManagement.vue')
  },
  {
    path: '/agents',
    name: 'AgentManagement',
    component: () => import('../views/AgentManagement.vue')
  },
  {
    path: '/models',
    name: 'ModelManagement',
    component: () => import('../views/ModelManagement.vue')
  },
  {
    path: '/skills',
    name: 'SkillConfig',
    component: () => import('../views/SkillConfig.vue')
  },
  {
    path: '/sync-tasks',
    name: 'SyncTaskManagement',
    component: () => import('../views/SyncTaskManagement.vue')
  },
  {
    path: '/agent-logs',
    name: 'AgentLogs',
    component: () => import('../views/AgentMonitor.vue')
  },
  {
    path: '/data',
    name: 'DataManager',
    component: () => import('../views/DataManager.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
