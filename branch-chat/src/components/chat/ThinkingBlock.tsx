"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export default function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span className={isStreaming ? "animate-pulse" : ""}>
          Thinking...
        </span>
      </button>
      <div
        className={`transition-all duration-200 ${
          isExpanded ? "max-h-[60vh] overflow-y-auto opacity-100" : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="mt-1 border-l-2 border-muted pl-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}
