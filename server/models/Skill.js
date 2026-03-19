import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
  // ========== 基础信息 ==========
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  
  // ========== 技能类型 ==========
  type: { 
    type: String, 
    required: true,
    enum: ['template', 'tool', 'workflow']
  },
  
  // ========== 技能内容 ==========
  content: {
    // 模板类型：预设 Prompt 模板
    promptTemplate: { type: String },
    
    // 工具类型：可调用的函数
    tool: {
      name: { type: String },
      description: { type: String },
      parameters: { type: mongoose.Schema.Types.Mixed },
      handler: { type: String }              // 处理函数路径
    },
    
    // 工作流类型：多步骤编排
    workflow: {
      steps: [{
        name: { type: String },
        action: { type: String },
        agentId: { type: String },
        config: { type: mongoose.Schema.Types.Mixed }
      }]
    }
  },
  
  // ========== 输入输出定义 ==========
  inputSchema: {
    type: { type: String, default: 'object' },
    properties: { type: mongoose.Schema.Types.Mixed }
  },
  outputSchema: {
    type: { type: String, default: 'object' },
    properties: { type: mongoose.Schema.Types.Mixed }
  },
  
  // ========== 分类标签 ==========
  tags: [{ type: String }],
  category: { type: String, default: '其他' },
  
  // ========== 关联智能体 ==========
  agentIds: [{ type: String }],              // 使用此技能的智能体
  
  // ========== 状态 ==========
  enabled: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 更新时自动设置 updatedAt
skillSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Skill', skillSchema);
