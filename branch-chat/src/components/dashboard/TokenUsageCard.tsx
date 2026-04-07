"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS } from "@/constants/providers";

interface UsageEntry {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
}

export default function TokenUsageCard() {
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usageRes, providersRes] = await Promise.all([
          fetch("/api/token-usage"),
          fetch("/api/providers"),
        ]);

        if (usageRes.ok) {
          const data = await usageRes.json();
          setUsage(data.usage);
        }
        if (providersRes.ok) {
          const data = await providersRes.json();
          setAvailableProviders(data.providers);
        }
      } catch {
        // Silently fail — page will show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading usage data...</p>
      </div>
    );
  }

  const allProviders = Object.keys(PROVIDERS).filter(
    (p) => p !== "mock" || process.env.NODE_ENV === "development"
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allProviders.map((providerKey) => {
        const provider = PROVIDERS[providerKey as keyof typeof PROVIDERS];
        const entry = usage.find((u) => u.provider === providerKey);
        const isAvailable = availableProviders.includes(providerKey);

        return (
          <Card key={providerKey}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: provider.color }}
                />
                {provider.displayName}
              </CardTitle>
              {!isAvailable && (
                <Badge variant="secondary" className="text-xs">
                  Not configured
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input tokens</span>
                  <span className="font-mono">{entry?.inputTokens?.toLocaleString() ?? "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output tokens</span>
                  <span className="font-mono">{entry?.outputTokens?.toLocaleString() ?? "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API calls</span>
                  <span className="font-mono">{entry?.callCount?.toLocaleString() ?? "0"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
