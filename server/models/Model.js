import mongoose from 'mongoose';

const modelSchema = new mongoose.Schema({
  // ========== 基础信息 ==========
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  provider: { 
    type: String, 
    required: true,
    enum: ['doubao', 'ollama', 'openai', 'deepseek', 'anthropic', 'custom']
  },
  
  // ========== 模型配置 ==========
  config: {
    endpoint: { type: String, required: true },
    model: { type: String, required: true },
    apiKey: { type: String },                    // 支持环境变量 ${API_KEY}
    maxTokens: { type: Number, default: 4096 },
    contextWindow: { type: Number, default: 4096 }
  },
  
  // ========== 能力标签 ==========
  capabilities: {
    chat: { type: Boolean, default: true },
    streaming: { type: Boolean, default: false },
    functionCall: { type: Boolean, default: false },
    vision: { type: Boolean, default: false }
  },
  
  // ========== 性能指标 ==========
  performance: {
    avgLatency: { type: Number, default: 0 },     // 平均响应时间 ms
    costPerToken: { type: Number, default: 0 },   // 每token成本
    dailyLimit: { type: Number, default: 0 },     // 每日调用限制
    dailyUsed: { type: Number, default: 0 }       // 今日已用
  },
  
  // ========== 状态 ==========
  enabled: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 更新时自动设置 updatedAt
modelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Model', modelSchema);
