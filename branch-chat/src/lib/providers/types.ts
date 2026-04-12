export interface LLMAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64
  size: number;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: LLMAttachment[];
}

export interface LLMRequestOptions {
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
  thinkingLevel?: string;
}

export interface Citation {
  url: string;
  title: string;
}

export interface LLMResponse {
  content: string;
  thinkingContent: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  webSearchRequestCount: number;
  citations: Citation[];
}

export type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'done'; content: string; thinkingContent: string | null; inputTokens: number; outputTokens: number; webSearchRequestCount: number; citations: Citation[] }
  | { type: 'error'; message: string };

export interface LLMProvider {
  name: string;
  sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): Promise<LLMResponse>;
  streamMessage(
    messages: LLMMessage[],
    model: string,
    options?: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk>;
}
