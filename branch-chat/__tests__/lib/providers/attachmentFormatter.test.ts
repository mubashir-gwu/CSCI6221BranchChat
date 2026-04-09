import { describe, it, expect } from "vitest";
import { formatAttachmentsForProvider } from "@/lib/providers/attachmentFormatter";
import type { LLMAttachment } from "@/lib/providers/types";

const imageAttachment: LLMAttachment = {
  filename: "photo.png",
  mimeType: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUg==",
};

const pdfAttachment: LLMAttachment = {
  filename: "document.pdf",
  mimeType: "application/pdf",
  data: "JVBERi0xLjQK",
};

// "Hello World" in base64
const textContent = "Hello World";
const textBase64 = Buffer.from(textContent).toString("base64");

const textAttachment: LLMAttachment = {
  filename: "notes.txt",
  mimeType: "text/plain",
  data: textBase64,
};

const markdownAttachment: LLMAttachment = {
  filename: "readme.md",
  mimeType: "text/markdown",
  data: textBase64,
};

const csvAttachment: LLMAttachment = {
  filename: "data.csv",
  mimeType: "text/csv",
  data: textBase64,
};

describe("formatAttachmentsForProvider", () => {
  describe("Anthropic format", () => {
    it("formats images as image source blocks", () => {
      const result = formatAttachmentsForProvider([imageAttachment], "anthropic") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("image");
      expect(result[0].source.type).toBe("base64");
      expect(result[0].source.media_type).toBe("image/png");
      expect(result[0].source.data).toBe(imageAttachment.data);
    });

    it("formats PDFs as document source blocks", () => {
      const result = formatAttachmentsForProvider([pdfAttachment], "anthropic") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("document");
      expect(result[0].source.type).toBe("base64");
      expect(result[0].source.media_type).toBe("application/pdf");
    });

    it("formats text files as inline text blocks", () => {
      const result = formatAttachmentsForProvider([textAttachment], "anthropic") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect(result[0].text).toContain("[File: notes.txt]");
      expect(result[0].text).toContain(textContent);
    });

    it("formats markdown files as text (text/markdown)", () => {
      const result = formatAttachmentsForProvider([markdownAttachment], "anthropic") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect(result[0].text).toContain("[File: readme.md]");
    });

    it("formats csv files as text", () => {
      const result = formatAttachmentsForProvider([csvAttachment], "anthropic") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect(result[0].text).toContain("[File: data.csv]");
    });
  });

  describe("OpenAI format", () => {
    it("formats images as image_url with data URI", () => {
      const result = formatAttachmentsForProvider([imageAttachment], "openai") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("image_url");
      expect(result[0].image_url.url).toBe(`data:image/png;base64,${imageAttachment.data}`);
    });

    it("formats PDFs as file with data URI", () => {
      const result = formatAttachmentsForProvider([pdfAttachment], "openai") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("file");
      expect(result[0].file.filename).toBe("document.pdf");
      expect(result[0].file.file_data).toBe(`data:application/pdf;base64,${pdfAttachment.data}`);
    });

    it("formats text files as inline text", () => {
      const result = formatAttachmentsForProvider([textAttachment], "openai") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect(result[0].text).toContain("[File: notes.txt]");
      expect(result[0].text).toContain(textContent);
    });
  });

  describe("Gemini format", () => {
    it("formats images as inlineData", () => {
      const result = formatAttachmentsForProvider([imageAttachment], "gemini") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].inlineData).toBeDefined();
      expect(result[0].inlineData.mimeType).toBe("image/png");
      expect(result[0].inlineData.data).toBe(imageAttachment.data);
    });

    it("formats PDFs as inlineData", () => {
      const result = formatAttachmentsForProvider([pdfAttachment], "gemini") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].inlineData).toBeDefined();
      expect(result[0].inlineData.mimeType).toBe("application/pdf");
    });

    it("formats text files as text with decoded content", () => {
      const result = formatAttachmentsForProvider([textAttachment], "gemini") as any[];
      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("[File: notes.txt]");
      expect(result[0].text).toContain(textContent);
    });
  });

  describe("Mock format", () => {
    it("returns empty array", () => {
      const result = formatAttachmentsForProvider([imageAttachment, pdfAttachment], "mock");
      expect(result).toEqual([]);
    });
  });

  describe("text file base64 decoding", () => {
    it("correctly decodes base64 to UTF-8 text", () => {
      const originalText = "Line 1\nLine 2\nSpecial chars: éàü";
      const encoded = Buffer.from(originalText).toString("base64");
      const att: LLMAttachment = { filename: "test.txt", mimeType: "text/plain", data: encoded };

      const result = formatAttachmentsForProvider([att], "anthropic") as any[];
      expect(result[0].text).toContain(originalText);
    });
  });
});
