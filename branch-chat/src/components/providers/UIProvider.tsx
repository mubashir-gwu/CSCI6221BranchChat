"use client";

import { useReducer, useMemo, useEffect, useCallback, useRef } from "react";
import { UIContext, UIState, UIAction } from "@/contexts/UIContext";
import { MODELS } from "@/constants/models";

const initialState: UIState = {
  isLoading: false,
  isSidebarOpen: true,
  isTreeOpen: false,
  isMinimapVisible: true,
  selectedProvider: "openai",
  selectedModel: "gpt-4o",
  availableProviders: [],
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

    case "SET_AVAILABLE_PROVIDERS":
      return { ...state, availableProviders: action.payload };

    case "TOGGLE_MINIMAP":
      return { ...state, isMinimapVisible: !state.isMinimapVisible };

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

  const selectedProviderRef = useRef(state.selectedProvider);
  useEffect(() => {
    selectedProviderRef.current = state.selectedProvider;
  }, [state.selectedProvider]);

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (!res.ok) return;
      const data = await res.json();
      const providers: string[] = data.providers;
      dispatch({ type: "SET_AVAILABLE_PROVIDERS", payload: providers });

      // If current selected provider has no key, switch to first available
      if (providers.length > 0 && !providers.includes(selectedProviderRef.current)) {
        const firstProvider = providers[0] as keyof typeof MODELS;
        const firstModel = MODELS[firstProvider]?.[0];
        if (firstModel) {
          dispatch({
            type: "SET_SELECTED_MODEL",
            payload: { provider: firstProvider, model: firstModel.id },
          });
        }
      } else if (providers.length === 0) {
        dispatch({
          type: "SET_SELECTED_MODEL",
          payload: { provider: "", model: "" },
        });
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}
