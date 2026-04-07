import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAvailableProviders,
  isProviderAvailable,
  getProviderApiKey,
} from "@/lib/providers/availability";

describe("Provider Availability", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getAvailableProviders", () => {
    it("returns empty array when no env vars are set (non-dev)", () => {
      process.env.NODE_ENV = "production";
      const providers = getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it("returns only providers with env vars set", () => {
      process.env.NODE_ENV = "production";
      process.env.OPENAI_API_KEY = "sk-test";
      const providers = getAvailableProviders();
      expect(providers).toEqual(["openai"]);
    });

    it("returns all providers when all env vars set", () => {
      process.env.NODE_ENV = "production";
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      process.env.GEMINI_API_KEY = "AI-test";
      const providers = getAvailableProviders();
      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
      expect(providers).toContain("gemini");
    });

    it("includes mock provider in development", () => {
      process.env.NODE_ENV = "development";
      const providers = getAvailableProviders();
      expect(providers).toContain("mock");
    });

    it("does not include mock provider in production", () => {
      process.env.NODE_ENV = "production";
      const providers = getAvailableProviders();
      expect(providers).not.toContain("mock");
    });
  });

  describe("isProviderAvailable", () => {
    it("returns true for openai when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      expect(isProviderAvailable("openai")).toBe(true);
    });

    it("returns false for openai when OPENAI_API_KEY is not set", () => {
      expect(isProviderAvailable("openai")).toBe(false);
    });

    it("returns true for anthropic when ANTHROPIC_API_KEY is set", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      expect(isProviderAvailable("anthropic")).toBe(true);
    });

    it("returns true for gemini when GEMINI_API_KEY is set", () => {
      process.env.GEMINI_API_KEY = "AI-test";
      expect(isProviderAvailable("gemini")).toBe(true);
    });

    it("returns true for mock in development", () => {
      process.env.NODE_ENV = "development";
      expect(isProviderAvailable("mock")).toBe(true);
    });

    it("returns false for mock in production", () => {
      process.env.NODE_ENV = "production";
      expect(isProviderAvailable("mock")).toBe(false);
    });

    it("returns false for unknown provider", () => {
      expect(isProviderAvailable("unknown")).toBe(false);
    });
  });

  describe("getProviderApiKey", () => {
    it("returns the API key when set", () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      expect(getProviderApiKey("openai")).toBe("sk-test-key");
    });

    it("returns undefined when not set", () => {
      expect(getProviderApiKey("openai")).toBeUndefined();
    });

    it("returns undefined for unknown provider", () => {
      expect(getProviderApiKey("mock")).toBeUndefined();
    });
  });
});
