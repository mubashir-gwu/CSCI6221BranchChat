"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessage from "./ChatMessage";
import LoadingIndicator from "./LoadingIndicator";
import type { TreeNode, ChildrenMap } from "@/types/tree";

interface ChatPanelProps {
  activePath: TreeNode[];
  childrenMap: ChildrenMap;
  nodesMap: Map<string, TreeNode>;
  onBranchNavigate: (nodeId: string) => void;
  isLoading: boolean;
}

export default function ChatPanel({
  activePath,
  childrenMap,
  nodesMap,
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
        {activePath.map((node, index) => {
          const childIds = childrenMap.get(node.id) ?? [];
          const childNodes = childIds
            .map((id) => nodesMap.get(id))
            .filter((n): n is TreeNode => n !== undefined);
          const activeChildId =
            index < activePath.length - 1 ? activePath[index + 1].id : null;
          return (
            <ChatMessage
              key={node.id}
              node={node}
              childCount={childIds.length}
              childNodes={childNodes}
              activeChildId={activeChildId}
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
