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

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}

export type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; content: string; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string };

export interface LLMProvider {
  name: string;
  sendMessage(
    messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse>;
  streamMessage(
    messages: LLMMessage[],
    model: string,
  ): AsyncGenerator<StreamChunk>;
}
