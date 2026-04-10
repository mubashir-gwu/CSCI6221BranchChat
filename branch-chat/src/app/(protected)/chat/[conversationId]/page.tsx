"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConversation } from "@/hooks/useConversation";
import { useUI } from "@/hooks/useUI";
import { useActivePath } from "@/hooks/useActivePath";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { buildChildrenMap, findDeepestLeaf, findDescendants } from "@/lib/tree";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/chat/ChatPanel";
import ChatInput from "@/components/chat/ChatInput";
import TreeSidebar from "@/components/tree/TreeSidebar";
import type { TreeNode } from "@/types/tree";
import type { NodeResponse } from "@/types/api";

function nodeResponseToTreeNode(n: NodeResponse): TreeNode {
  return {
    id: n.id,
    parentId: n.parentId,
    role: n.role,
    content: n.content,
    provider: n.provider,
    model: n.model,
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
    streamingState,
    abortStream,
  } = useStreamingChat();
  const [restoredMessage, setRestoredMessage] = useState('');

  // Load nodes on mount
  useEffect(() => {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversationId });

    async function loadNodes() {
      uiDispatch({ type: "SET_LOADING", payload: true });
      try {
        const res = await fetch(`/api/conversations/${conversationId}/nodes`);
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
      } catch {
        toast.error("Failed to load conversation");
      } finally {
        uiDispatch({ type: "SET_LOADING", payload: false });
      }
    }

    loadNodes();
  }, [conversationId, dispatch, uiDispatch]);

  const availableProviders = uiState.availableProviders;

  const childrenMap = useMemo(
    () => buildChildrenMap(state.nodes),
    [state.nodes]
  );

  const activePath = useActivePath(state.activeNodeId, state.nodes);

  // Determine default provider/model from active node or conversation defaults
  const activeNode = state.activeNodeId
    ? state.nodes.get(state.activeNodeId)
    : null;
  const conversation = state.conversations.find((c) => c.id === conversationId);

  const conversationProviderAvailable =
    conversation?.defaultProvider && availableProviders.includes(conversation.defaultProvider);
  const defaultProvider =
    activeNode?.provider ??
    (conversationProviderAvailable ? conversation.defaultProvider : null) ??
    uiState.selectedProvider;
  const defaultModel =
    activeNode?.model ??
    (conversationProviderAvailable ? conversation.defaultModel : null) ??
    uiState.selectedModel;

  const handleSend = useCallback(
    async (content: string, provider: string, model: string, attachments?: { filename: string; mimeType: string; data: string; size: number }[]) => {
      setRestoredMessage('');
      setPreviousActiveNodeId(null);
      const tempId = `temp-${Date.now()}`;
      const optimisticNode: TreeNode = {
        id: tempId,
        parentId: state.activeNodeId,
        role: "user",
        content,
        provider: null,
        model: null,
        createdAt: new Date().toISOString(),
      };

      // Show user message immediately
      dispatch({ type: "ADD_NODES", payload: [optimisticNode] });
      dispatch({ type: "SET_ACTIVE_NODE", payload: tempId });

      const retry = () => handleSend(content, provider, model, attachments);

      const result = await sendStreamingMessage({
        conversationId,
        parentNodeId: state.activeNodeId,
        content,
        provider,
        model,
        ...(attachments?.length ? { attachments } : {}),
      });

      // Remove optimistic node
      dispatch({ type: "REMOVE_NODES", payload: [tempId] });

      if (result.type !== 'done') {
        // Error or abort — restore the prompt so user can edit and resend
        dispatch({ type: "SET_ACTIVE_NODE", payload: state.activeNodeId });
        setRestoredMessage(content);

        if (result.type === 'error') {
          const errorMsg = result.message;
          if (errorMsg.includes("not configured")) {
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
        return;
      }

      const userNode = nodeResponseToTreeNode(result.data.userNode);
      const assistantNode = nodeResponseToTreeNode(result.data.assistantNode);

      dispatch({ type: "ADD_NODES", payload: [userNode, assistantNode] });
      dispatch({ type: "SET_ACTIVE_NODE", payload: assistantNode.id });
      window.location.hash = assistantNode.id;

      // Update selected model to match what was just used
      uiDispatch({
        type: "SET_SELECTED_MODEL",
        payload: { provider, model },
      });

      // Update sidebar title if auto-title was generated
      if (result.data.generatedTitle) {
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: {
            id: conversationId,
            title: result.data.generatedTitle,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    },
    [conversationId, state.activeNodeId, dispatch, uiDispatch, sendStreamingMessage]
  );

  const handleBranchNavigate = useCallback(
    (nodeId: string) => {
      const leafId = findDeepestLeaf(nodeId, childrenMap);
      dispatch({ type: "SET_ACTIVE_NODE", payload: leafId });
      window.location.hash = leafId;
    },
    [childrenMap, dispatch]
  );

  const handleTreeNodeClick = useCallback(
    (nodeId: string) => {
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
    },
    [dispatch]
  );

  const [previousActiveNodeId, setPreviousActiveNodeId] = useState<string | null>(null);

  const handleBranchFromHere = useCallback(
    (nodeId: string) => {
      setPreviousActiveNodeId(state.activeNodeId);
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
    },
    [state.activeNodeId, dispatch]
  );

  const handleGoBack = useCallback(() => {
    if (previousActiveNodeId) {
      dispatch({ type: "SET_ACTIVE_NODE", payload: previousActiveNodeId });
      window.location.hash = previousActiveNodeId;
      setPreviousActiveNodeId(null);
    }
  }, [previousActiveNodeId, dispatch]);

  const handleToggleTree = useCallback(() => {
    uiDispatch({ type: "TOGGLE_TREE" });
  }, [uiDispatch]);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/export`);
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
    } catch {
      toast.error("Network error. Please try again.");
    }
  }, [conversationId]);

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        const res = await fetch(
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

        // Navigate to parent or clear if root was deleted
        if (data.newActiveNodeId) {
          dispatch({ type: "SET_ACTIVE_NODE", payload: data.newActiveNodeId });
          window.location.hash = data.newActiveNodeId;
        } else {
          dispatch({ type: "SET_ACTIVE_NODE", payload: null });
          window.location.hash = "";
        }
      } catch {
        toast.error("Network error. Please try again.");
      }
    },
    [conversationId, childrenMap, dispatch]
  );

  const isStreaming = streamingState === 'streaming';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-sm font-semibold truncate">
            {conversation?.title ?? "Chat"}
          </h2>
          <Button size="sm" variant="outline" onClick={handleExport}>
            Export
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            activePath={activePath}
            childrenMap={childrenMap}
            nodesMap={state.nodes}
            onBranchNavigate={handleBranchNavigate}
            onNavigateToNode={handleBranchFromHere}
            onBranchFromHere={handleBranchFromHere}
            onGoBack={previousActiveNodeId ? handleGoBack : undefined}
            onDeleteNode={handleDeleteNode}
            isLoading={uiState.isLoading}
            streamingContent={streamingContent}
            streamingState={streamingState}
          />
        </div>
        <ChatInput
          onSend={handleSend}
          disabled={uiState.isLoading || isStreaming}
          defaultProvider={defaultProvider}
          defaultModel={defaultModel}
          availableProviders={availableProviders}
          streamingState={streamingState}
          onStopStreaming={abortStream}
          restoredMessage={restoredMessage}
        />
      </div>
      <TreeSidebar
        isOpen={uiState.isTreeOpen}
        onToggle={handleToggleTree}
        nodes={state.nodes}
        childrenMap={childrenMap}
        activeNodeId={state.activeNodeId}
        onNodeClick={handleTreeNodeClick}
      />
    </div>
  );
}
