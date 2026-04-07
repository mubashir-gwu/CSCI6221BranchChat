import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock availability
const mockGetAvailableProviders = vi.fn();
vi.mock("@/lib/providers/availability", () => ({
  getAvailableProviders: () => mockGetAvailableProviders(),
}));

import { GET } from "@/app/api/providers/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession);
  mockGetAvailableProviders.mockReturnValue(["openai", "mock"]);
});

describe("GET /api/providers", () => {
  it("should return 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("should return available providers for authenticated user", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.providers).toEqual(["openai", "mock"]);
  });

  it("should return empty array when no providers available", async () => {
    mockGetAvailableProviders.mockReturnValue([]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.providers).toEqual([]);
  });
});
