"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConversation } from "@/hooks/useConversation";
import { useUI } from "@/hooks/useUI";
import { useActivePath } from "@/hooks/useActivePath";
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
    createdAt: n.createdAt,
  };
}

export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const { state, dispatch } = useConversation();
  const { state: uiState, dispatch: uiDispatch } = useUI();

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
    async (content: string, provider: string, model: string) => {
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
      uiDispatch({ type: "SET_LOADING", payload: true });

      const retry = () => handleSend(content, provider, model);

      try {
        const res = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            parentNodeId: state.activeNodeId,
            content,
            provider,
            model,
          }),
        });

        // Remove optimistic node before adding real ones
        dispatch({ type: "REMOVE_NODES", payload: [tempId] });

        if (!res.ok) {
          dispatch({ type: "SET_ACTIVE_NODE", payload: state.activeNodeId });

          const status = res.status;
          let errorMsg: string;
          let showRetry = false;

          if (status === 422) {
            errorMsg = `Provider ${provider} is not available.`;
            toast.error(errorMsg);
            return;
          } else if (status === 429) {
            errorMsg = `Rate limited by ${provider}. Please try again in a moment.`;
            showRetry = true;
          } else if (status === 502) {
            const data = await res.json().catch(() => null);
            const serverMsg = data?.error ?? "";
            errorMsg = serverMsg.toLowerCase().includes("invalid api key")
              ? `Invalid API key for ${provider}. Contact your administrator.`
              : `${provider} API error. Please try again.`;
          } else if (status === 504) {
            errorMsg = "Request timed out. The model took too long to respond.";
            showRetry = true;
          } else {
            const data = await res.json().catch(() => null);
            errorMsg = data?.error || "Failed to send message";
          }

          if (showRetry) {
            toast.error(errorMsg, {
              action: { label: "Retry", onClick: retry },
            });
          } else {
            toast.error(errorMsg);
          }
          return;
        }

        const data = await res.json();
        const userNode = nodeResponseToTreeNode(data.userNode);
        const assistantNode = nodeResponseToTreeNode(data.assistantNode);

        dispatch({ type: "ADD_NODES", payload: [userNode, assistantNode] });
        dispatch({ type: "SET_ACTIVE_NODE", payload: assistantNode.id });
        window.location.hash = assistantNode.id;

        // Update selected model to match what was just used
        uiDispatch({
          type: "SET_SELECTED_MODEL",
          payload: { provider, model },
        });

        // After first message, re-fetch conversations to pick up auto-generated title
        if (state.activeNodeId === null) {
          fetch("/api/conversations")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.conversations) {
                dispatch({ type: "SET_CONVERSATIONS", payload: data.conversations });
              }
            })
            .catch(() => {});
        }
      } catch {
        dispatch({ type: "REMOVE_NODES", payload: [tempId] });
        dispatch({ type: "SET_ACTIVE_NODE", payload: state.activeNodeId });
        toast.error(
          "Network error. Please check your connection and try again.",
          { action: { label: "Retry", onClick: retry } }
        );
      } finally {
        uiDispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [conversationId, state.activeNodeId, dispatch, uiDispatch]
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
            onNavigateToNode={handleTreeNodeClick}
            onDeleteNode={handleDeleteNode}
            isLoading={uiState.isLoading}
          />
        </div>
        <ChatInput
          onSend={handleSend}
          disabled={uiState.isLoading}
          defaultProvider={defaultProvider}
          defaultModel={defaultModel}
          availableProviders={availableProviders}
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
