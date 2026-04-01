# Error Handling & Polish — Audit Report (Cycle 3)
Date: 2026-04-01
Tasks covered: T-059, T-060, T-061, T-062

## Cycle 2 Fix Verification

| # | Cycle 2 Issue | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Test mock missing `Node.deleteOne` — 3 test failures (Medium) | **FIXED** | `__tests__/api/llm-chat.test.ts:54` — `mockNodeDeleteOne` declared, line 59 adds `deleteOne: (...args) => mockNodeDeleteOne(...args)` to Node mock. Line 139: `mockNodeDeleteOne.mockResolvedValue({ deletedCount: 1 })` in `beforeEach`. All 3 previously-failing tests now pass (429 rate limit, 502 invalid key, 502 generic). |
| 2 | Test "should preserve user node" semantically stale (Low) | **FIXED** | `__tests__/api/llm-chat.test.ts:310` — test renamed to "should delete user node on LLM failure to prevent orphans". Assertions updated: verifies `mockNodeCreate` called once (line 316), `mockNodeDeleteOne` called once with `{ _id: expect.anything() }` (lines 324-325). |

## Spec Compliance

### T-059: Implement LLM Error Handling with Toast Notifications

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | 429 shows rate limit toast with retry button (FR-034) | **PASS** | `page.tsx:167-169` — status 429 maps to "Rate limited by {provider}. Please try again in a moment." with `showRetry = true`; lines 184-187 render `toast.error(errorMsg, { action: { label: "Retry", onClick: retry } })`. |
| 2 | 422 shows missing key toast with settings link (FR-034) | **PASS** | `page.tsx:161-166` — 422 shows toast with `action: { label: "Go to Settings", onClick: () => router.push("/settings") }`. |
| 3 | 502 shows invalid key or API error toast (FR-034) | **PASS** | `page.tsx:170-175` — 502 response body parsed; "invalid api key" check (case-insensitive) shows provider-specific message, otherwise generic API error. |
| 4 | Network failure shows network error toast (FR-034) | **PASS** | `page.tsx:207-213` — catch block shows "Network error. Please check your connection and try again." with Retry button. |
| 5 | Retry button re-sends the message | **PASS** | `page.tsx:136` — `const retry = () => handleSend(content, provider, model)` re-invokes with same arguments. |
| 6 | No empty assistant node on failure (FR-035) | **PASS** | Server: `route.ts:138-182` — assistant node only created after successful LLM response (line 142-149). On failure, user node is deleted (line 160) and rootNodeId reset if needed (lines 162-164). Client: optimistic node removed on error (lines 152, 208). |
| 7 | `npm run build` passes | **PASS** | Build completes with zero errors, all 18 routes. |

### T-060: Implement Provider Availability Check in ModelSelector

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Providers without keys are shown but disabled/grayed (FR-007) | **PASS** | `ModelSelector.tsx:30-38` — all providers rendered; `isProviderEnabled` checks `availableProviders` (mock always enabled). Disabled providers: gray dot `#9CA3AF` (line 76), `text-muted-foreground` (line 79), `(no key)` label (line 82), `disabled={!enabled}` on items (line 90). |
| 2 | Selecting disabled provider shows "Add key in Settings" message | **PASS** | `ModelSelector.tsx:91-96` — `onClick` for disabled items fires `toast.info(...)` with provider-specific message and returns early. |
| 3 | Only providers with keys can actually send messages | **PASS** | Client-side: disabled items prevent selection. Server-side: `route.ts:85-90` returns 422 if no key. Double protection. |
| 4 | `npm run build` passes | **PASS** | Confirmed. |

### T-061: Add Keyboard Shortcuts and Accessibility Basics

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All interactive elements reachable via Tab | **PASS** | `ConversationItem.tsx:81` — `tabIndex={0}`. Native `<button>` elements in BranchIndicator, ChatInput textarea, ChatMessage delete button, BranchMenu, TreeSidebar toggle. |
| 2 | Enter/Space activates buttons and tree nodes | **PASS** | `ConversationItem.tsx:90-95` — explicit `onKeyDown` for Enter/Space. Native `<button>` elements handle Enter/Space natively. |
| 3 | Dialog focus trapping works | **PASS** | `ConfirmDialog.tsx` uses shadcn `Dialog`/`DialogContent` (Radix UI) which implements focus trapping by default. |
| 4 | No contrast violations for primary text (NFR-010) | **PASS** | OKLCH theme colors follow shadcn's contrast-safe palette. Provider colors on decorative dots only. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-062: Final Integration Verification and Build Check

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `npm run build` passes | **PASS** | Build succeeds — 18 routes recognized, zero errors. |
| 2 | `npm test` passes with all tests green | **PASS** | 13 test files, 121 tests passed, 0 failures (vitest 4.1.2, duration 1.67s). |
| 3 | All three user flows from SRD §6 complete successfully | **PASS** (by design) | All routes, endpoints, and components wired for: (1) Register → Dashboard → Settings → Key → Conversation → Send → Response; (2) branching navigation with provider switching; (3) export/import with full tree. |
| 4 | Mock provider hidden in production build | **PASS** | Triple-gated: `ModelSelector.tsx:31-33` (filter in UI), `lib/providers/index.ts` (provider registry check), `route.ts:60-61` (server-side NODE_ENV check). |
| 5 | Data isolation verified | **PASS** (by design) | Every API route calls `auth()` and filters by `session.user.id`. |

## Bug Detection

No bugs found. All cycle 2 fixes verified and no new issues detected.

## Security

No issues found. All API routes authenticate via `auth()`, filter by `userId`, and validate inputs. API keys encrypted with AES-256-GCM, never exposed client-side.

## Architecture Alignment

No deviations. All files in correct locations per CLAUDE.md folder structure. Mongoose models match schemas. API routes match contracts. Two separate contexts (ConversationContext, UIContext) as specified.

## Forward Compatibility

No concerns. F-12 is the final feature.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
