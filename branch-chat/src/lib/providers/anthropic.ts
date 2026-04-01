import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMResponse, LLMMessage } from './types';

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
  ): Promise<LLMResponse> {
    const client = new Anthropic({ apiKey });

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const systemText = systemMessages.map((m) => m.content).join('\n');

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      ...(systemText ? { system: systemText } : {}),
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const firstBlock = response.content[0];
    const content = firstBlock.type === 'text' ? firstBlock.text : '';

    return {
      content,
      provider: 'anthropic',
      model,
    };
  },
};
