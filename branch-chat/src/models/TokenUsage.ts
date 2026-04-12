import { Schema, model, models, Types } from 'mongoose';

export interface ITokenUsage {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  model: string;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  webSearchRequests: number;
  updatedAt: Date;
}

const TokenUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['openai', 'anthropic', 'gemini', 'mock'], required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    callCount: { type: Number, default: 0 },
    webSearchRequests: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TokenUsageSchema.index({ userId: 1, model: 1 }, { unique: true });
TokenUsageSchema.index({ userId: 1, provider: 1 });

export const TokenUsage = models.TokenUsage || model('TokenUsage', TokenUsageSchema);
