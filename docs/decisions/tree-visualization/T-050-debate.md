# T-050 Deliberation: useTreeLayout Hook

## PROPOSER

Implement `src/hooks/useTreeLayout.ts` exactly per the Architecture Document §7.5 and Task Breakdown specification.

**Approach:**
- Accept `nodes: Map<string, TreeNode>`, `childrenMap: ChildrenMap`, and `activeNodeId: string | null` as parameters
- Use `useMemo` to compute layout only when inputs change
- Create a Dagre graph with `rankdir: "TB"`, `nodesep: 50`, `ranksep: 70`, margins 20
- For each node, use `node.measured?.width ?? 180` and `node.measured?.height ?? 60` (v12 API)
- Build edges from `childrenMap`
- Run `dagre.layout(graph)`
- Map results to ReactFlow node format with `type: 'treeNode'`, positioning offset by half-width/height
- Include `data` with: `label` (first 30 chars), `role`, `provider`, `isActive`, `hasMultipleChildren`
- Build edges with `type: 'smoothstep'`
- Return `{ rfNodes, rfEdges }`

**Key v12 concern:** The `node.measured` property is set by ReactFlow after initial render. For Dagre layout computation (which happens before ReactFlow measures nodes), we use fallback defaults (180x60). The `measured` property won't actually be populated on our input `TreeNode` type since those are our data model nodes, not ReactFlow internal nodes. The fallback values will always be used, which is correct for initial layout.

**Files:** `src/hooks/useTreeLayout.ts`

## CRITIC

1. **The `measured` property concern is valid but misleading.** Our `TreeNode` type from `src/types/tree.ts` has no `measured` property. The task description references `node.measured?.width` which is ReactFlow's internal node type, not our data model. Since we're computing layout from our own `TreeNode` objects (not ReactFlow nodes), `measured` will always be `undefined`, and the fallback `180`/`60` will always be used. This is correct behavior — we should still include the optional chaining for API compliance, but we should understand that for our use case it's effectively a constant.

2. **Position offset:** The task specifies `x: pos.x - 90, y: pos.y - 30` which is half of 180 and half of 60 — centering the node on the Dagre position. This is correct.

3. **No unnecessary complexity.** The hook is pure computation — no side effects, no state. `useMemo` is the right choice.

4. **Import concern:** `@dagrejs/dagre` v3.0.0 uses ES module exports. We need to verify the import works correctly with Next.js 16 / Turbopack. The default import `import dagre from '@dagrejs/dagre'` should work.

5. **Edge case:** Empty nodes map should return empty arrays — handled by the early return.

## MEDIATOR

Both sides agree on the approach. Key decisions:

1. Use the exact implementation from the task breakdown
2. The `measured` optional chaining is kept for v12 API correctness even though our TreeNode type won't have it
3. Use constant fallback dimensions (180x60) which is the effective behavior
4. Position offset: `x - 90, y - 30` (half dimensions)
5. Default import for dagre

No disagreements to resolve. Proceed with direct implementation per spec.
