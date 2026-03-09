import mongoose from 'mongoose';

const agentRunSchema = new mongoose.Schema({
  agentName: { type: String, required: true },
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['pending', 'running', 'success', 'failed'], default: 'pending' },
  durationMs: Number,
  errorMessage: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const requestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, default: 'admin' },
  source: { type: String, enum: ['feishu', 'cloud_function', 'manual', 'feedback'], default: 'feishu' },
  feedbackId: { type: String }, // 关联原始反馈ID
  feedbackType: { type: String, enum: ['CARD', 'CARD_SET', 'SUGGESTION'] }, // 反馈类型
  resourceId: { type: String }, // 关联的资源ID（卡片/卡册）
  requirement: { type: String, required: true },
  
  // 各智能体输出
  intentResult: {
    theme: String,
    type: String,
    keywords: [String],
    emotion: String,
    count: { type: Number, default: 1 },
    userPreferences: mongoose.Schema.Types.Mixed
  },
  knowledgeResult: {
    found: Boolean,
    knowledgeId: String,
    knowledgePoints: mongoose.Schema.Types.Mixed,
    source: { type: String, enum: ['hit', 'generated'] }
  },
  designResult: mongoose.Schema.Types.Mixed,
  reviewResult: {
    valid: Boolean,
    errors: [String],
    warnings: [String]
  },
  cardResult: {
    success: Boolean,
    cardId: String,
    cardName: String,
    message: String
  },
  
  // 智能体运行记录
  agentRuns: [agentRunSchema],
  
  // 整体状态
  status: { type: String, enum: ['processing', 'success', 'failed'], default: 'processing' },
  totalTimeMs: Number,
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
requestSchema.index({ createdAt: -1 });
requestSchema.index({ status: 1 });

export default mongoose.model('Request', requestSchema);
