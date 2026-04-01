import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, LLMMessage } from './types';

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
  ): Promise<LLMResponse> {
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      content: response.choices[0].message.content ?? '',
      provider: 'openai',
      model,
    };
  },
};
