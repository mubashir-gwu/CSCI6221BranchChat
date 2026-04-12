export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  supportsThinking: boolean;
  maxThinkingLevel: string | null;
}

export const MODELS: Record<string, readonly ModelConfig[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsThinking: false, maxThinkingLevel: null },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsThinking: false, maxThinkingLevel: null },
    { id: 'o3', name: 'O3', contextWindow: 200000, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'o4-mini', name: 'O4 Mini', contextWindow: 200000, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, supportsThinking: true, maxThinkingLevel: 'high' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 200000, supportsThinking: true, maxThinkingLevel: 'max' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000, supportsThinking: false, maxThinkingLevel: null },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', contextWindow: 1048576, supportsThinking: false, maxThinkingLevel: null },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', contextWindow: 1048576, supportsThinking: true, maxThinkingLevel: 'high' },
  ],
  mock: [
    { id: 'mock-model', name: 'Mock Model', contextWindow: 16000, supportsThinking: false, maxThinkingLevel: null },
  ],
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS][number]['id'];
