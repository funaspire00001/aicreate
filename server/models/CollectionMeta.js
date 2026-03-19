import mongoose from 'mongoose';

const collectionMetaSchema = new mongoose.Schema({
  // 英文集合名（唯一）
  name: { type: String, required: true, unique: true },
  // 中文名称
  displayName: { type: String, required: true },
  // 分类：管理表、智能体数据
  category: { type: String, default: '其他' },
  // 所属智能体ID列表（支持多智能体共享）
  agentIds: [{ type: String }],
  // 排序权重
  order: { type: Number, default: 99 },
  // 描述
  description: { type: String, default: '' },
  // 是否内置（内置的不可删除）
  isBuiltin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('CollectionMeta', collectionMetaSchema);
