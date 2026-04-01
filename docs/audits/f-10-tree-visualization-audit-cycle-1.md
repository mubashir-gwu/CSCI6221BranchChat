# Tree Visualization — Audit Report (Cycle 1)
Date: 2026-04-01
Tasks covered: T-049, T-050, T-051, T-052, T-053

## Spec Compliance

### T-049: Install @xyflow/react and @dagrejs/dagre

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `@xyflow/react` and `@dagrejs/dagre` install without peer dep conflicts | **PASS** | `package.json` lists `@xyflow/react: ^12.10.2` and `@dagrejs/dagre: ^3.0.0`. `npm run build` succeeds. |
| ReactFlow CSS is loaded | **PASS** | `src/app/globals.css:120-121` imports `@xyflow/react/dist/style.css` within `@layer base`. |
| `npm run build` passes | **PASS** | Build completes successfully with all routes listed. |

### T-050: Implement useTreeLayout Hook

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Hook returns valid `rfNodes` and `rfEdges` arrays for ReactFlow | **PASS** | `src/hooks/useTreeLayout.ts` returns `{ rfNodes, rfEdges }` with correct structure (id, type, position, data for nodes; id, source, target, type for edges). |
| Uses `node.measured?.width` (v12 API, not `node.width`) | **FAIL** | Lines 27-30 use constant `NODE_WIDTH` (180) and `NODE_HEIGHT` (60) instead of `node.measured?.width ?? 180`. The spec and Architecture Document §7.5 explicitly require `node.measured?.width ?? 180` to support dynamic node sizing in @xyflow/react v12. While the fallback value is the same (180), the code never reads from `node.measured`, meaning if ReactFlow provides measured dimensions, they are ignored. |
| Active node has `isActive: true` in data | **PASS** | Line 55: `isActive: nodeId === activeNodeId`. |
| Branch points have `hasMultipleChildren: true` | **PASS** | Line 56: `hasMultipleChildren: (childrenMap.get(nodeId)?.length ?? 0) > 1`. |
| Layout uses top-to-bottom (`rankdir: "TB"`) | **PASS** | Line 19: `rankdir: 'TB'`. |
| Memoized — only recomputes when inputs change | **PASS** | Entire computation is wrapped in `useMemo` with deps `[nodes, childrenMap, activeNodeId]`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-051: Implement TreeNode Custom Component

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Node renders with correct provider color (FR-025) | **PASS** | `TreeNode.tsx:19-21` looks up provider in `PROVIDERS` constant, applies color as `borderLeftColor` (line 36-37) and icon background (line 45). |
| Active node is visually highlighted (FR-026) | **PASS** | Lines 30-33: Active node gets `ring-2 ring-primary ring-offset-2` classes. |
| Content preview shown (FR-029) | **PASS** | Line 50: `{data.label || '...'}` — label is set to `node.content.substring(0, 30)` in useTreeLayout. |
| Handles positioned correctly for TB layout | **PASS** | Line 40: target Handle at `Position.Top`; line 57: source Handle at `Position.Bottom`. Correct for top-to-bottom flow. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-052: Implement TreeVisualization and TreeSidebar

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Tree renders all nodes and edges (FR-024) | **PASS** | `TreeVisualization.tsx` passes `rfNodes` and `rfEdges` from `useTreeLayout` to `<ReactFlow>`. Tests confirm correct node count. |
| Nodes are color-coded by provider (FR-025) | **PASS** | Handled by `TreeNode` component with provider color lookup. |
| Active node is highlighted (FR-026) | **PASS** | Handled by `TreeNode` component with `isActive` ring styling. |
| Clicking a node navigates chat (FR-027) | **PASS** | `TreeVisualization.tsx:27-31`: `handleNodeClick` calls `onNodeClick(node.id)`. In `chat/[conversationId]/page.tsx:220-226`, `handleTreeNodeClick` dispatches `SET_ACTIVE_NODE` and updates URL hash. |
| Pan and zoom work (FR-028) | **PASS** | ReactFlow provides built-in pan/zoom. `fitView` enabled (line 54). `<Controls>` component included (line 60). `<MiniMap>` component included (line 61). `minZoom={0.1}` and `maxZoom={2}` configured. |
| Sidebar collapses/expands without losing chat position (FR-023) | **PASS** | `TreeSidebar.tsx` is rendered alongside the chat `<div>` in a flex container (`page.tsx:267`). The chat panel is in a separate `flex-1` div. Toggling the sidebar only mounts/unmounts the tree panel — it does not touch the chat DOM, so scroll position is preserved. Toggle button always visible via absolute positioning (`-left-10`). |
| `npm run build` passes | **PASS** | Confirmed. |

### T-053: Write Tests for Tree Visualization

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 8 tests pass across both test files (4 in TreeVisualization.test.tsx, 4 in ModelSelector.test.tsx). |

## Bug Detection

### BUG-1: useTreeLayout ignores `node.measured` dimensions (Medium)

