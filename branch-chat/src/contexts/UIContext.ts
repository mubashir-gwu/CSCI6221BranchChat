"use client";

import { createContext, Dispatch } from "react";

export interface UIState {
  isLoading: boolean;
  isSidebarOpen: boolean;
  isTreeOpen: boolean;
  selectedProvider: string;
  selectedModel: string;
}

export type UIAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_TREE" }
  | { type: "SET_SELECTED_MODEL"; payload: { provider: string; model: string } };

export interface UIContextValue {
  state: UIState;
  dispatch: Dispatch<UIAction>;
}

export const UIContext = createContext<UIContextValue | null>(null);
