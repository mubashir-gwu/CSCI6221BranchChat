export const MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000 },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 200000 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000 },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', contextWindow: 1048576 },
  ],
  mock: [
    { id: 'mock-model', name: 'Mock Model', contextWindow: 16000 },
  ],
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS][number]['id'];
