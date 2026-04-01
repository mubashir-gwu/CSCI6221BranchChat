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
  decrypt: vi.fn().mockReturnValue("sk-test-key-12345"),
}));

// Mock context builder
const mockBuildContext = vi.fn();
vi.mock("@/lib/contextBuilder", () => ({
  buildContext: (...args: unknown[]) => mockBuildContext(...args),
}));

// Mock providers
const mockSendMessage = vi.fn();
vi.mock("@/lib/providers", () => ({
  getProvider: () => ({
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  }),
}));

// Mock Conversation model
const mockConversationFindById = vi.fn();
const mockConversationFindByIdAndUpdate = vi.fn();
vi.mock("@/models/Conversation", () => ({
  Conversation: {
    findById: (...args: unknown[]) => mockConversationFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockConversationFindByIdAndUpdate(...args),
  },
}));

// Mock ApiKey model
const mockApiKeyFindOne = vi.fn();
vi.mock("@/models/ApiKey", () => ({
  ApiKey: {
    findOne: (...args: unknown[]) => mockApiKeyFindOne(...args),
  },
}));

// Mock Node model
const mockNodeFind = vi.fn();
const mockNodeCreate = vi.fn();
vi.mock("@/models/Node", () => ({
  Node: {
    find: (...args: unknown[]) => mockNodeFind(...args),
    create: (...args: unknown[]) => mockNodeCreate(...args),
  },
}));

// Import after mocks
import { POST } from "@/app/api/llm/chat/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

const mockConversation = {
  _id: { toString: () => "conv-1" },
  userId: { toString: () => "user-1" },
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
  rootNodeId: null,
};

function makeRequest(body: object): Request {
  return new Request("http://localhost:3000/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  conversationId: "conv-1",
  parentNodeId: "node-1",
  content: "Hello, how are you?",
  provider: "openai",
  model: "gpt-4o",
};

const now = new Date("2024-06-01T00:00:00Z");

function makeMockNode(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => overrides.id ?? "node-new" },
    conversationId: { toString: () => "conv-1" },
    parentId: overrides.parentId !== undefined
      ? (overrides.parentId === null ? null : { toString: () => overrides.parentId })
      : { toString: () => "node-1" },
    role: overrides.role ?? "user",
    content: overrides.content ?? "Hello",
    provider: overrides.provider ?? null,
    model: overrides.model ?? null,
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock setup for successful flow
  mockAuth.mockResolvedValue(mockSession);
  mockConversationFindById.mockResolvedValue(mockConversation);
  mockApiKeyFindOne.mockReturnValue({
    lean: () => ({
      encryptedKey: "enc",
      iv: "iv",
      authTag: "tag",
    }),
  });
  mockNodeFind.mockReturnValue({
    lean: () => [],
  });
  mockBuildContext.mockReturnValue([
    { role: "user", content: "Hello, how are you?" },
  ]);
  mockSendMessage.mockResolvedValue({
    content: "I'm doing well!",
    model: "gpt-4o",
    provider: "openai",
  });

  let createCallCount = 0;
  mockNodeCreate.mockImplementation((data: Record<string, unknown>) => {
    createCallCount++;
    return makeMockNode({
      id: `node-${createCallCount}`,
      parentId: data.parentId,
      role: data.role,
      content: data.content,
      provider: data.provider,
      model: data.model,
    });
  });
});

describe("POST /api/llm/chat", () => {
  it("should return 401 if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("should return 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ conversationId: "conv-1" }));
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid provider", async () => {
    const res = await POST(
      makeRequest({ ...validBody, provider: "invalid-provider" })
    );
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid model", async () => {
    const res = await POST(
      makeRequest({ ...validBody, model: "nonexistent-model" })
    );
    expect(res.status).toBe(400);
  });

  it("should return 404 if conversation not found", async () => {
    mockConversationFindById.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("should return 403 if conversation belongs to different user", async () => {
    mockConversationFindById.mockResolvedValue({
      ...mockConversation,
      userId: { toString: () => "other-user" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("should return 422 when no API key found for provider", async () => {
    mockApiKeyFindOne.mockReturnValue({
      lean: () => null,
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe("No API key found for openai.");
  });

  it("should return 201 with userNode and assistantNode on success", async () => {
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.userNode).toBeDefined();
    expect(data.assistantNode).toBeDefined();
    expect(data.userNode.role).toBe("user");
    expect(data.assistantNode.role).toBe("assistant");
    expect(data.userNode.provider).toBeNull();
    expect(data.assistantNode.provider).toBe("openai");
    expect(data.assistantNode.model).toBe("gpt-4o");
  });

  it("should set rootNodeId when parentNodeId is null (first message)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, parentNodeId: null })
    );

    expect(res.status).toBe(201);
    expect(mockConversationFindByIdAndUpdate).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ rootNodeId: expect.anything() })
    );
  });

  it("should NOT set rootNodeId when parentNodeId is provided", async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(mockConversationFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("should include ancestor path context via buildContext", async () => {
    await POST(makeRequest(validBody));

    expect(mockBuildContext).toHaveBeenCalledWith(
      "node-1",
      "Hello, how are you?",
      expect.any(Map),
      128000 // gpt-4o context window
    );
  });

  it("should work with mock provider without API key", async () => {
    // Mock provider requires no API key
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const res = await POST(
      makeRequest({
        ...validBody,
        provider: "mock",
        model: "mock-model",
      })
    );

    expect(res.status).toBe(201);
    // ApiKey.findOne should NOT have been called for mock
    expect(mockApiKeyFindOne).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it("should return 429 on rate limit error from LLM", async () => {
    mockSendMessage.mockRejectedValue({ status: 429, message: "Rate limited" });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Rate limited");
  });

  it("should return 502 on invalid API key error from LLM", async () => {
    mockSendMessage.mockRejectedValue({ status: 401, message: "Invalid key" });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe("Invalid API key");
  });

  it("should return 502 on generic LLM error", async () => {
    mockSendMessage.mockRejectedValue(new Error("Something went wrong"));

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe("openai API error");
  });

  it("should preserve user node on LLM failure for retry", async () => {
    mockSendMessage.mockRejectedValue(new Error("LLM failed"));

    await POST(makeRequest(validBody));

    // User node should have been created (first call)
    expect(mockNodeCreate).toHaveBeenCalledTimes(1);
    expect(mockNodeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        content: "Hello, how are you?",
      })
    );
    // No assistant node created (only 1 call total)
  });
});
