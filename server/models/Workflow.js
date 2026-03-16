import mongoose from 'mongoose';

const workflowStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  name: { type: String, required: true },
  
  // 关联智能体 ID
  agentId: { type: String, required: true },
  agentName: { type: String, default: '' },
  
  // 步骤提示词（可覆盖智能体默认提示词）
  prompt: { type: String, default: '' },
  
  // 条件判断（可选）
  condition: { type: String },
  
  // 失败处理
  onFailure: {
    action: { type: String, enum: ['stop', 'skip', 'retry'], default: 'stop' },
    retryCount: { type: Number, default: 0 }
  }
});

const workflowSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  
  // 触发方式
  trigger: { 
    type: String, 
    required: true, 
    enum: ['manual', 'webhook', 'schedule', 'event'] 
  },
  
  // 定时配置（当 trigger 为 schedule 时）
  scheduleConfig: {
    cron: { type: String },
    timezone: { type: String, default: 'Asia/Shanghai' }
  },
  
  // 步骤
  steps: [workflowStepSchema],
  
  // 状态
  enabled: { type: Boolean, default: true },
  
  // 最后运行
  lastRun: { type: Date },
  lastStatus: { type: String, enum: ['success', 'failed', 'running', null], default: null },
  
  // 统计
  stats: {
    totalRuns: { type: Number, default: 0 },
    successRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
workflowSchema.index({ trigger: 1 });
workflowSchema.index({ enabled: 1 });

// 更新时自动设置 updatedAt
workflowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Workflow', workflowSchema);
