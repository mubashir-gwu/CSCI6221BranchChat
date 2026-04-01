export const MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
    { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576 },
  ],
  mock: [
    { id: 'mock-model', name: 'Mock Model', contextWindow: 16000 },
  ],
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS][number]['id'];
