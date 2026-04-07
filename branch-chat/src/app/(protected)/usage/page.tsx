"use client";

import TokenUsageCard from "@/components/dashboard/TokenUsageCard";

export default function UsagePage() {
  return (
    <div className="flex h-full flex-col p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Token Usage</h1>
          <p className="text-muted-foreground mt-1">
            Track your API usage across providers.
          </p>
        </div>
        <TokenUsageCard />
      </div>
    </div>
  );
}
