"use client";

import { useReducer, useMemo } from "react";
import { UIContext, UIState, UIAction } from "@/contexts/UIContext";

const initialState: UIState = {
  isLoading: false,
  isSidebarOpen: true,
  isTreeOpen: false,
  selectedProvider: "openai",
  selectedModel: "gpt-4o",
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "TOGGLE_SIDEBAR":
      return { ...state, isSidebarOpen: !state.isSidebarOpen };

    case "TOGGLE_TREE":
      return { ...state, isTreeOpen: !state.isTreeOpen };

    case "SET_SELECTED_MODEL":
      return {
        ...state,
        selectedProvider: action.payload.provider,
        selectedModel: action.payload.model,
      };

    default:
      return state;
  }
}

export default function UIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}
