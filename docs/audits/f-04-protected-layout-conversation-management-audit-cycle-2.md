# Protected Layout & Conversation Management — Audit Report (Cycle 2)
Date: 2026-03-31
Tasks covered: T-017, T-018, T-019, T-020, T-021, T-022, T-023

## Cycle 1 Regression Check

All 4 issues from Cycle 1 have been resolved:

| Cycle 1 Issue | Status | Evidence |
|---------------|--------|----------|
| Wrap API route handlers in try-catch with CastError handling | **FIXED** | All 4 route files (`conversations/route.ts`, `[id]/route.ts`, `nodes/route.ts`, `nodes/[nodeId]/route.ts`) now have try-catch blocks that check `error.name === "CastError"` and return 400. |
| Wrap `request.json()` in try-catch for malformed body | **FIXED** | `conversations/route.ts:48-52` (POST) and `[id]/route.ts:20-24` (PATCH) each have inner try-catch around `request.json()` returning `400 { error: "Invalid request body" }`. |
| Remove `showCloseButton` prop from ConfirmDialog | **FIXED** | `ConfirmDialog.tsx:34` — `<DialogContent>` has no extra props. Clean. |
| Use ToastProvider in root layout | **FIXED** | `layout.tsx:6` imports `ToastProvider from "@/components/common/ToastProvider"`, `layout.tsx:25` renders `<ToastProvider />`. |

## Spec Compliance

### T-017: Implement Shared Types

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All type files export their interfaces without errors | **PASS** | `src/types/database.ts`, `api.ts`, `tree.ts`, `llm.ts`, `export.ts` all compile. `npm run build` succeeds. |
| Constants are importable and type-safe | **PASS** | `src/constants/providers.ts` exports `PROVIDERS` with `as const` and `ProviderName`. `src/constants/models.ts` exports `MODELS` with `as const` and `ModelId`. Both consumed by API routes and UI components. |
| `npm run build` passes | **PASS** | Build succeeds. |

### T-018: Implement ConversationContext and UIContext

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `useConversation()` returns state and dispatch | **PASS** | `src/hooks/useConversation.ts` returns `{ state, dispatch }` from `ConversationContext`. |
| `useUI()` returns state and dispatch | **PASS** | `src/hooks/useUI.ts` returns `{ state, dispatch }` from `UIContext`. |
| Calling outside provider throws descriptive error | **PASS** | `useConversation` throws `"useConversation must be used within ConversationProvider"`. `useUI` throws `"useUI must be used within UIProvider"`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-019: Implement Conversation API Routes

| Criterion | Status | Evidence |
|-----------|--------|----------|
| GET /api/conversations returns user's conversations sorted newest first (FR-009) | **PASS** | `route.ts:17-18` — `Conversation.find({ userId }).sort({ updatedAt: -1 })`. |
| POST /api/conversations creates a conversation and returns 201 (FR-008) | **PASS** | `route.ts:79-97` — `Conversation.create()`, returns 201. |
| PATCH /api/conversations/:id renames and returns 200 (FR-010) | **PASS** | `[id]/route.ts:36-50` — `findOneAndUpdate` with ownership check, returns `{ id, title, updatedAt }`. |
| DELETE /api/conversations/:id deletes conversation + all nodes (FR-011) | **PASS** | `[id]/route.ts:73-83` — `Node.deleteMany` then `Conversation.deleteOne`. |
| All routes return 401 for unauthenticated requests | **PASS** | All handlers check `session?.user?.id` and return 401. |
| Cross-user access returns 404 (data isolation) | **PASS** | All queries scope by `userId: session.user.id`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-020: Implement Nodes API Routes

| Criterion | Status | Evidence |
|-----------|--------|----------|
| GET /api/conversations/:id/nodes returns all nodes for a conversation | **PASS** | `nodes/route.ts:30-41` — `Node.find({ conversationId })` with ownership check, returns `{ nodes[] }`. |
| DELETE cascading deletion (FR-021) | **PASS** | `[nodeId]/route.ts:38-61` — BFS traversal, `Node.deleteMany({ _id: { $in: toDelete } })`. |
| Returned deletedCount matches actual deletions | **PASS** | `route.ts:67` — returns `result.deletedCount`. |
| newActiveNodeId is the parent of the deleted node | **PASS** | `route.ts:64` — `targetNode.parentId?.toString() ?? null`. |
| Ownership verification works correctly | **PASS** | Both routes verify via `Conversation.findOne({ _id: id, userId })`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-021: Implement Protected Layout with Conversation Sidebar

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Protected layout renders sidebar + content area | **PASS** | `(protected)/layout.tsx` — flex layout with `w-64` sidebar + `flex-1` main content. |
| Conversations load and display in sidebar sorted by updatedAt (FR-009) | **PASS** | `ConversationList.tsx:57-58` sorts by `updatedAt` descending. ConversationProvider fetches on mount. |
| Clicking a conversation navigates to its chat page | **PASS** | `ConversationItem.tsx:85` — `router.push(/chat/${conversation.id})`. |
| "New Conversation" button creates a conversation (FR-008) | **PASS** | `ConversationList.tsx:27-54` — Dialog, POST to `/api/conversations`, dispatches ADD_CONVERSATION. |
| Rename updates title in sidebar and DB (FR-010) | **PASS** | `ConversationItem.tsx:27-54` — Inline edit, PATCH, dispatches UPDATE_CONVERSATION. |
| Delete removes conversation after confirmation (FR-011) | **PASS** | `ConversationItem.tsx:57-75` — ConfirmDialog, DELETE, REMOVE_CONVERSATION dispatch. Redirects if active. |
| Confirmation dialog appears before destructive actions | **PASS** | `ConversationItem.tsx:138-147` — `ConfirmDialog` with `destructive` prop. |
| Toast notifications work | **PASS** | `ToastProvider` in root `layout.tsx:25`. Toast calls throughout sidebar and dashboard components. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-022: Implement Dashboard Page

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Empty state shows prompt to create conversation | **PASS** | `dashboard/page.tsx:77-84` — "No conversations yet. Create one to get started!" with button. |
| Banner shows when no API keys are configured | **PASS** | `dashboard/page.tsx:17-29` — Fetches `GET /api/settings/api-keys`, shows amber banner when empty. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-023: Write Tests for Conversation API

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 21 tests pass across 2 test files (conversations.test.ts, nodes.test.ts). |
| Tests cover success and error cases | **PASS** | Tests cover: auth (401), ownership (404), CRUD operations, validation (400), cascade deletion, BFS traversal. |
| No external dependencies (DB, network) | **PASS** | All mocked: `auth()`, `connectDB()`, `Conversation`, `Node`. |

