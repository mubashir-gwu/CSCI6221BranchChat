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

// Mock provider availability
const mockIsProviderAvailable = vi.fn();
vi.mock("@/lib/providers/availability", () => ({
  isProviderAvailable: (...args: unknown[]) => mockIsProviderAvailable(...args),
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

// Mock Node model
const mockNodeFind = vi.fn();
const mockNodeCreate = vi.fn();
const mockNodeDeleteOne = vi.fn();
vi.mock("@/models/Node", () => ({
  Node: {
    find: (...args: unknown[]) => mockNodeFind(...args),
    create: (...args: unknown[]) => mockNodeCreate(...args),
    deleteOne: (...args: unknown[]) => mockNodeDeleteOne(...args),
  },
}));

// Mock TokenUsage model
const mockTokenUsageFindOneAndUpdate = vi.fn();
vi.mock("@/models/TokenUsage", () => ({
  TokenUsage: {
    findOneAndUpdate: (...args: unknown[]) => mockTokenUsageFindOneAndUpdate(...args),
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
  mockIsProviderAvailable.mockReturnValue(true);
  mockNodeFind.mockReturnValue({
    lean: () => [
      {
        _id: { toString: () => "node-1" },
        conversationId: { toString: () => "conv-1" },
        parentId: null,
        role: "user",
        content: "Previous message",
        provider: null,
        model: null,
        createdAt: now,
      },
    ],
  });
  mockNodeDeleteOne.mockResolvedValue({ deletedCount: 1 });
  mockBuildContext.mockReturnValue([
    { role: "user", content: "Hello, how are you?" },
  ]);
  mockSendMessage.mockResolvedValue({
    content: "I'm doing well!",
    model: "gpt-4o",
    provider: "openai",
    inputTokens: 10,
    outputTokens: 20,
  });
  mockTokenUsageFindOneAndUpdate.mockResolvedValue({});

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

  it("should return 422 when provider is not available", async () => {
    mockIsProviderAvailable.mockReturnValue(false);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain("not configured");
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

  it("should record token usage after successful call", async () => {
    await POST(makeRequest(validBody));

    expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", provider: "openai" },
      {
        $inc: {
          inputTokens: 10,
          outputTokens: 20,
          callCount: 1,
        },
      },
      { upsert: true }
    );
  });

  it("should still return 201 even if token tracking fails", async () => {
    mockTokenUsageFindOneAndUpdate.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
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

  it("should work with mock provider in development", async () => {
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

  describe("auto-title generation", () => {
    it("should generate title and return it in response when title is 'New Conversation'", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      mockSendMessage
        .mockResolvedValueOnce({
          content: "I'm doing well!",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 10,
          outputTokens: 20,
        })
        .mockResolvedValueOnce({
          content: "Greeting Exchange",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 5,
          outputTokens: 3,
        });

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.generatedTitle).toBe("Greeting Exchange");

      // Title should be saved to DB
      const titleUpdateCalls = mockConversationFindByIdAndUpdate.mock.calls.filter(
        (call: unknown[]) => {
          const update = call[1] as Record<string, unknown>;
          return typeof update.title === "string";
        }
      );
      expect(titleUpdateCalls.length).toBe(1);
      expect(titleUpdateCalls[0][1]).toEqual({ title: "Greeting Exchange" });
    });

    it("should NOT trigger title generation when title is not 'New Conversation'", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "Existing Title",
      });

      const res = await POST(makeRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.generatedTitle).toBeUndefined();

      // sendMessage should only be called once (for the chat itself)
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it("should not affect the main response if title generation fails", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      mockSendMessage
        .mockResolvedValueOnce({
          content: "I'm doing well!",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 10,
          outputTokens: 20,
        })
        .mockRejectedValueOnce(new Error("Title generation failed"));

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.userNode).toBeDefined();
      expect(data.assistantNode).toBeDefined();
      expect(data.generatedTitle).toBeUndefined();
    });

    it("should track token usage for the title generation call", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      mockSendMessage
        .mockResolvedValueOnce({
          content: "I'm doing well!",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 10,
          outputTokens: 20,
        })
        .mockResolvedValueOnce({
          content: "Greeting Exchange",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 5,
          outputTokens: 3,
        });

      await POST(makeRequest({ ...validBody, parentNodeId: null }));

      // Token usage should be tracked twice: once for chat, once for title
      expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledTimes(2);
      // Second call should be for title generation tokens
      expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1", provider: "openai" },
        {
          $inc: {
            inputTokens: 5,
            outputTokens: 3,
            callCount: 1,
          },
        },
        { upsert: true }
      );
    });

    it("should truncate title to 200 characters", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      const longTitle = "A".repeat(300);
      mockSendMessage
        .mockResolvedValueOnce({
          content: "I'm doing well!",
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 10,
          outputTokens: 20,
        })
        .mockResolvedValueOnce({
          content: longTitle,
          model: "gpt-4o",
          provider: "openai",
          inputTokens: 5,
          outputTokens: 3,
        });

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      const data = await res.json();

      expect(data.generatedTitle.length).toBe(200);

      const titleUpdateCalls = mockConversationFindByIdAndUpdate.mock.calls.filter(
        (call: unknown[]) => {
          const update = call[1] as Record<string, unknown>;
          return typeof update.title === "string";
        }
      );
      expect(titleUpdateCalls.length).toBe(1);
      expect((titleUpdateCalls[0][1] as Record<string, string>).title.length).toBe(200);
    });
  });

  it("should delete user node on LLM failure to prevent orphans", async () => {
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
    // User node should have been deleted to prevent orphans
    expect(mockNodeDeleteOne).toHaveBeenCalledTimes(1);
    expect(mockNodeDeleteOne).toHaveBeenCalledWith({ _id: expect.anything() });
  });
});
