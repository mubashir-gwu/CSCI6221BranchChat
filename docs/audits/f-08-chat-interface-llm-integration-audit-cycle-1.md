# Chat Interface & LLM Integration — Audit Report (Cycle 1)

Date: 2026-04-01
Tasks covered: T-036, T-037, T-038, T-039, T-040, T-041, T-042, T-043

---

## Spec Compliance

### T-036: Implement LLM Chat API Route

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Successful request returns `{ userNode, assistantNode }` with correct fields | **PASS** | `route.ts:143-149` returns both serialized nodes with 201 status. Test "returns userNode and assistantNode on success" confirms shape. |
| 2 | Missing API key returns 422 with "No API key found for [provider]" | **PASS** | `route.ts:86-90` returns 422 with exact message. Test confirms. |
| 3 | Mock provider works without API key in development | **PASS** | `route.ts:83-84` skips key decryption for mock. Test "allows mock provider without API key in development" confirms. |
| 4 | Rate limit errors return 429 | **PASS** | `route.ts:152-156` checks `llmError.status === 429`. Test confirms. |
| 5 | Invalid key returns 502 | **PASS** | `route.ts:158-162` checks `llmError.status === 401`, returns 502. Test confirms. |
| 6 | User node preserved on LLM failure for retry (FR-035) | **PASS** | User node is created at `route.ts:115-122` before LLM call at `route.ts:131`. On LLM failure, the catch block at `route.ts:150` returns an error without deleting the user node. Test "preserves user node on LLM failure" confirms. |
| 7 | First message sets `conversation.rootNodeId` | **PASS** | `route.ts:125-127` updates rootNodeId when `parentNodeId === null`. Test confirms. |
| 8 | `maxDuration = 60` is exported | **PASS** | `route.ts:14`: `export const maxDuration = 60`. |
| 9 | `npm run build` passes | **PASS** | Build completes successfully with `/api/llm/chat` route recognized. |

### T-037: Implement ModelSelector Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Dropdown shows providers grouped with color coding (FR-015, FR-018) | **PASS** | `ModelSelector.tsx:55-93` renders provider groups with colored dots via `providerInfo.color`. |
| 2 | Only providers with keys are shown (FR-007) | **PASS** | `ModelSelector.tsx:29-34` filters `visibleProviders` by `availableProviders` list. |
| 3 | Mock shown only in development | **PASS** | `ModelSelector.tsx:31` checks `process.env.NODE_ENV === "development"`. |
| 4 | Selecting a model calls `onChange` with `{ provider, model }` | **PASS** | `ModelSelector.tsx:80-85` calls `onChange({ provider: providerKey, model: m.id })`. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-038: Implement ChatMessage Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Markdown formatting renders correctly (FR-014) | **PASS** | `ChatMessage.tsx:58-87` uses `ReactMarkdown` with `react-syntax-highlighter` for code blocks. |
| 2 | Provider color border visible on assistant messages (FR-015) | **PASS** | `ChatMessage.tsx:33-34` applies `borderLeftColor` via inline style from `PROVIDERS[node.provider].color`. |
| 3 | Provider/model badge shown on assistant messages | **PASS** | `ChatMessage.tsx:45-55` renders badge with provider display name and model. |
| 4 | Branch indicator shown when `childCount > 1` (FR-016) | **PASS** | `ChatMessage.tsx:90-98` conditionally renders `BranchIndicator` when `childCount > 1`. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-039: Implement ChatInput and LoadingIndicator

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Typing a message and pressing Enter sends it (FR-013) | **PASS** | `ChatInput.tsx:36-40` handles Enter key (without Shift) to call `handleSend`. |
| 2 | ModelSelector inherits parent node's provider/model (FR-018) | **PARTIAL** | `ChatInput.tsx:24-27` initializes `selection` state from `defaultProvider`/`defaultModel` props, but `useState` only reads initial value — if the parent changes these props (e.g., user navigates to a different branch), the ModelSelector will not update. See Bug #1 below. |
| 3 | Send button disabled while loading (FR-017) | **PASS** | `ChatInput.tsx:52` passes `disabled` to button. `page.tsx:170` passes `disabled={uiState.isLoading}`. |
| 4 | Loading dots animate while waiting for response | **PASS** | `LoadingIndicator.tsx` renders three bouncing dots with staggered animation delays. |
| 5 | Input clears after sending | **PASS** | `ChatInput.tsx:33` calls `setMessage("")` after `onSend`. |
| 6 | `npm run build` passes | **PASS** | Confirmed. |

