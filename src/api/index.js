/**
 * API 封装
 * 统一管理所有 API 请求
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * 通用请求方法
 */
async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// ============ 仪表盘 ============
export const dashboardApi = {
  get: () => request('/api/dashboard'),
  createCard: (data) => request('/api/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ============ 本地卡片管理 ============
export const localCardsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/local-cards?${query}`);
  },
  
  get: (cardId) => request(`/api/local-cards/${cardId}`),
  
  publish: (cardId) => request(`/api/local-cards/${cardId}/publish`, {
    method: 'POST',
  }),
  
  delete: (cardId) => request(`/api/local-cards/${cardId}`, {
    method: 'DELETE',
  }),
  
  stats: () => request('/api/local-cards/stats/summary'),
};

// ============ 需求追踪 ============
export const requestsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/requests?${query}`);
  },
  
  get: (id) => request(`/api/requests/${id}`),
  
  create: (data) => request('/api/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  updateStep: (id, data) => request(`/api/requests/${id}/step`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  complete: (id, data) => request(`/api/requests/${id}/complete`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// ============ 知识库 ============
export const knowledgeApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/knowledge?${query}`);
  },
  
  get: (id) => request(`/api/knowledge/${id}`),
  
  search: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/knowledge/search?${query}`);
  },
  
  create: (data) => request('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id, data) => request(`/api/knowledge/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => request(`/api/knowledge/${id}`, {
    method: 'DELETE',
  }),
  
  stats: () => request('/api/knowledge/stats/overview'),
};

// ============ 智能体 ============
export const agentsApi = {
  list: () => request('/api/agents'),
  
  stats: (name) => request(`/api/agents/${name}/stats`),
  
  logs: (name, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/agents/${name}/logs?${query}`);
  },
};

// ============ 用户反馈 ============
export const feedbackApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/feedback?${query}`);
  },
  
  updateStatus: (id, data) => request(`/api/feedback/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// ============ 健康检查 ============
export const healthApi = {
  check: () => request('/api/health'),
};

// ============ 处理状态 ============
export const statusApi = {
  get: () => request('/api/status/status'),
  scheduler: () => request('/api/status/scheduler/status'),
  trigger: () => request('/api/status/trigger', { method: 'POST' }),
};

export default {
  dashboard: dashboardApi,
  requests: requestsApi,
  knowledge: knowledgeApi,
  agents: agentsApi,
  feedback: feedbackApi,
  health: healthApi,
  status: statusApi,
  localCards: localCardsApi,
};
