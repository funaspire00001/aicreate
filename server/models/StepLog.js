import mongoose from 'mongoose';

const StepLogSchema = new mongoose.Schema({
  // 关联的任务/卡片
  taskId: { type: String, required: true, index: true },
  cardId: { type: String },
  
  // 步骤信息
  step: { type: Number, required: true },           // 步骤序号 1-4
  stepName: { type: String, required: true },       // 步骤名称
  
  // 输入输出
  input: { type: mongoose.Schema.Types.Mixed },     // 输入数据
  output: { type: mongoose.Schema.Types.Mixed },    // 输出数据
  rawResponse: { type: String },                     // 原始响应
  
  // 执行信息
  model: { type: String, required: true },          // 使用的模型
  duration: { type: Number, required: true },       // 耗时(ms)
  success: { type: Boolean, default: true },        // 是否成功
  error: { type: String },                          // 错误信息
  
  // 时间戳
  createdAt: { type: Date, default: Date.now }
});

// 索引
StepLogSchema.index({ taskId: 1, step: 1 });
StepLogSchema.index({ createdAt: -1 });

const StepLog = mongoose.model('StepLog', StepLogSchema);

export default StepLog;
