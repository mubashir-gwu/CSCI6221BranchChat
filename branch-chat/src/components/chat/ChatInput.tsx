"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon } from "lucide-react";
import ModelSelector from "./ModelSelector";

interface ChatInputProps {
  onSend: (content: string, provider: string, model: string) => void;
  disabled: boolean;
  defaultProvider: string;
  defaultModel: string;
  availableProviders: string[];
}

export default function ChatInput({
  onSend,
  disabled,
  defaultProvider,
  defaultModel,
  availableProviders,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState({
    provider: defaultProvider,
    model: defaultModel,
  });

  useEffect(() => {
    setSelection({ provider: defaultProvider, model: defaultModel });
  }, [defaultProvider, defaultModel]);

  const isProviderUnavailable =
    !selection.provider || !availableProviders.includes(selection.provider);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled || isProviderUnavailable) return;
    onSend(trimmed, selection.provider, selection.model);
    setMessage("");
  }, [message, disabled, isProviderUnavailable, onSend, selection]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Type a message..."
          aria-label="Message input"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !message.trim() || isProviderUnavailable}
          aria-label="Send message"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2">
        <ModelSelector
          value={selection}
          onChange={setSelection}
          availableProviders={availableProviders}
        />
      </div>
    </div>
  );
}
