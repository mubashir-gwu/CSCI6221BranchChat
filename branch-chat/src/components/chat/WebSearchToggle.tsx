"use client";

import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

interface WebSearchToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export default function WebSearchToggle({
  enabled,
  onToggle,
}: WebSearchToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={`gap-1.5 ${
        enabled ? "bg-primary/10 dark:bg-primary/20 text-primary" : ""
      }`}
      aria-label={enabled ? "Disable web search" : "Enable web search"}
    >
      <Globe className="h-4 w-4" />
      <span className="hidden md:inline text-xs">Search</span>
    </Button>
  );
}
