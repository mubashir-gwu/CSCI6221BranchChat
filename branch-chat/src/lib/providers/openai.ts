import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk, Citation } from './types';
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

function extractCitationsFromOutput(output: any[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const item of output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (Array.isArray(block.annotations)) {
          for (const ann of block.annotations) {
            if (ann.type === 'url_citation' && ann.url && ann.title && !seen.has(ann.url)) {
              seen.add(ann.url);
              citations.push({ url: ann.url, title: ann.title });
            }
          }
        }
      }
    }
  }
  return citations;
}

function countWebSearchCalls(output: any[]): number {
  return output.filter((item: any) => item.type === 'web_search_call').length;
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
    if (options?.thinkingEnabled && isReasoningModel(model)) {
      params.reasoning = { effort: options.thinkingLevel ?? 'high', summary: 'auto' };
    }
    if (options?.webSearchEnabled) {
      params.tools = [...(params.tools as any[] || []), { type: 'web_search_preview' }];
    }

    const response = await client.responses.create(params as any);

    let thinkingContent: string | null = null;
    if (options?.thinkingEnabled && isReasoningModel(model)) {
      const reasoningItems = (response.output ?? []).filter((item: any) => item.type === 'reasoning');
      const summaries = reasoningItems
        .flatMap((item: any) => item.summary ?? [])
        .map((s: any) => s.text ?? '')
        .filter(Boolean);
      if (summaries.length > 0) {
        thinkingContent = summaries.join('\n');
      }
    }

    const outputArr = response.output ?? [];
    const citations = extractCitationsFromOutput(outputArr);
    const webSearchRequestCount = countWebSearchCalls(outputArr);

    return {
      content: response.output_text ?? '',
      thinkingContent,
      provider: 'openai',
      model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      webSearchRequestCount,
      citations,
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
      if (options?.thinkingEnabled && isReasoningModel(model)) {
        params.reasoning = { effort: options.thinkingLevel ?? 'high', summary: 'auto' };
      }
      if (options?.webSearchEnabled) {
        params.tools = [...(params.tools as any[] || []), { type: 'web_search_preview' }];
      }

      const stream = await client.responses.create(params as any);

      let accumulated = '';
      let accumulatedThinking = '';

      for await (const event of stream as any) {
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta as string;
          accumulated += delta;
          yield { type: 'token', content: delta };
        } else if (event.type === 'response.reasoning_summary_text.delta') {
          const delta = event.delta as string;
          accumulatedThinking += delta;
          yield { type: 'thinking', content: delta };
        } else if (event.type === 'response.completed') {
          const usage = event.response?.usage;
          const outputArr = event.response?.output ?? [];
          const citations = extractCitationsFromOutput(outputArr);
          const webSearchRequestCount = countWebSearchCalls(outputArr);
          yield {
            type: 'done',
            content: accumulated,
            thinkingContent: accumulatedThinking || null,
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
            webSearchRequestCount,
            citations,
          };
        }
      }
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'OpenAI streaming error' };
    }
  },
};
