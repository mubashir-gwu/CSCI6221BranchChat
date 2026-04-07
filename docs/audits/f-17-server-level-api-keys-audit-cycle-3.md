# Server-Level API Keys & Provider Gating — Audit Report (Cycle 3)
Date: 2026-04-07
Tasks covered: T-077, T-078, T-079, T-080, T-081, T-082, T-083, T-084, T-085, T-086

## Cycle 2 Recap

Cycle 2 found one medium-severity issue:

1. **Token tracking guard logically incorrect:** The `if (llmResponse.inputTokens || llmResponse.outputTokens)` guard skipped tracking when both values were `0`, and `|| 0` swallowed legitimate zero values.

Fix has been verified in this cycle.

## Spec Compliance

### T-077: Create TokenUsage Model
- **PASS:** Model at `src/models/TokenUsage.ts` with correct fields (`userId`, `provider`, `inputTokens`, `outputTokens`, `callCount`).
- **PASS:** `timestamps: { createdAt: false, updatedAt: true }` (line 20).
- **PASS:** Unique compound index `{ userId: 1, provider: 1 }` (line 23).
- **PASS:** Provider enum `'openai' | 'anthropic' | 'gemini' | 'mock'` (line 15).
- **PASS:** `npm run build` passes.

### T-078: Create Provider Availability Utility and API Route
- **PASS:** `src/lib/providers/availability.ts` exports `getAvailableProviders()`, `isProviderAvailable()`, `getProviderApiKey()`.
- **PASS:** Checks env vars via `PROVIDER_ENV_MAP`, includes `'mock'` in development (lines 12-14).
- **PASS:** `GET /api/providers` returns `{ providers: string[] }` (line 13).
- **PASS:** Returns 401 for unauthenticated requests (lines 6-9).
- **PASS:** `npm run build` passes.

### T-079: Update LLM Provider Interface and Implementations
- **PASS:** `sendMessage(messages, model)` — no `apiKey` parameter in `types.ts` (line 17).
- **PASS:** `LLMResponse` includes `inputTokens: number` and `outputTokens: number` (lines 10-11).
- **PASS:** OpenAI reads `process.env.OPENAI_API_KEY`.
- **PASS:** Anthropic reads `process.env.ANTHROPIC_API_KEY`.
- **PASS:** Gemini reads `process.env.GEMINI_API_KEY`.
- **PASS:** Mock returns estimated tokens: `ceil(content.length / 4)` for input and output (mock.ts lines 23-26).
- **PASS:** `providers/index.ts` registers all providers, no `apiKey` references.
- **PASS:** `npm run build` passes.

### T-080: Update LLM Chat Route Handler
- **PASS:** No imports of `encryption.ts` or `ApiKey` model.
- **PASS:** Provider availability check via `isProviderAvailable(provider)` (line 65).
- **PASS:** Returns 422 with `"Provider ${provider} is not configured."` (lines 66-69).
- **PASS:** Calls `provider.sendMessage(messages, model)` without `apiKey` (line 134).
- **PASS (cycle 2 fix verified):** Token usage tracking no longer guarded by truthiness check. `TokenUsage.findOneAndUpdate` with `$inc` and `upsert: true` runs unconditionally for every successful LLM call (lines 148-158). Uses `?? 0` (nullish coalescing) instead of `|| 0` (lines 152-153).
- **PASS:** Token tracking wrapped in try/catch — failure does not break response (lines 147-161).
- **PASS:** Orphaned user node cleanup on LLM failure (lines 172-176).
- **PASS:** `npm run build` passes.

### T-081: Create Token Usage API Route and Usage Page
- **PASS:** `GET /api/token-usage` returns `{ usage: [...] }` with correct fields per entry (lines 17-24).
- **PASS:** Returns 401 for unauthenticated requests (lines 7-9).
- **PASS:** `/usage` page at `src/app/(protected)/usage/page.tsx` renders `<TokenUsageCard />`.
- **PASS:** Dashboard page unchanged — conversation list only.
- **PASS:** `/settings` route does not exist.
- **PASS:** `npm run build` passes.

