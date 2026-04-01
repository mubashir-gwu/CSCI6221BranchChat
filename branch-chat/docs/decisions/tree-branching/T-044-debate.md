# T-044 Deliberation: Branch Creation Flow

## PROPOSER

The branch creation flow is architecturally straightforward because the data model already supports it. A branch is simply a node inserted with a `parentId` pointing to an existing node that already has children. No existing nodes are modified (FR-020).

**Current state analysis:**
- `ChatPage.handleSend` already sends `parentNodeId: state.activeNodeId` to `POST /api/llm/chat`
- The API creates a user node + assistant node as children of that parent
- `buildChildrenMap` in `tree.ts` correctly groups children by parentId
- `ChatMessage` already renders `BranchIndicator` when `childCount > 1`
- `handleBranchNavigate` sets `activeNodeId`, which recalculates `activePath` via `useActivePath`

**Proposed implementation:**
1. Add `findDeepestLeaf(nodeId, childrenMap)` to `src/lib/tree.ts` — needed for branch navigation (T-046 will use this when user selects a branch from BranchMenu and we need to navigate to its leaf)
2. Update `ChatPanel` to accept `nodesMap` prop so it can resolve child node IDs to full `TreeNode` objects for passing to `ChatMessage`
3. Update `page.tsx` to pass `nodesMap` to `ChatPanel`
4. No changes needed to the send flow — it already works correctly

**Data flow:**
```
User navigates to node B (which has child C) →
  activeNodeId = B → activePath = [root, ..., B] →
User sends message →
  POST /api/llm/chat { parentNodeId: B, content, provider, model } →
  API creates userNode D (parentId=B), assistantNode E (parentId=D) →
  Client adds D, E to nodesMap →
  childrenMap[B] = [C_id, D_id] → branch point created
```

## CRITIC

The Proposer's analysis is correct — the creation mechanism already works. But there are gaps:

1. **Navigation after branching**: When a new branch is created, `handleSend` sets `activeNodeId` to the new assistant node. Good. But when the user wants to go back to the OLD branch (A→B→C), they need to use BranchMenu. The `handleBranchNavigate` currently navigates to the branch point itself (B), which shows path [root, ..., B] — losing the view of both branches. This is correct for "I want to send from here" but wrong for "I want to view branch C's continuation."

2. **The `findDeepestLeaf` function**: Following the first child at each level is the right heuristic. But what if the user was previously viewing a specific branch? Should we remember which child was "active" per branch point? The task says to follow first child, which is simpler and matches the Architecture Document.

3. **ChatPanel receiving nodesMap**: This increases the prop surface. Is there a cleaner way? We could compute children nodes at the page level and pass them as a pre-computed structure. However, `nodesMap` is more flexible and avoids creating a parallel data structure. The prop addition is minimal and justified.

4. **No risk to existing functionality**: The send flow, node loading, and path calculation are untouched. Only additive changes.

## MEDIATOR

### FINAL IMPLEMENTATION PLAN

Both sides agree the branch creation mechanism already works. The Proposer's plan is sound with the Critic's endorsement. The key addition is the `findDeepestLeaf` utility and passing `nodesMap` through to ChatPanel.

**Implementation steps:**

1. **Add `findDeepestLeaf` to `src/lib/tree.ts`:**
   ```typescript
   export function findDeepestLeaf(nodeId: string, childrenMap: ChildrenMap): string {
     let current = nodeId;
     while (true) {
       const children = childrenMap.get(current) ?? [];
       if (children.length === 0) return current;
       current = children[0]; // Follow first child
     }
   }
   ```

2. **Update `ChatPanel` props** to accept `nodesMap: Map<string, TreeNode>` — needed for resolving child IDs to full objects for BranchMenu (used in T-045/T-046).

3. **Update `page.tsx`** to pass `state.nodes` as `nodesMap` to ChatPanel.

4. **No changes to `handleSend` or `handleBranchNavigate`** — they work correctly as-is.

5. **Verify acceptance criteria:**
   - Navigate to node with children → send message → sibling created ✓
   - Existing path unchanged ✓
   - Context inherited via ancestor walk ✓
   - Branch point shows indicator ✓
