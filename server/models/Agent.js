import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  workspaceId: { type: String, default: '' },

  // AI 配置
  ai: {
    enabled: { type: Boolean, default: true },
    modelId: { type: String, default: '' },
    prompt: { type: String, default: '' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4096 }
  },

  // 独立调度配置
  schedule: {
    enabled: { type: Boolean, default: true },
    interval: { type: Number, default: 30000 },
    batchSize: { type: Number, default: 10 },
    maxRetries: { type: Number, default: 3 }
  },

  // 成果表定义
  outputSchema: {
    collectionName: { type: String, default: '' },
    version: { type: Number, default: 1 },
    fields: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // 数据订阅配置
  subscriptions: [{
    agentId: { type: String, required: true },
    collectionName: { type: String, required: true },
    watermarkField: { type: String, default: 'updatedAt' },
    batchSize: { type: Number, default: 100 },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} }
  }],

  // 技能关联
  skillIds: [{ type: String }],

  enabled: { type: Boolean, default: true },

  // 运行状态（服务端更新，不由用户直接修改）
  status: {
    state: {
      type: String,
      enum: ['idle', 'running', 'error'],
      default: 'idle'
    },
    lastRun: { type: Date },
    currentTask: { type: String }
  },

  // 统计（服务端累加）
  stats: {
    totalRuns: { type: Number, default: 0 },
    successRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

agentSchema.index({ workspaceId: 1 });
agentSchema.index({ enabled: 1 });

agentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Agent', agentSchema);
