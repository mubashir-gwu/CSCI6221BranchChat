"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useConversation } from "@/hooks/useConversation";
import { useUI } from "@/hooks/useUI";
import { useActivePath } from "@/hooks/useActivePath";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { buildChildrenMap, findDeepestLeaf, findDescendants } from "@/lib/tree";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/chat/ChatPanel";
import ChatInput from "@/components/chat/ChatInput";
import TreeSidebar from "@/components/tree/TreeSidebar";
import { MODELS } from "@/constants/models";
import type { TreeNode } from "@/types/tree";
import type { NodeResponse } from "@/types/api";
import { fetchOrThrowOnBackendDown } from "@/lib/fetchClient";

function nodeResponseToTreeNode(n: NodeResponse): TreeNode {
  return {
    id: n.id,
    parentId: n.parentId,
    role: n.role,
    content: n.content,
    provider: n.provider,
    model: n.model,
    ...(n.thinkingContent ? { thinkingContent: n.thinkingContent } : {}),
    ...(n.citations?.length ? { citations: n.citations } : {}),
    ...(n.attachments?.length ? { attachments: n.attachments } : {}),
    createdAt: n.createdAt,
  };
}

export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const { state, dispatch } = useConversation();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const {
    sendStreamingMessage,
    streamingContent,
    streamingThinkingContent,
    streamingState,
    abortStream,
  } = useStreamingChat();
  const [restoredMessage, setRestoredMessage] = useState('');
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [hasLoadedNodes, setHasLoadedNodes] = useState(false);

  // Load nodes on mount
  useEffect(() => {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversationId });
    setHasLoadedNodes(false);

    async function loadNodes() {
      uiDispatch({ type: "SET_LOADING", payload: true });
      try {
        const res = await fetchOrThrowOnBackendDown(`/api/conversations/${conversationId}/nodes`);
        if (!res.ok) return;
        const data = await res.json();
        const nodesMap = new Map<string, TreeNode>();
        for (const n of data.nodes) {
          nodesMap.set(n.id, nodeResponseToTreeNode(n));
        }
        dispatch({ type: "SET_NODES", payload: nodesMap });

        // Set active node to deepest leaf
        if (nodesMap.size > 0) {
          // Check URL hash for previously active node
          const hashNodeId = window.location.hash.replace("#", "");
          if (hashNodeId && nodesMap.has(hashNodeId)) {
            dispatch({ type: "SET_ACTIVE_NODE", payload: hashNodeId });
            // Walk forward to next branch point or leaf for path display
            const cm = buildChildrenMap(nodesMap);
            let endId = hashNodeId;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const children = cm.get(endId) ?? [];
              if (children.length !== 1) break;
              endId = children[0];
            }
            if (endId !== hashNodeId) {
              setPathEndNodeId(endId);
            }
          } else {
            const childrenMap = buildChildrenMap(nodesMap);
            let leafId: string | null = null;
            // Find root (parentId === null)
            for (const [id, node] of nodesMap) {
              if (node.parentId === null) {
                leafId = id;
                break;
              }
            }
            // Walk to deepest first-child leaf
            if (leafId) {
              let currentId: string | null = leafId;
              while (currentId) {
                const childIds: string[] = childrenMap.get(currentId) ?? [];
                if (childIds.length === 0) break;
                currentId = childIds[0];
              }
              dispatch({ type: "SET_ACTIVE_NODE", payload: currentId });
              window.location.hash = currentId ?? "";
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "BackendUnavailableError") {
          setFatalError(err as Error);
          return;
        }
        toast.error("Failed to load conversation");
      } finally {
        uiDispatch({ type: "SET_LOADING", payload: false });
        setHasLoadedNodes(true);
      }
    }

    loadNodes();
  }, [conversationId, dispatch, uiDispatch]);

  const availableProviders = uiState.availableProviders;

  const childrenMap = useMemo(
    () => buildChildrenMap(state.nodes),
    [state.nodes]
  );

  const [pathEndNodeId, setPathEndNodeId] = useState<string | null>(null);
  const activePath = useActivePath(pathEndNodeId ?? state.activeNodeId, state.nodes);

  // Determine default provider/model from the last assistant message in the path
  const lastProviderNode = (() => {
    for (let i = activePath.length - 1; i >= 0; i--) {
      if (activePath[i].provider) return activePath[i];
    }
    return null;
  })();
  const conversation = state.conversations.find((c) => c.id === conversationId);

  const conversationProviderAvailable =
    conversation?.defaultProvider && availableProviders.includes(conversation.defaultProvider);
  const defaultProvider =
    lastProviderNode?.provider ??
    (conversationProviderAvailable ? conversation.defaultProvider : null) ??
    uiState.selectedProvider;
  const defaultModel =
    lastProviderNode?.model ??
    (conversationProviderAvailable ? conversation.defaultModel : null) ??
    uiState.selectedModel;

  const handleSend = useCallback(
    async (content: string, provider: string, model: string, attachments?: { filename: string; mimeType: string; data: string; size: number }[]) => {
      // New messages attach at the end of the displayed path, not the highlighted node
      const sendParentId = pathEndNodeId ?? state.activeNodeId;
      setRestoredMessage('');
      setPreviousActiveNodeId(null);
      setPathEndNodeId(null);
      setTreeHighlightNodeId(null);
      const tempId = `temp-${Date.now()}`;
      const optimisticNode: TreeNode = {
        id: tempId,
        parentId: sendParentId,
        role: "user",
        content,
        provider: null,
        model: null,
        ...(attachments?.length ? { attachments } : {}),
        createdAt: new Date().toISOString(),
      };

      // Show user message immediately
      dispatch({ type: "ADD_NODES", payload: [optimisticNode] });
      dispatch({ type: "SET_ACTIVE_NODE", payload: tempId });

      const retry = () => handleSend(content, provider, model, attachments);

      const result = await sendStreamingMessage({
        conversationId,
        parentNodeId: sendParentId,
        content,
        provider,
        model,
        ...(attachments?.length ? { attachments } : {}),
        thinkingEnabled: uiState.thinkingEnabled,
        webSearchEnabled: uiState.webSearchEnabled,
        // Apply node updates synchronously with streamingState -> 'idle'
        // so React batches them and the streaming bubble hands off to the
        // final assistant message without an intermediate blank frame.
        onDone: (data) => {
          const userNode = nodeResponseToTreeNode(data.userNode);
          const assistantNode = nodeResponseToTreeNode(data.assistantNode);
          dispatch({ type: "REMOVE_NODES", payload: [tempId] });
          dispatch({ type: "ADD_NODES", payload: [userNode, assistantNode] });
          dispatch({ type: "SET_ACTIVE_NODE", payload: assistantNode.id });
          window.location.hash = assistantNode.id;
          uiDispatch({
            type: "SET_SELECTED_MODEL",
            payload: { provider, model },
          });
        },
        onTitle: (title) => {
          dispatch({
            type: "UPDATE_CONVERSATION",
            payload: {
              id: conversationId,
              title,
              updatedAt: new Date().toISOString(),
            },
          });
        },
      });

      if (result.type !== 'done') {
        // Error or abort — remove the optimistic node and restore the prompt
        dispatch({ type: "REMOVE_NODES", payload: [tempId] });
        dispatch({ type: "SET_ACTIVE_NODE", payload: sendParentId });
        setRestoredMessage(content);

        if (result.type === 'error') {
          const errorMsg = result.message;
          if (result.code === 'BACKEND_UNAVAILABLE') {
            toast.error("Backend services are unavailable. Please try again in a moment.", {
              action: { label: "Retry", onClick: retry },
            });
          } else if (errorMsg.includes("not configured")) {
            toast.error(`Provider ${provider} is not available.`);
          } else if (errorMsg.includes("Rate limited")) {
            toast.error(errorMsg, {
              action: { label: "Retry", onClick: retry },
            });
          } else if (errorMsg.toLowerCase().includes("invalid api key")) {
            toast.error(`Invalid API key for ${provider}. Contact your administrator.`);
          } else {
            toast.error(errorMsg, {
              action: { label: "Retry", onClick: retry },
            });
          }
        }
      }
    },
    [conversationId, state.activeNodeId, pathEndNodeId, dispatch, uiDispatch, sendStreamingMessage, uiState.thinkingEnabled, uiState.webSearchEnabled]
  );

  const handleBranchNavigate = useCallback(
    (nodeId: string) => {
      // Walk forward to next branch point or leaf, same as tree click
      let endId = nodeId;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const children = childrenMap.get(endId) ?? [];
        if (children.length !== 1) break;
        endId = children[0];
      }
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
      setPathEndNodeId(endId !== nodeId ? endId : null);
      setScrollToNodeId(nodeId);
      setTreeHighlightNodeId(nodeId);
    },
    [childrenMap, dispatch]
  );

  const [scrollToNodeId, setScrollToNodeId] = useState<string | null>(null);
  const [treeHighlightNodeId, setTreeHighlightNodeId] = useState<string | null>(null);

  const handleVisibleNodeChange = useCallback((nodeId: string) => {
    setTreeHighlightNodeId(nodeId);
  }, []);

  const handleTreeNodeClick = useCallback(
    (nodeId: string) => {
      // Walk forward from the clicked node following first children
      // until we hit a branch point (>1 children) or a leaf
      let endId = nodeId;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const children = childrenMap.get(endId) ?? [];
        if (children.length !== 1) break;
        endId = children[0];
      }
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
      setPathEndNodeId(endId !== nodeId ? endId : null);
      setScrollToNodeId(nodeId);
      setTreeHighlightNodeId(nodeId);
    },
    [dispatch, childrenMap]
  );

  const handleScrollComplete = useCallback(() => {
    setScrollToNodeId(null);
  }, []);

  const [previousActiveNodeId, setPreviousActiveNodeId] = useState<string | null>(null);

  const handleBranchFromHere = useCallback(
    (nodeId: string) => {
      setPreviousActiveNodeId(state.activeNodeId);
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
      setPathEndNodeId(null);
      setTreeHighlightNodeId(null);
    },
    [state.activeNodeId, dispatch]
  );

  const handleGoBack = useCallback(() => {
    if (previousActiveNodeId) {
      // Walk forward to next branch point or leaf
      let endId = previousActiveNodeId;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const children = childrenMap.get(endId) ?? [];
        if (children.length !== 1) break;
        endId = children[0];
      }
      dispatch({ type: "SET_ACTIVE_NODE", payload: previousActiveNodeId });
      window.location.hash = previousActiveNodeId;
      setPreviousActiveNodeId(null);
      setPathEndNodeId(endId !== previousActiveNodeId ? endId : null);
      setScrollToNodeId(previousActiveNodeId);
      setTreeHighlightNodeId(previousActiveNodeId);
    }
  }, [previousActiveNodeId, childrenMap, dispatch]);

  const handleToggleTree = useCallback(() => {
    uiDispatch({ type: "TOGGLE_TREE" });
  }, [uiDispatch]);

  const handleExport = useCallback(async (fromNodeId: string | null = null) => {
    try {
      const fetchUrl = fromNodeId
        ? `/api/conversations/${conversationId}/export?fromNodeId=${encodeURIComponent(fromNodeId)}`
        : `/api/conversations/${conversationId}/export`;
      const res = await fetchOrThrowOnBackendDown(fetchUrl);
      if (!res.ok) {
        toast.error("Failed to export conversation");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] ?? "conversation.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if ((err as Error)?.name === "BackendUnavailableError") {
        setFatalError(err as Error);
        return;
      }
      toast.error("Network error. Please try again.");
    }
  }, [conversationId]);

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        const res = await fetchOrThrowOnBackendDown(
          `/api/conversations/${conversationId}/nodes/${nodeId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to delete");
          return;
        }
        const data = await res.json();
        const deletedIds = [nodeId];
        // Also remove descendants from state
        const descendants = findDescendants(nodeId, childrenMap);
        deletedIds.push(...descendants);
        dispatch({ type: "REMOVE_NODES", payload: deletedIds });

        setPathEndNodeId(null);
        setTreeHighlightNodeId(null);

        // Navigate to parent or clear if root was deleted
        if (data.newActiveNodeId) {
          dispatch({ type: "SET_ACTIVE_NODE", payload: data.newActiveNodeId });
          window.location.hash = data.newActiveNodeId;
        } else {
          dispatch({ type: "SET_ACTIVE_NODE", payload: null });
          window.location.hash = "";
        }
      } catch (err) {
        if ((err as Error)?.name === "BackendUnavailableError") {
          setFatalError(err as Error);
          return;
        }
        toast.error("Network error. Please try again.");
      }
    },
    [conversationId, childrenMap, dispatch]
  );

  const isStreaming = streamingState === 'streaming';

  const handleModelChange = useCallback((provider: string, model: string) => {
    uiDispatch({ type: "SET_SELECTED_MODEL", payload: { provider, model } });
  }, [uiDispatch]);

  const selectedModelConfig = MODELS[uiState.selectedProvider as keyof typeof MODELS]?.find(
    (m) => m.id === uiState.selectedModel
  );
  const thinkingDisabled = !selectedModelConfig?.supportsThinking;

  if (fatalError) throw fatalError;

  const chatInputElement = (
    <ChatInput
      onSend={handleSend}
      disabled={uiState.isLoading || isStreaming}
      defaultProvider={defaultProvider}
      defaultModel={defaultModel}
      availableProviders={availableProviders}
      streamingState={streamingState}
      onStopStreaming={abortStream}
      restoredMessage={restoredMessage}
      thinkingEnabled={uiState.thinkingEnabled}
      onThinkingToggle={() => uiDispatch({ type: "TOGGLE_THINKING" })}
      thinkingDisabled={thinkingDisabled}
      selectedModel={selectedModelConfig?.name}
      onModelChange={handleModelChange}
      webSearchEnabled={uiState.webSearchEnabled}
      onWebSearchToggle={() => uiDispatch({ type: "TOGGLE_WEB_SEARCH" })}
    />
  );

  const chatPanelElement = (
    <ChatPanel
      activePath={activePath}
      childrenMap={childrenMap}
      nodesMap={state.nodes}
      onBranchNavigate={handleBranchNavigate}
      onNavigateToNode={handleBranchFromHere}
      onBranchFromHere={handleBranchFromHere}
      onGoBack={previousActiveNodeId ? handleGoBack : undefined}
      onDeleteNode={handleDeleteNode}
      onExport={handleExport}
      isLoading={uiState.isLoading}
      streamingContent={streamingContent}
      streamingThinkingContent={streamingThinkingContent}
      streamingState={streamingState}
      scrollToNodeId={scrollToNodeId}
      onScrollComplete={handleScrollComplete}
      onVisibleNodeChange={handleVisibleNodeChange}
    />
  );

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-11 items-center justify-between border-b px-4">
          <h2 className="text-sm font-semibold truncate">
            {conversation?.title ?? "Chat"}
          </h2>
          <Button size="sm" variant="outline" onClick={() => handleExport()}>
            Export
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {hasLoadedNodes ? chatPanelElement : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        {hasLoadedNodes && chatInputElement}
      </div>
      <TreeSidebar
        isOpen={uiState.isTreeOpen}
        onToggle={handleToggleTree}
        nodes={state.nodes}
        childrenMap={childrenMap}
        activeNodeId={treeHighlightNodeId ?? state.activeNodeId}
        onNodeClick={handleTreeNodeClick}
      />
    </div>
  );
}
