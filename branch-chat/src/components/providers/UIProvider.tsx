"use client";

import { useReducer, useMemo, useEffect, useCallback, useRef, useState } from "react";
import { UIContext, UIState, UIAction } from "@/contexts/UIContext";
import { MODELS } from "@/constants/models";
import { fetchOrThrowOnBackendDown } from "@/lib/fetchClient";
import BackendStatusGate from "@/components/common/BackendStatusGate";

const initialState: UIState = {
  isLoading: false,
  isSidebarOpen: true,
  isTreeOpen: false,
  isMinimapVisible: false,
  selectedProvider: "openai",
  selectedModel: "gpt-4o",
  availableProviders: [],
  thinkingEnabled: false,
  webSearchEnabled: true,
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

    case "TOGGLE_THINKING":
      return { ...state, thinkingEnabled: !state.thinkingEnabled };

    case "SET_THINKING_ENABLED":
      return { ...state, thinkingEnabled: action.payload };

    case "TOGGLE_WEB_SEARCH":
      return { ...state, webSearchEnabled: !state.webSearchEnabled };

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

  const [backendDown, setBackendDown] = useState(false);

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetchOrThrowOnBackendDown("/api/providers");
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
    } catch (err) {
      if ((err as Error)?.name === "BackendUnavailableError") {
        setBackendDown(true);
        return;
      }
      // Silently fail
    }
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  // Auto-disable thinking when switching to a model that doesn't support it
  const selectedModelRef = useRef(state.selectedModel);
  useEffect(() => {
    selectedModelRef.current = state.selectedModel;
  }, [state.selectedModel]);

  useEffect(() => {
    const provider = state.selectedProvider as keyof typeof MODELS;
    const modelConfig = MODELS[provider]?.find((m) => m.id === state.selectedModel);
    if (modelConfig && !modelConfig.supportsThinking) {
      dispatch({ type: "SET_THINKING_ENABLED", payload: false });
    }
  }, [state.selectedModel, state.selectedProvider]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  const handleRecover = useCallback(() => {
    setBackendDown(false);
    refreshProviders();
  }, [refreshProviders]);

  if (backendDown) {
    return <BackendStatusGate onRecover={handleRecover} />;
  }

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}
