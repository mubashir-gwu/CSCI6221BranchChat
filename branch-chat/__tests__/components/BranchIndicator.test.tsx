import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchIndicator from "@/components/chat/BranchIndicator";

describe("BranchIndicator", () => {
  it("renders badge with correct branch count", () => {
    render(
      <BranchIndicator nodeId="node-1" branchCount={3} onClick={vi.fn()} />
    );
    expect(screen.getByText("3 branches")).toBeDefined();
  });

  it("renders badge with 2 branches", () => {
    render(
      <BranchIndicator nodeId="node-1" branchCount={2} onClick={vi.fn()} />
    );
    expect(screen.getByText("2 branches")).toBeDefined();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <BranchIndicator nodeId="node-1" branchCount={2} onClick={handleClick} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a button element", () => {
    render(
      <BranchIndicator nodeId="node-1" branchCount={4} onClick={vi.fn()} />
    );
    expect(screen.getByRole("button")).toBeDefined();
  });
});
