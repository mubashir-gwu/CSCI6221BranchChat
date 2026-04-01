import { Schema, model, models, InferSchemaType, Types } from 'mongoose';

const NodeSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Node', default: null },
    role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    content: { type: String, required: true },
    provider: { type: String, enum: ['openai', 'anthropic', 'gemini', 'mock', null], default: null },
    model: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NodeSchema.index({ conversationId: 1 });
NodeSchema.index({ conversationId: 1, parentId: 1 });

export interface INode {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock' | null;
  model: string | null;
  createdAt: Date;
}

export const Node = models.Node || model('Node', NodeSchema);
