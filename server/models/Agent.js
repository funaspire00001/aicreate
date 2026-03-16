import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true, enum: ['analyst', 'generator', 'designer', 'reviewer', 'planner', 'custom'] },
  description: { type: String, default: '' },
  
  // 关联模型 ID（引用 models.json 中的模型）
  modelId: { type: String, default: 'ollama-qwen' },
  
  // 提示词
  prompt: { type: String, required: true },
  
  // 参数配置（可覆盖模型默认参数）
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 4096 },
  
  // 能力标签
  capabilities: [{ type: String }],
  
  // 状态
  enabled: { type: Boolean, default: true },
  
  // 统计
  stats: {
    totalCalls: { type: Number, default: 0 },
    successCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
agentSchema.index({ role: 1 });
agentSchema.index({ enabled: 1 });

// 更新时自动设置 updatedAt
agentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Agent', agentSchema);
