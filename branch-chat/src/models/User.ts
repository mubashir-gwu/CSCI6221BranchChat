import { Schema, model, models, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  hashedPassword: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashedPassword: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>('User', UserSchema);
