"use client";

import { useMemo } from "react";
import { getPathToRoot } from "@/lib/tree";
import type { TreeNode } from "@/types/tree";

export function useActivePath(
  activeNodeId: string | null,
  nodesMap: Map<string, TreeNode>
): TreeNode[] {
  return useMemo(() => {
    if (!activeNodeId || nodesMap.size === 0) return [];
    try {
      return getPathToRoot(activeNodeId, nodesMap);
    } catch {
      return [];
    }
  }, [activeNodeId, nodesMap]);
}
