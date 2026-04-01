# Error Handling & Polish — Audit Report (Cycle 2)
Date: 2026-04-01
Tasks covered: T-059, T-060, T-061, T-062

## Cycle 1 Fix Verification

| # | Cycle 1 Issue | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Orphaned user node on LLM failure + retry (Medium) | **FIXED** | `api/llm/chat/route.ts:159-164` — inner catch block now calls `await Node.deleteOne({ _id: userNode._id })` to clean up the user node on LLM failure, and resets `rootNodeId` if it was the first message. Retry creates a fresh user node with no orphan. |
| 2 | 422 toast missing clickable settings link (Low) | **FIXED** | `page.tsx:162-165` — 422 handler now uses `toast.error(errorMsg, { action: { label: "Go to Settings", onClick: () => router.push("/settings") } })`, providing a clickable action button. |
| 3 | Stale closure in UIProvider.refreshProviders (Low) | **FIXED** | `UIProvider.tsx:49-52` — `selectedProviderRef` ref created and kept in sync via `useEffect`. Line 63 reads `selectedProviderRef.current` instead of capturing `state.selectedProvider` in the callback closure. `useCallback` dependency array is now empty (line 76). |

## Spec Compliance

### T-059: Implement LLM Error Handling with Toast Notifications

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | 429 shows rate limit toast with retry button (FR-034) | **PASS** | `page.tsx:167-169` — status 429 maps to "Rate limited by {provider}. Please try again in a moment." with `showRetry = true`; line 184-187 renders `toast.error(errorMsg, { action: { label: "Retry", onClick: retry } })`. |
| 2 | 422 shows missing key toast with settings link (FR-034) | **PASS** | `page.tsx:161-166` — 422 shows toast with `action: { label: "Go to Settings", onClick: () => router.push("/settings") }`. Clickable link to settings. |
| 3 | 502 shows invalid key or API error toast (FR-034) | **PASS** | `page.tsx:170-175` — 502 response body parsed; "invalid api key" check (case-insensitive) shows provider-specific message, otherwise generic API error. |
| 4 | Network failure shows network error toast (FR-034) | **PASS** | `page.tsx:207-213` — catch block shows "Network error. Please check your connection and try again." with Retry button. |
| 5 | Retry button re-sends the message | **PASS** | `page.tsx:136` — `const retry = () => handleSend(content, provider, model)` re-invokes with same arguments. |
| 6 | No empty assistant node on failure (FR-035) | **PASS** | Server-side: `route.ts:138-182` — assistant node only created after successful LLM response (line 142-149). On failure, user node is deleted (line 160). Client-side: optimistic node removed on error (lines 152, 208). |
| 7 | `npm run build` passes | **PASS** | Build completes successfully with zero errors, all 18 routes recognized. |

### T-060: Implement Provider Availability Check in ModelSelector

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Providers without keys are shown but disabled/grayed (FR-007) | **PASS** | `ModelSelector.tsx:30-38` — all providers shown; `isProviderEnabled` returns false for providers not in `availableProviders` (except mock). Disabled providers show gray dot (`#9CA3AF`, line 76) and `text-muted-foreground` class (line 79). `DropdownMenuItem` has `disabled={!enabled}` (line 90). |
| 2 | Selecting disabled provider shows "Add key in Settings" message | **PASS** | `ModelSelector.tsx:91-96` — `onClick` for disabled provider fires `toast.info(...)` and returns early. |
| 3 | Only providers with keys can actually send messages | **PASS** | Client-side: disabled items prevent selection. Server-side: `route.ts:85-90` returns 422 if no key. Double protection. |
| 4 | `npm run build` passes | **PASS** | Confirmed. |

