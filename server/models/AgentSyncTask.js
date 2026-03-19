import mongoose from 'mongoose';

const agentSyncTaskSchema = new mongoose.Schema({
  // ========== 联合主键 ==========
  consumerAgentId: { type: String, required: true },   // 消费者智能体ID
  producerAgentId: { type: String, required: true },   // 生产者智能体ID
  sourceCollection: { type: String, required: true },  // 数据源表名
  
  // ========== 水位线（CDC核心）==========
  lastSyncWatermark: { type: Date, default: null },    // 上次同步时间点
  lastSyncCount: { type: Number, default: 0 },         // 上次同步条数
  
  // ========== 同步状态 ==========
  lastRunAt: { type: Date, default: null },
  lastStatus: { 
    type: String, 
    enum: ['success', 'fail', 'processing', 'pending'],
    default: 'pending'
  },
  errorMsg: { type: String, default: '' },
  
  // ========== 重试机制 ==========
  retryCount: { type: Number, default: 0 },            // 当前重试次数
  maxRetries: { type: Number, default: 3 },            // 最大重试次数
  nextRetryAt: { type: Date, default: null },          // 下次重试时间
  
  // ========== 统计 ==========
  totalSyncCount: { type: Number, default: 0 },        // 累计同步条数
  totalSuccessCount: { type: Number, default: 0 },     // 累计成功条数
  totalFailCount: { type: Number, default: 0 },        // 累计失败条数
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 联合唯一索引
agentSyncTaskSchema.index(
  { consumerAgentId: 1, producerAgentId: 1, sourceCollection: 1 },
  { unique: true }
);

// 更新时自动设置 updatedAt
agentSyncTaskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('AgentSyncTask', agentSyncTaskSchema);
