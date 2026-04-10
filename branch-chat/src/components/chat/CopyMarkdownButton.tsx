"use client";

import { useState } from "react";
import { ClipboardCopy, Check } from "lucide-react";

interface CopyMarkdownButtonProps {
  content: string;
}

export default function CopyMarkdownButton({ content }: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      aria-label={copied ? "Copied" : "Copy markdown"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <ClipboardCopy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
