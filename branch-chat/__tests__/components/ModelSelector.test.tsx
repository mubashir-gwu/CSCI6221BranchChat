import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock shadcn dropdown components to render as simple elements
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ render: trigger }: { render: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{trigger}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-group">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Mock shadcn button
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <button {...props}>{children}</button>,
}));

import ModelSelector from "@/components/chat/ModelSelector";

describe("ModelSelector", () => {
  it("renders provider groups with color dots", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai", "anthropic"]}
      />
    );

    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Anthropic")).toBeDefined();
  });

  it("displays current selection in trigger", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai"]}
      />
    );

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger.textContent).toContain("OpenAI");
    expect(trigger.textContent).toContain("GPT-4o");
  });

  it("calls onChange when a model is selected", () => {
    const handleChange = vi.fn();
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={handleChange}
        availableProviders={["openai"]}
      />
    );

    const items = screen.getAllByTestId("dropdown-item");
    // Click GPT-4o Mini (second item)
    fireEvent.click(items[1]);
    expect(handleChange).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("only shows providers that have API keys", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai"]}
      />
    );

    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.queryByText("Anthropic")).toBeNull();
    expect(screen.queryByText("Google Gemini")).toBeNull();
  });
});
