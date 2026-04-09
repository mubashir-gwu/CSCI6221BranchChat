import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, LLMMessage, StreamChunk } from './types';

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  },

  async *streamMessage(
    messages: LLMMessage[],
    model: string,
  ): AsyncGenerator<StreamChunk> {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const stream = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        stream_options: { include_usage: true },
      });

      let accumulated = '';

      for await (const chunk of stream) {
        if (chunk.choices.length === 0 && chunk.usage) {
          yield {
            type: 'done',
            content: accumulated,
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        } else {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            accumulated += content;
            yield { type: 'token', content };
          }
        }
      }
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'OpenAI streaming error' };
    }
  },
};
