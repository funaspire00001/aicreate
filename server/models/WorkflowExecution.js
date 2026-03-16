import mongoose from 'mongoose';

const workflowExecutionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  workflowId: { type: String, required: true, index: true },
  workflowName: { type: String },
  
  // 执行状态
  status: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  
  // 输入输出
  input: { type: String },
  output: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  
  // 时间
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number }, // 毫秒
  
  // 步骤执行详情
  steps: [{
    order: { type: Number },
    name: { type: String },
    agentId: { type: String },
    agentName: { type: String },
    status: { type: String, enum: ['pending', 'running', 'success', 'failed', 'skipped'] },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },
    input: { type: String },
    output: { type: mongoose.Schema.Types.Mixed },
    error: { type: String }
  }],
  
  // 触发信息
  triggeredBy: { type: String, default: 'manual' }, // manual, webhook, schedule, event
  
  createdAt: { type: Date, default: Date.now, index: true }
});

// 索引
workflowExecutionSchema.index({ workflowId: 1, createdAt: -1 });
workflowExecutionSchema.index({ status: 1 });

export default mongoose.model('WorkflowExecution', workflowExecutionSchema);
