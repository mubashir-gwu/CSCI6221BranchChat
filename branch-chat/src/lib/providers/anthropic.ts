import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk, Citation } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';
import { MODELS } from '@/constants/models';

type AnthropicMessage = Anthropic.MessageCreateParams['messages'][number];

function buildAnthropicMessages(nonSystemMessages: LLMMessage[]): AnthropicMessage[] {
  const formatted: AnthropicMessage[] = nonSystemMessages.map((m) => {
    const contentBlocks: any[] = [];

    // Add attachment content blocks first
    if (m.attachments && m.attachments.length > 0) {
      const attachmentBlocks = formatAttachmentsForProvider(m.attachments, 'anthropic');
      contentBlocks.push(...attachmentBlocks);
    }

    // Add text content block
    contentBlocks.push({ type: 'text' as const, text: m.content });

    return {
      role: m.role as 'user' | 'assistant',
      content: contentBlocks.length === 1 && !m.attachments?.length ? m.content : contentBlocks,
    };
  });

  // Add cache_control to last message's last content block (AFTER attachments)
  if (formatted.length > 0) {
    const lastMsg = formatted[formatted.length - 1];
    if (typeof lastMsg.content === 'string') {
      formatted[formatted.length - 1] = {
        ...lastMsg,
        content: [{ type: 'text' as const, text: lastMsg.content, cache_control: { type: 'ephemeral' as const } }],
      };
    } else if (Array.isArray(lastMsg.content)) {
      const blocks = [...lastMsg.content] as any[];
      const lastBlock = blocks[blocks.length - 1];
      blocks[blocks.length - 1] = { ...lastBlock, cache_control: { type: 'ephemeral' as const } };
      formatted[formatted.length - 1] = { ...lastMsg, content: blocks };
    }
  }

  return formatted;
}

function buildSystemParam(systemText: string) {
  if (!systemText) return {};
  return { system: [{ type: 'text' as const, text: systemText, cache_control: { type: 'ephemeral' as const } }] };
}

function buildThinkingParams(model: string, options?: LLMRequestOptions): Record<string, unknown> {
  if (!options?.thinkingEnabled) return {};

  const modelConfig = MODELS.anthropic?.find((m) => m.id === model);
  const level = modelConfig?.maxThinkingLevel ?? options.thinkingLevel ?? 'high';

  if (level === 'max') {
    return {
      thinking: { type: 'adaptive' },
      output_config: { effort: 'max' },
      temperature: 1,
      max_tokens: 16384,
    };
  }

  return {
    thinking: { type: 'enabled', budget_tokens: 10000 },
    temperature: 1,
    max_tokens: 16384,
  };
}

function buildWebSearchTools(options?: LLMRequestOptions): Record<string, unknown> {
  if (!options?.webSearchEnabled) return {};
  return {
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  };
}

function extractCitations(content: any[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const block of content) {
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c.url && c.title && !seen.has(c.url)) {
          seen.add(c.url);
          citations.push({ url: c.url, title: c.title });
        }
      }
    }
  }
  return citations;
}

function getWebSearchRequestCount(usage: any): number {
  return usage?.server_tool_use?.web_search_requests ?? 0;
}

function extractThinkingAndText(content: Anthropic.ContentBlock[]): { thinking: string; text: string } {
  let thinking = '';
  let text = '';
  for (const block of content) {
    if (block.type === 'thinking' && 'thinking' in block) {
      thinking += (block as any).thinking;
    } else if (block.type === 'text') {
      text += block.text;
    }
  }
  return { thinking, text };
}

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const systemText = systemMessages.map((m) => m.content).join('\n');

    const thinkingParams = buildThinkingParams(model, options);
    const webSearchTools = buildWebSearchTools(options);

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      ...buildSystemParam(systemText),
      messages: buildAnthropicMessages(nonSystemMessages),
      ...thinkingParams,
      ...webSearchTools,
    } as any);

    const { thinking, text } = extractThinkingAndText(response.content);
    const citations = extractCitations(response.content as any[]);
    const webSearchRequestCount = getWebSearchRequestCount(response.usage);

    return {
      content: text,
      thinkingContent: thinking || null,
      provider: 'anthropic',
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
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
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      const systemText = systemMessages.map((m) => m.content).join('\n');

      const thinkingParams = buildThinkingParams(model, options);
      const webSearchTools = buildWebSearchTools(options);

      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        ...buildSystemParam(systemText),
        messages: buildAnthropicMessages(nonSystemMessages),
        ...thinkingParams,
        ...webSearchTools,
      } as any);

      let accumulatedThinking = '';

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta' && 'thinking' in event.delta) {
            const thinkingText = (event.delta as any).thinking;
            accumulatedThinking += thinkingText;
            yield { type: 'thinking', content: thinkingText };
          } else if (event.delta.type === 'text_delta') {
            yield { type: 'token', content: event.delta.text };
          }
          // Ignore server_tool_use and web_search_tool_result deltas
        }
      }

      const finalMessage = await stream.finalMessage();
      const { thinking, text } = extractThinkingAndText(finalMessage.content);
      const citations = extractCitations(finalMessage.content as any[]);
      const webSearchRequestCount = getWebSearchRequestCount(finalMessage.usage);

      yield {
        type: 'done',
        content: text,
        thinkingContent: (accumulatedThinking || thinking) || null,
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        webSearchRequestCount,
        citations,
      };
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'Anthropic streaming error' };
    }
  },
};
