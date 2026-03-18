import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  agentIds: [{ type: String }],  // 智能体ID列表
  isDefault: { type: Boolean, default: false },  // 是否为默认空间
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
workspaceSchema.index({ name: 1 });

// 更新时自动设置 updatedAt
workspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Workspace', workspaceSchema);
