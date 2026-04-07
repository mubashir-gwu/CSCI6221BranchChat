'use client';

import { useCallback, useMemo } from 'react';
import { ReactFlow, Controls, ControlButton, MiniMap, type NodeMouseHandler } from '@xyflow/react';
import { Map, MapMinus } from 'lucide-react';
import TreeNodeComponent from './TreeNode';
import { useTreeLayout } from '@/hooks/useTreeLayout';
import { useUI } from '@/hooks/useUI';
import type { TreeNode } from '@/types/tree';
import type { ChildrenMap } from '@/types/tree';

const nodeTypes = { treeNode: TreeNodeComponent };

interface TreeVisualizationProps {
  nodes: Map<string, TreeNode>;
  childrenMap: ChildrenMap;
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

export default function TreeVisualization({
  nodes,
  childrenMap,
  activeNodeId,
  onNodeClick,
}: TreeVisualizationProps) {
  const { rfNodes, rfEdges } = useTreeLayout(nodes, childrenMap, activeNodeId);
  const { isMinimapVisible, toggleMinimap } = useUI();

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as { role?: string };
      if (data.role === 'user') return;
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    style: { stroke: 'var(--border)' },
  }), []);

  if (nodes.size === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No messages yet
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      aria-label="Conversation tree visualization"
    >
      <Controls showInteractive={false}>
        <ControlButton
          onClick={toggleMinimap}
          aria-label={isMinimapVisible ? 'Hide minimap' : 'Show minimap'}
        >
          {isMinimapVisible ? <Map className="h-3.5 w-3.5" /> : <MapMinus className="h-3.5 w-3.5" />}
        </ControlButton>
      </Controls>
      {isMinimapVisible && (
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const data = node.data as { isActive?: boolean; role?: string };
            if (data.isActive) return 'var(--color-primary)';
            if (data.role === 'user') return '#6B7280';
            return 'var(--color-border)';
          }}
          className="bg-card"
        />
      )}
    </ReactFlow>
  );
}
