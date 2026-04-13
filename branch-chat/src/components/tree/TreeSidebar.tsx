'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import TreeVisualization from './TreeVisualization';
import type { TreeNode } from '@/types/tree';
import type { ChildrenMap } from '@/types/tree';

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 320;

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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    // Dragging left increases width (panel is on the right)
    const delta = startX.current - e.clientX;
    const maxWidth = window.innerWidth * 0.5;
    const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth.current + delta));
    setWidth(newWidth);
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Clean up cursor style if component unmounts while dragging
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

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
        <div
          className="fixed inset-0 w-full z-40 bg-card md:static md:w-auto md:z-auto md:h-full md:border-l"
          style={{ '--tree-sidebar-width': `${width}px` } as React.CSSProperties}
        >
          {/* Desktop resize handle */}
          <div
            className="hidden md:flex absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize items-center z-10 group"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="h-full w-0.5 mx-auto group-hover:bg-primary/40 transition-colors" />
          </div>
          <div className="flex h-11 items-center justify-between border-b px-3">
            <span className="text-sm font-medium">Tree View</span>
            <button
              onClick={onToggle}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Close tree view"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-2.75rem)]">
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
