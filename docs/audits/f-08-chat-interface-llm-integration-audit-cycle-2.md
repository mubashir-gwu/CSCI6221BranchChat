# Chat Interface & LLM Integration — Audit Report (Cycle 2)

Date: 2026-04-01
Tasks covered: T-036, T-037, T-038, T-039, T-040, T-041, T-042, T-043

---

## Cycle 1 Fix Verification

All 6 issues from cycle 1 REQUIRES_REVISION have been addressed:

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | ChatInput selection state not synced with prop changes | **FIXED** | `ChatInput.tsx:29-31` — `useEffect` now calls `setSelection` when `defaultProvider`/`defaultModel` change. |
| 2 | Gemini provider does not handle system role messages | **FIXED** | `gemini.ts:14-15` filters system messages; lines 24-26 build `systemInstruction`; line 31 passes it to `ai.chats.create()`. |
| 3 | No loading indicator during initial node fetch | **FIXED** | `page.tsx:41` sets `SET_LOADING: true` at start of `loadNodes()`; line 84 sets false in `finally`. |
| 4 | First-child leaf selection ignores previously active branch | **FIXED** | `page.tsx:55-57` checks `window.location.hash` for a previously active node ID. Lines 77, 153, 172 update the hash on navigation. |
| 5 | Auth check after input validation | **FIXED** | `route.ts:39-43` — auth check now immediately follows JSON parsing, before any field validation. |
| 6 | parentNodeId not validated against conversation | **FIXED** | `route.ts:112-118` — validates `parentNodeId` against `nodesMap`, returns 400 with clear message. |

---

## Spec Compliance

### T-036: Implement LLM Chat API Route

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Successful request returns `{ userNode, assistantNode }` with correct fields | **PASS** | `route.ts:151-157` returns both serialized nodes with 201. |
| 2 | Missing API key returns 422 with "No API key found for [provider]" | **PASS** | `route.ts:87-90`. |
| 3 | Mock provider works without API key in development | **PASS** | `route.ts:83-84` skips key decryption for mock. |
| 4 | Rate limit errors return 429 | **PASS** | `route.ts:160-164`. |
| 5 | Invalid key returns 502 | **PASS** | `route.ts:166-170`. |
| 6 | User node preserved on LLM failure for retry (FR-035) | **PASS** | User node created at line 123, LLM called at 139. On failure, catch at 158 returns error without deleting user node. |
| 7 | First message sets `conversation.rootNodeId` | **PASS** | `route.ts:133-135`. |
| 8 | `maxDuration = 60` is exported | **PASS** | `route.ts:14`. |
| 9 | `npm run build` passes | **PASS** | Build completes successfully. |

### T-037: Implement ModelSelector Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Dropdown shows providers grouped with color coding | **PASS** | `ModelSelector.tsx:59-93` renders provider groups with colored dots. |
| 2 | Only providers with keys are shown | **PASS** | `ModelSelector.tsx:29-34` filters by `availableProviders`. |
| 3 | Mock shown only in development | **PASS** | `ModelSelector.tsx:31`. |
| 4 | Selecting a model calls `onChange` with `{ provider, model }` | **PASS** | `ModelSelector.tsx:78`. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-038: Implement ChatMessage Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Markdown formatting renders correctly (FR-014) | **PASS** | `ChatMessage.tsx:59-86` uses `ReactMarkdown` + `SyntaxHighlighter`. |
| 2 | Provider color border visible on assistant messages (FR-015) | **PASS** | `ChatMessage.tsx:38-42` applies `borderLeftColor`. |
| 3 | Provider/model badge shown on assistant messages | **PASS** | `ChatMessage.tsx:45-55`. |
| 4 | Branch indicator shown when `childCount > 1` (FR-016) | **PASS** | `ChatMessage.tsx:90-98`. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-039: Implement ChatInput and LoadingIndicator

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Typing a message and pressing Enter sends it (FR-013) | **PASS** | `ChatInput.tsx:40-44`. |
| 2 | ModelSelector inherits parent node's provider/model (FR-018) | **PASS** | `ChatInput.tsx:24-27` initializes from props; `useEffect` at lines 29-31 syncs on prop change. Cycle 1 Bug #1 is fixed. |
| 3 | Send button disabled while loading (FR-017) | **PASS** | `ChatInput.tsx:62`. |
| 4 | Loading dots animate while waiting for response | **PASS** | `LoadingIndicator.tsx` renders bouncing dots. |
| 5 | Input clears after sending | **PASS** | `ChatInput.tsx:37`. |
| 6 | `npm run build` passes | **PASS** | Confirmed. |

