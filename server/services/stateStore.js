/**
 * 处理状态存储服务
 * 用于实时记录当前处理进度
 */

// 当前处理状态
const processingState = {
  isProcessing: false,
  currentFeedback: null,        // 当前处理的反馈
  currentStep: '',             // 当前步骤: fetching | generating | publishing | updating
  totalPending: 0,           // 待处理总数
  processedCount: 0,          // 已处理数量
  lastUpdateTime: null,     // 最后更新时间
  logs: [],               // 处理日志
  
  // 处理统计
  stats: {
    todayTotal: 0,           // 今日处理总数
    todaySuccess: 0,         // 今日成功数
    todayFailed: 0,           // 今日失败数
    totalGenerated: 0,          // 总生成卡片数
    lastError: null            // 最后错误信息
  }
};

/**
 * 更新处理状态
 */
export function updateState(updates) {
  Object.assign(processingState, updates);
  processingState.lastUpdateTime = new Date().toISOString();
}

/**
 * 格式化时间为 24 小时制 (HH:mm:ss)
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 添加处理日志
 */
export function addLog(type = 'info', message) {
  const log = {
    time: formatTime(new Date()),
    type,
    message
  };
  processingState.logs.push(log);
  
  // 保持最近 100 条日志
  if (processingState.logs.length > 100) {
    processingState.logs.shift();
  }
}

/**
 * 增加统计计数
 */
export function incrementStats(key) {
  if (processingState.stats.hasOwnProperty(key)) {
    processingState.stats[key]++;
    processingState.lastUpdateTime = new Date().toISOString();
  }
}

/**
 * 获取统计数据
 */
export function getStats() {
  return { ...processingState.stats };
}

/**
 * 获取当前状态
 */
export function getState() {
  return { ...processingState };
}

export default {
  updateState,
  addLog,
  getState,
  getStats,
  incrementStats
};