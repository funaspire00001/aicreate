import mongoose from 'mongoose';

const agentRunSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requestId: { type: String, required: true, index: true },
  agentName: { type: String, required: true, index: true },
  
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  
  status: { type: String, enum: ['pending', 'running', 'success', 'failed'], default: 'pending' },
  durationMs: Number,
  errorMessage: String,
  
  createdAt: { type: Date, default: Date.now, index: true }
});

// 索引
agentRunSchema.index({ agentName: 1, createdAt: -1 });
agentRunSchema.index({ status: 1 });

export default mongoose.model('AgentRun', agentRunSchema);
