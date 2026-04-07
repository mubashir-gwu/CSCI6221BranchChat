# Server-Level API Keys & Provider Gating — Audit Report (Cycle 2)
Date: 2026-04-07
Tasks covered: T-077, T-078, T-079, T-080, T-081, T-082, T-083, T-084, T-085, T-086

## Cycle 1 Recap

Cycle 1 found three medium-severity issues related to provider unavailability UX:

1. **ModelSelector showed no empty state message** when `availableProviders` was empty.
2. **UIProvider kept stale "openai"/"gpt-4o" selection** when no providers were available.
3. **ChatInput send button was not disabled** when selected provider was unavailable.

All three have been addressed in this cycle. Verification below.

## Spec Compliance

### T-077: Create TokenUsage Model
- **PASS:** Model at `src/models/TokenUsage.ts` with correct fields (`userId`, `provider`, `inputTokens`, `outputTokens`, `callCount`).
- **PASS:** `timestamps: { createdAt: false, updatedAt: true }`.
- **PASS:** Unique compound index `{ userId: 1, provider: 1 }` (line 23).
- **PASS:** Provider enum `'openai' | 'anthropic' | 'gemini' | 'mock'`.
- **PASS:** `npm run build` passes.

### T-078: Create Provider Availability Utility and API Route
- **PASS:** `src/lib/providers/availability.ts` exports `getAvailableProviders()`, `isProviderAvailable()`, `getProviderApiKey()`.
- **PASS:** Checks env vars via `PROVIDER_ENV_MAP`, includes `'mock'` in development.
- **PASS:** `GET /api/providers` returns `{ providers: string[] }` (line 12).
- **PASS:** Returns 401 for unauthenticated requests (lines 6-9).
- **PASS:** `npm run build` passes.

### T-079: Update LLM Provider Interface and Implementations
- **PASS:** `sendMessage(messages, model)` — no `apiKey` parameter in `types.ts`.
- **PASS:** `LLMResponse` includes `inputTokens: number` and `outputTokens: number` (required, not optional — matches CLAUDE.md).
- **PASS:** OpenAI reads `process.env.OPENAI_API_KEY` (openai.ts:11), extracts `response.usage.prompt_tokens`/`completion_tokens` (lines 25-26).
- **PASS:** Anthropic reads `process.env.ANTHROPIC_API_KEY` (anthropic.ts:11), extracts `response.usage.input_tokens`/`output_tokens` (lines 35-36).
- **PASS:** Gemini reads `process.env.GEMINI_API_KEY` (gemini.ts:11), extracts `response.usageMetadata.promptTokenCount`/`candidatesTokenCount` (lines 38-39).
- **PASS:** Mock returns estimated tokens: `ceil(content.length / 4)` for input (sum of all messages) and output (lines 23-26).
- **PASS:** `providers/index.ts` registers all providers, no `apiKey` references.
- **PASS:** `npm run build` passes.

### T-080: Update LLM Chat Route Handler
- **PASS:** No imports of `encryption.ts` or `ApiKey` model.
- **PASS:** Provider availability check via `isProviderAvailable(provider)` (line 65).
- **PASS:** Returns 422 with `"Provider ${provider} is not configured."` (lines 66-69).
- **PASS:** Calls `provider.sendMessage(messages, model)` without `apiKey` (line 134).
- **PASS:** Token usage tracking via `TokenUsage.findOneAndUpdate` with `$inc` and `upsert: true` (lines 149-159).
- **PASS:** Token tracking wrapped in try/catch — failure does not break response (lines 147-163).
- **PASS:** Orphaned user node cleanup on LLM failure (lines 174-178).
- **PASS:** `npm run build` passes.

### T-081: Create Token Usage API Route and Usage Page
- **PASS:** `GET /api/token-usage` returns `{ usage: [...] }` with correct fields per entry.
- **PASS:** Returns 401 for unauthenticated requests (lines 6-9).
- **PASS:** `/usage` page at `src/app/(protected)/usage/page.tsx` renders `<TokenUsageCard />`.
- **PASS:** Dashboard page unchanged — conversation list only.
- **PASS:** `/settings` route does not exist.
- **PASS:** `npm run build` passes.

**Note:** Route is `/api/token-usage` and component is `TokenUsageCard` at `src/components/dashboard/`, matching CLAUDE.md (authoritative over task breakdown). Acceptable deviation.

### T-082: Update ModelSelector for Provider Availability Gating
- **PASS:** Available providers selectable, unavailable greyed out with `disabled` and `"(not available)"` label.
- **PASS (cycle 1 fix verified):** When `availableProviders.length === 0`, ModelSelector renders a disabled button with text "No providers available" (lines 41-48). Dropdown does not open.
- **PASS (cycle 1 fix verified):** UIProvider dispatches `SET_SELECTED_MODEL` with `{ provider: "", model: "" }` when `providers.length === 0` (lines 76-81).
- **PASS (cycle 1 fix verified):** ChatInput computes `isProviderUnavailable` (lines 33-34) and disables the send button accordingly (line 66).
- **PASS:** `npm run build` passes.

