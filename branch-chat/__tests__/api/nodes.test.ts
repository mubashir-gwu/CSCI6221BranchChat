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
const mockConversationFindOne = vi.fn();
vi.mock("@/models/Conversation", () => ({
  Conversation: {
    findOne: (...args: unknown[]) => mockConversationFindOne(...args),
  },
}));

// Mock Node model
const mockNodeFind = vi.fn();
const mockNodeDeleteMany = vi.fn();
vi.mock("@/models/Node", () => ({
  Node: {
    find: (...args: unknown[]) => mockNodeFind(...args),
    deleteMany: (...args: unknown[]) => mockNodeDeleteMany(...args),
  },
}));

import { GET } from "@/app/api/conversations/[id]/nodes/route";
import { DELETE } from "@/app/api/conversations/[id]/nodes/[nodeId]/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

const mockConversation = {
  _id: { toString: () => "conv-1" },
  userId: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/conversations/:id/nodes", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/conversations/conv-1/nodes");
    const res = await GET(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(401);
  });

  it("returns 404 if conversation not owned by user", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/conversations/other/nodes");
    const res = await GET(req as any, makeParams("other") as any);
    expect(res.status).toBe(404);
  });

  it("returns all nodes for a conversation", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);

    const mockNodes = [
      {
        _id: { toString: () => "node-1" },
        parentId: null,
        role: "user",
        content: "Hello",
        provider: null,
        model: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        _id: { toString: () => "node-2" },
        parentId: { toString: () => "node-1" },
        role: "assistant",
        content: "Hi there!",
        provider: "openai",
        model: "gpt-4o",
        createdAt: new Date("2026-01-01"),
      },
    ];

    mockNodeFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockNodes),
    });

    const req = new Request("http://localhost:3000/api/conversations/conv-1/nodes");
    const res = await GET(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[0].id).toBe("node-1");
    expect(data.nodes[0].parentId).toBe(null);
    expect(data.nodes[1].id).toBe("node-2");
    expect(data.nodes[1].parentId).toBe("node-1");
  });
});

describe("DELETE /api/conversations/:id/nodes/:nodeId", () => {
  const makeParams = (id: string, nodeId: string) => ({
    params: Promise.resolve({ id, nodeId }),
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/conversations/conv-1/nodes/node-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("conv-1", "node-1") as any);
    expect(res.status).toBe(401);
  });

  it("returns 404 if conversation not owned by user", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/conversations/other/nodes/node-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("other", "node-1") as any);
    expect(res.status).toBe(404);
  });

  it("deletes node and all descendants", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);

    // Tree: node-1 -> node-2 -> node-3
    //                         -> node-4
    const mockNodes = [
      { _id: { toString: () => "node-1" }, parentId: null },
      { _id: { toString: () => "node-2" }, parentId: { toString: () => "node-1" } },
      { _id: { toString: () => "node-3" }, parentId: { toString: () => "node-2" } },
      { _id: { toString: () => "node-4" }, parentId: { toString: () => "node-2" } },
    ];

    mockNodeFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockNodes),
    });
    mockNodeDeleteMany.mockResolvedValue({ deletedCount: 3 });

    const req = new Request("http://localhost:3000/api/conversations/conv-1/nodes/node-2", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("conv-1", "node-2") as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.deletedCount).toBe(3);
    expect(data.newActiveNodeId).toBe("node-1");

    // Verify it tried to delete node-2, node-3, and node-4
    const deleteCall = mockNodeDeleteMany.mock.calls[0][0];
    expect(deleteCall._id.$in).toContain("node-2");
    expect(deleteCall._id.$in).toContain("node-3");
    expect(deleteCall._id.$in).toContain("node-4");
    expect(deleteCall._id.$in).not.toContain("node-1");
  });

  it("returns 404 if node does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });

    const req = new Request("http://localhost:3000/api/conversations/conv-1/nodes/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, makeParams("conv-1", "nonexistent") as any);
    expect(res.status).toBe(404);
  });
});