### T-040: Implement ChatPanel Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Chat displays linear path from root to active node (FR-012) | **PASS** | `ChatPanel.tsx:37-55` maps `activePath` (root-to-active) to `ChatMessage` components. `useActivePath.ts` computes path via `getPathToRoot`. |
| 2 | User and assistant messages are visually distinct | **PASS** | `ChatMessage.tsx:28-34` applies different alignment and styling: user gets primary background (right side), assistant gets muted background with provider color left border. |
| 3 | Auto-scrolls to newest message | **PASS** | `ChatPanel.tsx:22-27` scrolls `bottomRef` into view on `activePath.length` or `isLoading` change. |
| 4 | Loading indicator shown when waiting for LLM (FR-017) | **PASS** | `ChatPanel.tsx:50-52` renders `LoadingIndicator` when `isLoading` is true. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-041: Implement Chat Page

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Navigating to `/chat/[id]` loads and displays conversation (FR-012) | **PASS** | `page.tsx:37-79` fetches nodes on mount, builds nodesMap, sets active node to deepest leaf. |
| 2 | Sending a message creates user + assistant nodes and updates chat (FR-013) | **PASS** | `page.tsx:114-156` POSTs to `/api/llm/chat`, dispatches `ADD_NODES` and `SET_ACTIVE_NODE`. |
| 3 | Model selector pre-fills with active node's provider/model (FR-018) | **PARTIAL** | `page.tsx:109-112` correctly derives `defaultProvider`/`defaultModel`, but `ChatInput` doesn't sync when these change. See Bug #1 below. |
| 4 | Loading state shown during LLM call (FR-017) | **PASS** | `page.tsx:116` sets loading true; `page.tsx:152` sets false in `finally`. |
| 5 | New messages appear and auto-scroll | **PASS** | `ADD_NODES` dispatch adds to state.nodes, `useActivePath` recomputes, `ChatPanel` auto-scrolls. |
| 6 | `npm run build` passes | **PASS** | Confirmed. |

### T-042: Markdown Rendering Fix for Turbopack

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Code blocks with syntax highlighting render correctly in dev mode | **PASS** | Execution Log confirms Turbopack handles react-markdown v10 + react-syntax-highlighter. No `--webpack` fallback needed. |
| 2 | `npm run dev` starts without errors | **PASS** | Per Execution Log. |
| 3 | `npm run build` passes | **PASS** | Confirmed. |

### T-043: Write Tests for LLM Chat Route

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | All tests pass via `npm test` | **PASS** | 82/82 tests pass (8 test files), including 16 new tests in `llm-chat.test.ts`. |
| 2 | No real API calls made in tests (NF-013) | **PASS** | `llm-chat.test.ts` mocks all providers via `vi.mock('@/lib/providers')`. |
| 3 | Tests use mock provider | **PASS** | Tests mock `getProvider` to return a controlled mock, plus one test specifically validates the mock provider path without API key. |

---

## Bug Detection

### Bug #1 — ChatInput selection state not synced with prop changes (Medium)

**File:** `src/components/chat/ChatInput.tsx:24-27`