## Bug Detection

No bugs found. All issues from Cycle 1 have been resolved. Specific re-checks:

- **try-catch coverage**: All 6 exported handler functions across 4 route files are wrapped in try-catch with CastError → 400 and generic → 500 handling.
- **request.json() safety**: Both POST and PATCH handlers that parse JSON bodies use inner try-catch returning 400.
- **ConfirmDialog**: Clean `<DialogContent>` with no unrecognized props.
- **State management**: ConversationProvider reducer correctly handles all 9 action types. REMOVE_CONVERSATION properly clears `activeConversationId`, `nodes`, and `activeNodeId` when the active conversation is removed. REMOVE_NODES correctly clears `activeNodeId` if it was among the removed nodes.
- **No stale closures or missing dependencies**: `useEffect` in ConversationProvider has `[]` deps (fetch on mount only) — correct. Dashboard's `useEffect` for API key check also `[]` — correct.
- **No memory leaks**: No subscriptions or event listeners that need cleanup.

## Security

| Check | Status | Evidence |
|-------|--------|----------|
| Auth bypass | **PASS** | All API routes call `auth()` and check `session?.user?.id`. Middleware protects page routes. |
| Data isolation | **PASS** | Every query scopes by `userId: session.user.id`. Cross-user returns 404. |
| API key exposure | **PASS** | No secrets in client code. LLM keys encrypted in MongoDB. |
| Input validation | **PASS** | Title: 1-200 chars, trimmed. Provider: checked against `PROVIDERS` allowlist. Model: checked against `MODELS[provider]`. |
| Mongoose injection | **PASS** | Provider allowlisted. Title used as plain string in `$set`. IDs from URL params — CastError now caught cleanly. |
| Error information leakage | **PASS** | Catch blocks return generic `"Internal server error"` — no stack traces or internal details exposed. |

## Architecture Alignment

| Check | Status | Evidence |
|-------|--------|----------|
| Folder structure matches CLAUDE.md | **PASS** | All files in specified locations under `branch-chat/src/`. |
| Mongoose models match specified schema | **PASS** | `Conversation`: `userId, title, defaultProvider, defaultModel, rootNodeId`, `{ timestamps: true }`, index `{ userId: 1, updatedAt: -1 }`. `Node`: `conversationId, parentId, role, content, provider, model`, `{ timestamps: { createdAt: true, updatedAt: false } }`, indexes `{ conversationId: 1 }` and `{ conversationId: 1, parentId: 1 }`. |
| API routes match specified contracts | **PASS** | All response shapes match CLAUDE.md. Status codes: 201 POST, 200 GET/PATCH/DELETE, 401 auth, 404 not found, 400 validation. |
| Components where they should be | **PASS** | Sidebar in `components/sidebar/`, common in `components/common/`, providers in `components/providers/`. |
| Data flow as designed | **PASS** | Context + useReducer. Two separate contexts. ConversationProvider fetches on mount. `useMemo` on context values. |
| No unexpected files | **PASS** | No extraneous files. |
| ToastProvider usage | **PASS** | Root `layout.tsx` now uses `ToastProvider` wrapper per spec (Cycle 1 fix confirmed). |

## Forward Compatibility

| Concern | Current Code | Future Need | Assessment |
|---------|-------------|-------------|------------|
| F-05: API Key Management | Dashboard checks key existence via GET | Full CRUD on settings page | **Compatible** — read-only check. |
| F-06: Chat Interface | ConversationContext has `nodes`, `activeNodeId`, `ADD_NODES`, `REMOVE_NODES` | Load nodes, set active, add from LLM | **Compatible** — all actions defined. `SET_ACTIVE_CONVERSATION` clears nodes. |
| F-06: Tree Operations | `ChildrenMap` type in `src/types/tree.ts` | `src/lib/tree.ts` functions | **Compatible** — type is `Map<string, string[]>`. Node deletion route uses compatible inline BFS. |
| F-07: Tree Visualization | UIContext has `isTreeOpen`, `TOGGLE_TREE` | TreeSidebar toggle | **Compatible** — UI state ready. |
| F-08: Branching | Node has `parentId`, no `childrenIds` stored | Insert with parentId at branch point | **Compatible** — matches CLAUDE.md design. |
| F-11: Import/Export | `ExportedTree` type complete | Import validation and creation | **Compatible** — type ready. |

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**

All 4 issues from Cycle 1 have been verified as fixed. All acceptance criteria for T-017 through T-023 pass. No new bugs, security issues, or architecture deviations found. The feature is clean and ready for downstream features to build upon.
