import mongoose from 'mongoose';

const KnowledgeTreeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  
  // 关联
  demandId: { type: String, required: true, index: true },
  keyPointId: { type: String },
  
  // 状态
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  
  // 输入（关键点）
  input: { type: mongoose.Schema.Types.Mixed },
  
  // 输出：知识树结构
  tree: { type: mongoose.Schema.Types.Mixed },
  
  // 原始AI响应
  rawOutput: { type: String },
  
  // 执行信息
  error: { type: String },
  duration: { type: Number },
  
  // ===== 消费标记（下游智能体使用）=====
  // 是否已被卡片规划智能体处理
  consumedByCardPlan: { type: Boolean, default: false },
  consumedByCardPlanAt: { type: Date },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

// 索引
KnowledgeTreeSchema.index({ demandId: 1, status: 1 });
KnowledgeTreeSchema.index({ consumedByCardPlan: 1, status: 1 });

const KnowledgeTree = mongoose.model('KnowledgeTree', KnowledgeTreeSchema);

export default KnowledgeTree;
