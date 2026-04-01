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

// Mock Conversation model
const mockConversationFind = vi.fn();
const mockConversationCreate = vi.fn();
const mockConversationFindOne = vi.fn();
const mockConversationFindOneAndUpdate = vi.fn();
const mockConversationDeleteOne = vi.fn();

vi.mock("@/models/Conversation", () => ({
  Conversation: {
    find: (...args: unknown[]) => mockConversationFind(...args),
    create: (...args: unknown[]) => mockConversationCreate(...args),
    findOne: (...args: unknown[]) => mockConversationFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockConversationFindOneAndUpdate(...args),
    deleteOne: (...args: unknown[]) => mockConversationDeleteOne(...args),
  },
}));

// Mock Node model
const mockNodeDeleteMany = vi.fn();
vi.mock("@/models/Node", () => ({
  Node: {
    deleteMany: (...args: unknown[]) => mockNodeDeleteMany(...args),
  },
}));

// Import handlers after mocks
import { GET, POST } from "@/app/api/conversations/route";
import { PATCH, DELETE } from "@/app/api/conversations/[id]/route";

function makeRequest(body?: object): Request {
  return new Request("http://localhost:3000/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

const mockConversation = {
  _id: { toString: () => "conv-1" },
  userId: "user-1",
  title: "Test Conversation",
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
  rootNodeId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/conversations", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user conversations sorted by updatedAt", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockConversation]),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].id).toBe("conv-1");
    expect(data.conversations[0].title).toBe("Test Conversation");
  });
});

describe("POST /api/conversations", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest({ title: "Test", defaultProvider: "openai", defaultModel: "gpt-4o" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates conversation with valid data", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationCreate.mockResolvedValue(mockConversation);

    const req = makeRequest({
      title: "Test Conversation",
      defaultProvider: "openai",
      defaultModel: "gpt-4o",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.title).toBe("Test Conversation");
  });

  it("rejects invalid provider", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const req = makeRequest({
      title: "Test",
      defaultProvider: "invalid-provider",
      defaultModel: "gpt-4o",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid model for provider", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const req = makeRequest({
      title: "Test",
      defaultProvider: "openai",
      defaultModel: "claude-sonnet-4-20250514",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty title", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const req = makeRequest({
      title: "",
      defaultProvider: "openai",
      defaultModel: "gpt-4o",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects title longer than 200 characters", async () => {
    mockAuth.mockResolvedValue(mockSession);

    const req = makeRequest({
      title: "a".repeat(201),
      defaultProvider: "openai",
      defaultModel: "gpt-4o",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/conversations/:id", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/conversations/conv-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });
    const res = await PATCH(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(401);
  });

  it("renames conversation", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOneAndUpdate.mockResolvedValue({
      ...mockConversation,
      title: "Renamed",
      updatedAt: new Date("2026-01-02"),
    });

    const req = new Request("http://localhost:3000/api/conversations/conv-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed" }),
    });
    const res = await PATCH(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("Renamed");
  });

  it("returns 404 for non-existent or other user's conversation", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOneAndUpdate.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/conversations/other-conv", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed" }),
    });
    const res = await PATCH(req as any, makeParams("other-conv") as any);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/conversations/:id", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/conversations/conv-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(401);
  });

  it("deletes conversation and cascades node deletion", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeDeleteMany.mockResolvedValue({ deletedCount: 5 });
    mockConversationDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const req = new Request("http://localhost:3000/api/conversations/conv-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.deleted).toBe(true);
    expect(mockNodeDeleteMany).toHaveBeenCalledWith({ conversationId: "conv-1" });
    expect(mockConversationDeleteOne).toHaveBeenCalledWith({ _id: "conv-1" });
  });

  it("returns 404 for other user's conversation", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/conversations/other-conv", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("other-conv") as any);
    expect(res.status).toBe(404);
  });
});
