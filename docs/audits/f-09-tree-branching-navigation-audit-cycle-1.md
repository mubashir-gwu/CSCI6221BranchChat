# Tree Branching & Navigation — Audit Report (Cycle 1)
Date: 2026-04-01
Tasks covered: T-044, T-045, T-046, T-047, T-048

## Spec Compliance

### T-044: Implement Branch Creation Flow

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Navigating to node B (which has child C) and sending a message creates node D as sibling of C under B (FR-019) | **PASS** | `page.tsx:144-208` — `handleSend` posts to `/api/llm/chat` with `parentNodeId: state.activeNodeId`. The LLM route (`llm/chat/route.ts:123`) creates the user node with `parentId: parentNodeId`, correctly creating a sibling branch without modifying existing children. |
| Path A → B → C remains intact after branching (FR-020) | **PASS** | No mutation of existing nodes occurs — the API only inserts new nodes. `ADD_NODES` in the reducer (`ConversationProvider.tsx:60-64`) adds to a new Map without altering existing entries. |
| The new branch inherits full ancestor context (FR-019) | **PASS** | `llm/chat/route.ts:120` calls `buildContext(parentNodeId, content, nodesMap, contextWindow)` which walks ancestors to build the message history. |
| Node B now shows as a branch point (childCount > 1) (FR-016) | **PASS** | `ChatPanel.tsx:45-46` computes `childIds` from `childrenMap` and passes `childCount={childIds.length}` to `ChatMessage`. `ChatMessage.tsx:125` renders `BranchIndicator` when `childCount > 1`. |
| `npm run build` passes | **PASS** | Build completes successfully with all routes generated. |

### T-045: Implement BranchIndicator Component

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Badge visible on messages with multiple children (FR-016) | **PASS** | `ChatMessage.tsx:125-146` conditionally renders `BranchIndicator` when `childCount > 1`. |
| Shows correct branch count | **PASS** | `BranchIndicator.tsx:19` renders `{branchCount} branches` inside a Badge. |
| Click triggers branch menu | **PASS** | `ChatMessage.tsx:130-131` toggles `showBranchMenu` state on click, which renders `BranchMenu` at line 132-144. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-046: Implement BranchMenu Component

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Menu shows all children of the branch point (FR-022) | **PASS** | `BranchMenu.tsx:25` maps over all `children` props. `ChatPanel.tsx:46-48` resolves all child IDs to TreeNode objects. |
| Each child shows content preview and provider color | **PASS** | `BranchMenu.tsx:30-33` shows truncated preview. `BranchMenu.tsx:43-47` renders a colored dot using `PROVIDERS[provider].color`. |
| Selecting a branch navigates to its deepest leaf | **PASS** | `ChatMessage.tsx:138-140` calls `onBranchClick(childId)` which maps to `handleBranchNavigate` in `page.tsx:210-216`, calling `findDeepestLeaf(nodeId, childrenMap)`. |
| Active branch is highlighted | **PASS** | `BranchMenu.tsx:29,39` applies `bg-accent font-medium` class when `isActive`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-047: Implement Node Deletion from Chat

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Deleting a node removes it and all descendants (FR-021) | **PASS** | Server: `nodes/[nodeId]/route.ts:50-61` BFS finds all descendants, `deleteMany` removes them. Client: `page.tsx:232-236` uses `findDescendants` then dispatches `REMOVE_NODES`. |
| Chat navigates to parent after deletion (FR-021) | **PARTIAL** | Server returns `newActiveNodeId` (parent). But client at `page.tsx:240` calls `findDeepestLeaf(data.newActiveNodeId, childrenMap)` to navigate to the deepest leaf of the parent, not the parent itself. See Bug #1. |
| Confirmation dialog shown before deletion | **PASS** | `ChatMessage.tsx:162-170` renders `ConfirmDialog` with "Delete this message and all replies? This cannot be undone." |
| Existing sibling branches are unaffected | **PASS** | Server-side BFS only traverses descendants of the target node. Siblings are untouched. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-048: Write Tests for Branching Components

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 2 test files, 9 tests — all pass (vitest 4.1.2). |
| Component renders and interactions verified | **PASS** | BranchIndicator: badge rendering (2 tests), click callback, button role. ChatPanel: empty state, message rendering, branch indicator visibility (present/absent), loading state. |

## Bug Detection

### Bug #1: Stale `childrenMap` used after deletion — navigates to deleted node (Medium)

**File:** `src/app/(protected)/chat/[conversationId]/page.tsx:219-251`

**Description:** In `handleDeleteNode`, after dispatching `REMOVE_NODES` (line 236), `findDeepestLeaf(data.newActiveNodeId, childrenMap)` is called at line 240. However, `childrenMap` is a `useMemo` derived from `state.nodes` — it won't update until the next render. The stale `childrenMap` still contains the deleted node's entries.

If the deleted node was the **first child** of its parent, `findDeepestLeaf` walks from the parent into the deleted node's subtree (since deleted node is still `children[0]` in the stale map), setting `activeNodeId` to a node that no longer exists. This results in an empty chat view.

**Fix:** Either:
- Set `activeNodeId` directly to `data.newActiveNodeId` (matching the T-047 spec: "Set `activeNodeId` to the returned `newActiveNodeId`"), or
- Build a filtered childrenMap excluding deleted IDs before calling `findDeepestLeaf`.

