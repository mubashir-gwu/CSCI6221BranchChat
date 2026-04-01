import type { LLMProvider } from './types';

const providers = new Map<string, LLMProvider>();

export function registerProvider(provider: LLMProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): LLMProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}
