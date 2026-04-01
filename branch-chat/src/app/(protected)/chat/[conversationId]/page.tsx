"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConversation } from "@/hooks/useConversation";
import { useUI } from "@/hooks/useUI";
import { useActivePath } from "@/hooks/useActivePath";
import { buildChildrenMap, findDeepestLeaf, findDescendants } from "@/lib/tree";
import ChatPanel from "@/components/chat/ChatPanel";
import ChatInput from "@/components/chat/ChatInput";
import { MODELS } from "@/constants/models";
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

  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

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

  // Fetch available providers (API keys)
  useEffect(() => {
    async function fetchKeys() {
      try {
        const res = await fetch("/api/settings/api-keys");
        if (!res.ok) return;
        const data = await res.json();
        const providers = data.keys.map((k: { provider: string }) => k.provider);
        setAvailableProviders(providers);

        // If current selected provider has no key, switch to first available
        if (providers.length > 0 && !providers.includes(uiState.selectedProvider)) {
          const firstProvider = providers[0] as keyof typeof MODELS;
          const firstModel = MODELS[firstProvider]?.[0];
          if (firstModel) {
            uiDispatch({
              type: "SET_SELECTED_MODEL",
              payload: { provider: firstProvider, model: firstModel.id },
            });
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchKeys();
  }, [uiState.selectedProvider, uiDispatch]);

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
          const data = await res.json();
          toast.error(data.error || "Failed to send message");
          // Restore active node to what it was before
          dispatch({ type: "SET_ACTIVE_NODE", payload: state.activeNodeId });
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
      } catch {
        dispatch({ type: "REMOVE_NODES", payload: [tempId] });
        dispatch({ type: "SET_ACTIVE_NODE", payload: state.activeNodeId });
        toast.error("Network error. Please try again.");
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
          const leafId = findDeepestLeaf(data.newActiveNodeId, childrenMap);
          dispatch({ type: "SET_ACTIVE_NODE", payload: leafId });
          window.location.hash = leafId;
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          activePath={activePath}
          childrenMap={childrenMap}
          nodesMap={state.nodes}
          onBranchNavigate={handleBranchNavigate}
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
  );
}
