"use client";

import { useRef, useCallback, useMemo, useEffect, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.md', '.csv'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
];

interface FileUploadAreaProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled: boolean;
}

function isAllowedFile(file: File): boolean {
  // Check MIME type
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  // Fallback: check extension for .md files detected as text/plain
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function getTotalSize(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

export default function FileUploadArea({ files, onFilesChange, disabled }: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = useCallback((newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    const currentCount = files.length;
    const currentSize = getTotalSize(files);

    const toAdd: File[] = [];

    for (const file of incoming) {
      if (currentCount + toAdd.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files per message`);
        break;
      }
      if (!isAllowedFile(file)) {
        toast.error(`File type not allowed: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name} (max 5MB)`);
        continue;
      }
      if (currentSize + getTotalSize(toAdd) + file.size > MAX_TOTAL_SIZE) {
        toast.error("Total attachment size exceeds 10MB");
        break;
      }
      toAdd.push(file);
    }

    if (toAdd.length > 0) {
      onFilesChange([...files, ...toAdd]);
    }
  }, [files, onFilesChange]);

  const handleFileSelect = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
      e.target.value = ''; // Reset so the same file can be re-selected
    }
  }, [validateAndAddFiles]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [disabled, validateAndAddFiles]);

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-label="File upload"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleFileSelect}
        disabled={disabled}
        aria-label="Attach files"
        className="h-8 w-8"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FilePreviewChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const blobUrlMap = useMemo(() => {
    const map = new Map<File, string>();
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        map.set(file, URL.createObjectURL(file));
      }
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of blobUrlMap.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [blobUrlMap]);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs"
        >
          {file.type.startsWith('image/') ? (
            <img
              src={blobUrlMap.get(file) ?? ''}
              alt={file.name}
              className="h-6 w-6 rounded object-cover"
            />
          ) : file.type === 'application/pdf' ? (
            <FileText className="h-4 w-4 text-red-500" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[120px] truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
