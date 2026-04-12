"use client";

import { useEffect, useRef, useCallback } from "react";
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
  scrollToNodeId?: string | null;
  onScrollComplete?: () => void;
  onVisibleNodeChange?: (nodeId: string) => void;
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
  scrollToNodeId,
  onScrollComplete,
  onVisibleNodeChange,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const skipAutoScrollRef = useRef(false);
  const isStreaming = streamingState === 'streaming';

  const setMessageRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) {
      messageRefs.current.set(nodeId, el);
    } else {
      messageRefs.current.delete(nodeId);
    }
  }, []);

  // Scroll to a specific node when requested from tree view click
  useEffect(() => {
    if (!scrollToNodeId) return;
    const el = messageRefs.current.get(scrollToNodeId);
    if (el) {
      skipAutoScrollRef.current = true;
      // Find the scroll viewport and scroll with an offset for visual breathing room
      const viewport = el.closest('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        const viewportRect = viewport.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - viewportRect.top + viewport.scrollTop - 16;
        viewport.scrollTo({ top: offset, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    onScrollComplete?.();
  }, [scrollToNodeId, activePath, onScrollComplete]);

  // Auto-scroll to bottom on new messages, loading state change, or streaming content
  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePath.length, isLoading, streamingContent]);

  // Track which message is at the top of the viewport and report to parent
  useEffect(() => {
    if (!onVisibleNodeChange) return;
    // Find viewport relative to a known child element, not via global query
    const viewport = bottomRef.current?.closest('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const viewportTop = viewport.getBoundingClientRect().top;
        let closestId: string | null = null;
        let closestDist = Infinity;

        for (const [nodeId, el] of messageRefs.current) {
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(rect.top - viewportTop);
          if (dist < closestDist) {
            closestDist = dist;
            closestId = nodeId;
          }
        }

        if (closestId) {
          onVisibleNodeChange(closestId);
        }
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [onVisibleNodeChange, activePath]);

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
            <div key={node.id} ref={(el) => setMessageRef(node.id, el)}>
            <ChatMessage
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
            </div>
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
