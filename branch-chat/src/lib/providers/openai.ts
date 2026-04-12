import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';

function buildOpenAIMessages(messages: LLMMessage[]): any[] {
  return messages.map((m) => {
    if (m.attachments && m.attachments.length > 0) {
      const contentParts: any[] = [];
      const attachmentBlocks = formatAttachmentsForProvider(m.attachments, 'openai');
      contentParts.push(...attachmentBlocks);
      contentParts.push({ type: 'text', text: m.content });
      return { role: m.role, content: contentParts };
    }
    return { role: m.role, content: m.content };
  });
}

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model,
      messages: buildOpenAIMessages(messages),
    });

    return {
      content: response.choices[0].message.content ?? '',
      thinkingContent: null,
      provider: 'openai',
      model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
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
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const stream = await client.chat.completions.create({
        model,
        messages: buildOpenAIMessages(messages),
        stream: true,
        stream_options: { include_usage: true },
      });

      let accumulated = '';

      for await (const chunk of stream) {
        if (chunk.choices.length === 0 && chunk.usage) {
          yield {
            type: 'done',
            content: accumulated,
            thinkingContent: null,
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
            webSearchRequestCount: 0,
            citations: [],
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
