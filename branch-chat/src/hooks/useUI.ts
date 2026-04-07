"use client";

import { useContext, useCallback } from "react";
import { UIContext } from "@/contexts/UIContext";

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within UIProvider");
  }

  const toggleMinimap = useCallback(() => {
    context.dispatch({ type: "TOGGLE_MINIMAP" });
  }, [context.dispatch]);

  return {
    ...context,
    isMinimapVisible: context.state.isMinimapVisible,
    toggleMinimap,
  };
}
