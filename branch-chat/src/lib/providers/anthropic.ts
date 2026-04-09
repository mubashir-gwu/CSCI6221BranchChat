import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMResponse, LLMMessage, StreamChunk } from './types';

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  },

  async *streamMessage(
    messages: LLMMessage[],
    model: string,
  ): AsyncGenerator<StreamChunk> {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      const systemText = systemMessages.map((m) => m.content).join('\n');

      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        ...(systemText ? { system: systemText } : {}),
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'token', content: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'done',
        content: finalMessage.content[0].type === 'text' ? finalMessage.content[0].text : '',
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      };
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'Anthropic streaming error' };
    }
  },
};
