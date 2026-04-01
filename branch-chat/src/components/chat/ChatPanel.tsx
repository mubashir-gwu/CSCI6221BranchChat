"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessage from "./ChatMessage";
import LoadingIndicator from "./LoadingIndicator";
import type { TreeNode, ChildrenMap } from "@/types/tree";

interface ChatPanelProps {
  activePath: TreeNode[];
  childrenMap: ChildrenMap;
  onBranchNavigate: (nodeId: string) => void;
  isLoading: boolean;
}

export default function ChatPanel({
  activePath,
  childrenMap,
  onBranchNavigate,
  isLoading,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePath.length, isLoading]);

  if (activePath.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Send a message to start the conversation.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {activePath.map((node) => {
          const children = childrenMap.get(node.id) ?? [];
          return (
            <ChatMessage
              key={node.id}
              node={node}
              childCount={children.length}
              isActive={node.id === activePath[activePath.length - 1]?.id}
              onBranchClick={onBranchNavigate}
            />
          );
        })}
        {isLoading && <LoadingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
