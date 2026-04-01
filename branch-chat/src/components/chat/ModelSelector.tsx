"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PROVIDERS } from "@/constants/providers";
import { MODELS } from "@/constants/models";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

interface ModelSelectorProps {
  value: { provider: string; model: string };
  onChange: (value: { provider: string; model: string }) => void;
  availableProviders: string[];
}

export default function ModelSelector({
  value,
  onChange,
  availableProviders,
}: ModelSelectorProps) {
  // Show all providers; mock only in dev
  const visibleProviders = Object.keys(PROVIDERS).filter((key) => {
    if (key === "mock") {
      return process.env.NODE_ENV === "development";
    }
    return true;
  });

  const isProviderEnabled = (key: string) =>
    key === "mock" || availableProviders.includes(key);

  // Find display info for current selection
  const currentProvider = PROVIDERS[value.provider as keyof typeof PROVIDERS];
  const currentModels = MODELS[value.provider as keyof typeof MODELS];
  const currentModel = currentModels?.find((m) => m.id === value.model);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: currentProvider?.color ?? "#6B7280" }}
            />
            <span>
              {currentProvider?.displayName ?? value.provider} /{" "}
              {currentModel?.name ?? value.model}
            </span>
            <ChevronDownIcon className="h-3 w-3 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={4}>
        {visibleProviders.map((providerKey, idx) => {
          const provider = PROVIDERS[providerKey as keyof typeof PROVIDERS];
          const models = MODELS[providerKey as keyof typeof MODELS];
          const enabled = isProviderEnabled(providerKey);

          return (
            <DropdownMenuGroup key={providerKey}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: enabled ? provider.color : "#9CA3AF",
                    }}
                  />
                  <span className={enabled ? "" : "text-muted-foreground"}>
                    {provider.displayName}
                    {!enabled && (
                      <span className="ml-1 text-xs opacity-60">(no key)</span>
                    )}
                  </span>
                </span>
              </DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  disabled={!enabled}
                  onClick={() => {
                    if (!enabled) {
                      toast.info(
                        `Add an API key for ${provider.displayName} in Settings to use this model.`
                      );
                      return;
                    }
                    onChange({ provider: providerKey, model: m.id });
                  }}
                >
                  <span
                    className={
                      value.provider === providerKey && value.model === m.id
                        ? "font-semibold"
                        : enabled
                          ? ""
                          : "text-muted-foreground"
                    }
                  >
                    {m.name}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
