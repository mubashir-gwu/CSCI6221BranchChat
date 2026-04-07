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
    disabled,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick} disabled={disabled}>
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

  it("shows all providers but marks unavailable ones as disabled", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai"]}
      />
    );

    expect(screen.getByText("OpenAI")).toBeDefined();
    // Unavailable providers are shown but with "(not available)" label
    expect(screen.getAllByText("(not available)").length).toBeGreaterThanOrEqual(2);
  });

  it("disables items for unavailable providers", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai"]}
      />
    );

    const items = screen.getAllByTestId("dropdown-item");
    // OpenAI items should be enabled, others disabled
    const disabledItems = items.filter((item) => (item as HTMLButtonElement).disabled);
    expect(disabledItems.length).toBeGreaterThan(0);
  });

  it("enables items for available providers", () => {
    render(
      <ModelSelector
        value={{ provider: "openai", model: "gpt-4o" }}
        onChange={vi.fn()}
        availableProviders={["openai", "anthropic"]}
      />
    );

    // OpenAI and Anthropic items should be selectable
    const items = screen.getAllByTestId("dropdown-item");
    const enabledItems = items.filter((item) => !(item as HTMLButtonElement).disabled);
    expect(enabledItems.length).toBeGreaterThan(0);
  });
});
