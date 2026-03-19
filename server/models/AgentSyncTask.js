import mongoose from 'mongoose';

const agentSyncTaskSchema = new mongoose.Schema({
  subscriberAgentId: { type: String, required: true },
  sourceAgentId: { type: String, required: true },
  sourceCollection: { type: String, required: true },

  // 水位线
  lastReadWatermark: { type: Date, default: null },
  lastReadCount: { type: Number, default: 0 },

  // 读取状态
  lastRunAt: { type: Date, default: null },
  lastStatus: {
    type: String,
    enum: ['success', 'fail', 'processing', 'pending'],
    default: 'pending'
  },
  errorMsg: { type: String, default: '' },

  // 重试
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: { type: Date, default: null },

  // 统计
  totalReadCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

agentSyncTaskSchema.index(
  { subscriberAgentId: 1, sourceAgentId: 1 },
  { unique: true }
);
agentSyncTaskSchema.index({ lastStatus: 1 });

agentSyncTaskSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('AgentSyncTask', agentSyncTaskSchema);
