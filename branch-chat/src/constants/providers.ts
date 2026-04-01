export const PROVIDERS = {
  openai: { name: 'openai', displayName: 'OpenAI', color: '#10A37F' },
  anthropic: { name: 'anthropic', displayName: 'Anthropic', color: '#D4A27F' },
  gemini: { name: 'gemini', displayName: 'Google Gemini', color: '#4285F4' },
  mock: { name: 'mock', displayName: 'Mock (Dev)', color: '#6B7280' },
} as const;

export type ProviderName = keyof typeof PROVIDERS;
