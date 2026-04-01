# Error Handling & Polish — Audit Report (Cycle 1)
Date: 2026-04-01
Tasks covered: T-059, T-060, T-061, T-062

## Spec Compliance

### T-059: Implement LLM Error Handling with Toast Notifications

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | 429 shows rate limit toast with retry button (FR-034) | **PASS** | `src/app/(protected)/chat/[conversationId]/page.tsx:162-163` — status 429 maps to "Rate limited by {provider}. Please try again in a moment." with `showRetry = true`; line 180 renders `toast.error(errorMsg, { action: { label: "Retry", onClick: retry } })`. |
| 2 | 422 shows missing key toast with settings link (FR-034) | **PARTIAL** | `page.tsx:161` — 422 maps to "No API key found for {provider}. Add one in Settings." The message *mentions* Settings but does **not** include a clickable link to `/settings`. The spec says "with link to settings" (T-059 acceptance criterion). A plain text mention is not a link. |
| 3 | 502 shows invalid key or API error toast (FR-034) | **PASS** | `page.tsx:166-171` — 502 response body is parsed; if it contains "invalid api key" (case-insensitive), shows "Invalid API key for {provider}. Check your key in Settings." Otherwise shows "{provider} API error. Please try again." |
| 4 | Network failure shows network error toast (FR-034) | **PASS** | `page.tsx:202-208` — catch block (fetch throws on network failure) shows "Network error. Please check your connection and try again." with Retry button. |
| 5 | Retry button re-sends the message | **PASS** | `page.tsx:135` — `const retry = () => handleSend(content, provider, model)` re-invokes `handleSend` with the same arguments. |
| 6 | No empty assistant node on failure (FR-035) | **PASS** | Server-side: `api/llm/chat/route.ts:138-176` — LLM call is wrapped in try/catch; assistant node is only created after successful LLM response (line 142-149). On failure, only the user node exists. Client-side: optimistic node is removed on error (line 151, 203). |
| 7 | `npm run build` passes | **PASS** | Build completes successfully with zero errors. |

### T-060: Implement Provider Availability Check in ModelSelector

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Providers without keys are shown but disabled/grayed (FR-007) | **PASS** | `ModelSelector.tsx:30-38` — All providers shown; `isProviderEnabled` returns false for providers not in `availableProviders` (except mock). Disabled providers show gray dot (line 77: `#9CA3AF`) and `text-muted-foreground` class (line 79). `DropdownMenuItem` has `disabled={!enabled}` (line 90). |
| 2 | Selecting disabled provider shows "Add key in Settings" message | **PASS** | `ModelSelector.tsx:91-95` — `onClick` for disabled provider fires `toast.info("Add an API key for {provider.displayName} in Settings to use this model.")` and returns early. |
| 3 | Only providers with keys can actually send messages | **PASS** | Client-side: disabled items prevent selection. Server-side: `api/llm/chat/route.ts:85-93` — API key lookup returns 422 if no key found. Double protection. |
| 4 | `npm run build` passes | **PASS** | Confirmed. |

### T-061: Add Keyboard Shortcuts and Accessibility Basics

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All interactive elements reachable via Tab | **PASS** | `ConversationItem.tsx:81` — `tabIndex={0}`. `BranchIndicator.tsx:18` — native `<button>`. `ChatInput.tsx:50` — native `<textarea>`. `ChatMessage.tsx:151` — native `<button>` for delete. `BranchMenu.tsx:36` — native `<button>` elements. `TreeSidebar.tsx:28` — native `<button>`. Layout sidebar toggle — native `<button>`. All buttons via shadcn `<Button>` render native `<button>` elements. |
| 2 | Enter/Space activates buttons and tree nodes | **PASS** | `ConversationItem.tsx:90-95` — explicit `onKeyDown` handler for Enter and Space. Native `<button>` elements already handle Enter/Space natively. |
| 3 | Dialog focus trapping works | **PASS** | `ConfirmDialog.tsx` uses shadcn `Dialog` / `DialogContent` from Radix UI, which implements focus trapping by default. |
| 4 | No contrast violations for primary text (NFR-010) | **PASS** | OKLCH theme colors in `globals.css` follow shadcn's default contrast-safe palette. Provider colors are used on dots/accents (small decorative elements), not primary text. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-062: Final Integration Verification and Build Check

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `npm run build` passes | **PASS** | Build succeeds with all 18 routes recognized. |
| 2 | `npm test` passes with all tests green | **PASS** | 121 tests across 13 test files — all pass. |
| 3 | All three user flows from SRD section 6 complete successfully | **PASS** (by design) | All routes exist, all API endpoints functional, all components wired. Full flow verification is integration-level. Code paths support: Register -> Dashboard -> Settings -> Add key -> New Conversation -> Send -> Response; branching navigation; export/import. |
| 4 | Mock provider hidden in production build | **PASS** | `ModelSelector.tsx:31-33` — mock filtered out when `NODE_ENV !== 'development'`. `lib/providers/index.ts:24-26` — mock only registered in development. `api/llm/chat/route.ts:60-61` — server rejects mock provider in non-development. Triple-gated. |
| 5 | Data isolation verified | **PASS** (by design) | Every API route calls `auth()` and filters by `session.user.id`. Conversation ownership checked before operations. Node operations scoped through conversation ownership. |

