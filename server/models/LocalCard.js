import mongoose from 'mongoose';

/**
 * 本地卡片模型 - 存储 AI 生成的卡片
 */
const LocalCardSchema = new mongoose.Schema({
  // 卡片ID（本地生成）
  cardId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 主题
  theme: {
    type: String,
    required: true
  },
  
  // 风格
  style: {
    type: String,
    default: ''
  },
  
  // 使用的模型
  model: {
    type: String,
    default: 'ollama-qwen'
  },
  
  // 完整的卡片数据（JSON）
  cardData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // 需求分析结果
  analysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // 设计方案
  design: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // 状态：local（本地草稿）/ published（已发布）
  status: {
    type: String,
    enum: ['local', 'published'],
    default: 'local',
    index: true
  },
  
  // 发布时间
  publishedAt: {
    type: Date,
    default: null
  },
  
  // 云端卡片ID
  publishedCardId: {
    type: String,
    default: null
  },
  
  // 云端卡片名称
  publishedCardName: {
    type: String,
    default: null
  },
  
  // 任务ID（关联 StepLog）
  taskId: {
    type: String,
    index: true
  },
  
  // 生成步骤记录
  steps: [{
    step: Number,
    name: String,
    duration: Number,
    success: Boolean
  }],
  
  // 总生成时长
  totalDuration: {
    type: Number,
    default: 0
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

// 更新时自动设置 updatedAt
LocalCardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 生成卡片ID
LocalCardSchema.statics.generateCardId = function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOCAL_${dateStr}_${timeStr}_${random}`;
};

export default mongoose.model('LocalCard', LocalCardSchema);
