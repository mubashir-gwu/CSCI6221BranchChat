# T-044 Implementation Plan: Branch Creation Flow

## Changes

### 1. `src/lib/tree.ts` — Add `findDeepestLeaf`
- New export: `findDeepestLeaf(nodeId: string, childrenMap: ChildrenMap): string`
- Walks first child at each level until reaching a leaf
- Used by T-046 BranchMenu for navigating to the end of a selected branch

### 2. `src/components/chat/ChatPanel.tsx` — Accept `nodesMap` prop
- Add `nodesMap: Map<string, TreeNode>` to `ChatPanelProps`
- Pass resolved children `TreeNode[]` and `activeChildId` to each `ChatMessage`
- `activeChildId` determined by checking which child of a node is in the `activePath`

### 3. `src/app/(protected)/chat/[conversationId]/page.tsx` — Pass nodesMap
- Pass `state.nodes` as `nodesMap` prop to `ChatPanel`

### 4. No changes needed
- `handleSend` — already uses `state.activeNodeId` as `parentNodeId`
- `handleBranchNavigate` — already sets `activeNodeId`
- LLM chat API — already creates user+assistant nodes as children
- `buildChildrenMap` — already handles multiple children per node

## Acceptance Criteria Verification
- Navigating to node B (which has child C) and sending a message creates node D as sibling of C under B → verified via existing `handleSend` flow
- Path A → B → C remains intact after branching → API creates new nodes, never modifies existing
- The new branch inherits full ancestor context → API's `contextBuilder` walks ancestors
- Node B now shows as a branch point (childCount > 1) → `ChatMessage` already shows `BranchIndicator` when `childCount > 1`
