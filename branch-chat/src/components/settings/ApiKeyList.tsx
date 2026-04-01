"use client";

import { useEffect, useState, useCallback } from "react";
import ApiKeyForm from "@/components/settings/ApiKeyForm";
import { PROVIDERS } from "@/constants/providers";

interface StoredKey {
  provider: string;
  maskedKey: string;
  updatedAt: string;
}

const KEY_PROVIDERS = (["openai", "anthropic", "gemini"] as const).map(
  (p) => PROVIDERS[p]
);

export default function ApiKeyList() {
  const [keys, setKeys] = useState<StoredKey[]>([]);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } catch {
      // silently fail — user will see empty state
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  function getMaskedKey(provider: string): string | null {
    const found = keys.find((k) => k.provider === provider);
    return found?.maskedKey ?? null;
  }

  return (
    <div className="space-y-4">
      {KEY_PROVIDERS.map((p) => (
        <ApiKeyForm
          key={p.name}
          provider={p.name}
          displayName={p.displayName}
          color={p.color}
          currentMaskedKey={getMaskedKey(p.name)}
          onSave={fetchKeys}
          onDelete={fetchKeys}
        />
      ))}
    </div>
  );
}
