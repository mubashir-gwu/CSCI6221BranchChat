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
  // Determine which providers to show
  const visibleProviders = Object.keys(PROVIDERS).filter((key) => {
    if (key === "mock") {
      return process.env.NODE_ENV === "development";
    }
    return availableProviders.includes(key);
  });

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

          return (
            <DropdownMenuGroup key={providerKey}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: provider.color }}
                  />
                  {provider.displayName}
                </span>
              </DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => onChange({ provider: providerKey, model: m.id })}
                >
                  <span
                    className={
                      value.provider === providerKey && value.model === m.id
                        ? "font-semibold"
                        : ""
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
