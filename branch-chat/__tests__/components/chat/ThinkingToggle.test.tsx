import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThinkingToggle from "@/components/chat/ThinkingToggle";

describe("ThinkingToggle", () => {
  it("renders Brain icon button", () => {
    render(<ThinkingToggle enabled={false} onToggle={() => {}} disabled={false} />);
    expect(screen.getByRole("button", { name: /thinking/i })).toBeDefined();
  });

  it("calls onToggle on click", () => {
    const onToggle = vi.fn();
    render(<ThinkingToggle enabled={false} onToggle={onToggle} disabled={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("disabled state applies opacity and prevents click", () => {
    const onToggle = vi.fn();
    render(<ThinkingToggle enabled={false} onToggle={onToggle} disabled={true} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("opacity-50");
    expect(button.className).toContain("pointer-events-none");
  });

  it("shows tooltip with model name when disabled", () => {
    render(<ThinkingToggle enabled={false} onToggle={() => {}} disabled={true} modelName="GPT-4o" />);
    expect(screen.getByText("Not available for GPT-4o")).toBeDefined();
  });

  it("does not show tooltip when not disabled", () => {
    render(<ThinkingToggle enabled={false} onToggle={() => {}} disabled={false} modelName="GPT-4o" />);
    expect(screen.queryByText("Not available for GPT-4o")).toBeNull();
  });
});
