import mongoose from 'mongoose';

const AgentOutputSchema = new mongoose.Schema({
  // 智能体标识
  agentKey: {
    type: String,
    required: true,
    enum: ['organizer', 'architect', 'planner', 'generator']
  },
  
  // 关联的输入记录
  inputId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentInput',
    required: true
  },
  
  // 来源追溯
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sourceType: {
    type: String,
    required: true,
    enum: ['demand', 'keypoint', 'knowledgetree', 'cardplan']
  },
  
  // 输出数据
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // 输出类型（便于后续查询）
  outputType: {
    type: String,
    enum: ['keypoint', 'knowledgetree', 'cardplan', 'card'],
    required: true
  },
  
  // 生成的数据 ID（如果写入了其他集合）
  outputIds: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  
  // 处理状态
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },
  
  // 处理耗时
  duration: {
    type: Number
  },
  
  // 错误信息
  errorMsg: {
    type: String
  },
  
  // 元数据
  metadata: {
    modelId: String,
    tokensUsed: Number,
    promptTokens: Number,
    completionTokens: Number
  }
}, {
  timestamps: true,
  collection: 'agent_outputs'
});

// 查询索引
AgentOutputSchema.index({ agentKey: 1, createdAt: -1 });
AgentOutputSchema.index({ inputId: 1 });
AgentOutputSchema.index({ sourceId: 1 });

export default mongoose.model('AgentOutput', AgentOutputSchema);
