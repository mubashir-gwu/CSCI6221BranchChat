import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';

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
      config.thinkingConfig = {
        thinkingLevel: options.thinkingLevel ?? 'high',
        includeThoughts: true,
      };
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

    return {
      content: response.text ?? '',
      thinkingContent,
      provider: 'gemini',
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      webSearchRequestCount: 0,
      citations: [],
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
        config.thinkingConfig = {
          thinkingLevel: options.thinkingLevel ?? 'high',
          includeThoughts: true,
        };
      }

      const stream = await ai.models.generateContentStream({
        model,
        contents,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      });

      let accumulated = '';
      let accumulatedThinking = '';
      let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;

      for await (const chunk of stream) {
        if (chunk.candidates?.[0]?.content?.parts) {
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
        }
        if (chunk.usageMetadata) {
          lastUsage = chunk.usageMetadata;
        }
      }

      yield {
        type: 'done',
        content: accumulated,
        thinkingContent: accumulatedThinking || null,
        inputTokens: lastUsage?.promptTokenCount ?? 0,
        outputTokens: lastUsage?.candidatesTokenCount ?? 0,
        webSearchRequestCount: 0,
        citations: [],
      };
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'Gemini streaming error' };
    }
  },
};
