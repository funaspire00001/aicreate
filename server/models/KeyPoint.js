import mongoose from 'mongoose';

const KeyPointSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  
  // 关联需求
  demandId: { type: String, required: true, index: true },
  
  // 状态
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  
  // 输入（原始需求内容）
  input: { type: String },
  
  // 输出：关键点列表
  points: { type: mongoose.Schema.Types.Mixed },
  
  // 总结
  summary: { type: String },
  
  // 原始AI响应
  rawOutput: { type: String },
  
  // 执行信息
  error: { type: String },
  duration: { type: Number },
  
  // ===== 消费标记（下游智能体使用）=====
  // 是否已被知识树智能体处理
  consumedByKnowledgeTree: { type: Boolean, default: false },
  consumedByKnowledgeTreeAt: { type: Date },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

// 索引
KeyPointSchema.index({ demandId: 1, status: 1 });
KeyPointSchema.index({ consumedByKnowledgeTree: 1, status: 1 });

const KeyPoint = mongoose.model('KeyPoint', KeyPointSchema);

export default KeyPoint;
