import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMResponse, LLMMessage, StreamChunk } from './types';

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const history = nonSystemMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join('\n')
      : undefined;

    const chat = ai.chats.create({
      model,
      history,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });
    const response = await chat.sendMessage({ message: lastMessage.content });

    return {
      content: response.text ?? '',
      provider: 'gemini',
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },

  async *streamMessage(
    _messages: LLMMessage[],
    _model: string,
  ): AsyncGenerator<StreamChunk> {
    throw new Error('Not implemented');
  },
};
