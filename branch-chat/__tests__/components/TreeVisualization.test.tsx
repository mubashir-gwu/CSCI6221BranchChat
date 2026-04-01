import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TreeNode, ChildrenMap } from "@/types/tree";

// Mock @xyflow/react to avoid canvas/DOM measurement issues in jsdom
vi.mock("@xyflow/react", () => {
  return {
    ReactFlow: ({
      nodes,
      onNodeClick,
    }: {
      nodes: { id: string; data: Record<string, unknown> }[];
      edges: unknown[];
      onNodeClick: (event: unknown, node: { id: string }) => void;
      [key: string]: unknown;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => (
          <div
            key={node.id}
            data-testid={`rf-node-${node.id}`}
            data-active={String(node.data.isActive)}
            data-role={String(node.data.role)}
            onClick={() => onNodeClick(null, { id: node.id })}
          >
            {String(node.data.label)}
          </div>
        ))}
      </div>
    ),
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom" },
  };
});

import TreeVisualization from "@/components/tree/TreeVisualization";

function makeNode(
  id: string,
  parentId: string | null,
  role: "user" | "assistant" = "user",
  content?: string,
  provider?: string | null
): TreeNode {
  return {
    id,
    parentId,
    role,
    content: content ?? `Message ${id}`,
    provider: provider ?? (role === "assistant" ? "openai" : null),
    model: role === "assistant" ? "gpt-4o" : null,
    createdAt: new Date().toISOString(),
  };
}

describe("TreeVisualization", () => {
  it("renders correct number of nodes", () => {
    const nodes = new Map<string, TreeNode>([
      ["a", makeNode("a", null, "user", "Hello")],
      ["b", makeNode("b", "a", "assistant", "Hi there")],
      ["c", makeNode("c", "b", "user", "Follow up")],
    ]);
    const childrenMap: ChildrenMap = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);

    render(
      <TreeVisualization
        nodes={nodes}
        childrenMap={childrenMap}
        activeNodeId="c"
        onNodeClick={vi.fn()}
      />
    );

    expect(screen.getByTestId("rf-node-a")).toBeDefined();
    expect(screen.getByTestId("rf-node-b")).toBeDefined();
    expect(screen.getByTestId("rf-node-c")).toBeDefined();
  });

  it("marks active node with isActive true", () => {
    const nodes = new Map<string, TreeNode>([
      ["a", makeNode("a", null, "user", "Hello")],
      ["b", makeNode("b", "a", "assistant", "Reply")],
    ]);
    const childrenMap: ChildrenMap = new Map([["a", ["b"]]]);

    render(
      <TreeVisualization
        nodes={nodes}
        childrenMap={childrenMap}
        activeNodeId="b"
        onNodeClick={vi.fn()}
      />
    );

    expect(screen.getByTestId("rf-node-b").dataset.active).toBe("true");
    expect(screen.getByTestId("rf-node-a").dataset.active).toBe("false");
  });

  it("calls onNodeClick with correct nodeId when node is clicked", () => {
    const handleClick = vi.fn();
    const nodes = new Map<string, TreeNode>([
      ["a", makeNode("a", null, "user", "Hello")],
      ["b", makeNode("b", "a", "assistant", "Reply")],
    ]);
    const childrenMap: ChildrenMap = new Map([["a", ["b"]]]);

    render(
      <TreeVisualization
        nodes={nodes}
        childrenMap={childrenMap}
        activeNodeId="a"
        onNodeClick={handleClick}
      />
    );

    fireEvent.click(screen.getByTestId("rf-node-b"));
    expect(handleClick).toHaveBeenCalledWith("b");
  });

  it("renders empty state when no nodes", () => {
    render(
      <TreeVisualization
        nodes={new Map()}
        childrenMap={new Map()}
        activeNodeId={null}
        onNodeClick={vi.fn()}
      />
    );

    expect(screen.getByText("No messages yet")).toBeDefined();
  });
});
