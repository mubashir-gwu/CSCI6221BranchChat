"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon, SquareIcon } from "lucide-react";
import ModelSelector from "./ModelSelector";
import FileUploadArea, { FilePreviewChips } from "./FileUploadArea";
import type { StreamingState } from "@/hooks/useStreamingChat";

interface AttachmentData {
  filename: string;
  mimeType: string;
  data: string;
  size: number;
}

interface ChatInputProps {
  onSend: (content: string, provider: string, model: string, attachments?: AttachmentData[]) => void;
  disabled: boolean;
  defaultProvider: string;
  defaultModel: string;
  availableProviders: string[];
  streamingState?: StreamingState;
  onStopStreaming?: () => void;
  restoredMessage?: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URI prefix: "data:...;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({
  onSend,
  disabled,
  defaultProvider,
  defaultModel,
  availableProviders,
  streamingState,
  onStopStreaming,
  restoredMessage,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selection, setSelection] = useState({
    provider: defaultProvider,
    model: defaultModel,
  });

  useEffect(() => {
    setSelection({ provider: defaultProvider, model: defaultModel });
  }, [defaultProvider, defaultModel]);

  useEffect(() => {
    if (restoredMessage) {
      setMessage(restoredMessage);
    }
  }, [restoredMessage]);

  const isStreaming = streamingState === 'streaming';
  const isDisabled = disabled || isStreaming;

  const isProviderUnavailable =
    !selection.provider || !availableProviders.includes(selection.provider);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isDisabled || isProviderUnavailable) return;

    let attachments: AttachmentData[] | undefined;
    if (files.length > 0) {
      attachments = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          mimeType: file.type || 'text/plain',
          data: await readFileAsBase64(file),
          size: file.size,
        }))
      );
    }

    onSend(trimmed, selection.provider, selection.model, attachments);
    setMessage("");
    setFiles([]);
  }, [message, files, isDisabled, isProviderUnavailable, onSend, selection]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-center gap-2">
        <FileUploadArea
          files={files}
          onFilesChange={setFiles}
          disabled={isDisabled}
        />
        <textarea
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Type a message..."
          aria-label="Message input"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
        />
        {isStreaming && onStopStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onStopStreaming}
            aria-label="Stop streaming"
          >
            <SquareIcon className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isDisabled || !message.trim() || isProviderUnavailable}
            aria-label="Send message"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      <FilePreviewChips
        files={files}
        onRemove={(index) => setFiles(files.filter((_, i) => i !== index))}
      />
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
