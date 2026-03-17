import mongoose from 'mongoose';

/**
 * 需求数据模型 - 用户提交的需求/主题
 * 作为整个智能体流程的入口和追踪点
 */
const demandSchema = new mongoose.Schema({
  // 需求ID
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // 主题（标题）
  theme: {
    type: String,
    required: true
  },

  // 详细内容
  content: {
    type: String,
    default: ''
  },

  // 来源
  source: {
    type: String,
    enum: ['manual', 'web', 'feedback', 'import'],
    default: 'manual'
  },

  // 标签
  tags: [{
    type: String
  }],

  // 优先级
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },

  // 状态
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },

  // 当前执行步骤 (0=待开始, 1=信息整理, 2=知识树, 3=卡片规划, 4=卡片生成, 5=完成)
  currentStep: {
    type: Number,
    default: 0
  },

  // ===== 消费标记（下游智能体使用）=====
  
  // 是否已被信息整理智能体处理
  consumedByKeyPoint: { type: Boolean, default: false },
  consumedByKeyPointAt: { type: Date },

  // ===== 关联 ID（链接到独立数据表）=====
  
  // 关联的关键点
  keyPointId: {
    type: String,
    default: null
  },

  // 关联的知识树
  knowledgeTreeId: {
    type: String,
    default: null
  },

  // 关联的卡片规划
  cardPlanId: {
    type: String,
    default: null
  },

  // 关联的工作流执行ID
  workflowExecutionId: {
    type: String,
    default: null
  },

  // 生成的卡片ID列表
  cardIds: [{
    type: String
  }],

  // 卡片数量
  cardCount: {
    type: Number,
    default: 0
  },

  // 处理完成时间
  processedAt: {
    type: Date,
    default: null
  },

  // 错误信息
  errorMessage: {
    type: String,
    default: null
  },

  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
demandSchema.index({ status: 1, createdAt: -1 });
demandSchema.index({ source: 1 });
demandSchema.index({ currentStep: 1 });

// 生成需求ID
demandSchema.statics.generateId = function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEMAND_${dateStr}_${timeStr}_${random}`;
};

// 更新时自动设置 updatedAt
demandSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Demand', demandSchema);
