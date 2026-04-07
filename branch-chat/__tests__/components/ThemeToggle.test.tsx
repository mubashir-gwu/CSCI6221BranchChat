import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeToggle from "@/components/common/ThemeToggle";

const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockTheme = "system";
  });

  it("renders without crashing", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeDefined();
  });

  it("shows three theme options when dropdown is opened", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(await screen.findByText("Light")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
  });

  it("calls setTheme('dark') when Dark option is selected", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    const darkOption = await screen.findByText("Dark");
    fireEvent.click(darkOption);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme('light') when Light option is selected", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    const lightOption = await screen.findByText("Light");
    fireEvent.click(lightOption);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme('system') when System option is selected", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    const systemOption = await screen.findByText("System");
    fireEvent.click(systemOption);
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
