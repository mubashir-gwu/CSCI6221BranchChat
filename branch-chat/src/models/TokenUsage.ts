import { Schema, model, models, Document, Types } from 'mongoose';

export interface ITokenUsage extends Document {
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  updatedAt: Date;
}

const TokenUsageSchema = new Schema<ITokenUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['openai', 'anthropic', 'gemini', 'mock'], required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    callCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TokenUsageSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const TokenUsage = models.TokenUsage || model<ITokenUsage>('TokenUsage', TokenUsageSchema);
