import mongoose from 'mongoose';

const CardPlanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  
  // 关联
  demandId: { type: String, required: true, index: true },
  knowledgeTreeId: { type: String },
  
  // 状态
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  
  // 输入（知识树）
  input: { type: mongoose.Schema.Types.Mixed },
  
  // 输出：卡片规划列表
  plans: { type: mongoose.Schema.Types.Mixed },
  
  // 卡片总数
  totalCards: { type: Number, default: 0 },
  
  // 原始AI响应
  rawOutput: { type: String },
  
  // 执行信息
  error: { type: String },
  duration: { type: Number },
  
  // ===== 消费标记（下游智能体使用）=====
  // 是否已被卡片生成智能体处理
  consumedByCardGenerator: { type: Boolean, default: false },
  consumedByCardGeneratorAt: { type: Date },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

// 索引
CardPlanSchema.index({ demandId: 1, status: 1 });
CardPlanSchema.index({ consumedByCardGenerator: 1, status: 1 });

const CardPlan = mongoose.model('CardPlan', CardPlanSchema);

export default CardPlan;
