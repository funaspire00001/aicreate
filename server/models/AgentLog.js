import mongoose from 'mongoose';

const agentLogSchema = new mongoose.Schema({
  // ========== 基础信息 ==========
  id: { type: String, required: true, unique: true },
  traceId: { type: String, required: true },          // 链路追踪ID
  
  // ========== 日志类型 ==========
  type: { 
    type: String, 
    required: true,
    enum: ['input', 'output', 'run', 'step', 'sync', 'request', 'error']
  },
  
  // ========== 关联 ==========
  agentId: { type: String, required: true },
  workspaceId: { type: String },
  
  // ========== 操作信息 ==========
  action: { type: String, required: true },           // 操作类型
  status: { 
    type: String, 
    enum: ['pending', 'success', 'fail', 'processing'],
    default: 'pending'
  },
  message: { type: String, default: '' },
  
  // ========== 详细数据 ==========
  data: { type: mongoose.Schema.Types.Mixed },        // 根据type不同存储不同内容
  
  // ========== 错误信息 ==========
  error: {
    code: { type: String },
    message: { type: String },
    stack: { type: String }
  },
  
  // ========== 耗时 ==========
  duration: { type: Number, default: 0 },             // 毫秒
  
  // ========== 元数据 ==========
  metadata: {
    modelId: { type: String },
    tokensUsed: { type: Number },
    inputCount: { type: Number },
    outputCount: { type: Number }
  },
  
  createdAt: { type: Date, default: Date.now }
});

// 索引
agentLogSchema.index({ traceId: 1 });                 // 链路追踪
agentLogSchema.index({ agentId: 1, type: 1 });        // 按智能体和类型查询
agentLogSchema.index({ status: 1 });                  // 按状态查询
agentLogSchema.index({ createdAt: -1 });              // 按时间倒序

export default mongoose.model('AgentLog', agentLogSchema);
