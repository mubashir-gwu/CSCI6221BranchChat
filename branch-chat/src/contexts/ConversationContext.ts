"use client";

import { createContext, Dispatch } from "react";
import type { ConversationResponse } from "@/types/api";
import type { TreeNode } from "@/types/tree";

export interface ConversationState {
  conversations: ConversationResponse[];
  activeConversationId: string | null;
  nodes: Map<string, TreeNode>;
  activeNodeId: string | null;
}

export type ConversationAction =
  | { type: "SET_CONVERSATIONS"; payload: ConversationResponse[] }
  | { type: "ADD_CONVERSATION"; payload: ConversationResponse }
  | { type: "UPDATE_CONVERSATION"; payload: { id: string; title: string; updatedAt: string } }
  | { type: "REMOVE_CONVERSATION"; payload: string }
  | { type: "SET_NODES"; payload: Map<string, TreeNode> }
  | { type: "ADD_NODES"; payload: TreeNode[] }
  | { type: "REMOVE_NODES"; payload: string[] }
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string | null }
  | { type: "SET_ACTIVE_NODE"; payload: string | null };

export interface ConversationContextValue {
  state: ConversationState;
  dispatch: Dispatch<ConversationAction>;
}

export const ConversationContext = createContext<ConversationContextValue | null>(null);
