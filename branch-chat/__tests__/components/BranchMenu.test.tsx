import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchMenu from "@/components/chat/BranchMenu";
import type { TreeNode } from "@/types/tree";

function makeChild(
  id: string,
  parentId: string,
  content: string,
  provider = "openai"
): TreeNode {
  return {
    id,
    parentId,
    role: "assistant",
    content,
    provider,
    model: "gpt-4o",
    createdAt: new Date().toISOString(),
  };
}

describe("BranchMenu", () => {
  const parent = "parent-1";
  const children = [
    makeChild("c1", parent, "First branch reply"),
    makeChild("c2", parent, "Second branch reply"),
  ];

  it("renders 'New branch from here' option when onNavigateToNode is provided", () => {
    render(
      <BranchMenu
        parentNodeId={parent}
        children={children}
        activeChildId="c1"
        onSelect={vi.fn()}
        onNavigateToNode={vi.fn()}
      />
    );

    expect(screen.getByText("+ New branch from here")).toBeDefined();
  });

  it("does not render 'New branch from here' when onNavigateToNode is not provided", () => {
    render(
      <BranchMenu
        parentNodeId={parent}
        children={children}
        activeChildId="c1"
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryByText("+ New branch from here")).toBeNull();
  });

  it("calls onNavigateToNode with parentNodeId when 'New branch from here' is clicked", () => {
    const onNavigate = vi.fn();

    render(
      <BranchMenu
        parentNodeId={parent}
        children={children}
        activeChildId="c1"
        onSelect={vi.fn()}
        onNavigateToNode={onNavigate}
      />
    );

    fireEvent.click(screen.getByText("+ New branch from here"));
    expect(onNavigate).toHaveBeenCalledWith(parent);
  });

  it("existing branch options still work", () => {
    const onSelect = vi.fn();

    render(
      <BranchMenu
        parentNodeId={parent}
        children={children}
        activeChildId="c1"
        onSelect={onSelect}
        onNavigateToNode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("First branch reply"));
    expect(onSelect).toHaveBeenCalledWith("c1");

    fireEvent.click(screen.getByText("Second branch reply"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });
});
