import mongoose from 'mongoose';

const knowledgePointSchema = new mongoose.Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  difficulty: { type: String, enum: ['简单', '中等', '困难'], default: '中等' },
  keywords: [String]
}, { _id: false });

const knowledgeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  subject: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  topic: { type: String, required: true, index: true },
  knowledgePoints: [knowledgePointSchema],
  recommendStyle: {
    templateStyle: String,
    colorScheme: String,
    layoutMode: String,
    textTemperament: String,
    refinementLevel: String,
    texturePreference: String
  },
  metadata: {
    usageCount: { type: Number, default: 0 },
    lastUsed: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['user_generated', 'system_generated', 'imported'], default: 'user_generated' },
    qualityScore: { type: Number, min: 0, max: 5, default: 0 }
  }
});

// 索引
knowledgeSchema.index({ subject: 1, category: 1 });
knowledgeSchema.index({ topic: 'text', 'knowledgePoints.question': 'text' });

export default mongoose.model('Knowledge', knowledgeSchema);