Note: Route is `/api/token-usage` and component is `TokenUsageCard` at `src/components/dashboard/`, matching CLAUDE.md. Acceptable deviation from task breakdown.

### T-082: Update ModelSelector for Provider Availability Gating
- **PASS:** Available providers selectable, unavailable greyed out with `disabled` and `"(not available)"` label (lines 91-93, 100).
- **PASS:** When `availableProviders.length === 0`, ModelSelector renders disabled button with "No providers available" (lines 41-48).
- **PASS:** UIProvider dispatches `SET_SELECTED_MODEL` with `{ provider: "", model: "" }` when no providers available (lines 76-81).
- **PASS:** ChatInput computes `isProviderUnavailable` (lines 33-34) and disables send button (line 66).
- **PASS:** `availableProviders` exposed via `useUI()` hook (useUI.ts line 19).
- **PASS:** `UIContext.ts` includes `availableProviders: string[]` in state type (line 12).
- **PASS:** `npm run build` passes.

### T-083: Update Import to Default to Available Provider
- **PASS:** Checks if default provider `"openai"` is available via `isProviderAvailable()` (line 78).
- **PASS:** Falls back to first available provider and its first model when unavailable (lines 79-84).
- **PASS:** Preserves provider if available.
- **PASS:** `npm run build` passes.

### T-084: Remove Dead Code
- **PASS:** `src/models/ApiKey.ts` — deleted.
- **PASS:** `src/lib/encryption.ts` — deleted.
- **PASS:** `src/components/settings/` — deleted.
- **PASS:** `src/app/(protected)/settings/` — deleted.
- **PASS:** `src/app/api/settings/` — deleted.
- **PASS:** `__tests__/api/api-keys.test.ts` — deleted.
- **PASS:** `__tests__/lib/encryption.test.ts` — deleted.
- **PASS:** No remaining imports from deleted files — grep returns only `getProviderApiKey` function name in `availability.ts`.
- **PASS:** `.env.example` has `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`; no `ENCRYPTION_KEY`.
- **PASS:** Protected layout has "Usage" link to `/usage` (lines 29-37), no "Settings" link.
- **PASS:** `middleware.ts` matcher includes `/usage`, no `/settings` (line 16).
- **PASS:** `npm run build` passes. `npm test` passes.

### T-085: Update LLM Chat Route Error Handling
- **PASS:** Chat page 422 handler shows `"Provider ${provider} is not available."` (line 161).
- **PASS:** No "Go to Settings" action, no link to `/settings`.
- **PASS:** No UI references to Settings page anywhere in `src/` (grep confirmed: zero matches for `/settings`).
- **PASS:** Other error handling (429, 502, 504, network) preserved unchanged.
- **PASS:** `npm run build` passes.

### T-086: Write Tests
- **PASS:** `__tests__/lib/providers-availability.test.ts` — tests for `getAvailableProviders`, `isProviderAvailable`, `getProviderApiKey`.
- **PASS:** `__tests__/api/llm-chat.test.ts` — provider availability mock, 422 for unavailable, token usage recording.
- **PASS:** `__tests__/api/usage.test.ts` — GET endpoint, correct data and empty array.
- **PASS:** `__tests__/api/providers.test.ts` — GET endpoint, 401 for unauthed.
- **PASS:** `__tests__/components/ModelSelector.test.tsx` — available/unavailable rendering, disabled items, selection.
- **PASS:** No test references `ApiKey`, `encryption`, or `/api/settings/api-keys`.
- **PASS:** All 142 tests pass. `npm run build` passes.

## Bug Detection

### Cycle 2 issue — verification

1. **Token tracking guard logically incorrect:** **FIXED.** The `if` guard has been removed entirely (line 148 now directly starts the `TokenUsage.findOneAndUpdate` call). The `$inc` values use `?? 0` (nullish coalescing) instead of `|| 0`, correctly handling the case where `inputTokens` or `outputTokens` is `0` without skipping the upsert. `callCount: 1` is always incremented.

