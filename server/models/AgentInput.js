import mongoose from 'mongoose';

const AgentInputSchema = new mongoose.Schema({
  // 智能体标识
  agentKey: {
    type: String,
    required: true,
    enum: ['organizer', 'architect', 'planner', 'generator']
  },
  
  // 来源信息
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sourceType: {
    type: String,
    required: true,
    enum: ['demand', 'keypoint', 'knowledgetree', 'cardplan']
  },
  sourceUpdatedAt: {
    type: Date,
    required: true
  },
  
  // 输入数据快照
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // 处理状态
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  
  // 重试信息
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  errorMsg: {
    type: String
  },
  
  // 时间戳
  claimedAt: {
    type: Date,
    default: Date.now
  },
  processingAt: {
    type: Date
  },
  processedAt: {
    type: Date
  },
  
  // 处理耗时
  duration: {
    type: Number
  }
}, {
  timestamps: true,
  collection: 'agent_inputs'
});

// 唯一索引：同一智能体 + 同一来源 + 同一版本只处理一次
AgentInputSchema.index(
  { agentKey: 1, sourceId: 1, sourceUpdatedAt: 1 },
  { unique: true }
);

// 查询索引
AgentInputSchema.index({ agentKey: 1, status: 1 });
AgentInputSchema.index({ claimedAt: 1 });

export default mongoose.model('AgentInput', AgentInputSchema);
