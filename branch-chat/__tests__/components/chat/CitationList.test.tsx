import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CitationList from "@/components/chat/CitationList";

describe("CitationList", () => {
  it("renders numbered citations with correct links", () => {
    const citations = [
      { url: "https://example.com", title: "Example" },
      { url: "https://docs.test", title: "Docs" },
    ];
    render(<CitationList citations={citations} />);

    expect(screen.getByText("[1] Example")).toBeDefined();
    expect(screen.getByText("[2] Docs")).toBeDefined();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("https://example.com");
    expect(links[1].getAttribute("href")).toBe("https://docs.test");
  });

  it("links open in new tab", () => {
    const citations = [{ url: "https://example.com", title: "Example" }];
    render(<CitationList citations={citations} />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("renders nothing for empty array", () => {
    const { container } = render(<CitationList citations={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when citations is undefined-like", () => {
    const { container } = render(<CitationList citations={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
