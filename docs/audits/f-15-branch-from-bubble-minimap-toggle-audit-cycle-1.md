# Branch from Bubble & Minimap Toggle — Audit Report (Cycle 1)
Date: 2026-04-07
Tasks covered: T-071, T-072, T-073

## Spec Compliance

### T-071: Add "New Branch from Here" to BranchMenu

| Criterion | Status | Evidence |
|-----------|--------|----------|
| BranchMenu dropdown shows "New branch from here" as the last option | **PASS** | `src/components/chat/BranchMenu.tsx:61-67` — renders `+ New branch from here` at the bottom, separated by a divider (`border-t`), conditionally when `onNavigateToNode` is provided. |
| Clicking it navigates to the parent node (sets it as active) | **PASS** | `BranchMenu.tsx:63` calls `onNavigateToNode(parentNodeId)`. The chat page (`page.tsx:316`) passes `handleTreeNodeClick` as `onNavigateToNode`, which dispatches `SET_ACTIVE_NODE` (`page.tsx:232`). |
| After clicking, the user can type a new message that creates a new branch | **PASS** | Setting the parent (assistant) node as `activeNodeId` means the next message from ChatInput will be sent with that node as `parentNodeId`, creating a new branch. |
| Existing branch navigation options still work | **PASS** | Branch children buttons remain unchanged (`BranchMenu.tsx:37-56`), calling `onSelect(child.id)` on click. Verified by test `BranchMenu.test.tsx:74-92`. |
| `npm run build` passes | **PASS** | Build completes successfully. |

### T-072: Add Minimap Toggle to Tree Sidebar

| Criterion | Status | Evidence |
|-----------|--------|----------|
| A toggle button (eye icon) appears in the tree sidebar header | **PASS** | `src/components/tree/TreeSidebar.tsx:42-48` — renders Eye/EyeOff icon button in the header bar, with accessible `aria-label`. |
| Clicking it toggles the ReactFlow minimap on/off | **PASS** | Button calls `toggleMinimap` from `useUI()` (`TreeSidebar.tsx:43`). `TreeVisualization.tsx:66` conditionally renders `<MiniMap>` based on `isMinimapVisible`. |
| Default state: minimap visible | **PASS** | `UIProvider.tsx:11` sets `isMinimapVisible: true` in initial state. |
| Preference is session-only (resets on page reload) | **PASS** | State is held in React context (`useReducer`) with no localStorage persistence. Resets on reload. |
| `npm run build` passes | **PASS** | Build completes successfully. |

### T-073: Write Tests for Branch from Bubble and Minimap Toggle

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 130 tests pass across 14 test files. |
| `npm run build` passes | **PASS** | Build completes successfully. |

**Test coverage details:**
- `BranchMenu.test.tsx`: 4 tests — renders option when callback provided, hides when not, calls callback with correct ID, existing options still work.
- `TreeVisualization.test.tsx`: 7 tests (2 new for minimap) — renders minimap when visible, hides minimap when not visible.

## Bug Detection

No bugs found in F-15 feature code.

**Note (pre-existing, not F-15):** `UIProvider.tsx:60` still fetches from `/api/settings/api-keys` instead of `/api/providers`. This is a leftover from the BYO-Key architecture and belongs to F-13 (Server-Level API Keys). It does not affect F-15 functionality since `isMinimapVisible` and `TOGGLE_MINIMAP` are independent of provider fetching. Flagged for awareness only.

## Security

No security concerns. F-15 is purely UI-only (client-side component changes and React context state). No new API routes, no database queries, no auth changes.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| `isMinimapVisible` in UIContext | `UIContext.ts` adds `isMinimapVisible: boolean` | `UIContext.ts:9` — field present in `UIState` | **Match** |
| `TOGGLE_MINIMAP` action | Delta doc §10 | `UIContext.ts:21` — action type defined | **Match** |
| UIProvider handles TOGGLE_MINIMAP | Delta doc §5.8 | `UIProvider.tsx:38-39` — reducer toggles boolean | **Match** |
| useUI exposes isMinimapVisible + toggleMinimap | Task T-072 step 3 | `useUI.ts:12-14,18-19` — both exposed | **Match** |
| TreeSidebar: Eye/EyeOff toggle in header | Delta doc §5.8, CLAUDE.md Components table | `TreeSidebar.tsx:42-48` — Eye/EyeOff icons from lucide-react | **Match** |
| TreeVisualization: conditional MiniMap | Delta doc §5.9, CLAUDE.md Components table | `TreeVisualization.tsx:66-77` — `{isMinimapVisible && <MiniMap ...>}` | **Match** |
| BranchMenu: "New branch from here" at bottom | Delta doc §5.5, CLAUDE.md Components table | `BranchMenu.tsx:58-68` — option with divider, calls `onNavigateToNode` | **Match** |
| BranchMenu: optional `onNavigateToNode` prop | Task T-071 | `BranchMenu.tsx:11` — optional prop | **Match** |
| File locations | All files in spec-designated paths | All correct | **Match** |

No deviations found.

## Forward Compatibility

No forward compatibility concerns. F-15 changes are self-contained:
- `isMinimapVisible` in UIContext is additive and does not conflict with any future features.
- `onNavigateToNode` on BranchMenu is optional, preserving backward compatibility.
- No shared interfaces were modified in ways that would affect other features.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
