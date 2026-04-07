export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMProvider {
  name: string;
  sendMessage(
    messages: LLMMessage[],
    model: string,
  ): Promise<LLMResponse>;
}
