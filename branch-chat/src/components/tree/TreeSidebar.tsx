'use client';

import { PanelRightOpen, PanelRightClose, Eye, EyeOff } from 'lucide-react';
import TreeVisualization from './TreeVisualization';
import { useUI } from '@/hooks/useUI';
import type { TreeNode } from '@/types/tree';
import type { ChildrenMap } from '@/types/tree';

interface TreeSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  nodes: Map<string, TreeNode>;
  childrenMap: ChildrenMap;
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

export default function TreeSidebar({
  isOpen,
  onToggle,
  nodes,
  childrenMap,
  activeNodeId,
  onNodeClick,
}: TreeSidebarProps) {
  const { isMinimapVisible, toggleMinimap } = useUI();

  return (
    <div className="relative flex h-full">
      <button
        onClick={onToggle}
        className="absolute top-14 -left-10 z-10 flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={isOpen ? 'Close tree view' : 'Open tree view'}
      >
        {isOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="h-full w-80 border-l bg-card">
          <div className="flex h-10 items-center justify-between border-b px-3">
            <span className="text-sm font-medium">Tree View</span>
            <button
              onClick={toggleMinimap}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label={isMinimapVisible ? 'Hide minimap' : 'Show minimap'}
            >
              {isMinimapVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            <TreeVisualization
              nodes={nodes}
              childrenMap={childrenMap}
              activeNodeId={activeNodeId}
              onNodeClick={onNodeClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}
