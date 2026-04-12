"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessage from "./ChatMessage";
import ThinkingBlock from "./ThinkingBlock";
import LoadingIndicator from "./LoadingIndicator";
import type { TreeNode, ChildrenMap } from "@/types/tree";
import type { StreamingState } from "@/hooks/useStreamingChat";

interface ChatPanelProps {
  activePath: TreeNode[];
  childrenMap: ChildrenMap;
  nodesMap: Map<string, TreeNode>;
  onBranchNavigate: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
  onBranchFromHere?: (nodeId: string) => void;
  onGoBack?: () => void;
  onDeleteNode?: (nodeId: string) => void;
  isLoading: boolean;
  streamingContent?: string;
  streamingThinkingContent?: string;
  streamingState?: StreamingState;
}

export default function ChatPanel({
  activePath,
  childrenMap,
  nodesMap,
  onBranchNavigate,
  onNavigateToNode,
  onBranchFromHere,
  onGoBack,
  onDeleteNode,
  isLoading,
  streamingContent,
  streamingThinkingContent,
  streamingState,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = streamingState === 'streaming';

  // Auto-scroll to bottom on new messages, loading state change, or streaming content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePath.length, isLoading, streamingContent]);

  if (activePath.length === 0 && !isLoading && !isStreaming) {
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
              isLast={index === activePath.length - 1}
              onBranchClick={onBranchNavigate}
              onNavigateToNode={onNavigateToNode}
              onBranchFromHere={onBranchFromHere}
              onGoBack={onGoBack}
              onDelete={onDeleteNode}
            />
          );
        })}
        {isStreaming && (streamingContent || streamingThinkingContent) ? (
          <div className="flex justify-start mb-4">
            <div className="relative max-w-[80%] rounded-lg px-4 py-3 bg-muted border-l-4 border-l-muted-foreground/30">
              {streamingThinkingContent && (
                <ThinkingBlock content={streamingThinkingContent} isStreaming={!streamingContent} />
              )}
              {streamingContent && (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/70 animate-pulse" />
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : isStreaming ? (
          <LoadingIndicator />
        ) : null}
        {isLoading && !isStreaming && <LoadingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
