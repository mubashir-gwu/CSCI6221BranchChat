export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
}

export interface LLMProvider {
  name: string;
  sendMessage(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
  ): Promise<LLMResponse>;
}
