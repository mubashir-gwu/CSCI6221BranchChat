import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMMessage } from '@/lib/providers/types';

// Capture args passed to client.messages.create and client.messages.stream
let capturedCreateArgs: unknown = null;
let capturedStreamArgs: unknown = null;

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(async (args: unknown) => {
          capturedCreateArgs = args;
          return {
            content: [{ type: 'text', text: 'mock response' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        }),
        stream: vi.fn((args: unknown) => {
          capturedStreamArgs = args;
          const events: unknown[] = [];
          return {
            [Symbol.asyncIterator]: () => ({
              next: async () => {
                if (events.length === 0) return { done: true, value: undefined };
                return { done: false, value: events.shift() };
              },
            }),
            finalMessage: async () => ({
              content: [{ type: 'text', text: 'streamed response' }],
              usage: { input_tokens: 15, output_tokens: 8 },
            }),
          };
        }),
      };
    },
  };
});

describe('Anthropic Provider — Prompt Caching', () => {
  beforeEach(() => {
    capturedCreateArgs = null;
    capturedStreamArgs = null;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  // Dynamically import after mock is set up
  async function getProvider() {
    const mod = await import('@/lib/providers/anthropic');
    return mod.anthropicProvider;
  }

  describe('sendMessage', () => {
    it('includes cache_control on system content block', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ];

      await provider.sendMessage(messages, 'claude-sonnet-4-20250514');

      const args = capturedCreateArgs as Record<string, unknown>;
      expect(args.system).toEqual([
        { type: 'text', text: 'You are helpful.', cache_control: { type: 'ephemeral' } },
      ]);
    });

    it('includes cache_control on last message content block', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ];

      await provider.sendMessage(messages, 'claude-sonnet-4-20250514');

      const args = capturedCreateArgs as Record<string, unknown>;
      const msgs = args.messages as Array<{ role: string; content: unknown }>;
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.content).toEqual([
        { type: 'text', text: 'How are you?', cache_control: { type: 'ephemeral' } },
      ]);
    });

    it('does not add system cache_control when system prompt is absent', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await provider.sendMessage(messages, 'claude-sonnet-4-20250514');

      const args = capturedCreateArgs as Record<string, unknown>;
      expect(args.system).toBeUndefined();
    });

    it('uses exactly 2 breakpoints when system prompt is present', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Bye' },
      ];

      await provider.sendMessage(messages, 'claude-sonnet-4-20250514');

      const args = capturedCreateArgs as Record<string, unknown>;

      // Count cache_control occurrences
      let cacheControlCount = 0;
      const system = args.system as Array<{ cache_control?: unknown }>;
      for (const block of system) {
        if (block.cache_control) cacheControlCount++;
      }
      const msgs = args.messages as Array<{ content: unknown }>;
      for (const msg of msgs) {
        if (Array.isArray(msg.content)) {
          for (const block of msg.content as Array<{ cache_control?: unknown }>) {
            if (block.cache_control) cacheControlCount++;
          }
        }
      }
      expect(cacheControlCount).toBe(2);
    });
  });

  describe('streamMessage', () => {
    it('includes cache_control on system content block', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ];

      // Consume the generator
      const chunks = [];
      for await (const chunk of provider.streamMessage(messages, 'claude-sonnet-4-20250514')) {
        chunks.push(chunk);
      }

      const args = capturedStreamArgs as Record<string, unknown>;
      expect(args.system).toEqual([
        { type: 'text', text: 'You are helpful.', cache_control: { type: 'ephemeral' } },
      ]);
    });

    it('includes cache_control on last message content block', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ];

      const chunks = [];
      for await (const chunk of provider.streamMessage(messages, 'claude-sonnet-4-20250514')) {
        chunks.push(chunk);
      }

      const args = capturedStreamArgs as Record<string, unknown>;
      const msgs = args.messages as Array<{ role: string; content: unknown }>;
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.content).toEqual([
        { type: 'text', text: 'How are you?', cache_control: { type: 'ephemeral' } },
      ]);
    });

    it('does not add system cache_control when system prompt is absent', async () => {
      const provider = await getProvider();
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const chunks = [];
      for await (const chunk of provider.streamMessage(messages, 'claude-sonnet-4-20250514')) {
        chunks.push(chunk);
      }

      const args = capturedStreamArgs as Record<string, unknown>;
      expect(args.system).toBeUndefined();
    });
  });
});
