"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConversation } from "@/hooks/useConversation";
import { useUI } from "@/hooks/useUI";
import { useActivePath } from "@/hooks/useActivePath";
import { buildChildrenMap } from "@/lib/tree";
import ChatPanel from "@/components/chat/ChatPanel";
import ChatInput from "@/components/chat/ChatInput";
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
        setAvailableProviders(data.keys.map((k: { provider: string }) => k.provider));
      } catch {
        // Silently fail
      }
    }
    fetchKeys();
  }, []);

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

  const defaultProvider =
    activeNode?.provider ?? conversation?.defaultProvider ?? uiState.selectedProvider;
  const defaultModel =
    activeNode?.model ?? conversation?.defaultModel ?? uiState.selectedModel;

  const handleSend = useCallback(
    async (content: string, provider: string, model: string) => {
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

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Failed to send message");
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
        toast.error("Network error. Please try again.");
      } finally {
        uiDispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [conversationId, state.activeNodeId, dispatch, uiDispatch]
  );

  const handleBranchNavigate = useCallback(
    (nodeId: string) => {
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      window.location.hash = nodeId;
    },
    [dispatch]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          activePath={activePath}
          childrenMap={childrenMap}
          onBranchNavigate={handleBranchNavigate}
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
