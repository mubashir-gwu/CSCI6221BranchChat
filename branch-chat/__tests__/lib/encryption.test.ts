import { describe, it, expect, vi, beforeAll } from "vitest";

// Set a test encryption key (32 bytes = 64 hex chars)
vi.stubEnv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

import { encrypt, decrypt, maskKey } from "@/lib/encryption";

describe("encryption", () => {
  describe("encrypt/decrypt round-trip", () => {
    it("should encrypt and decrypt a key successfully", () => {
      const original = "test-key";
      const encrypted = encrypt(original);

      expect(encrypted.encryptedKey).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();

      // All should be hex strings
      expect(encrypted.encryptedKey).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);

      const decrypted = decrypt(encrypted.encryptedKey, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(original);
    });

    it("should encrypt and decrypt a longer API key", () => {
      const original = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted.encryptedKey, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(original);
    });

    it("should produce different ciphertexts for the same plaintext", () => {
      const encrypted1 = encrypt("same-key");
      const encrypted2 = encrypt("same-key");
      expect(encrypted1.encryptedKey).not.toBe(encrypted2.encryptedKey);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe("tamper detection", () => {
    it("should throw when authTag is tampered", () => {
      const encrypted = encrypt("test-key");
      const tamperedTag = "a".repeat(encrypted.authTag.length);
      expect(() => decrypt(encrypted.encryptedKey, encrypted.iv, tamperedTag)).toThrow();
    });

    it("should throw when ciphertext is tampered", () => {
      const encrypted = encrypt("test-key");
      const tamperedCipher = "a".repeat(encrypted.encryptedKey.length);
      expect(() => decrypt(tamperedCipher, encrypted.iv, encrypted.authTag)).toThrow();
    });
  });

  describe("maskKey", () => {
    it("should mask a standard API key", () => {
      expect(maskKey("sk-abc123xyz")).toBe("sk-...xyz");
    });

    it("should return *** for short keys", () => {
      expect(maskKey("abc")).toBe("***");
      expect(maskKey("abcdef")).toBe("***");
    });

    it("should mask a 7-character key", () => {
      expect(maskKey("abcdefg")).toBe("abc...efg");
    });
  });
});
