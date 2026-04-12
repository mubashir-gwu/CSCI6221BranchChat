import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WebSearchToggle from "@/components/chat/WebSearchToggle";

describe("WebSearchToggle", () => {
  it("renders Globe icon button", () => {
    render(<WebSearchToggle enabled={false} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: /web search/i })).toBeDefined();
  });

  it("calls onToggle on click", () => {
    const onToggle = vi.fn();
    render(<WebSearchToggle enabled={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("active state styling when enabled", () => {
    render(<WebSearchToggle enabled={true} onToggle={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary/10");
    expect(button.className).toContain("text-primary");
  });

  it("no active styling when disabled", () => {
    render(<WebSearchToggle enabled={false} onToggle={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.className).not.toContain("bg-primary/10");
  });
});
