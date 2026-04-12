import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk } from './types';
import { formatAttachmentsForProvider } from './attachmentFormatter';

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

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      ...buildSystemParam(systemText),
      messages: buildAnthropicMessages(nonSystemMessages),
    });

    const firstBlock = response.content[0];
    const content = firstBlock.type === 'text' ? firstBlock.text : '';

    return {
      content,
      thinkingContent: null,
      provider: 'anthropic',
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
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
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      const systemText = systemMessages.map((m) => m.content).join('\n');

      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        ...buildSystemParam(systemText),
        messages: buildAnthropicMessages(nonSystemMessages),
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
        thinkingContent: null,
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        webSearchRequestCount: 0,
        citations: [],
      };
    } catch (error: any) {
      yield { type: 'error', message: error?.message ?? 'Anthropic streaming error' };
    }
  },
};
