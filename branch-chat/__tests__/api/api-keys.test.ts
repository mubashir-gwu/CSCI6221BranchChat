import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock db
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue({
    encryptedKey: "encrypted-hex",
    iv: "iv-hex",
    authTag: "tag-hex",
  }),
  decrypt: vi.fn().mockReturnValue("sk-test-key-12345"),
  maskKey: vi.fn().mockReturnValue("sk-...345"),
}));

// Mock ApiKey model
const mockApiKeyFind = vi.fn();
const mockApiKeyFindOneAndUpdate = vi.fn();
const mockApiKeyDeleteOne = vi.fn();

vi.mock("@/models/ApiKey", () => ({
  ApiKey: {
    find: (...args: unknown[]) => mockApiKeyFind(...args),
    findOneAndUpdate: (...args: unknown[]) => mockApiKeyFindOneAndUpdate(...args),
    deleteOne: (...args: unknown[]) => mockApiKeyDeleteOne(...args),
  },
  API_KEY_PROVIDERS: ["openai", "anthropic", "gemini"],
}));

// Import handlers after mocks
import { GET } from "@/app/api/settings/api-keys/route";
import { PUT, DELETE } from "@/app/api/settings/api-keys/[provider]/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

function makeRequest(body?: object): Request {
  return new Request("http://localhost:3000/api/settings/api-keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

describe("API Key Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/settings/api-keys", () => {
    it("should return 401 if not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("should return masked keys", async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockApiKeyFind.mockReturnValue({
        lean: () => [
          {
            provider: "openai",
            encryptedKey: "enc",
            iv: "iv",
            authTag: "tag",
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
      });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.keys).toHaveLength(1);
      expect(data.keys[0].provider).toBe("openai");
      expect(data.keys[0].maskedKey).toBe("sk-...345");
    });
  });

  describe("PUT /api/settings/api-keys/[provider]", () => {
    it("should return 401 if not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await PUT(makeRequest({ apiKey: "sk-test" }), makeParams("openai"));
      expect(res.status).toBe(401);
    });

    it("should return 400 for invalid provider", async () => {
      mockAuth.mockResolvedValue(mockSession);
      const res = await PUT(makeRequest({ apiKey: "sk-test" }), makeParams("invalid"));
      expect(res.status).toBe(400);
    });

    it("should return 400 if apiKey is missing", async () => {
      mockAuth.mockResolvedValue(mockSession);
      const res = await PUT(makeRequest({}), makeParams("openai"));
      expect(res.status).toBe(400);
    });

    it("should save an API key successfully", async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockApiKeyFindOneAndUpdate.mockResolvedValue({});

      const res = await PUT(makeRequest({ apiKey: "sk-test" }), makeParams("openai"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("API key saved");
      expect(mockApiKeyFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1", provider: "openai" },
        { encryptedKey: "encrypted-hex", iv: "iv-hex", authTag: "tag-hex" },
        { upsert: true, new: true }
      );
    });

    it("should accept all valid providers", async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockApiKeyFindOneAndUpdate.mockResolvedValue({});

      for (const provider of ["openai", "anthropic", "gemini"]) {
        const res = await PUT(makeRequest({ apiKey: "sk-test" }), makeParams(provider));
        expect(res.status).toBe(200);
      }
    });
  });

  describe("DELETE /api/settings/api-keys/[provider]", () => {
    it("should return 401 if not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await DELETE(new Request("http://localhost:3000"), makeParams("openai"));
      expect(res.status).toBe(401);
    });

    it("should return 400 for invalid provider", async () => {
      mockAuth.mockResolvedValue(mockSession);
      const res = await DELETE(new Request("http://localhost:3000"), makeParams("invalid"));
      expect(res.status).toBe(400);
    });

    it("should delete an API key successfully", async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockApiKeyDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await DELETE(new Request("http://localhost:3000"), makeParams("openai"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("API key deleted");
      expect(mockApiKeyDeleteOne).toHaveBeenCalledWith({
        userId: "user-1",
        provider: "openai",
      });
    });
  });
});
