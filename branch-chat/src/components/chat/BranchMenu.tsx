"use client";

import { PROVIDERS } from "@/constants/providers";
import type { TreeNode } from "@/types/tree";

interface BranchMenuProps {
  parentNodeId: string;
  children: TreeNode[];
  activeChildId: string | null;
  onSelect: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
}

export default function BranchMenu({
  parentNodeId,
  children,
  activeChildId,
  onSelect,
  onNavigateToNode,
}: BranchMenuProps) {
  return (
    <div className="rounded-lg border bg-popover p-2 shadow-md" role="menu" aria-label="Branch options">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Branches ({children.length})
      </p>
      <div className="flex flex-col gap-1">
        {children.map((child) => {
          const provider = child.provider
            ? PROVIDERS[child.provider as keyof typeof PROVIDERS]
            : null;
          const isActive = child.id === activeChildId;
          const preview =
            child.content.length > 60
              ? child.content.slice(0, 60) + "..."
              : child.content;

          return (
            <button
              key={child.id}
              role="menuitem"
              onClick={() => onSelect(child.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                isActive ? "bg-accent font-medium" : ""
              }`}
            >
              {provider && (
                <span
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: provider.color }}
                />
              )}
              <span className="line-clamp-2">{preview}</span>
            </button>
          );
        })}
      </div>
      {onNavigateToNode && (
        <>
          <div className="my-2 border-t" />
          <button
            role="menuitem"
            onClick={() => onNavigateToNode(parentNodeId)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            + New branch from here
          </button>
        </>
      )}
    </div>
  );
}
