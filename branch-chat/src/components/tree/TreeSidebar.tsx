'use client';

import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import TreeVisualization from './TreeVisualization';
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
  return (
    <div className="relative flex h-full">
      <button
        onClick={onToggle}
        className="absolute top-13 -left-10 z-10 flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={isOpen ? 'Close tree view' : 'Open tree view'}
      >
        {isOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="h-full w-80 border-l bg-card">
          <div className="flex h-10 items-center border-b px-3">
            <span className="text-sm font-medium">Tree View</span>
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
