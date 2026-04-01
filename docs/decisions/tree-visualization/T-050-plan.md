# T-050 Implementation Plan: useTreeLayout Hook

## File: `src/hooks/useTreeLayout.ts`

### Implementation
1. Import `useMemo` from React, `dagre` from `@dagrejs/dagre`
2. Import `TreeNode` and `ChildrenMap` from `@/types/tree`
3. Export function `useTreeLayout(nodes: Map<string, TreeNode>, childrenMap: ChildrenMap, activeNodeId: string | null)`
4. Wrap computation in `useMemo` with `[nodes, childrenMap, activeNodeId]` deps
5. Early return `{ rfNodes: [], rfEdges: [] }` if nodes is empty
6. Create Dagre graph: `rankdir: "TB"`, `nodesep: 50`, `ranksep: 70`, `marginx: 20`, `marginy: 20`
7. For each node: `setNode(id, { width: 180, height: 60 })` (constant since our TreeNode has no `measured`)
8. For each childrenMap entry: `setEdge(parentId, childId)`
9. Run `dagre.layout(graph)`
10. Map to rfNodes with `type: 'treeNode'`, position offset by `(x - 90, y - 30)`, data includes label/role/provider/isActive/hasMultipleChildren
11. Map to rfEdges with `type: 'smoothstep'`
12. Return `{ rfNodes, rfEdges }`
