import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { TreeNode } from '@/types/tree';
import type { ChildrenMap } from '@/types/tree';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export function useTreeLayout(
  nodes: Map<string, TreeNode>,
  childrenMap: ChildrenMap,
  activeNodeId: string | null
) {
  return useMemo(() => {
    if (nodes.size === 0) return { rfNodes: [], rfEdges: [] };

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: 'TB',
      nodesep: 50,
      ranksep: 70,
      marginx: 20,
      marginy: 20,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const [nodeId, node] of nodes) {
      graph.setNode(nodeId, {
        width: (node as any).measured?.width ?? NODE_WIDTH,
        height: (node as any).measured?.height ?? NODE_HEIGHT,
      });
    }

    for (const [parentId, children] of childrenMap) {
      for (const childId of children) {
        if (nodes.has(parentId) && nodes.has(childId)) {
          graph.setEdge(parentId, childId);
        }
      }
    }

    dagre.layout(graph);

    const rfNodes = [...nodes].map(([nodeId, node]) => {
      const pos = graph.node(nodeId);
      return {
        id: nodeId,
        type: 'treeNode',
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
        data: {
          label: node.content.substring(0, 30),
          role: node.role,
          provider: node.provider,
          isActive: nodeId === activeNodeId,
          hasMultipleChildren: (childrenMap.get(nodeId)?.length ?? 0) > 1,
        },
      };
    });

    const rfEdges: { id: string; source: string; target: string; type: string }[] = [];
    for (const [parentId, children] of childrenMap) {
      for (const childId of children) {
        rfEdges.push({
          id: `${parentId}-${childId}`,
          source: parentId,
          target: childId,
          type: 'smoothstep',
        });
      }
    }

    return { rfNodes, rfEdges };
  }, [nodes, childrenMap, activeNodeId]);
}
