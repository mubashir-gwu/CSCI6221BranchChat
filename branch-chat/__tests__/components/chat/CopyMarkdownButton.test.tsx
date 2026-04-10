import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CopyMarkdownButton from "@/components/chat/CopyMarkdownButton";

describe("CopyMarkdownButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders clipboard icon", () => {
    render(<CopyMarkdownButton content="hello" />);
    expect(
      screen.getByRole("button", { name: /copy markdown/i })
    ).toBeDefined();
  });

  it("calls navigator.clipboard.writeText with content on click", async () => {
    render(<CopyMarkdownButton content="# Hello World" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy markdown/i }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "# Hello World"
    );
  });

  it("changes icon to check mark after click", async () => {
    render(<CopyMarkdownButton content="test" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy markdown/i }));
    });
    expect(screen.getByRole("button", { name: /copied/i })).toBeDefined();
  });

  it("reverts icon after 2 seconds", async () => {
    render(<CopyMarkdownButton content="test" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy markdown/i }));
    });
    expect(screen.getByRole("button", { name: /copied/i })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(
      screen.getByRole("button", { name: /copy markdown/i })
    ).toBeDefined();
  });
});
