import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk, Citation } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';

function buildThinkingConfig(model: string, level: string): Record<string, unknown> {
  if (/^gemini-3/.test(model)) {
    return { thinkingLevel: level, includeThoughts: true };
  }
  return { thinkingBudget: -1, includeThoughts: true };
}

function extractGeminiCitations(candidate: any): Citation[] {
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const chunk of chunks) {
    const url = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (url && title && !seen.has(url)) {
      seen.add(url);
      citations.push({ url, title });
    }
  }
  return citations;
}

function hasGroundingMetadata(candidate: any): boolean {
  return !!(candidate?.groundingMetadata?.groundingChunks?.length);
}

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const history = nonSystemMessages.slice(0, -1).map((m) => {
      const parts: any[] = [];
      if (m.attachments && m.attachments.length > 0) {
        parts.push(...formatAttachmentsForProvider(m.attachments, 'gemini'));
      }
      parts.push({ text: m.content });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    const lastParts: any[] = [];
    if (lastMessage.attachments && lastMessage.attachments.length > 0) {
      lastParts.push(...formatAttachmentsForProvider(lastMessage.attachments, 'gemini'));
    }
    lastParts.push({ text: lastMessage.content });

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join('\n')
      : undefined;

    const config: Record<string, unknown> = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (options?.thinkingEnabled) {
      config.thinkingConfig = buildThinkingConfig(model, options.thinkingLevel ?? 'high');
    }
    if (options?.webSearchEnabled) {
      config.tools = [{ googleSearch: {} }];
    }

    const chat = ai.chats.create({
      model,
      history,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });
    const response = await chat.sendMessage({ message: lastParts });

    let thinkingContent: string | null = null;
    if (options?.thinkingEnabled && response.candidates?.[0]?.content?.parts) {
      const thoughtParts = response.candidates[0].content.parts
        .filter((p: any) => p.thought === true)
        .map((p: any) => p.text ?? '')
        .filter(Boolean);
      if (thoughtParts.length > 0) {
        thinkingContent = thoughtParts.join('');
      }
    }

    const candidate = response.candidates?.[0];
    const citations = extractGeminiCitations(candidate);
    const webSearchRequestCount = hasGroundingMetadata(candidate) ? 1 : 0;

    return {
      content: response.text ?? '',
      thinkingContent,
      provider: 'gemini',
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      webSearchRequestCount,
      citations,
    };
  },

  async *streamMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      const systemInstruction = systemMessages.length > 0
        ? systemMessages.map((m) => m.content).join('\n')
        : undefined;

      const contents = nonSystemMessages.map((m) => {
        const parts: any[] = [];
        if (m.attachments && m.attachments.length > 0) {
          parts.push(...formatAttachmentsForProvider(m.attachments, 'gemini'));
        }
        parts.push({ text: m.content });
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      });

      const config: Record<string, unknown> = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (options?.thinkingEnabled) {
        config.thinkingConfig = buildThinkingConfig(model, options.thinkingLevel ?? 'high');
      }
      if (options?.webSearchEnabled) {
        config.tools = [{ googleSearch: {} }];
      }

      const stream = await ai.models.generateContentStream({
        model,
        contents,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      });

      let accumulated = '';
      let accumulatedThinking = '';
      let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
      let lastCandidate: any = null;

      for await (const chunk of stream) {
        if (chunk.candidates?.[0]?.content?.parts) {
          lastCandidate = chunk.candidates[0];
          for (const part of chunk.candidates[0].content.parts) {
            const partText = (part as any).text ?? '';
            if (!partText) continue;
            if ((part as any).thought === true) {
              accumulatedThinking += partText;
              yield { type: 'thinking', content: partText };
            } else {
              accumulated += partText;
              yield { type: 'token', content: partText };
            }
          }
        } else {
          const text = chunk.text;
          if (text) {
            accumulated += text;
            yield { type: 'token', content: text };
          }
          if (chunk.candidates?.[0]) {
            lastCandidate = chunk.candidates[0];
          }
        }
        if (chunk.usageMetadata) {
          lastUsage = chunk.usageMetadata;
        }
      }

      const citations = extractGeminiCitations(lastCandidate);
      const webSearchRequestCount = hasGroundingMetadata(lastCandidate) ? 1 : 0;

      yield {
        type: 'done',
        content: accumulated,
        thinkingContent: accumulatedThinking || null,
        inputTokens: lastUsage?.promptTokenCount ?? 0,
        outputTokens: lastUsage?.candidatesTokenCount ?? 0,
        webSearchRequestCount,
        citations,
      };
    } catch (error: any) {
      const causeMsg = error?.cause?.message ?? error?.cause?.code ?? error?.cause;
      const detail = causeMsg ? `${error?.message ?? 'Gemini streaming error'} (cause: ${causeMsg})` : (error?.message ?? 'Gemini streaming error');
      yield { type: 'error', message: detail };
    }
  },
};
