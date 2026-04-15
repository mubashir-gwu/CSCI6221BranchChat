"use client";

import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

interface ThinkingToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
  modelName?: string;
}

export default function ThinkingToggle({
  enabled,
  onToggle,
  disabled,
  modelName,
}: ThinkingToggleProps) {
  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={`gap-1.5 ${
          disabled
            ? "opacity-50 pointer-events-none"
            : enabled
              ? "bg-primary/10 dark:bg-primary/20 text-primary"
              : ""
        }`}
        aria-label={enabled ? "Disable thinking" : "Enable thinking"}
      >
        <Brain className="h-4 w-4" />
        <span className="hidden md:inline text-xs">Thinking</span>
      </Button>
      {disabled && modelName && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs rounded bg-popover border shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Not available for {modelName}
        </div>
      )}
    </div>
  );
}