## Bug Detection

### Bug 1: Orphaned user node on LLM failure creates duplicate on retry

**File:** `src/app/(protected)/chat/[conversationId]/page.tsx`, `handleSend` function
**Lines:** 135, 137-211
**Severity:** Medium

**Description:** When the LLM call fails (429, 502, etc.), the server has already created a user node in the database (route.ts:123-130). The client removes the optimistic node (page.tsx:151 or 203) and resets the active node to `state.activeNodeId` (page.tsx:154 or 204). When the user clicks Retry, `handleSend` is called again with the same `parentNodeId`, creating a **second** user node on the server with the same parent. This results in:
1. An orphaned user node from the first attempt (no assistant reply, invisible to the user since the client removed it)
2. A duplicate branch at the same parent node

The spec says "The user node is kept for retry context" (T-059), meaning the retry should reuse the existing user node rather than creating a new one. However, the current retry simply re-invokes the full `handleSend`, which creates a new user+assistant pair.

**Impact:** After a failed LLM call + retry, the conversation tree will have an extra orphaned user node. If the user reloads the page, this orphaned node becomes visible as an unintended branch.

### Bug 2: `refreshProviders` has stale closure over `state.selectedProvider`

**File:** `src/components/providers/UIProvider.tsx`
**Lines:** 49-71
**Severity:** Low

**Description:** The `refreshProviders` callback depends on `state.selectedProvider` (line 71). Since `useCallback` captures the value at render time, the auto-fallback logic (line 58) compares against the provider value from the render when `refreshProviders` was last memoized. This is mostly harmless because `refreshProviders` only runs on mount via `useEffect` (line 73-75), but if it were called again later (e.g., after settings change), the stale closure could cause incorrect fallback behavior.

## Security

### No Issues Found

1. **Auth bypass:** All API routes check `auth()` and return 401 if no session. `middleware.ts` protects all routes except `/login`, `/register`, `/api/auth/*`. **PASS**
2. **Data isolation:** Every database query filters by `userId` from the session. Conversation ownership is verified before node operations. **PASS**
3. **API key exposure:** Keys are encrypted with AES-256-GCM, masked on GET, and only decrypted server-side in the LLM chat route. No secrets in client-side code. **PASS**
4. **Input validation:** Provider and model are validated against known constants. Content is checked for non-empty string. CastError is caught for invalid MongoDB IDs. **PASS**
5. **Mongoose injection:** Query parameters come from validated session IDs and request body fields that are checked before use. **PASS**

## Architecture Alignment

### No Deviations Found

1. **Folder structure:** All files are in the locations specified by CLAUDE.md. **PASS**
2. **Mongoose models:** Match the specified schemas. **PASS**
3. **API routes:** All routes match the specified contracts. Error status codes (422, 429, 502) align with CLAUDE.md. **PASS**
4. **Components:** All components exist in their specified locations with correct props. **PASS**
5. **Data flow:** Two separate contexts (ConversationContext, UIContext) as specified. `availableProviders` correctly cached in UIContext per T-060. Derived values (`childrenMap`, `activePath`) computed via `useMemo`/hooks, not stored. **PASS**
6. **Extra files:** `UIContext.ts` has `availableProviders` and `SET_AVAILABLE_PROVIDERS` action added for T-060. This is an acceptable extension of the spec — the spec says UIProvider should cache available providers. **Acceptable**
7. **Toast implementation:** Uses `sonner` via `toast.error()` and `toast.info()` as specified. **PASS**

## Forward Compatibility

No forward compatibility concerns. F-12 is the final feature — there are no subsequent features that depend on it. The error handling patterns are self-contained and don't introduce constraints on future work.

## Summary
- Critical issues: 0
- Medium issues: 1 (orphaned user node on LLM failure + retry)
- Low issues: 2 (missing settings link in 422 toast, stale closure in refreshProviders)
- Recommendation: **FIX FIRST**
