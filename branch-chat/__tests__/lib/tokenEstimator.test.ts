import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateTokensForMessage,
} from "@/lib/tokenEstimator";

describe("estimateTokensForMessage", () => {
  it("estimates tokens for a short message", () => {
    // "Hello" = 5 chars → ceil(5/4) + 4 = 2 + 4 = 6
    expect(
      estimateTokensForMessage({ role: "user", content: "Hello" })
    ).toBe(6);
  });

  it("estimates tokens for an empty message", () => {
    // "" = 0 chars → ceil(0/4) + 4 = 0 + 4 = 4
    expect(
      estimateTokensForMessage({ role: "user", content: "" })
    ).toBe(4);
  });

  it("estimates tokens for a longer message", () => {
    // 100 chars → ceil(100/4) + 4 = 25 + 4 = 29
    const content = "a".repeat(100);
    expect(
      estimateTokensForMessage({ role: "user", content })
    ).toBe(29);
  });
});

describe("estimateTokens", () => {
  it("returns 0 for empty messages array", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("estimates tokens for a single message", () => {
    // "Hello" → 6
    expect(
      estimateTokens([{ role: "user", content: "Hello" }])
    ).toBe(6);
  });

  it("sums tokens across multiple messages", () => {
    // "Hello" → 6, "World!" → ceil(6/4)+4 = 2+4 = 6
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "World!" },
    ];
    expect(estimateTokens(messages)).toBe(12);
  });

  it("handles messages with varying lengths", () => {
    const messages = [
      { role: "system", content: "" }, // 0 + 4 = 4
      { role: "user", content: "Hi" }, // ceil(2/4)+4 = 1+4 = 5
      { role: "assistant", content: "a".repeat(17) }, // ceil(17/4)+4 = 5+4 = 9
    ];
    expect(estimateTokens(messages)).toBe(18);
  });
});
