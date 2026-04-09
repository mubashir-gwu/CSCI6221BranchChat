import type { LLMProvider, LLMResponse, LLMMessage, StreamChunk } from './types';

const MOCK_RESPONSE = `## Mock Response

This is a **mock response** for development.

- Item 1
- Item 2

\`\`\`javascript
console.log("Hello from mock!");
\`\`\``;

export const mockProvider: LLMProvider = {
  name: 'mock',

  async sendMessage(
    _messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const inputTokens = Math.ceil(
      _messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    );
    const outputTokens = Math.ceil(MOCK_RESPONSE.length / 4);

    return {
      content: MOCK_RESPONSE,
      provider: 'mock',
      model,
      inputTokens,
      outputTokens,
    };
  },

  async *streamMessage(
    _messages: LLMMessage[],
    _model: string,
  ): AsyncGenerator<StreamChunk> {
    const inputLength = _messages.reduce((sum, m) => sum + m.content.length, 0);

    for (const char of MOCK_RESPONSE) {
      await new Promise((r) => setTimeout(r, 10));
      yield { type: 'token', content: char };
    }

    yield {
      type: 'done',
      content: MOCK_RESPONSE,
      inputTokens: Math.ceil(inputLength / 4),
      outputTokens: Math.ceil(MOCK_RESPONSE.length / 4),
    };
  },
};
