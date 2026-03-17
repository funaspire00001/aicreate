import mongoose from 'mongoose';

const StepLogSchema = new mongoose.Schema({
  // 关联的执行记录
  executionId: { type: String, index: true },
  taskId: { type: String, index: true },
  cardId: { type: String },
  
  // 智能体标识（用于按智能体筛选日志）
  agentKey: { 
    type: String, 
    enum: ['organizer', 'architect', 'planner', 'generator', 'system'],
    index: true 
  },
  
  // 步骤信息
  step: { type: Number },           // 步骤序号 1-4
  stepName: { type: String },       // 步骤名称
  
  // 日志级别
  level: { 
    type: String, 
    enum: ['info', 'warn', 'error', 'debug'], 
    default: 'info' 
  },
  
  // 日志消息
  message: { type: String, required: true },        // 日志消息
  
  // 输出数据
  output: { type: mongoose.Schema.Types.Mixed },    // 输出数据
  rawResponse: { type: String },                     // 原始响应
  
  // 执行信息
  model: { type: String },                           // 使用的模型
  agentId: { type: String },                         // 智能体ID
  agentName: { type: String },                       // 智能体名称
  duration: { type: Number },                        // 耗时(ms)
  success: { type: Boolean, default: true },         // 是否成功
  error: { type: String },                           // 错误信息
  
  // 时间戳
  createdAt: { type: Date, default: Date.now, index: true }
});

// 索引
StepLogSchema.index({ agentKey: 1, createdAt: -1 });
StepLogSchema.index({ executionId: 1, createdAt: 1 });
StepLogSchema.index({ level: 1 });

const StepLog = mongoose.model('StepLog', StepLogSchema);

export default StepLog;
