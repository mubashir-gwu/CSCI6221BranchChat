"use client";

interface CitationListProps {
  citations: { url: string; title: string }[];
}

export default function CitationList({ citations }: CitationListProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="border-t border-border mt-3 pt-2">
      <div className="flex flex-col gap-1">
        {citations.map((citation, index) => (
          <a
            key={`${citation.url}-${index}`}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            [{index + 1}] {citation.title}
          </a>
        ))}
      </div>
    </div>
  );
}