### T-083: Update Import to Default to Available Provider
- **PASS:** Checks if default provider `"openai"` is available via `isProviderAvailable()` (line 78).
- **PASS:** Falls back to first available provider and its first model when unavailable (lines 79-84).
- **PASS:** Preserves provider if available.
- **PASS:** `npm run build` passes.

### T-084: Remove Dead Code
- **PASS:** `src/models/ApiKey.ts` — deleted, confirmed not found.
- **PASS:** `src/lib/encryption.ts` — deleted, confirmed not found.
- **PASS:** `src/components/settings/` — deleted, confirmed not found.
- **PASS:** `src/app/(protected)/settings/` — deleted, confirmed not found.
- **PASS:** `src/app/api/settings/` — deleted, confirmed not found.
- **PASS:** `__tests__/api/api-keys.test.ts` — deleted.
- **PASS:** `__tests__/lib/encryption.test.ts` — deleted.
- **PASS:** No remaining imports from deleted files — grep confirms only `getProviderApiKey` function name.
- **PASS:** `.env.example` has `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`; no `ENCRYPTION_KEY`.
- **PASS:** Protected layout has "Usage" link to `/usage` (lines 29-36), no "Settings" link.
- **PASS:** `middleware.ts` matcher includes `/usage`, no `/settings`.
- **PASS:** `npm run build` passes. `npm test` passes.

### T-085: Update LLM Chat Route Error Handling
- **PASS:** Chat page 422 handler shows `"Provider ${provider} is not available."` (line 161).
- **PASS:** No "Go to Settings" action, no link to `/settings`.
- **PASS:** No UI references to Settings page anywhere in `src/` (grep confirmed).
- **PASS:** Other error handling (429, 502, 504, network) preserved unchanged.
- **PASS:** `npm run build` passes.

### T-086: Write Tests
- **PASS:** `__tests__/lib/providers-availability.test.ts` — tests for `getAvailableProviders`, `isProviderAvailable`, `getProviderApiKey`.
- **PASS:** `__tests__/api/llm-chat.test.ts` — provider availability mock, 422 for unavailable, token usage recording, resilience.
- **PASS:** `__tests__/api/usage.test.ts` — GET endpoint, correct data and empty array.
- **PASS:** `__tests__/api/providers.test.ts` — GET endpoint, 401 for unauthed.
- **PASS:** `__tests__/components/ModelSelector.test.tsx` — available/unavailable rendering, disabled items, selection.
- **PASS:** No test references `ApiKey`, `encryption`, or `/api/settings/api-keys`.
- **PASS:** All 142 tests pass. `npm run build` passes.

## Bug Detection

### Cycle 1 issues — verification

1. **Unavailable model remains selected (UIProvider):** **FIXED.** `UIProvider.tsx` lines 76-81 now dispatch `SET_SELECTED_MODEL` with `{ provider: "", model: "" }` when `providers.length === 0`. The stale "openai"/"gpt-4o" state no longer persists.

2. **ChatInput send button not disabled:** **FIXED.** `ChatInput.tsx` lines 33-34 compute `isProviderUnavailable` by checking if the selected provider is missing or not in `availableProviders`. The send button is disabled via line 66: `disabled={disabled || !message.trim() || isProviderUnavailable}`.

3. **ModelSelector shows no empty state:** **FIXED.** `ModelSelector.tsx` lines 41-48 render a disabled button with "No providers available" text when `availableProviders.length === 0`, preventing the dropdown from opening.

### New issues found

4. **Token tracking guard condition is logically incorrect.** Severity: **Medium.**
   - **File:** `src/app/api/llm/chat/route.ts`, line 148.
   - **Description:** The guard `if (llmResponse.inputTokens || llmResponse.outputTokens)` uses JavaScript truthiness, which means if both values are exactly `0`, the entire upsert block is skipped — `callCount` is never incremented and the call is silently untracked. While no current provider returns `0` for both, the guard is semantically wrong: a successful LLM call should always be tracked regardless of token counts. The `|| 0` fallbacks inside `$inc` have the same truthiness issue — they should be `?? 0` to guard against `undefined`/`null` without swallowing `0`.
   - **Fix:** Remove the `if` guard entirely so every successful LLM call is tracked. Change `|| 0` to `?? 0` inside the `$inc` object.

No other bugs found:
- All promise rejections handled with try/catch.
- No data model mismatches — Mongoose schema fields align with TypeScript interfaces.
- API contracts match CLAUDE.md for request/response shapes.
- No missing null/undefined checks on critical paths.
- No stale closures — UIProvider uses `useRef` for `selectedProviderRef`.
- ChatInput `isProviderUnavailable` correctly recalculates on each render (no stale closure risk).

## Security

1. **Auth checks on all routes:**
   - `GET /api/providers` — `session.user.id` check (lines 6-9). **PASS**
   - `GET /api/token-usage` — `session.user.id` check (lines 6-9). **PASS**
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
- LLM chat route has correct structure for auto-title: `parentNodeId === null` check at line 128. Fire-and-forget auto-title can be inserted after the successful response block.
- Providers correctly handle system messages for title generation.
- TokenUsage tracking available for auto-title LLM calls.
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
- Medium issues: 1 (token tracking guard is logically incorrect — skips tracking when both token values are 0)
- Low issues: 0
- Recommendation: **FIX FIRST**
