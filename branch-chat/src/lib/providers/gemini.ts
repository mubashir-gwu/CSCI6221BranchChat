import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMResponse, LLMMessage } from './types';

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
  ): Promise<LLMResponse> {
    const ai = new GoogleGenAI({ apiKey });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = ai.chats.create({ model, history });
    const response = await chat.sendMessage({ message: lastMessage.content });

    return {
      content: response.text ?? '',
      provider: 'gemini',
      model,
    };
  },
};
