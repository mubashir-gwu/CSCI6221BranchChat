import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThinkingBlock from "@/components/chat/ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders collapsed by default", () => {
    render(<ThinkingBlock content="Some thinking content" />);
    expect(screen.getByText("Thinking...")).toBeDefined();
    // Content is rendered but hidden via CSS (max-h-0 opacity-0)
    const contentEl = screen.getByText("Some thinking content");
    expect(contentEl.parentElement?.className).toContain("max-h-0");
  });

  it("clicking header expands to show content", () => {
    render(<ThinkingBlock content="Some thinking content" />);
    fireEvent.click(screen.getByText("Thinking..."));
    const contentEl = screen.getByText("Some thinking content");
    expect(contentEl.parentElement?.className).toContain("max-h-[500px]");
  });

  it("clicking again collapses", () => {
    render(<ThinkingBlock content="Some thinking content" />);
    const button = screen.getByText("Thinking...");
    // Expand
    fireEvent.click(button);
    // Collapse
    fireEvent.click(button);
    const contentEl = screen.getByText("Some thinking content");
    expect(contentEl.parentElement?.className).toContain("max-h-0");
  });

  it("isStreaming shows pulsing indicator", () => {
    render(<ThinkingBlock content="Streaming thoughts" isStreaming />);
    const label = screen.getByText("Thinking...");
    expect(label.className).toContain("animate-pulse");
  });

  it("does not show pulsing when not streaming", () => {
    render(<ThinkingBlock content="Done thinking" />);
    const label = screen.getByText("Thinking...");
    expect(label.className).not.toContain("animate-pulse");
  });

  it("renders nothing when content is empty", () => {
    const { container } = render(<ThinkingBlock content="" />);
    expect(container.innerHTML).toBe("");
  });
});