### T-061: Add Keyboard Shortcuts and Accessibility Basics

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All interactive elements reachable via Tab | **PASS** | `ConversationItem.tsx:81` — `tabIndex={0}`. `BranchIndicator.tsx:18` — native `<button>`. `ChatInput.tsx:50` — native `<textarea>`. `ChatMessage.tsx:150` — native `<button>` for delete. `BranchMenu.tsx:36` — native `<button>`. `TreeSidebar.tsx:27` — native `<button>`. |
| 2 | Enter/Space activates buttons and tree nodes | **PASS** | `ConversationItem.tsx:90-95` — explicit `onKeyDown` for Enter/Space. Native `<button>` elements handle Enter/Space natively. |
| 3 | Dialog focus trapping works | **PASS** | `ConfirmDialog.tsx` uses shadcn `Dialog`/`DialogContent` (Radix UI) which implements focus trapping by default. |
| 4 | No contrast violations for primary text (NFR-010) | **PASS** | OKLCH theme colors follow shadcn's contrast-safe palette. Provider colors on decorative dots, not primary text. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-062: Final Integration Verification and Build Check

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `npm run build` passes | **PASS** | Build succeeds with all 18 routes. |
| 2 | `npm test` passes with all tests green | **FAIL** | 3 tests fail in `__tests__/api/llm-chat.test.ts` — see Bug Detection below. |
| 3 | All three user flows from SRD §6 complete successfully | **PASS** (by design) | All routes, endpoints, and components wired for: Register → Dashboard → Settings → Key → Conversation → Send → Response; branching navigation; export/import. |
| 4 | Mock provider hidden in production build | **PASS** | Triple-gated: `ModelSelector.tsx:31-33`, `lib/providers/index.ts:24-26`, `route.ts:60-61`. |
| 5 | Data isolation verified | **PASS** (by design) | Every API route calls `auth()` and filters by `session.user.id`. |

## Bug Detection

### Bug 1: Test mock missing `Node.deleteOne`, causing 3 test failures

**File:** `__tests__/api/llm-chat.test.ts`, lines 54-59
**Severity:** Medium

**Description:** The cycle 1 fix added `await Node.deleteOne({ _id: userNode._id })` at `route.ts:160` to clean up orphaned user nodes on LLM failure. However, the test mock for `Node` (lines 54-59) only defines `find` and `create` — it does not define `deleteOne`. When the LLM error tests execute, the route's inner catch block tries `Node.deleteOne(...)`, which throws `TypeError: Node.deleteOne is not a function`. This error propagates to the outer catch block at line 183, which returns status 500 instead of the expected 429 or 502.

**Failing tests:**
1. "should return 429 on rate limit error from LLM" — expects 429, gets 500
2. "should return 502 on invalid API key error from LLM" — expects 502, gets 500
3. "should return 502 on generic LLM error" — expects 502, gets 500

**Fix:** Add `deleteOne` to the Node mock:
```typescript
const mockNodeDeleteOne = vi.fn();
vi.mock("@/models/Node", () => ({
  Node: {
    find: (...args: unknown[]) => mockNodeFind(...args),
    create: (...args: unknown[]) => mockNodeCreate(...args),
    deleteOne: (...args: unknown[]) => mockNodeDeleteOne(...args),
  },
}));
```
And have `mockNodeDeleteOne.mockResolvedValue({ deletedCount: 1 })` in the `beforeEach`.

### Bug 2: Test "should preserve user node on LLM failure" is semantically stale

**File:** `__tests__/api/llm-chat.test.ts`, lines 307-321
**Severity:** Low

**Description:** The test at line 307 is named "should preserve user node on LLM failure for retry" and asserts that `mockNodeCreate` was called once (i.e., only the user node was created, not the assistant node). This test still passes because it doesn't verify what happens after creation. However, the production code now **deletes** the user node on LLM failure (route.ts:160) — the exact opposite of "preserving" it. The test name and intent no longer match the actual behavior. This test currently passes by coincidence (deleteOne throws, but the test doesn't check the response status or deletion calls).

**Fix:** Rename the test to "should delete user node on LLM failure to prevent orphans" and update assertions to verify `Node.deleteOne` was called with the user node's ID. Also add `mockNodeDeleteOne` to the mock (same fix as Bug 1).

## Security

No issues found. Same findings as cycle 1 — all security checks pass.

## Architecture Alignment

No deviations found. All files in correct locations, models match schemas, API routes match contracts, two separate contexts as specified.

## Forward Compatibility

No concerns. F-12 is the final feature.

## Summary
- Critical issues: 0
- Medium issues: 1 (test mock missing `Node.deleteOne` → 3 failing tests)
- Low issues: 1 (stale test name/semantics)
- Recommendation: **FIX FIRST**
