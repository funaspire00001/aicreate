import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'paused', 'archived'],
    default: 'active'
  },
  agentIds: [{ type: String }],

  stats: {
    activeAgents: { type: Number, default: 0 },
    totalOutputs: { type: Number, default: 0 },
    lastActivityAt: { type: Date }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

workspaceSchema.index({ name: 1 });
workspaceSchema.index({ status: 1 });

workspaceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Workspace', workspaceSchema);