### New issues found

None. All code paths reviewed:
- All promise rejections handled with try/catch.
- No data model mismatches — Mongoose schema fields align with TypeScript interfaces.
- API contracts match CLAUDE.md for request/response shapes.
- No missing null/undefined checks on critical paths.
- No stale closures — UIProvider uses `useRef` for `selectedProviderRef`.
- ChatInput `isProviderUnavailable` correctly recalculates on each render.
- Import route correctly handles provider fallback with proper null checks.

## Security

1. **Auth checks on all routes:**
   - `GET /api/providers` — `session.user.id` check (lines 6-9). **PASS**
   - `GET /api/token-usage` — `session.user.id` check (lines 7-9). **PASS**
   - `POST /api/llm/chat` — `session.user.id` check (lines 40-43). **PASS**
   - `POST /api/import` — `session.user.id` check (lines 13-16). **PASS**

2. **Data isolation:**
   - Token usage filtered by `userId` (token-usage/route.ts:15). **PASS**
   - LLM chat verifies conversation ownership (llm/chat/route.ts:86-88). **PASS**
   - No cross-user data leakage vectors.

3. **API key exposure:**
   - Keys read from `process.env` server-side only, never sent to client. **PASS**
   - `GET /api/providers` returns provider names only. **PASS**
   - `.env.example` has placeholders, not real keys. **PASS**

4. **Input validation:**
   - Provider validated against `PROVIDERS` constant (line 55). **PASS**
   - Model validated against provider's model list (lines 73-76). **PASS**
   - Content validated as non-empty string (lines 50-52). **PASS**

5. **No Mongoose injection risks** — provider validated against enum, userId from session.

No security issues found.

## Architecture Alignment

1. **Folder structure:** All files in correct locations per CLAUDE.md. **PASS**
   - `src/models/TokenUsage.ts`
   - `src/lib/providers/availability.ts`
   - `src/app/api/providers/route.ts`
   - `src/app/api/token-usage/route.ts`
   - `src/components/dashboard/TokenUsageCard.tsx`
   - `src/app/(protected)/usage/page.tsx`

2. **Mongoose models:** TokenUsage schema exactly matches CLAUDE.md. **PASS**

3. **API routes:** All match CLAUDE.md contracts. **PASS**

4. **Components:** All in correct locations per CLAUDE.md. **PASS**

5. **Data flow:**
   - UIProvider fetches from `/api/providers`, dispatches `SET_AVAILABLE_PROVIDERS`. **PASS**
   - UIProvider clears selected model when no providers available. **PASS**
   - ModelSelector receives `availableProviders` as prop. **PASS**
   - ChatInput receives `availableProviders` and disables send when provider unavailable. **PASS**
   - TokenUsageCard fetches from `/api/token-usage` and `/api/providers` internally. **PASS**

6. **No files that shouldn't exist.** All BYO-Key files confirmed deleted. **PASS**

7. **Middleware matcher:** Includes `/dashboard`, `/chat/:path*`, `/usage`, plus API routes. No `/settings`. **PASS**

No deviations.

## Forward Compatibility

### F-18: Auto-Title Conversations
- LLM chat route has correct structure for auto-title insertion after the successful response block.
- Providers correctly handle system messages for title generation.
- TokenUsage tracking available for auto-title LLM calls via the same `findOneAndUpdate` pattern.
- **Compatible.**

### F-19: File-Based Logging
- No logging currently in F-17 code. Logger utility will be created in F-19.
- API routes follow consistent try/catch patterns for easy log insertion.
- `.gitignore` will be updated in F-19 to include `logs/`.
- **Compatible.**

### General
- `LLMProvider` interface is stable — no further signature changes expected.
- `getAvailableProviders()` and `isProviderAvailable()` are clean, importable utilities.
- UIProvider's empty-provider handling (`{ provider: "", model: "" }`) is defensive — downstream components check before acting.
- No hardcoded assumptions that would need to be undone.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