### T-040: Implement ChatPanel Component

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Chat displays linear path from root to active node (FR-012) | **PASS** | `ChatPanel.tsx:40-51` maps `activePath` to `ChatMessage` components. |
| 2 | User and assistant messages are visually distinct | **PASS** | `ChatMessage.tsx:30-37` — different alignment and background styles. |
| 3 | Auto-scrolls to newest message | **PASS** | `ChatPanel.tsx:25-27`. |
| 4 | Loading indicator shown when waiting for LLM (FR-017) | **PASS** | `ChatPanel.tsx:52`. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-041: Implement Chat Page

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Navigating to `/chat/[id]` loads and displays conversation (FR-012) | **PASS** | `page.tsx:37-89` fetches nodes, builds map, sets active node. |
| 2 | Sending a message creates user + assistant nodes and updates chat (FR-013) | **PASS** | `page.tsx:124-167`. |
| 3 | Model selector pre-fills with active node's provider/model (FR-018) | **PASS** | `page.tsx:119-122` derives defaults; `ChatInput` syncs via `useEffect`. |
| 4 | Loading state shown during LLM call (FR-017) | **PASS** | `page.tsx:126` sets loading true; line 163 sets false in `finally`. |
| 5 | New messages appear and auto-scroll | **PASS** | `ADD_NODES` dispatch + `useActivePath` recomputes + `ChatPanel` auto-scrolls. |
| 6 | `npm run build` passes | **PASS** | Confirmed. |

### T-042: Markdown Rendering Fix for Turbopack

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Code blocks with syntax highlighting render correctly in dev mode | **PASS** | Per Execution Log. |
| 2 | `npm run dev` starts without errors | **PASS** | Per Execution Log. |
| 3 | `npm run build` passes | **PASS** | Confirmed. |

### T-043: Write Tests for LLM Chat Route

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | All tests pass via `npm test` | **FAIL** | 8 of 16 tests in `llm-chat.test.ts` fail. See Bug #1 below. |
| 2 | No real API calls made in tests (NF-013) | **PASS** | All providers mocked via `vi.mock`. |
| 3 | Tests use mock provider | **PASS** | Tests mock `getProvider`. |

---

## Bug Detection

### Bug #1 — Tests not updated for parentNodeId validation fix (Medium)

**File:** `__tests__/api/llm-chat.test.ts:123-125`

**Description:** The cycle 1 fix #6 added parentNodeId validation at `route.ts:112-118`. However, the test suite's default `mockNodeFind` at line 123 returns an empty array via `.lean()`. All tests using `validBody` (which has `parentNodeId: "node-1"`) now hit the new 400 response ("Parent node not found in this conversation") before reaching the LLM call, node creation, or error handling paths.

**Failing tests (8):**
- "should return 201 with userNode and assistantNode on success"
- "should NOT set rootNodeId when parentNodeId is provided"
- "should include ancestor path context via buildContext"
- "should work with mock provider without API key"
- "should return 429 on rate limit error from LLM"
- "should return 502 on invalid API key error from LLM"
- "should return 502 on generic LLM error"
- "should preserve user node on LLM failure for retry"

**Impact:** 8 of 82 tests fail. The acceptance criterion "All tests pass via `npm test`" for T-043 is not met.

**Fix:** Update the default `mockNodeFind` in `beforeEach` (line 123-125) to return a node with `_id: "node-1"` so the parentNodeId validation passes:

```typescript
mockNodeFind.mockReturnValue({
  lean: () => [
    {
      _id: { toString: () => "node-1" },
      conversationId: { toString: () => "conv-1" },
      parentId: null,
      role: "user",
      content: "Previous message",
      provider: null,
      model: null,
      createdAt: now,
    },
  ],
});
```

---

## Security

No new security issues. All cycle 1 findings re-verified:

- **Auth check order (S-1):** Now fixed — auth runs before any validation (`route.ts:39-43`). No longer leaks provider/model validity to unauthenticated users.
- **Conversation ownership (S-2):** Still correct (`route.ts:74-80`).
- **API key handling (S-3):** Still correct — decrypted server-side only.
- **No injection vectors (S-4):** Still correct.
- **parentNodeId validation (S-5):** Now fixed — returns clear 400 instead of generic 500 (`route.ts:112-118`).

---

## Architecture Alignment

No deviations from CLAUDE.md or Architecture Document. All files in correct locations, all API contracts match, all component props match spec. No changes from cycle 1 assessment.

---

## Forward Compatibility

### FC-1 — F-09: Tree Branching & Navigation (Compatible)

Cycle 1 concern FC-4 (ChatInput selection sync affecting F-09) is now resolved. The `useEffect` in `ChatInput.tsx:29-31` ensures the ModelSelector stays in sync when the active node changes during branch navigation.

### FC-2 — F-10: Tree Visualization (Compatible)

No changes from cycle 1. `state.nodes` and `childrenMap` available for tree rendering.

### FC-3 — F-11: Export & Import (Compatible)

No changes from cycle 1.

### FC-4 — URL hash for active node persistence (Positive)

The `window.location.hash` approach for persisting the active node (`page.tsx:55-57, 77, 153, 172`) is lightweight and works well for same-session navigation. F-09 branch navigation can use the same mechanism via the existing `handleBranchNavigate` callback.

---

## Summary

- Critical issues: 0
- Medium issues: 1 (Bug #1: Tests not updated for parentNodeId validation fix — 8 tests fail)
- Low issues: 0
- Recommendation: **FIX FIRST** — The test suite must be updated to pass before this feature can be marked complete.
