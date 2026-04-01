import { Schema, model, models, Document, Types } from 'mongoose';

export const API_KEY_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  provider: ApiKeyProvider;
  encryptedKey: string;
  iv: string;
  authTag: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, enum: API_KEY_PROVIDERS },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { timestamps: true }
);

ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const ApiKey = models.ApiKey || model<IApiKey>('ApiKey', ApiKeySchema);
