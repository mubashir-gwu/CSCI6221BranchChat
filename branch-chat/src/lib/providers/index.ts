import type { LLMProvider } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { mockProvider } from './mock';

const providers = new Map<string, LLMProvider>();

export function registerProvider(provider: LLMProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): LLMProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}

// Register all providers
registerProvider(openaiProvider);
registerProvider(anthropicProvider);
registerProvider(geminiProvider);

if (process.env.NODE_ENV === 'development') {
  registerProvider(mockProvider);
}
