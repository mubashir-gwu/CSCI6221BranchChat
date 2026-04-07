const PROVIDER_ENV_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

export function getAvailableProviders(): string[] {
  const providers = Object.entries(PROVIDER_ENV_MAP)
    .filter(([, envVar]) => !!process.env[envVar])
    .map(([provider]) => provider);

  if (process.env.NODE_ENV === 'development') {
    providers.push('mock');
  }

  return providers;
}

export function isProviderAvailable(provider: string): boolean {
  const envVar = PROVIDER_ENV_MAP[provider];
  if (!envVar) return provider === 'mock' && process.env.NODE_ENV === 'development';
  return !!process.env[envVar];
}

export function getProviderApiKey(provider: string): string | undefined {
  const envVar = PROVIDER_ENV_MAP[provider];
  return envVar ? process.env[envVar] : undefined;
}
