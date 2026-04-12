"use client";

import { createContext, Dispatch } from "react";

export interface UIState {
  isLoading: boolean;
  isSidebarOpen: boolean;
  isTreeOpen: boolean;
  isMinimapVisible: boolean;
  selectedProvider: string;
  selectedModel: string;
  availableProviders: string[];
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
}

export type UIAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_TREE" }
  | { type: "SET_SELECTED_MODEL"; payload: { provider: string; model: string } }
  | { type: "SET_AVAILABLE_PROVIDERS"; payload: string[] }
  | { type: "TOGGLE_MINIMAP" }
  | { type: "TOGGLE_THINKING" }
  | { type: "SET_THINKING_ENABLED"; payload: boolean }
  | { type: "TOGGLE_WEB_SEARCH" };

export interface UIContextValue {
  state: UIState;
  dispatch: Dispatch<UIAction>;
}

export const UIContext = createContext<UIContextValue | null>(null);