**Description:** `useState` only reads `defaultProvider`/`defaultModel` as the initial value. When the user navigates to a different branch (changing the active node's provider/model), or when the conversation changes, the `selection` state inside `ChatInput` retains the stale previous value. The ModelSelector will display the old provider/model rather than the new active node's provider/model.

**Impact:** User confusion — after branch navigation, the model selector shows the wrong provider/model. Sending a message would use the stale selection rather than the expected one from the new active node.

**Fix:** Add a `useEffect` that updates `selection` when `defaultProvider` or `defaultModel` props change:
```typescript
useEffect(() => {
  setSelection({ provider: defaultProvider, model: defaultModel });
}, [defaultProvider, defaultModel]);
```

### Bug #2 — Gemini provider does not handle system role messages (Medium)

**File:** `src/lib/providers/gemini.ts:14-16`

**Description:** The role mapping `m.role === 'assistant' ? 'model' : 'user'` maps both `system` and `user` roles to `'user'`. The Gemini API supports system instructions via a separate `systemInstruction` parameter, but this provider sends system messages as regular user messages. While no code currently creates system-role nodes, the data model allows `role: "system"` and `contextBuilder.ts` would include them in the message array if present. If system messages are added in a future feature (e.g., F-12 or custom system prompts), the Gemini provider will silently mishandle them.

**Impact:** Low today (no system nodes are created), but becomes Medium once system prompts are introduced. System instructions would be treated as regular user messages, potentially confusing the model.

**Fix:** Extract system messages and pass them via the `config.systemInstruction` parameter in `ai.chats.create()`.

### Bug #3 — No loading indicator during initial node fetch (Low)

**File:** `src/app/(protected)/chat/[conversationId]/page.tsx:37-79`

**Description:** The `loadNodes()` effect does not set `isLoading` while fetching historical nodes from the API. During this fetch, the user sees the empty state message ("Send a message to start the conversation") even when the conversation has existing messages. This is misleading for conversations with history.

**Impact:** User confusion on page load for existing conversations. The empty state flashes briefly before messages appear.

### Bug #4 — First-child leaf selection ignores previously active branch (Low)

**File:** `src/app/(protected)/chat/[conversationId]/page.tsx:65-70`

**Description:** On page load, the code walks the first child of each node to find the deepest leaf. If the user was previously on a non-first branch, re-opening the conversation will land on the wrong branch. There is no persistence of which branch was last active.

**Impact:** Minor UX inconvenience when returning to a branched conversation. The user must manually navigate back to their previous branch.

---

## Security

### S-1 — Auth check after input validation (Low)

**File:** `src/app/api/llm/chat/route.ts:40-69`

**Description:** Input validation (provider/model existence) runs before the auth check at line 66-69. An unauthenticated user can probe whether a provider or model name is valid by examining the error response (400 vs 401). Since provider and model names are public knowledge (they're defined in client-side constants shipped in the JS bundle), this leaks no private information.

**Verdict:** Acceptable. No fix needed.

### S-2 — Conversation ownership verified correctly (PASS)

**File:** `src/app/api/llm/chat/route.ts:74-80`

The route fetches the conversation by ID and checks `conversation.userId.toString() !== session.user.id`. User A cannot send messages in User B's conversation. All database queries for nodes are scoped to the verified `conversationId`.

### S-3 — API key handling (PASS)

API keys are decrypted server-side only (`route.ts:92`), never returned to the client. The `GET /api/settings/api-keys` endpoint returns only masked keys (verified in prior audit). No keys in client-side code or git.

### S-4 — No injection vectors (PASS)

User content (`content` field) is passed to the LLM provider as a string parameter via official SDKs — no string interpolation into queries. Mongoose queries use object syntax (`{ userId, provider }`), not string concatenation. `ReactMarkdown` sanitizes HTML by default (no `rehypeRaw` plugin).

### S-5 — parentNodeId not validated against conversation (Low)

**File:** `src/app/api/llm/chat/route.ts:112-122`

**Description:** The route does not verify that `parentNodeId` belongs to the current conversation before creating the user node. However, since `buildContext` calls `getPathToRoot` which walks the `nodesMap` (built only from nodes in this conversation), a cross-conversation `parentNodeId` would cause `getPathToRoot` to throw "Node not found", which is caught by the outer catch and returns 500. The user node is NOT created (it's created after `buildContext`). So no data corruption occurs, but the error response is a generic 500 instead of a clear 400.

**Verdict:** Low severity. The behavior is safe but the error message is unhelpful.

---

## Architecture Alignment

### A-1 — Folder structure matches spec (PASS)

All files are in the locations specified by CLAUDE.md:
- `src/app/api/llm/chat/route.ts` — correct
- `src/components/chat/ModelSelector.tsx` — correct
- `src/components/chat/ChatMessage.tsx` — correct
- `src/components/chat/ChatInput.tsx` — correct
- `src/components/chat/LoadingIndicator.tsx` — correct
- `src/components/chat/ChatPanel.tsx` — correct
- `src/components/chat/BranchIndicator.tsx` — correct (also created BranchMenu.tsx, listed in spec)
- `src/hooks/useActivePath.ts` — correct
- `src/app/(protected)/chat/[conversationId]/page.tsx` — correct
- `__tests__/api/llm-chat.test.ts` — correct

### A-2 — API contract matches spec (PASS)

The `POST /api/llm/chat` route follows the specified contract exactly:
- Request: `{ conversationId, parentNodeId, content, provider, model }` — correct
- 201: `{ userNode, assistantNode }` — correct
- 422: "No API key found for [provider]." — correct
- 429: "Rate limited by [provider]." — correct
- 502: "Invalid API key" / "[provider] API error" — correct

### A-3 — Component props match spec (PASS)

All component prop interfaces match the Architecture Document §6 component table in CLAUDE.md:
- `ChatPanel`: `activePath`, `childrenMap`, `onBranchNavigate`, `isLoading` — correct
- `ChatMessage`: `node`, `childCount`, `isActive`, `onBranchClick` — correct
- `ChatInput`: `onSend`, `disabled`, `defaultProvider`, `defaultModel` (plus `availableProviders`) — correct
- `ModelSelector`: `value`, `onChange`, `availableProviders` — correct
- `BranchIndicator`: `nodeId`, `branchCount`, `onClick` — correct

### A-4 — Data flow matches design (PASS)

State management uses two separate contexts (ConversationContext, UIContext) as specified. `childrenMap` and `activePath` are computed (useMemo/useActivePath), never stored — matching the spec's "Derived (useMemo)" requirement.

### A-5 — LLM orchestration follows 12-step flow (PASS)

The route implements all 12 steps from Architecture Document §5.4 in the correct order: parse → validate → auth → ownership → decrypt key → load nodes → build context → insert user node → set rootNodeId → call LLM → insert assistant node → return.

---

## Forward Compatibility

### FC-1 — F-09: Tree Branching & Navigation (Compatible)

**Current code:** `ChatPanel` renders a linear `activePath`. `BranchIndicator` and `BranchMenu` are already implemented. `onBranchNavigate` callback is wired through to `page.tsx:158-163`.

**Assessment:** F-09 needs to add branch creation (sending a message from a non-leaf node) and navigation. The `handleSend` in `page.tsx` already passes `state.activeNodeId` as `parentNodeId`, so sending from any node in the path naturally creates a branch. BranchMenu is ready to use. Compatible.

### FC-2 — F-10: Tree Visualization (Compatible)

**Current code:** `state.nodes` (Map) and `childrenMap` are available in the chat page. `page.tsx` already references TreeSidebar toggle button placeholder.

**Assessment:** F-10 needs access to all nodes and the children map to render the tree visualization. Both are computed and available. The `handleBranchNavigate` callback can be shared with TreeVisualization's `onNodeClick`. Compatible.

### FC-3 — F-11: Export & Import (Compatible)

**Current code:** Nodes are stored in the DB with the correct schema (conversationId, parentId, role, content, provider, model, createdAt). The export route can query by conversationId and compute childrenIds.

**Assessment:** No blockers. The data model supports export/import as specified.

### FC-4 — ChatInput selection sync issue affects F-09 (Concern)

**Current code:** Bug #1 (ChatInput not syncing `selection` state) will become more visible when F-09 enables branch navigation — users will frequently change the active node, and the ModelSelector will show stale values.

**Assessment:** Should be fixed before or during F-09 implementation.

---

## Summary

- Critical issues: 0
- Medium issues: 2 (Bug #1: ChatInput selection sync, Bug #2: Gemini system role)
- Low issues: 4 (Bug #3: no initial loading indicator, Bug #4: first-child leaf selection, S-1: auth order, S-5: parentNodeId validation error message)
- Recommendation: **FIX FIRST** — The two medium issues should be addressed before proceeding.
