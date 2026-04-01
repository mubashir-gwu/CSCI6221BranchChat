import { Schema, model, models, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  userId: Types.ObjectId;
  title: string;
  defaultProvider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  defaultModel: string;
  rootNodeId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    defaultProvider: { type: String, required: true, enum: ['openai', 'anthropic', 'gemini', 'mock'] },
    defaultModel: { type: String, required: true },
    rootNodeId: { type: Schema.Types.ObjectId, ref: 'Node', default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const Conversation = models.Conversation || model<IConversation>('Conversation', ConversationSchema);
