import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TreeNode, ChildrenMap } from "@/types/tree";

// Mock useUI hook for minimap visibility
const mockUseUI = vi.fn().mockReturnValue({
  isMinimapVisible: true,
  toggleMinimap: vi.fn(),
  state: { isMinimapVisible: true },
  dispatch: vi.fn(),
});
vi.mock("@/hooks/useUI", () => ({
  useUI: () => mockUseUI(),
}));

// Mock @xyflow/react to avoid canvas/DOM measurement issues in jsdom
vi.mock("@xyflow/react", () => {
  return {
    ReactFlow: ({
      nodes,
      onNodeClick,
      children,
    }: {
      nodes: { id: string; data: Record<string, unknown> }[];
      edges: unknown[];
      onNodeClick: (event: unknown, node: { id: string }) => void;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => (
          <div
            key={node.id}
            data-testid={`rf-node-${node.id}`}
            data-active={String(node.data.isActive)}
            data-role={String(node.data.role)}
            onClick={() => onNodeClick(null, { id: node.id, data: node.data })}
          >
            {String(node.data.label)}
          </div>
        ))}
        {children}
      </div>
    ),
    Controls: ({ children }: { children?: React.ReactNode }) => <div data-testid="controls">{children}</div>,
    ControlButton: ({ children, onClick, ...props }: { children?: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => <button data-testid="control-button" onClick={onClick} {...props}>{children}</button>,
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

  it("calls onNodeClick when an assistant node is clicked", () => {
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

  it("does NOT call onNodeClick when a user node is clicked", () => {
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
        activeNodeId="b"
        onNodeClick={handleClick}
      />
    );

    fireEvent.click(screen.getByTestId("rf-node-a"));
    expect(handleClick).not.toHaveBeenCalled();
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

  it("renders MiniMap when isMinimapVisible is true", () => {
    mockUseUI.mockReturnValue({
      isMinimapVisible: true,
      toggleMinimap: vi.fn(),
      state: { isMinimapVisible: true },
      dispatch: vi.fn(),
    });

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

    expect(screen.getByTestId("minimap")).toBeDefined();
  });

  it("does NOT render MiniMap when isMinimapVisible is false", () => {
    mockUseUI.mockReturnValue({
      isMinimapVisible: false,
      toggleMinimap: vi.fn(),
      state: { isMinimapVisible: false },
      dispatch: vi.fn(),
    });

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

    expect(screen.queryByTestId("minimap")).toBeNull();
  });
});
