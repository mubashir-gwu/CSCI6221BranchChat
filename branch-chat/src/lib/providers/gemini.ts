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

    const chat = ai.chats.create({
      model,
      history,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });
    const response = await chat.sendMessage({ message: lastParts });

    return {
      content: response.text ?? '',
      thinkingContent: null,
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

      const stream = await ai.models.generateContentStream({
        model,
        contents,
        ...(systemInstruction ? { config: { systemInstruction } } : {}),
      });

      let accumulated = '';
      let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          accumulated += text;
          yield { type: 'token', content: text };
        }
        if (chunk.usageMetadata) {
          lastUsage = chunk.usageMetadata;
        }
      }

      yield {
        type: 'done',
        content: accumulated,
        thinkingContent: null,
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
