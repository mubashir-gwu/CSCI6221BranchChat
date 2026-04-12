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

// Mock TokenUsage model
const mockTokenUsageFind = vi.fn();
vi.mock("@/models/TokenUsage", () => ({
  TokenUsage: {
    find: (...args: unknown[]) => mockTokenUsageFind(...args),
  },
}));

import { GET } from "@/app/api/token-usage/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession);
});

describe("GET /api/token-usage", () => {
  it("should return 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("should return per-model token usage for the authenticated user", async () => {
    mockTokenUsageFind.mockReturnValue({
      lean: () => [
        {
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 100,
          outputTokens: 200,
          callCount: 5,
        },
        {
          model: "claude-sonnet-4-6",
          provider: "anthropic",
          inputTokens: 50,
          outputTokens: 80,
          callCount: 2,
        },
      ],
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage).toHaveLength(2);
    expect(data.usage[0]).toEqual({
      model: "gpt-4o",
      provider: "openai",
      inputTokens: 100,
      outputTokens: 200,
      callCount: 5,
      webSearchRequests: 0,
    });
    expect(data.usage[1]).toEqual({
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      inputTokens: 50,
      outputTokens: 80,
      callCount: 2,
      webSearchRequests: 0,
    });
  });

  it("should return empty array for user with no usage", async () => {
    mockTokenUsageFind.mockReturnValue({
      lean: () => [],
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage).toEqual([]);
  });
});