**File:** `src/hooks/useTreeLayout.ts:27-30`
**Description:** The hook uses hardcoded `NODE_WIDTH` and `NODE_HEIGHT` constants instead of reading from `node.measured?.width ?? 180` as specified. The `TreeNode` type in `types/tree.ts` doesn't include a `measured` property, so `node.measured` can't be accessed even if the code tried. In practice, since the hook provides initial layout before ReactFlow measures nodes, and the fallback values match the constants, this doesn't cause a visible layout bug currently. However, it deviates from the spec's intent to support dynamic measured dimensions.
**Severity:** Low — No runtime impact since the fallback values are identical to the constants. The `nodes` input is the app's `TreeNode` map (not ReactFlow's internal nodes with `measured`), so there's no `measured` field to read anyway. The spec's pseudocode assumes a different data flow than what was implemented.

### BUG-2: No edge case handling for orphaned nodes in childrenMap iteration (Low)

**File:** `src/hooks/useTreeLayout.ts:34-37`
**Description:** If `childrenMap` contains a parentId that doesn't exist in the `nodes` map, `graph.setEdge` would reference a node not in the graph. This is theoretically prevented by `buildChildrenMap` only creating entries from existing nodes, so the invariant is maintained in practice.
**Severity:** Low — Defensive concern only; not triggerable with current data flow.

No other logic errors, unhandled rejections, data model mismatches, or React state issues found.

## Security

No new API routes, auth changes, or database queries introduced by F-10. All security-relevant behavior resides in the existing chat page and API routes from prior features.

| Check | Status |
|-------|--------|
| Auth bypass | **N/A** — No new API routes. TreeSidebar is rendered within the protected layout. |
| Data isolation | **N/A** — Tree visualization reads from client-side state already scoped by user. |
| API key exposure | **PASS** — No secrets in client-side tree components. |
| Input validation | **N/A** — No new user input paths to server. |
| Mongoose injection | **N/A** — No new database queries. |

No security issues found.

## Architecture Alignment

| Aspect | Specified | Implemented | Assessment |
|--------|-----------|-------------|------------|
| Folder structure | `src/hooks/useTreeLayout.ts`, `src/components/tree/TreeNode.tsx`, `src/components/tree/TreeVisualization.tsx`, `src/components/tree/TreeSidebar.tsx` | All files at correct locations | **Match** |
| TreeSidebar props | `isOpen`, `onToggle` | `isOpen`, `onToggle`, plus `nodes`, `childrenMap`, `activeNodeId`, `onNodeClick` | **Acceptable deviation** — CLAUDE.md only lists `isOpen` and `onToggle` but the implementation correctly passes tree data as props rather than relying on context. This is a reasonable approach since TreeSidebar needs this data to render TreeVisualization. |
| UIContext fields | CLAUDE.md lists: `isLoading`, `isSidebarOpen`, `selectedProvider`, `selectedModel` | Added `isTreeOpen` and `TOGGLE_TREE` action | **Acceptable deviation** — The tree sidebar needs its own open/close state. Adding `isTreeOpen` to UIContext is the natural place for it and follows the same pattern as `isSidebarOpen`. |
| nodeTypes registration | `{ treeNode: TreeNode }` | `const nodeTypes = { treeNode: TreeNodeComponent }` defined outside component (line 10) | **Match** — Correctly defined outside the component to prevent ReactFlow re-registration on every render. |
| ReactFlow styles | `@layer base { @import "@xyflow/react/dist/style.css"; }` in globals.css | Present at lines 120-121 | **Match** |
| Dagre layout params | `rankdir: "TB", nodesep: 50, ranksep: 70, marginx: 20, marginy: 20` | Lines 19-23 match exactly | **Match** |
| Edge type | `type: "smoothstep"` | Line 68 and `defaultEdgeOptions` in TreeVisualization | **Match** |

## Forward Compatibility

### F-11: Export & Import
**Current code:** Tree visualization reads from the same `nodes` Map and `childrenMap` that the rest of the app uses.
**Future need:** Export needs to serialize nodes; Import needs to load nodes into state.
**Assessment:** **Compatible** — Tree visualization is a pure consumer of state. Export/Import will work with the existing state management without touching tree visualization code.

### F-12: Error Handling & Polish
**Current code:** TreeVisualization handles the empty state gracefully ("No messages yet"). TreeSidebar toggle is smooth.
**Future need:** Error boundaries, loading states, toast notifications.
**Assessment:** **Compatible** — The tree components are well-isolated. Error boundaries can be added around TreeVisualization without modification. No hardcoded assumptions that would conflict.

### Dynamic node sizing
**Current code:** Uses fixed 180x60 dimensions.
**Future need:** If nodes ever need variable sizing (e.g., showing more content preview), the current constant approach would need to be updated.
**Assessment:** **Minor concern** — The constants are easily changeable, and the current approach works correctly for uniform-sized nodes. Not a blocking issue.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 2
- Recommendation: **FIX FIRST**

Two low-severity issues require revision before proceeding:
1. `useTreeLayout` must use `node.measured?.width ?? 180` instead of hardcoded constants, per spec and Architecture Document §7.5.
2. `useTreeLayout` edge loop needs a guard to skip edges where parentId or childId is missing from the nodes map.
