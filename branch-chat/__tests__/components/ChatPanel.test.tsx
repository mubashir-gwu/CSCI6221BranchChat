import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TreeNode, ChildrenMap } from "@/types/tree";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock ScrollArea to just render children
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

// Mock react-markdown to render plain text
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <p>{children}</p>,
}));

// Mock remark-gfm
vi.mock("remark-gfm", () => ({ default: () => {} }));

// Mock react-syntax-highlighter
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

import ChatPanel from "@/components/chat/ChatPanel";

function makeNode(
  id: string,
  parentId: string | null,
  role: "user" | "assistant" = "user",
  content?: string
): TreeNode {
  return {
    id,
    parentId,
    role,
    content: content ?? `Message ${id}`,
    provider: role === "assistant" ? "openai" : null,
    model: role === "assistant" ? "gpt-4" : null,
    createdAt: new Date().toISOString(),
  };
}

describe("ChatPanel", () => {
  it("renders empty state when no messages", () => {
    render(
      <ChatPanel
        activePath={[]}
        childrenMap={new Map()}
        nodesMap={new Map()}
        onBranchNavigate={vi.fn()}
        isLoading={false}
      />
    );
    expect(screen.getByText("Send a message to start the conversation.")).toBeDefined();
  });

  it("renders messages from activePath", () => {
    const nodeA = makeNode("a", null, "user", "Hello world");
    const nodeB = makeNode("b", "a", "assistant", "Hi there");
    const nodesMap = new Map<string, TreeNode>([
      ["a", nodeA],
      ["b", nodeB],
    ]);
    const childrenMap: ChildrenMap = new Map([
      ["a", ["b"]],
      ["b", []],
    ]);

    render(
      <ChatPanel
        activePath={[nodeA, nodeB]}
        childrenMap={childrenMap}
        nodesMap={nodesMap}
        onBranchNavigate={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText("Hello world")).toBeDefined();
    expect(screen.getByText("Hi there")).toBeDefined();
  });

  it("shows branch indicator on nodes with multiple children", () => {
    const root = makeNode("root", null, "user", "Root message");
    const nodesMap = new Map<string, TreeNode>([
      ["root", root],
      ["c1", makeNode("c1", "root", "assistant", "Child 1")],
      ["c2", makeNode("c2", "root", "assistant", "Child 2")],
    ]);
    const childrenMap: ChildrenMap = new Map([
      ["root", ["c1", "c2"]],
      ["c1", []],
      ["c2", []],
    ]);

    render(
      <ChatPanel
        activePath={[root, nodesMap.get("c1")!]}
        childrenMap={childrenMap}
        nodesMap={nodesMap}
        onBranchNavigate={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText("2 branches")).toBeDefined();
  });

  it("does not show branch indicator on nodes with single child", () => {
    const root = makeNode("root", null, "user", "Root message");
    const child = makeNode("c1", "root", "assistant", "Only child");
    const nodesMap = new Map<string, TreeNode>([
      ["root", root],
      ["c1", child],
    ]);
    const childrenMap: ChildrenMap = new Map([
      ["root", ["c1"]],
      ["c1", []],
    ]);

    render(
      <ChatPanel
        activePath={[root, child]}
        childrenMap={childrenMap}
        nodesMap={nodesMap}
        onBranchNavigate={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.queryByText(/branches/)).toBeNull();
  });

  it("renders scroll area when isLoading is true even with empty path", () => {
    render(
      <ChatPanel
        activePath={[]}
        childrenMap={new Map()}
        nodesMap={new Map()}
        onBranchNavigate={vi.fn()}
        isLoading={true}
      />
    );

    // When isLoading is true, ChatPanel renders the scroll area (not the empty state)
    expect(screen.getByTestId("scroll-area")).toBeDefined();
    // Should NOT show the empty state text
    expect(screen.queryByText("Send a message to start the conversation.")).toBeNull();
  });
});
