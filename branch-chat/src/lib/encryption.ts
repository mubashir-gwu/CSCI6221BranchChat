import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(plaintext: string): { encryptedKey: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encryptedKey: encrypted, iv: iv.toString('hex'), authTag };
}

export function decrypt(encryptedKey: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskKey(key: string): string {
  if (key.length <= 6) return '***';
  return key.substring(0, 3) + '...' + key.substring(key.length - 3);
}
