"use client";

import { useReducer, useEffect, useMemo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  ConversationContext,
  ConversationState,
  ConversationAction,
} from "@/contexts/ConversationContext";
import type { TreeNode } from "@/types/tree";
import { fetchOrThrowOnBackendDown } from "@/lib/fetchClient";
import BackendStatusGate from "@/components/common/BackendStatusGate";

const initialState: ConversationState = {
  conversations: [],
  activeConversationId: null,
  nodes: new Map(),
  activeNodeId: null,
};

function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };

    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
      };

    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title, updatedAt: action.payload.updatedAt }
            : c
        ),
      };

    case "REMOVE_CONVERSATION": {
      const newConversations = state.conversations.filter(
        (c) => c.id !== action.payload
      );
      const isActiveRemoved = state.activeConversationId === action.payload;
      return {
        ...state,
        conversations: newConversations,
        activeConversationId: isActiveRemoved ? null : state.activeConversationId,
        nodes: isActiveRemoved ? new Map() : state.nodes,
        activeNodeId: isActiveRemoved ? null : state.activeNodeId,
      };
    }

    case "SET_NODES":
      return { ...state, nodes: action.payload };

    case "ADD_NODES": {
      const newNodes = new Map(state.nodes);
      for (const node of action.payload) {
        newNodes.set(node.id, node);
      }
      return { ...state, nodes: newNodes };
    }

    case "REMOVE_NODES": {
      const newNodes = new Map(state.nodes);
      for (const id of action.payload) {
        newNodes.delete(id);
      }
      const activeRemoved = state.activeNodeId
        ? action.payload.includes(state.activeNodeId)
        : false;
      return {
        ...state,
        nodes: newNodes,
        activeNodeId: activeRemoved ? null : state.activeNodeId,
      };
    }

    case "SET_ACTIVE_CONVERSATION":
      return {
        ...state,
        activeConversationId: action.payload,
        nodes: new Map(),
        activeNodeId: null,
      };

    case "SET_ACTIVE_NODE":
      return { ...state, activeNodeId: action.payload };

    default:
      return state;
  }
}

export default function ConversationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  const [backendDown, setBackendDown] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchConversations() {
      try {
        const res = await fetchOrThrowOnBackendDown("/api/conversations");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          dispatch({ type: "SET_CONVERSATIONS", payload: data.conversations });
        }
        setHasLoaded(true);
      } catch (err) {
        if (cancelled) return;
        if ((err as Error)?.name === "BackendUnavailableError") {
          setBackendDown(true);
          return;
        }
        setHasLoaded(true);
      }
    }
    fetchConversations();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  const handleRecover = useCallback(() => {
    setBackendDown(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (backendDown) {
    return <BackendStatusGate onRecover={handleRecover} />;
  }

  if (!hasLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
