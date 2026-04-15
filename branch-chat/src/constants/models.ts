export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  supportsThinking: boolean;
  maxThinkingLevel: string | null;
}

export const MODELS: Record<string, readonly ModelConfig[]> = {
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 1000000, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', contextWindow: 400000, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', contextWindow: 128000, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 1000000, supportsThinking: true, maxThinkingLevel: 'max' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1000000, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', contextWindow: 1048576, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', contextWindow: 1048576, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
  mock: [
    { id: 'mock-model', name: 'Mock Model', contextWindow: 16000, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS][number]['id'];
