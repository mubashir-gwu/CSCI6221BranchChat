import type { LLMProvider, LLMResponse, LLMMessage, LLMRequestOptions, StreamChunk } from './types';

const MOCK_THINKING = 'Mock thinking: analyzing the request...\nConsidering multiple approaches...\nFormulating response...';

const MOCK_RESPONSE = `## Mock Response

This is a **mock response** for development.

- Item 1
- Item 2

\`\`\`javascript
console.log("Hello from mock!");
\`\`\``;

function getAttachmentPrefix(messages: LLMMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg?.attachments && lastUserMsg.attachments.length > 0) {
    const filenames = lastUserMsg.attachments.map((a) => a.filename).join(', ');
    return `I see you've attached: ${filenames}. `;
  }
  return '';
}

export const mockProvider: LLMProvider = {
  name: 'mock',

  async sendMessage(
    _messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const prefix = getAttachmentPrefix(_messages);
    const responseContent = prefix + MOCK_RESPONSE;

    const inputTokens = Math.ceil(
      _messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    );
    const outputTokens = Math.ceil(responseContent.length / 4);

    return {
      content: responseContent,
      thinkingContent: options?.thinkingEnabled ? MOCK_THINKING : null,
      provider: 'mock',
      model,
      inputTokens,
      outputTokens,
      webSearchRequestCount: 0,
      citations: [],
    };
  },

  async *streamMessage(
    _messages: LLMMessage[],
    _model: string,
    options?: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    const inputLength = _messages.reduce((sum, m) => sum + m.content.length, 0);

    if (options?.thinkingEnabled) {
      yield { type: 'thinking', content: 'Mock thinking: analyzing the request...' };
      yield { type: 'thinking', content: '\nConsidering multiple approaches...' };
      yield { type: 'thinking', content: '\nFormulating response...' };
    }

    const prefix = getAttachmentPrefix(_messages);
    const responseContent = prefix + MOCK_RESPONSE;

    for (const char of responseContent) {
      await new Promise((r) => setTimeout(r, 10));
      yield { type: 'token', content: char };
    }

    yield {
      type: 'done',
      content: responseContent,
      thinkingContent: options?.thinkingEnabled ? MOCK_THINKING : null,
      inputTokens: Math.ceil(inputLength / 4),
      outputTokens: Math.ceil(responseContent.length / 4),
      webSearchRequestCount: 0,
      citations: [],
    };
  },
};
