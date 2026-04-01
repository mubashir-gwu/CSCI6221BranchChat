import { Schema, model, models, Document, Types } from 'mongoose';

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini';
  encryptedKey: string;
  iv: string;
  authTag: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, enum: ['openai', 'anthropic', 'gemini'] },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { timestamps: true }
);

ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const ApiKey = models.ApiKey || model<IApiKey>('ApiKey', ApiKeySchema);
