import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  // ========== 基础信息 ==========
  id: { type: String, required: true, unique: true },
  key: { 
    type: String, 
    required: true, 
    unique: true,
    enum: ['demand', 'organizer', 'architect', 'planner', 'generator', 'output']
  },
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['source', 'processor', 'output'],
    default: 'processor'
  },
  description: { type: String, default: '' },
  
  // ========== 数据配置 ==========
  data: {
    // 输入配置（支持多个输入源）
    inputs: [{
      source: { 
        type: String, 
        enum: ['user_input', 'feedback', 'agent_output', 'manual', 'external']
      },
      collection: { type: String },      // 数据表名
      query: { type: mongoose.Schema.Types.Mixed }, // 查询条件
      trigger: { 
        type: String, 
        enum: ['polling', 'event', 'manual'],
        default: 'polling'
      }
    }],
    // 输出配置
    output: {
      collection: { type: String },       // 输出数据表
      status: { type: String, default: 'pending' },  // 输出后状态
      notify: [{ type: String }]          // 通知下游智能体
    }
  },
  
  // ========== AI 配置（可选） ==========
  ai: {
    enabled: { type: Boolean, default: true },
    modelId: { type: String, default: 'ollama-qwen' },
    prompt: { type: String, default: '' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4096 }
  },
  
  // ========== 技能配置 ==========
  skills: [{
    id: { type: String },
    name: { type: String },
    config: { type: mongoose.Schema.Types.Mixed }
  }],
  
  // ========== 调度配置 ==========
  schedule: {
    interval: { type: Number, default: 5000 },    // 轮询间隔(ms)
    batchSize: { type: Number, default: 1 },      // 批处理数量
    maxRetries: { type: Number, default: 3 }      // 最大重试次数
  },
  
  // ========== 运行时状态 ==========
  status: {
    state: { 
      type: String, 
      enum: ['idle', 'running', 'failed'],
      default: 'idle'
    },
    currentTask: { type: String },
    lastRun: { type: Date },
    errorMsg: { type: String }
  },
  
  // ========== 统计信息 ==========
  stats: {
    totalCalls: { type: Number, default: 0 },
    successCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 }
  },
  
  // ========== 开关 ==========
  enabled: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
agentSchema.index({ key: 1 });
agentSchema.index({ type: 1 });
agentSchema.index({ enabled: 1 });

// 更新时自动设置 updatedAt
agentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Agent', agentSchema);