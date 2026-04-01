# Protected Layout & Conversation Management — Audit Report (Cycle 1)
Date: 2026-03-31
Tasks covered: T-017, T-018, T-019, T-020, T-021, T-022, T-023

## Spec Compliance

### T-017: Implement Shared Types

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All type files export their interfaces without errors | **PASS** | `src/types/database.ts`, `api.ts`, `tree.ts`, `llm.ts`, `export.ts` all export correctly. `npm run build` passes. |
| Constants are importable and type-safe | **PASS** | `src/constants/providers.ts` exports `PROVIDERS` with `as const` and `ProviderName` type. `src/constants/models.ts` exports `MODELS` with `as const` and `ModelId` type. Both are imported by API routes and UI components without error. |
| `npm run build` passes | **PASS** | Build succeeds with all routes and pages generated. |

**Details:**
- `src/types/export.ts` matches the spec exactly (version 1, nodes with childrenIds, etc.).
- `src/constants/providers.ts` matches spec: openai (#10A37F), anthropic (#D4A27F), gemini (#4285F4), mock (#6B7280).
- `src/constants/models.ts` matches spec: gpt-4o, gpt-4o-mini, claude-sonnet-4, claude-3.5-haiku, gemini-2.0-flash, mock-model with correct context windows.

### T-018: Implement ConversationContext and UIContext

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `useConversation()` returns state and dispatch | **PASS** | `src/hooks/useConversation.ts` returns `{ state, dispatch }` from `ConversationContext`. |
| `useUI()` returns state and dispatch | **PASS** | `src/hooks/useUI.ts` returns `{ state, dispatch }` from `UIContext`. |
| Calling outside provider throws descriptive error | **PASS** | Both hooks throw `"useConversation must be used within ConversationProvider"` and `"useUI must be used within UIProvider"` respectively. |
| `npm run build` passes | **PASS** | Confirmed. |

**Details:**
- `ConversationContext` state shape: `conversations[]`, `activeConversationId`, `nodes: Map`, `activeNodeId` — matches CLAUDE.md spec.
- `UIContext` state shape: `isLoading`, `isSidebarOpen`, `isTreeOpen`, `selectedProvider`, `selectedModel` — matches spec. Note: `isTreeOpen` is an addition beyond what CLAUDE.md specifies in State Management section, but it's referenced in the task breakdown and is an acceptable addition.
- Actions in ConversationContext: SET_CONVERSATIONS, ADD_CONVERSATION, UPDATE_CONVERSATION, REMOVE_CONVERSATION, SET_NODES, ADD_NODES, REMOVE_NODES, SET_ACTIVE_CONVERSATION, SET_ACTIVE_NODE — all present.
- Actions in UIContext: SET_LOADING, TOGGLE_SIDEBAR, TOGGLE_TREE, SET_SELECTED_MODEL — all present.
- UIProvider defaults: `isSidebarOpen: true`, `isTreeOpen: false`, `isLoading: false` — matches T-018 spec.
- ConversationProvider fetches conversations on mount — matches spec.
- Both providers use `useMemo` for the context value to avoid unnecessary re-renders.

### T-019: Implement Conversation API Routes

| Criterion | Status | Evidence |
|-----------|--------|----------|
| GET /api/conversations returns user's conversations sorted newest first (FR-009) | **PASS** | `route.ts:16-18` — `Conversation.find({ userId }).sort({ updatedAt: -1 })` |
| POST /api/conversations creates a conversation and returns 201 (FR-008) | **PASS** | `route.ts:66-84` — Creates with `Conversation.create()`, returns 201 with full response. |
| PATCH /api/conversations/:id renames and returns 200 (FR-010) | **PASS** | `[id]/route.ts:29-43` — `findOneAndUpdate` with `{ _id: id, userId }`, returns `{ id, title, updatedAt }`. |
| DELETE /api/conversations/:id deletes conversation + all nodes (FR-011) | **PASS** | `[id]/route.ts:59-71` — Finds with ownership check, `Node.deleteMany`, `Conversation.deleteOne`. |
| All routes return 401 for unauthenticated requests | **PASS** | All four handlers check `session?.user?.id` and return 401 if absent. |
| Cross-user access returns 404 (data isolation) | **PASS** | All queries scope by `userId: session.user.id`. `findOneAndUpdate` and `findOne` return null for wrong user → 404. |
| `npm run build` passes | **PASS** | Confirmed. |

**Details:**
- Title validation: 1-200 chars, trimmed, non-empty — matches spec.
- Provider validation: checked against `PROVIDERS` constant.
- Model validation: checked against `MODELS[provider]`.
- Cascade delete order: `Node.deleteMany` → `Conversation.deleteOne` — matches CLAUDE.md.
- PATCH response matches `RenameConversationResponse`: `{ id, title, updatedAt }`.

### T-020: Implement Nodes API Routes

| Criterion | Status | Evidence |
|-----------|--------|----------|
| GET /api/conversations/:id/nodes returns all nodes for a conversation | **PASS** | `nodes/route.ts:29-41` — `Node.find({ conversationId })` with ownership check. Returns `{ nodes[] }` with id, parentId, role, content, provider, model, createdAt. |
| DELETE cascading deletion (FR-021) | **PASS** | `[nodeId]/route.ts:30-61` — Loads all nodes, builds children map, BFS traversal, `Node.deleteMany({ _id: { $in: toDelete } })`. |
| Returned deletedCount matches actual deletions | **PASS** | `route.ts:65` — Returns `result.deletedCount` from `deleteMany`. |
| newActiveNodeId is the parent of the deleted node | **PASS** | `route.ts:63` — `targetNode.parentId?.toString() ?? null`. |
| Ownership verification works correctly | **PASS** | Both routes verify conversation ownership via `Conversation.findOne({ _id: id, userId })`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-021: Implement Protected Layout with Conversation Sidebar

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Protected layout renders sidebar + content area | **PASS** | `(protected)/layout.tsx` — flex layout with 264px sidebar (`w-64`) + main content area. |
| Conversations load and display in sidebar sorted by updatedAt (FR-009) | **PASS** | `ConversationList.tsx:57-58` — Sorts by `updatedAt` descending. ConversationProvider fetches on mount. |
| Clicking a conversation navigates to its chat page | **PASS** | `ConversationItem.tsx:85` — `router.push(/chat/${conversation.id})`. |
| "New Conversation" button creates a conversation (FR-008) | **PASS** | `ConversationList.tsx:27-54` — Dialog with title input, POST to `/api/conversations`, dispatches ADD_CONVERSATION. |
| Rename updates title in sidebar and DB (FR-010) | **PASS** | `ConversationItem.tsx:27-54` — Inline edit, PATCH request, dispatches UPDATE_CONVERSATION. |
| Delete removes conversation after confirmation (FR-011) | **PASS** | `ConversationItem.tsx:57-75` — ConfirmDialog → DELETE request → REMOVE_CONVERSATION dispatch. Redirects to `/dashboard` if active. |
| Confirmation dialog appears before destructive actions | **PASS** | `ConversationItem.tsx:138-147` — `ConfirmDialog` with destructive styling for delete. |
| Toast notifications work | **PASS** | `Toaster` from sonner included in root `layout.tsx:25`. Toast calls in ConversationList, ConversationItem, and DashboardPage. |
| `npm run build` passes | **PASS** | Confirmed. |

**Details:**
- Layout wraps children with `ConversationProvider` → `UIProvider` — matches spec.
- Logout button present in sidebar footer, calls `signOut({ callbackUrl: "/login" })`.
- `ConfirmDialog` props: `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `confirmLabel`, `destructive` — matches spec exactly.
- `ToastProvider` wraps sonner `<Toaster />` — matches spec.
- Root `layout.tsx` includes `<Toaster />` directly (sonner) alongside AuthProvider — matches spec.

### T-022: Implement Dashboard Page

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Empty state shows prompt to create conversation | **PASS** | `dashboard/page.tsx:76-85` — "No conversations yet. Create one to get started!" with "New Conversation" button. |
| Banner shows when no API keys are configured | **PASS** | `dashboard/page.tsx:17-29` — Fetches `GET /api/settings/api-keys`, shows amber banner when `keys.length === 0`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-023: Write Tests for Conversation API

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 21 tests pass across both files (2 test files). |
| Tests cover success and error cases | **PASS** | Tests cover: auth failures (401), ownership isolation (404), valid CRUD operations, validation errors (400), cascading deletion, BFS traversal. |
| No external dependencies (DB, network) | **PASS** | All mocked: `auth()`, `connectDB()`, `Conversation`, `Node` models. |

## Bug Detection

### Bug 1: Missing try-catch around `request.json()` in API routes
- **File:** `src/app/api/conversations/route.ts:39`, `src/app/api/conversations/[id]/route.ts:17`
- **Description:** `request.json()` can throw if the request body is malformed or missing. No try-catch wraps these calls, so a malformed POST/PATCH request would result in an unhandled exception and a 500 error instead of a clean 400.
- **Severity:** Low — This is a defensive concern. In practice, Next.js catches the error and returns 500. A proper 400 would be better UX but not functionally broken.

### Bug 2: Missing try-catch around MongoDB operations in API routes
- **File:** All API route files
- **Description:** Database operations (find, create, deleteMany, etc.) are not wrapped in try-catch. A Mongoose cast error (e.g., passing an invalid ObjectId format for `[id]`) would result in an unhandled exception and 500 instead of a proper 400 or 404.
- **Severity:** Medium — Passing a non-ObjectId string like `"abc"` as a conversation ID to any route will throw a Mongoose CastError. This is a realistic user scenario (e.g., manually typed URLs). Should return 400 or 404, not 500.

### Bug 3: `showCloseButton` prop on DialogContent
- **File:** `src/components/common/ConfirmDialog.tsx:34`
- **Description:** `showCloseButton={false}` is passed to `DialogContent`. This is not a standard shadcn/ui prop — shadcn uses the `DialogClose` component or relies on default close behavior. This prop may be silently ignored or may cause a TypeScript warning depending on the specific shadcn version.
- **Severity:** Low — If ignored, the dialog still functions correctly with default close behavior. Not a functional bug.

## Security

### Assessment: No Critical or High Issues

| Check | Status | Evidence |
|-------|--------|----------|
| Auth bypass | **PASS** | All API routes call `auth()` and check `session?.user?.id`. Middleware protects page routes. |
| Data isolation | **PASS** | Every database query scopes by `userId: session.user.id`. Cross-user access returns 404. |
| API key exposure | **PASS** | No secrets in client-side code. LLM keys stored encrypted in MongoDB (F-05 concern). Env vars only on server. |
| Input validation | **PASS** | Title validated (1-200 chars). Provider validated against allowlist. Model validated against provider's model list. |
| Mongoose injection | **PASS** | Provider checked against `PROVIDERS` constant (allowlist). Title is a plain string used in `$set`. No `$where` or raw query construction. IDs come from URL params and are used directly in `_id` queries (Mongoose casts). |

**Note on ObjectId validation:** While not a security vulnerability per se, the lack of ObjectId format validation before passing to Mongoose queries means invalid IDs throw CastError (500) rather than returning 404. This is a robustness issue, not a security issue — Mongoose's strict typing prevents injection.

## Architecture Alignment

| Check | Status | Evidence |
|-------|--------|----------|
| Folder structure matches CLAUDE.md | **PASS** | All files in specified locations. Types in `src/types/`, constants in `src/constants/`, contexts in `src/contexts/`, hooks in `src/hooks/`, providers in `src/components/providers/`, sidebar in `src/components/sidebar/`, common in `src/components/common/`. |
| Mongoose models match specified schema | **PASS** | Conversation has `userId, title, defaultProvider, defaultModel, rootNodeId` with `{ timestamps: true }` and index `{ userId: 1, updatedAt: -1 }`. Node has `conversationId, parentId, role, content, provider, model` with `{ timestamps: { createdAt: true, updatedAt: false } }` and correct indexes. |
| API routes match specified contracts | **PASS** | All endpoints return the exact response shapes defined in CLAUDE.md. Status codes match (201 for POST, 200 for GET/PATCH/DELETE, 401 for auth, 404 for not found). |
| Components are where they should be | **PASS** | ConversationList and ConversationItem in `components/sidebar/`. ConfirmDialog and ToastProvider in `components/common/`. ConversationProvider and UIProvider in `components/providers/`. |
| Data flow between components as designed | **PASS** | Context + useReducer pattern. ConversationProvider fetches on mount. Components dispatch actions. Two separate contexts (not merged). |
| Any files that shouldn't exist | **PASS** | No unexpected files found. |
| Any quiet deviations from the architecture | **PASS** | Root `layout.tsx` uses `<Toaster />` directly from sonner import rather than the `ToastProvider` wrapper component. This is functionally identical. The `ToastProvider` component exists at `src/components/common/ToastProvider.tsx` but is not used in the root layout. **Acceptable deviation** — the component exists for reuse if needed. |

### Deviation Detail: ToastProvider not used in root layout
- **Specified:** T-021 says "Add [ToastProvider] to root layout.tsx"
- **Implemented:** Root `layout.tsx` imports `Toaster` directly from `@/components/ui/sonner` instead of using `ToastProvider`
- **Assessment:** Acceptable — functionally identical. The `ToastProvider` wrapper exists and could be swapped in, but the direct import is simpler.

## Forward Compatibility

| Concern | Current Code | Future Need | Assessment |
|---------|-------------|-------------|------------|
| F-05: API Key Management | Settings page check in dashboard (`GET /api/settings/api-keys`) | Full API key CRUD on settings page | **Compatible** — Dashboard only reads key existence. Settings page (F-05) will implement full management. |
| F-06: Chat Interface | `ConversationContext` has `nodes: Map`, `activeNodeId`, `ADD_NODES`, `REMOVE_NODES` | Chat page will load nodes, set active node, add nodes from LLM responses | **Compatible** — All needed actions are defined. `SET_ACTIVE_CONVERSATION` clears nodes (clean state for new conversation). |
| F-06: Tree Operations | `ChildrenMap` type defined in `src/types/tree.ts` | `src/lib/tree.ts` will implement `buildChildrenMap`, `findDescendants`, etc. | **Compatible** — Type matches expected signature `Map<string, string[]>`. Node deletion route already uses inline BFS which aligns with the future `findDescendants` function. |
| F-07: Tree Visualization | `UIContext` has `isTreeOpen`, `TOGGLE_TREE` | TreeSidebar will toggle visibility | **Compatible** — UI state ready. |
| F-08: Branching | Node model has `parentId`, no `childrenIds` stored | Branching inserts new node with parentId pointing to branch point | **Compatible** — Matches CLAUDE.md: "childrenIds NOT stored — compute client-side". |
| F-11: Import/Export | `ExportedTree` type defined with full shape including `childrenIds` | Import route will validate and create conversation + nodes | **Compatible** — Type is ready. |
| Conversation defaults | `defaultProvider: "openai"` hardcoded in ConversationList and DashboardPage | Users may want to create conversations with different default providers | **Low concern** — The "New Conversation" dialog doesn't let users pick a provider/model. This is consistent with the spec (T-021 says dialog/modal for creation), but future UX improvement could add provider selection. Not a compatibility issue. |

## Summary
- Critical issues: 0
- Medium issues: 1 (Missing try-catch for Mongoose CastError on invalid ObjectIds)
- Low issues: 2 (Missing try-catch for malformed JSON body; `showCloseButton` prop)
- Recommendation: **FIX FIRST**

All acceptance criteria for T-017 through T-023 are met. However, all 4 issues should be fixed for robustness before proceeding:
1. Wrap all API route handlers in try-catch with CastError → 400 handling.
2. Ensure malformed JSON request bodies return 400, not 500.
3. Remove unrecognized `showCloseButton` prop from ConfirmDialog.
4. Use `ToastProvider` wrapper in root layout per T-021 spec.

See `docs/signals/f-04-protected-layout-conversation-management/REQUIRES_REVISION` for detailed fix instructions.
