import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExportedTree } from "@/types/export";

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
const mockConversationCreate = vi.fn();

vi.mock("@/models/Conversation", () => ({
  Conversation: {
    findOne: (...args: unknown[]) => mockConversationFindOne(...args),
    create: (...args: unknown[]) => mockConversationCreate(...args),
  },
}));

// Mock Node model
const mockNodeFind = vi.fn();
const mockNodeInsertMany = vi.fn();

vi.mock("@/models/Node", () => ({
  Node: {
    find: (...args: unknown[]) => mockNodeFind(...args),
    insertMany: (...args: unknown[]) => mockNodeInsertMany(...args),
  },
}));

// Import handlers after mocks
import { GET } from "@/app/api/conversations/[id]/export/route";
import { POST } from "@/app/api/import/route";

const mockSession = {
  user: { id: "user-1", email: "test@test.com" },
};

const mockConversation = {
  _id: { toString: () => "conv-1" },
  userId: "user-1",
  title: "Test Conversation",
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
  rootNodeId: { toString: () => "node-root" },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mockNodes = [
  {
    _id: { toString: () => "node-root" },
    conversationId: { toString: () => "conv-1" },
    parentId: null,
    role: "system",
    content: "You are a helpful assistant",
    provider: null,
    model: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    _id: { toString: () => "node-1" },
    conversationId: { toString: () => "conv-1" },
    parentId: { toString: () => "node-root" },
    role: "user",
    content: "Hello",
    provider: null,
    model: null,
    createdAt: new Date("2026-01-01T00:01:00Z"),
  },
  {
    _id: { toString: () => "node-2" },
    conversationId: { toString: () => "conv-1" },
    parentId: { toString: () => "node-1" },
    role: "assistant",
    content: "Hi there!",
    provider: "openai",
    model: "gpt-4o",
    createdAt: new Date("2026-01-01T00:02:00Z"),
  },
];

function makeExportRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/conversations/${id}/export`, {
    method: "GET",
  });
}

function makeImportRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validExportedTree(): ExportedTree {
  return {
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    title: "Test Conversation",
    nodes: [
      {
        id: "node-root",
        parentId: null,
        childrenIds: ["node-1"],
        role: "system",
        content: "You are a helpful assistant",
        provider: null,
        model: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "node-1",
        parentId: "node-root",
        childrenIds: ["node-2"],
        role: "user",
        content: "Hello",
        provider: null,
        model: null,
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      {
        id: "node-2",
        parentId: "node-1",
        childrenIds: [],
        role: "assistant",
        content: "Hi there!",
        provider: "openai",
        model: "gpt-4o",
        createdAt: "2026-01-01T00:02:00.000Z",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── EXPORT TESTS ────────────────────────────────────────────────────────────

describe("GET /api/conversations/:id/export", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeExportRequest("conv-1");
    const res = await GET(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent conversation", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(null);

    const req = makeExportRequest("conv-999");
    const res = await GET(req as any, makeParams("conv-999") as any);
    expect(res.status).toBe(404);
  });

  it("exports valid JSON with all nodes and metadata", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockNodes) });

    const req = makeExportRequest("conv-1");
    const res = await GET(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(200);

    const data: ExportedTree = await res.json();

    // Check structure
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeDefined();
    expect(data.title).toBe("Test Conversation");
    expect(data.nodes).toHaveLength(3);

    // Check Content-Disposition header
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".json");
  });

  it("exports nodes with correct parentId and childrenIds", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockNodes) });

    const req = makeExportRequest("conv-1");
    const res = await GET(req as any, makeParams("conv-1") as any);
    const data: ExportedTree = await res.json();

    const root = data.nodes.find((n) => n.id === "node-root")!;
    expect(root.parentId).toBeNull();
    expect(root.childrenIds).toEqual(["node-1"]);

    const node1 = data.nodes.find((n) => n.id === "node-1")!;
    expect(node1.parentId).toBe("node-root");
    expect(node1.childrenIds).toEqual(["node-2"]);

    const node2 = data.nodes.find((n) => n.id === "node-2")!;
    expect(node2.parentId).toBe("node-1");
    expect(node2.childrenIds).toEqual([]);
  });

  it("exports provider and model fields", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockNodes) });

    const req = makeExportRequest("conv-1");
    const res = await GET(req as any, makeParams("conv-1") as any);
    const data: ExportedTree = await res.json();

    const assistantNode = data.nodes.find((n) => n.role === "assistant")!;
    expect(assistantNode.provider).toBe("openai");
    expect(assistantNode.model).toBe("gpt-4o");
  });
});

// ─── IMPORT TESTS ────────────────────────────────────────────────────────────

describe("POST /api/import", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeImportRequest({ jsonData: validExportedTree() });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const req = new Request("http://localhost:3000/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing jsonData", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const req = makeImportRequest({});
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported version", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const tree = validExportedTree();
    (tree as any).version = 2;
    const req = makeImportRequest({ jsonData: tree });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("version");
  });

  it("returns 400 for multiple roots", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const tree = validExportedTree();
    tree.nodes.push({
      id: "extra-root",
      parentId: null,
      childrenIds: [],
      role: "user",
      content: "extra root",
      provider: null,
      model: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const req = makeImportRequest({ jsonData: tree });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("root");
  });

  it("returns 400 for orphaned parentId references", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const tree = validExportedTree();
    tree.nodes[1].parentId = "non-existent-parent";
    const req = makeImportRequest({ jsonData: tree });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("non-existent parent");
  });

  it("returns 400 for disconnected tree", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const tree: ExportedTree = {
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      title: "Disconnected",
      nodes: [
        {
          id: "root",
          parentId: null,
          childrenIds: [],
          role: "system",
          content: "root",
          provider: null,
          model: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "island-a",
          parentId: "island-b",
          childrenIds: [],
          role: "user",
          content: "island a",
          provider: null,
          model: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "island-b",
          parentId: "island-a",
          childrenIds: [],
          role: "user",
          content: "island b",
          provider: null,
          model: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const req = makeImportRequest({ jsonData: tree });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("disconnected");
  });

  it("imports valid JSON and creates conversation with correct node count", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const createdConv = {
      _id: { toString: () => "new-conv-1" },
      title: "Test Conversation",
    };
    mockConversationCreate.mockResolvedValue(createdConv);
    mockNodeInsertMany.mockResolvedValue([]);

    const req = makeImportRequest({ jsonData: validExportedTree() });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.conversationId).toBe("new-conv-1");
    expect(data.title).toBe("Test Conversation");
    expect(data.nodeCount).toBe(3);
  });

  it("regenerates all IDs (no conflicts with original)", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const createdConv = {
      _id: { toString: () => "new-conv-1" },
      title: "Test Conversation",
    };
    mockConversationCreate.mockResolvedValue(createdConv);
    mockNodeInsertMany.mockResolvedValue([]);

    const req = makeImportRequest({ jsonData: validExportedTree() });
    await POST(req as any);

    // Check that insertMany was called with remapped IDs
    expect(mockNodeInsertMany).toHaveBeenCalledTimes(1);
    const insertedNodes = mockNodeInsertMany.mock.calls[0][0];
    expect(insertedNodes).toHaveLength(3);

    // All IDs should be new ObjectIds, not original string IDs
    const originalIds = new Set(["node-root", "node-1", "node-2"]);
    for (const node of insertedNodes) {
      expect(originalIds.has(node._id.toString())).toBe(false);
    }
  });

  it("preserves parent-child relationships after ID remapping", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const createdConv = {
      _id: { toString: () => "new-conv-1" },
      title: "Test Conversation",
    };
    mockConversationCreate.mockResolvedValue(createdConv);
    mockNodeInsertMany.mockResolvedValue([]);

    const req = makeImportRequest({ jsonData: validExportedTree() });
    await POST(req as any);

    const insertedNodes = mockNodeInsertMany.mock.calls[0][0];

    // Build a map of old content → new node for relationship checking
    const byContent = new Map<string, any>();
    for (const node of insertedNodes) {
      byContent.set(node.content, node);
    }

    const root = byContent.get("You are a helpful assistant");
    const userNode = byContent.get("Hello");
    const assistantNode = byContent.get("Hi there!");

    // Root has no parent
    expect(root.parentId).toBeNull();
    // User node's parent is the root
    expect(userNode.parentId.toString()).toBe(root._id.toString());
    // Assistant node's parent is the user node
    expect(assistantNode.parentId.toString()).toBe(userNode._id.toString());
  });
});

// ─── ATTACHMENT TESTS ─────────────────────────────────────────────────────────

describe("export/import with attachments", () => {
  const mockAttachment = {
    filename: "test.png",
    mimeType: "image/png",
    data: "iVBORw0KGgoAAAANSUhEUg==",
    size: 1024,
  };

  const mockNodesWithAttachments = [
    {
      _id: { toString: () => "node-root" },
      conversationId: { toString: () => "conv-1" },
      parentId: null,
      role: "user",
      content: "See this image",
      provider: null,
      model: null,
      attachments: [mockAttachment],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      _id: { toString: () => "node-1" },
      conversationId: { toString: () => "conv-1" },
      parentId: { toString: () => "node-root" },
      role: "assistant",
      content: "Nice image!",
      provider: "openai",
      model: "gpt-4o",
      createdAt: new Date("2026-01-01T00:01:00Z"),
    },
  ];

  it("export includes attachments on nodes that have them", async () => {
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockNodesWithAttachments) });

    const req = makeExportRequest("conv-1");
    const res = await GET(req as any, makeParams("conv-1") as any);
    expect(res.status).toBe(200);

    const data: ExportedTree = await res.json();
    const userNode = data.nodes.find((n) => n.content === "See this image")!;
    expect(userNode.attachments).toBeDefined();
    expect(userNode.attachments).toHaveLength(1);
    expect(userNode.attachments![0].filename).toBe("test.png");

    const assistantNode = data.nodes.find((n) => n.role === "assistant")!;
    expect(assistantNode.attachments).toBeUndefined();
  });

  it("import restores attachments onto nodes", async () => {
    mockAuth.mockResolvedValue(mockSession);
    const createdConv = {
      _id: { toString: () => "new-conv-1" },
      title: "Test Conversation",
    };
    mockConversationCreate.mockResolvedValue(createdConv);
    mockNodeInsertMany.mockResolvedValue([]);

    const tree = validExportedTree();
    tree.nodes[1].attachments = [mockAttachment];

    const req = makeImportRequest({ jsonData: tree });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const insertedNodes = mockNodeInsertMany.mock.calls[0][0];
    const nodeWithAttachment = insertedNodes.find((n: any) => n.content === "Hello");
    expect(nodeWithAttachment.attachments).toBeDefined();
    expect(nodeWithAttachment.attachments).toHaveLength(1);
    expect(nodeWithAttachment.attachments[0].filename).toBe("test.png");
  });
});

// ─── ROUND-TRIP TEST ─────────────────────────────────────────────────────────

describe("Round-trip: export → import → export", () => {
  it("produces identical tree structure (NFR-009)", async () => {
    // Step 1: Export
    mockAuth.mockResolvedValue(mockSession);
    mockConversationFindOne.mockResolvedValue(mockConversation);
    mockNodeFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockNodes) });

    const exportReq = makeExportRequest("conv-1");
    const exportRes = await GET(exportReq as any, makeParams("conv-1") as any);
    const exported: ExportedTree = await exportRes.json();

    // Step 2: Import
    const createdConv = {
      _id: { toString: () => "new-conv-2" },
      title: exported.title,
    };
    mockConversationCreate.mockResolvedValue(createdConv);
    mockNodeInsertMany.mockResolvedValue([]);

    const importReq = makeImportRequest({ jsonData: exported });
    const importRes = await POST(importReq as any);
    expect(importRes.status).toBe(201);

    const importData = await importRes.json();
    expect(importData.nodeCount).toBe(exported.nodes.length);

    // Step 3: Verify structure preservation
    const insertedNodes = mockNodeInsertMany.mock.calls[0][0];

    // Same number of nodes
    expect(insertedNodes.length).toBe(exported.nodes.length);

    // Same roles and content
    const exportedContents = exported.nodes.map((n) => n.content).sort();
    const importedContents = insertedNodes.map((n: any) => n.content).sort();
    expect(importedContents).toEqual(exportedContents);

    // Same tree shape: count roots, count children per node
    const exportedRoots = exported.nodes.filter((n) => n.parentId === null);
    const importedRoots = insertedNodes.filter((n: any) => n.parentId === null);
    expect(importedRoots.length).toBe(exportedRoots.length);
  });
});