### Bug #2: Root node deletion does not clear `rootNodeId` on Conversation (Low)

**File:** `src/app/api/conversations/[id]/nodes/[nodeId]/route.ts`

**Description:** When the root node is deleted (the node with `parentId === null`), the server does not update `conversation.rootNodeId` to `null`. The conversation document retains a stale `rootNodeId` pointing to the deleted node. This doesn't cause immediate issues since nodes are loaded independently, but could cause problems for future features (e.g., export, import validation) that rely on `rootNodeId`.

**Fix:** After deletion, if `targetNode.parentId === null`, update `await Conversation.findByIdAndUpdate(id, { rootNodeId: null })`.

### Bug #3: `nodeId` prop accepted but unused in BranchIndicator (Low)

**File:** `src/components/chat/BranchIndicator.tsx:6,13`

**Description:** The `nodeId` prop is declared in the interface and destructured but never used in the component body. This matches the spec's prop definition so it's not a spec violation, but it's dead code. TypeScript will not warn about this.

**Impact:** Cosmetic. No functional issue.

## Security

| Check | Status | Evidence |
|-------|--------|----------|
| Auth on DELETE node route | **PASS** | `nodes/[nodeId]/route.ts:12-15` — calls `auth()`, returns 401 if no session. |
| User scoping on DELETE node route | **PASS** | `nodes/[nodeId]/route.ts:22-29` — finds conversation by `_id` AND `userId: session.user.id`. Returns 404 if not owned. |
| No data leakage across users | **PASS** | All queries filter by userId (conversations) or conversationId (nodes). |
| Input validation on node deletion | **PASS** | CastError caught at line 71 for invalid ObjectId format. |
| No secrets exposed client-side | **PASS** | No API keys or encryption keys in component code. |
| No Mongoose injection vectors | **PASS** | Route params are strings used directly as ObjectId lookups. Mongoose validates the cast. |

No security issues found.

## Architecture Alignment

| Aspect | Specified | Implemented | Assessment |
|--------|-----------|-------------|------------|
| ChatPanel props | `activePath[]`, `onBranchNavigate` | `activePath[]`, `childrenMap`, `nodesMap`, `onBranchNavigate`, `onDeleteNode`, `isLoading` | **Acceptable deviation** — additional props are necessary for branch indicator rendering and deletion. The spec's prop list was minimal guidance, not exhaustive. |
| BranchIndicator props | `nodeId`, `branchCount`, `onClick` | Same | **PASS** |
| BranchMenu props | `parentNodeId`, `children[]`, `activeChildId`, `onSelect` | Same | **PASS** |
| BranchMenu content preview | "first ~50 chars" | 60 chars | **Acceptable deviation** — spec said "~50", 60 is close enough. |
| File locations | `src/components/chat/BranchIndicator.tsx`, `BranchMenu.tsx` | Same | **PASS** |
| ConfirmDialog for deletion | "ConfirmDialog" in `src/components/common/` | `ConfirmDialog` at `src/components/common/ConfirmDialog.tsx` | **PASS** |
| `childrenMap` derived via useMemo | Specified in State Management | `page.tsx:120-123` | **PASS** |
| `activePath` derived, never stored | Specified in State Management | `useActivePath` hook returns `useMemo` result | **PASS** |
| `REMOVE_NODES` reducer action | Not explicitly specified | `ConversationProvider.tsx:67-79` — cleanly removes nodes and clears activeNodeId if removed | **Acceptable addition** — required for deletion feature. |

No architectural violations found.

## Forward Compatibility

| Concern | Current Code | Future Need | Assessment |
|---------|-------------|-------------|------------|
| Tree click navigation (F-10) | `handleBranchNavigate` in page.tsx accepts any nodeId, calls `findDeepestLeaf`, dispatches `SET_ACTIVE_NODE` | F-10 TreeVisualization needs `onNodeClick` to navigate chat | **Compatible** — `handleBranchNavigate` can be passed directly to TreeVisualization. |
| Tree sidebar integration (F-10) | `childrenMap` and `nodesMap` computed in page.tsx | F-10 TreeSidebar/TreeVisualization needs these as props | **Compatible** — already computed and available. |
| Export (F-11) | `rootNodeId` may be stale after root deletion (Bug #2) | Export uses `rootNodeId` to verify tree integrity | **Risk** — stale `rootNodeId` could cause export validation to fail or produce invalid output. Fix Bug #2. |
| Import (F-11) | Import validation checks "one root, all parentIds exist" | Import needs consistent `rootNodeId` | **Risk** — same as above. |
| `findDeepestLeaf` utility | In `src/lib/tree.ts`, walks first child | F-10 may want to highlight deepest leaf when clicking tree nodes | **Compatible** — utility is generic and reusable. |

## Summary
- Critical issues: 0
- Medium issues: 1 (Bug #1: stale childrenMap after deletion)
- Low issues: 2 (Bug #2: rootNodeId not cleared on root deletion, Bug #3: unused nodeId prop)
- Recommendation: **FIX FIRST** — Bug #1 causes navigation to deleted nodes after deletion, producing a broken UI state. Should be fixed before proceeding.
