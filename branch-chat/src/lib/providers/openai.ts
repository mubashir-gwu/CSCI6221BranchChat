import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';

/**
 * Returns true for o-series reasoning models (o3, o4-mini, etc.).
 * These models do not support the temperature parameter.
 */
export function isReasoningModel(modelId: string): boolean {
  return /^o\d/.test(modelId);
}

function buildInstructionsAndInput(messages: LLMMessage[]): {
  instructions: string | undefined;
  input: any[];
} {
  const systemMessages: string[] = [];
  const input: any[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemMessages.push(m.content);
      continue;
    }

    if (m.attachments && m.attachments.length > 0) {
      const contentParts: any[] = [];
      const attachmentBlocks = formatAttachmentsForProvider(m.attachments, 'openai');
      contentParts.push(...attachmentBlocks);
      contentParts.push({ type: 'text', text: m.content });
      input.push({ role: m.role, content: contentParts });
    } else {
      input.push({ role: m.role, content: m.content });
    }
  }

  return {
    instructions: systemMessages.length > 0 ? systemMessages.join('\n') : undefined,
    input,
  };
}

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { instructions, input } = buildInstructionsAndInput(messages);

    const params: Record<string, unknown> = {
      model,
      input,
    };
    if (instructions) {
      params.instructions = instructions;
    }
    if (!isReasoningModel(model)) {
      params.temperature = 1;
    }

    const response = await client.responses.create(params as any);

    return {
      content: response.output_text ?? '',
      thinkingContent: null,
      provider: 'openai',
      model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
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
      const { instructions, input } = buildInstructionsAndInput(messages);

      const params: Record<string, unknown> = {
        model,
        input,
        stream: true,
      };
      if (instructions) {
        params.instructions = instructions;
      }
      if (!isReasoningModel(model)) {
        params.temperature = 1;
      }

      const stream = await client.responses.create(params as any);

      let accumulated = '';

      for await (const event of stream as any) {
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta as string;
          accumulated += delta;
          yield { type: 'token', content: delta };
        } else if (event.type === 'response.completed') {
          const usage = event.response?.usage;
          yield {
            type: 'done',
            content: accumulated,
            thinkingContent: null,
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
            webSearchRequestCount: 0,
            citations: [],
          };
        }
      }
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'OpenAI streaming error' };
    }
  },
};
