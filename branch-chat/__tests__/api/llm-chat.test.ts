import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectSSEEvents } from "../helpers/sseHelper";
import type { StreamChunk } from "@/lib/providers/types";

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
const mockStreamMessage = vi.fn();
vi.mock("@/lib/providers", () => ({
  getProvider: () => ({
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    streamMessage: (...args: unknown[]) => mockStreamMessage(...args),
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
  title: "Existing Title",
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

async function* successStreamGenerator(): AsyncGenerator<StreamChunk> {
  yield { type: 'token', content: "I'm " };
  yield { type: 'token', content: "doing well!" };
  yield { type: 'done', content: "I'm doing well!", thinkingContent: null, inputTokens: 10, outputTokens: 20, webSearchRequestCount: 0, citations: [] };
}

async function* errorBeforeContentGenerator(): AsyncGenerator<StreamChunk> {
  yield { type: 'error', message: 'Provider error' };
}

async function* errorAfterContentGenerator(): AsyncGenerator<StreamChunk> {
  yield { type: 'token', content: 'Partial ' };
  yield { type: 'error', message: 'Mid-stream error' };
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
  mockStreamMessage.mockImplementation(() => successStreamGenerator());
  mockSendMessage.mockResolvedValue({
    content: "Greeting Exchange",
    model: "gpt-4o",
    provider: "openai",
    inputTokens: 5,
    outputTokens: 3,
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
  // Pre-stream validation tests (return JSON, not SSE)
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

  // Streaming success tests
  it("should return SSE stream with token and done events on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await collectSSEEvents(res);
    const tokenEvents = events.filter((e) => e.event === "token");
    const doneEvents = events.filter((e) => e.event === "done");

    expect(tokenEvents.length).toBe(2);
    expect(tokenEvents[0].data.content).toBe("I'm ");
    expect(tokenEvents[1].data.content).toBe("doing well!");

    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0].data.userNode).toBeDefined();
    expect(doneEvents[0].data.assistantNode).toBeDefined();
    expect(doneEvents[0].data.userNode.role).toBe("user");
    expect(doneEvents[0].data.assistantNode.role).toBe("assistant");
    expect(doneEvents[0].data.assistantNode.provider).toBe("openai");
    expect(doneEvents[0].data.assistantNode.model).toBe("gpt-4o");
    expect(doneEvents[0].data.tokenUsage).toBeDefined();
    expect(doneEvents[0].data.tokenUsage.inputTokens).toBe(10);
    expect(doneEvents[0].data.tokenUsage.outputTokens).toBe(20);
  });

  it("should record token usage with per-model key after successful stream", async () => {
    const res = await POST(makeRequest(validBody));
    await collectSSEEvents(res); // consume the stream

    expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", model: "gpt-4o" },
      {
        $inc: {
          inputTokens: 10,
          outputTokens: 20,
          callCount: 1,
          webSearchRequests: 0,
        },
        $set: { provider: "openai" },
      },
      { upsert: true }
    );
  });

  it("should still complete stream even if token tracking fails", async () => {
    mockTokenUsageFindOneAndUpdate.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest(validBody));
    const events = await collectSSEEvents(res);
    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);
  });

  it("should set rootNodeId when parentNodeId is null (first message)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, parentNodeId: null })
    );
    await collectSSEEvents(res);

    expect(mockConversationFindByIdAndUpdate).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ rootNodeId: expect.anything() })
    );
  });

  it("should NOT set rootNodeId when parentNodeId is provided", async () => {
    const res = await POST(makeRequest(validBody));
    await collectSSEEvents(res);

    // findByIdAndUpdate should not be called for rootNodeId
    const rootCalls = mockConversationFindByIdAndUpdate.mock.calls.filter(
      (call: unknown[]) => {
        const update = call[1] as Record<string, unknown>;
        return update.rootNodeId !== undefined;
      }
    );
    expect(rootCalls.length).toBe(0);
  });

  it("should include ancestor path context via buildContext", async () => {
    const res = await POST(makeRequest(validBody));
    await collectSSEEvents(res);

    expect(mockBuildContext).toHaveBeenCalledWith(
      "node-1",
      "Hello, how are you?",
      expect.any(Map),
      128000, // gpt-4o context window
      undefined, // no attachments
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
    const events = await collectSSEEvents(res);
    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);

    process.env.NODE_ENV = originalEnv;
  });

  // Error handling tests
  it("should send error event with partial:false when error before content", async () => {
    mockStreamMessage.mockImplementation(() => errorBeforeContentGenerator());

    const res = await POST(makeRequest(validBody));
    const events = await collectSSEEvents(res);
    const errorEvents = events.filter((e) => e.event === "error");

    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.partial).toBe(false);
    expect(errorEvents[0].data.message).toBe("Provider error");
  });

  it("should not save any nodes on pre-content error", async () => {
    mockStreamMessage.mockImplementation(() => errorBeforeContentGenerator());

    const res = await POST(makeRequest(validBody));
    await collectSSEEvents(res);

    expect(mockNodeCreate).not.toHaveBeenCalled();
    expect(mockNodeDeleteOne).not.toHaveBeenCalled();
  });

  it("should send error event with partial:true when error after content", async () => {
    mockStreamMessage.mockImplementation(() => errorAfterContentGenerator());

    const res = await POST(makeRequest(validBody));
    const events = await collectSSEEvents(res);
    const errorEvents = events.filter((e) => e.event === "error");

    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.partial).toBe(true);
    expect(errorEvents[0].data.message).toBe("Mid-stream error");
  });

  it("should not save any nodes on post-content error", async () => {
    mockStreamMessage.mockImplementation(() => errorAfterContentGenerator());

    const res = await POST(makeRequest(validBody));
    await collectSSEEvents(res);

    // No nodes saved — DB writes only happen on successful completion
    expect(mockNodeCreate).not.toHaveBeenCalled();
    expect(mockNodeDeleteOne).not.toHaveBeenCalled();
  });

  it("should handle thrown errors during streaming", async () => {
    mockStreamMessage.mockImplementation(async function* () {
      throw new Error("Unexpected crash");
    });

    const res = await POST(makeRequest(validBody));
    const events = await collectSSEEvents(res);
    const errorEvents = events.filter((e) => e.event === "error");

    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].data.partial).toBe(false);
  });

  // Auto-title tests
  describe("auto-title generation", () => {
    it("should fire auto-title using sendMessage (non-streaming) when title is 'New Conversation'", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      await collectSSEEvents(res);

      // Wait for fire-and-forget title generation
      await new Promise((r) => setTimeout(r, 50));

      // sendMessage should be called for title generation (not streamMessage)
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger title generation when title is not 'New Conversation'", async () => {
      const res = await POST(makeRequest(validBody));
      await collectSSEEvents(res);

      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should not affect the stream if title generation fails", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });
      mockSendMessage.mockRejectedValue(new Error("Title generation failed"));

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      const events = await collectSSEEvents(res);
      const doneEvents = events.filter((e) => e.event === "done");

      expect(doneEvents.length).toBe(1);
      expect(doneEvents[0].data.userNode).toBeDefined();
      expect(doneEvents[0].data.assistantNode).toBeDefined();
    });

    it("should track token usage for the title generation call", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null }));
      await collectSSEEvents(res);

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      // Token usage tracked for both stream and title
      expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1", model: "gpt-4o" },
        {
          $inc: {
            inputTokens: 5,
            outputTokens: 3,
            callCount: 1,
          },
          $set: { provider: "openai" },
        },
        { upsert: true }
      );
    });
  });

  // ─── THINKING AND WEB SEARCH TESTS ──────────────────────────────────────────

  describe("thinking stream events", () => {
    it("should emit thinking SSE events when provider yields thinking chunks", async () => {
      async function* thinkingStreamGenerator(): AsyncGenerator<StreamChunk> {
        yield { type: 'thinking', content: 'Let me think...' };
        yield { type: 'token', content: "Here's my answer" };
        yield { type: 'done', content: "Here's my answer", thinkingContent: 'Let me think...', inputTokens: 10, outputTokens: 20, webSearchRequestCount: 0, citations: [] };
      }
      mockStreamMessage.mockImplementation(() => thinkingStreamGenerator());

      const res = await POST(makeRequest(validBody));
      const events = await collectSSEEvents(res);
      const thinkingEvents = events.filter((e) => e.event === "thinking");
      expect(thinkingEvents.length).toBe(1);
      expect(thinkingEvents[0].data.content).toBe("Let me think...");
    });
  });

  describe("web search citations", () => {
    it("should include citations in done event when provider returns them", async () => {
      const mockCitations = [
        { url: 'https://example.com', title: 'Example' },
      ];
      async function* webSearchStreamGenerator(): AsyncGenerator<StreamChunk> {
        yield { type: 'token', content: "Answer with citations" };
        yield { type: 'done', content: "Answer with citations", thinkingContent: null, inputTokens: 10, outputTokens: 20, webSearchRequestCount: 1, citations: mockCitations };
      }
      mockStreamMessage.mockImplementation(() => webSearchStreamGenerator());

      // Make the node create return citations
      let createCallCount = 0;
      mockNodeCreate.mockImplementation((data: Record<string, unknown>) => {
        createCallCount++;
        return makeMockNode({
          id: `node-ws-${createCallCount}`,
          parentId: data.parentId,
          role: data.role,
          content: data.content,
          provider: data.provider,
          model: data.model,
          citations: data.citations,
        });
      });

      const res = await POST(makeRequest({ ...validBody, webSearchEnabled: true }));
      const events = await collectSSEEvents(res);
      const doneEvents = events.filter((e) => e.event === "done");
      expect(doneEvents.length).toBe(1);
      expect(doneEvents[0].data.assistantNode.citations).toEqual(mockCitations);
    });

    it("should increment webSearchRequests in TokenUsage", async () => {
      async function* webSearchStreamGenerator(): AsyncGenerator<StreamChunk> {
        yield { type: 'done', content: "Answer", thinkingContent: null, inputTokens: 10, outputTokens: 20, webSearchRequestCount: 2, citations: [] };
      }
      mockStreamMessage.mockImplementation(() => webSearchStreamGenerator());

      const res = await POST(makeRequest({ ...validBody, webSearchEnabled: true }));
      await collectSSEEvents(res);

      expect(mockTokenUsageFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1", model: "gpt-4o" },
        {
          $inc: {
            inputTokens: 10,
            outputTokens: 20,
            callCount: 1,
            webSearchRequests: 2,
          },
          $set: { provider: "openai" },
        },
        { upsert: true }
      );
    });

    it("should disable web search for auto-title generation", async () => {
      mockConversationFindById.mockResolvedValue({
        ...mockConversation,
        title: "New Conversation",
      });

      const res = await POST(makeRequest({ ...validBody, parentNodeId: null, webSearchEnabled: true }));
      await collectSSEEvents(res);

      await new Promise((r) => setTimeout(r, 50));

      // sendMessage called for title with web search disabled
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const titleOptions = mockSendMessage.mock.calls[0][2];
      expect(titleOptions.webSearchEnabled).toBe(false);
      expect(titleOptions.thinkingEnabled).toBe(false);
    });
  });

  it("should have dynamic export set to force-dynamic", async () => {
    const routeModule = await import("@/app/api/llm/chat/route");
    expect((routeModule as any).dynamic).toBe("force-dynamic");
  });

  // ─── FILE ATTACHMENT TESTS ──────────────────────────────────────────────────

  describe("file attachment validation", () => {
    const validAttachment = {
      filename: "test.png",
      mimeType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUg==",
      size: 1024,
    };

    it("should save attachments on user node when valid", async () => {
      const body = {
        ...validBody,
        attachments: [validAttachment],
      };

      const res = await POST(makeRequest(body));
      const events = await collectSSEEvents(res);
      const doneEvents = events.filter((e) => e.event === "done");
      expect(doneEvents.length).toBe(1);

      // Node.create should have been called with attachments for the user node
      const userNodeCall = mockNodeCreate.mock.calls[0][0];
      expect(userNodeCall.attachments).toBeDefined();
      expect(userNodeCall.attachments).toHaveLength(1);
      expect(userNodeCall.attachments[0].filename).toBe("test.png");
    });

    it("should return 400 when file count exceeds 5", async () => {
      const attachments = Array.from({ length: 6 }, (_, i) => ({
        ...validAttachment,
        filename: `file-${i}.png`,
      }));

      const res = await POST(makeRequest({ ...validBody, attachments }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("5 files");
    });

    it("should return 400 when a single file exceeds 5MB", async () => {
      const attachments = [{
        ...validAttachment,
        size: 6 * 1024 * 1024,
      }];

      const res = await POST(makeRequest({ ...validBody, attachments }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("5MB");
    });

    it("should return 400 when total size exceeds 10MB", async () => {
      const attachments = Array.from({ length: 3 }, (_, i) => ({
        ...validAttachment,
        filename: `file-${i}.png`,
        size: 4 * 1024 * 1024, // 4MB each = 12MB total
      }));

      const res = await POST(makeRequest({ ...validBody, attachments }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("10MB");
    });

    it("should return 400 for invalid MIME type", async () => {
      const attachments = [{
        ...validAttachment,
        mimeType: "application/exe",
      }];

      const res = await POST(makeRequest({ ...validBody, attachments }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("not allowed");
    });

    it("should return 413 when body exceeds 20MB", async () => {
      const req = new Request("http://localhost:3000/api/llm/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(25 * 1024 * 1024),
        },
        body: JSON.stringify(validBody),
      });

      const res = await POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toContain("too large");
    });
  });
});
