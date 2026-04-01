"use client";

export default function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="rounded-lg bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
