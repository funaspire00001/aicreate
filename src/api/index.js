const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function qs(params = {}) {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
}

// ────────── 智能体 ──────────
export const agentsApi = {
  list: (params) => request(`/api/agents${qs(params)}`),
  get: (id) => request(`/api/agents/${id}`),
  create: (data) => request('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/agents/${id}`, { method: 'DELETE' }),
  pushInput: (id, data) => request(`/api/agents/${id}/input`, { method: 'POST', body: JSON.stringify(data) }),
  dataStats: (id) => request(`/api/agents/${id}/data-stats`),
  statsSummary: () => request('/api/agents/stats/summary'),
};

// ────────── 空间 ──────────
export const workspacesApi = {
  list: (params) => request(`/api/workspaces${qs(params)}`),
  get: (id) => request(`/api/workspaces/${id}`),
  create: (data) => request('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/workspaces/${id}`, { method: 'DELETE' }),
  agents: (id) => request(`/api/workspaces/${id}/agents`),
  start: (id) => request(`/api/workspaces/${id}/start`, { method: 'POST' }),
  pause: (id) => request(`/api/workspaces/${id}/pause`, { method: 'POST' }),
};

// ────────── 模型 ──────────
export const modelsApi = {
  list: () => request('/api/models'),
  config: () => request('/api/models/config'),
  saveConfig: (c) => request('/api/models/config', { method: 'PUT', body: JSON.stringify(c) }),
  add: (m) => request('/api/models', { method: 'POST', body: JSON.stringify(m) }),
  update: (id, m) => request(`/api/models/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(m) }),
  delete: (id) => request(`/api/models/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  test: (id, prompt) => request(`/api/models/${encodeURIComponent(id)}/test`, { method: 'POST', body: JSON.stringify({ testPrompt: prompt }) }),
  ollama: () => request('/api/models/ollama'),
  ollamaStatus: () => request('/api/models/ollama/status'),
  ollamaConfig: (c) => request('/api/models/ollama/config', { method: 'PUT', body: JSON.stringify(c) }),
  stats: () => request('/api/models/stats'),
};

// ────────── 技能 ──────────
export const skillsApi = {
  list: (params) => request(`/api/skills${qs(params)}`),
  get: (id) => request(`/api/skills/${id}`),
  create: (data) => request('/api/skills', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/skills/${id}`, { method: 'DELETE' }),
  categories: () => request('/api/skills/meta/categories'),
  tags: () => request('/api/skills/meta/tags'),
};

// ────────── 订阅任务 ──────────
export const syncTasksApi = {
  list: (params) => request(`/api/sync-tasks${qs(params)}`),
  get: (id) => request(`/api/sync-tasks/${id}`),
  trigger: (id) => request(`/api/sync-tasks/${id}/trigger`, { method: 'POST' }),
  triggerAll: () => request('/api/sync-tasks/trigger-all', { method: 'POST' }),
  resetRetry: (id) => request(`/api/sync-tasks/${id}/reset-retry`, { method: 'POST' }),
  delete: (id) => request(`/api/sync-tasks/${id}`, { method: 'DELETE' }),
  stats: () => request('/api/sync-tasks/stats/summary'),
};

// ────────── 日志 ──────────
export const agentLogsApi = {
  list: (params) => request(`/api/agent-logs${qs(params)}`),
  get: (id) => request(`/api/agent-logs/${id}`),
  trace: (traceId) => request(`/api/agent-logs/trace/${traceId}`),
  stats: (params) => request(`/api/agent-logs/stats/summary${qs(params)}`),
  cleanup: (days) => request(`/api/agent-logs/cleanup${qs({ days })}`, { method: 'DELETE' }),
};

// ────────── 仪表盘 ──────────
export const dashboardApi = {
  get: () => request('/api/dashboard'),
};

// ────────── 数据管理 ──────────
export const dataApi = {
  collections: () => request('/api/data/collections'),
  collectionData: (name, params) => request(`/api/data/collections/${name}${qs(params)}`),
  getRecord: (name, id) => request(`/api/data/collections/${name}/${id}`),
  updateRecord: (name, id, data) => request(`/api/data/collections/${name}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecord: (name, id) => request(`/api/data/collections/${name}/${id}`, { method: 'DELETE' }),
};

// ────────── 健康检查 ──────────
export const healthApi = {
  check: () => request('/api/health'),
};

export default {
  agents: agentsApi,
  workspaces: workspacesApi,
  models: modelsApi,
  skills: skillsApi,
  syncTasks: syncTasksApi,
  agentLogs: agentLogsApi,
  dashboard: dashboardApi,
  data: dataApi,
  health: healthApi,
};
