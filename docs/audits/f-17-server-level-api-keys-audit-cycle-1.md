# Server-Level API Keys & Provider Gating — Audit Report (Cycle 1)
Date: 2026-04-07
Tasks covered: T-077, T-078, T-079, T-080, T-081, T-082, T-083, T-084, T-085, T-086

## Spec Compliance

### T-077: Create TokenUsage Model
- **PASS:** Model exists at `src/models/TokenUsage.ts` with correct schema fields (`userId`, `provider`, `inputTokens`, `outputTokens`, `callCount`).
- **PASS:** `timestamps: { createdAt: false, updatedAt: true }` matches spec.
- **PASS:** Unique compound index on `{ userId: 1, provider: 1 }` (line 23).
- **PASS:** Provider enum includes `'openai' | 'anthropic' | 'gemini' | 'mock'`.
- **PASS:** `npm run build` passes.

### T-078: Create Provider Availability Utility and API Route
- **PASS:** `src/lib/providers/availability.ts` exports `getAvailableProviders()`, `isProviderAvailable()`, `getProviderApiKey()`.
- **PASS:** `getAvailableProviders()` checks env vars via `PROVIDER_ENV_MAP` and includes `'mock'` in development.
- **PASS:** `GET /api/providers` exists at `src/app/api/providers/route.ts`, returns `{ providers: string[] }`.
- **PASS:** Returns 401 for unauthenticated requests (auth check at line 6-9).
- **PASS:** `npm run build` passes.

### T-079: Update LLM Provider Interface and Implementations
- **PASS:** `sendMessage` signature in `types.ts` has no `apiKey` parameter — `sendMessage(messages: LLMMessage[], model: string)`.
- **PASS:** `LLMResponse` includes `inputTokens: number` and `outputTokens: number`.
- **PASS:** OpenAI provider reads `process.env.OPENAI_API_KEY`, extracts `response.usage.prompt_tokens`/`completion_tokens`.
- **PASS:** Anthropic provider reads `process.env.ANTHROPIC_API_KEY`, extracts `response.usage.input_tokens`/`output_tokens`.
- **PASS:** Gemini provider reads `process.env.GEMINI_API_KEY`, extracts `response.usageMetadata.promptTokenCount`/`candidatesTokenCount`.
- **PASS:** Mock provider returns estimated tokens via `ceil(content.length / 4)` for input (sum of all message content lengths) and output.
- **PASS:** `providers/index.ts` registers all providers, no `apiKey` references.
- **PASS:** `npm run build` passes.

### T-080: Update LLM Chat Route Handler
- **PASS:** No imports of `encryption.ts` or `ApiKey` model.
- **PASS:** Provider availability check via `isProviderAvailable(provider)` (line 65).
- **PASS:** Returns 422 with `"Provider ${provider} is not configured."` when unavailable.
- **PASS:** Calls `provider.sendMessage(messages, model)` without `apiKey` (line 134).
- **PASS:** Token usage tracking via `TokenUsage.findOneAndUpdate` with `$inc` and `upsert: true` (lines 149-159).
- **PASS:** Token tracking wrapped in try/catch — failure does not break response (lines 147-163).
- **PASS:** Orphaned user node cleanup preserved on LLM failure (lines 174-178): deletes user node and resets `rootNodeId`.
- **PASS:** `npm run build` passes.

### T-081: Create Token Usage API Route and Usage Page
- **PASS:** `GET /api/token-usage` returns `{ usage: [...] }` with `provider`, `inputTokens`, `outputTokens`, `callCount` per entry.
- **PASS:** Returns 401 for unauthenticated requests.
- **PASS:** `/usage` page at `src/app/(protected)/usage/page.tsx` renders `<TokenUsageCard />`.
- **PASS:** `/dashboard` page unchanged — conversation list only, no token usage content.
- **PASS:** `/settings` route does not exist.
- **PASS:** `npm run build` passes.

**Note:** T-081 specifies the route as `/api/usage` and the component as `src/components/usage/UsageDashboard.tsx`. The implementation uses `/api/token-usage` and `src/components/dashboard/TokenUsageCard.tsx`, matching the authoritative CLAUDE.md spec. Acceptable deviation from task breakdown.

### T-082: Update ModelSelector for Provider Availability Gating
- **PASS:** ModelSelector receives `availableProviders` prop and gates provider selection.
- **PASS:** Unavailable providers rendered with `disabled={!enabled}`, `text-muted-foreground` styling, and `"(not available)"` label.
- **PASS:** Available providers are selectable and trigger `onChange`.
- **PARTIAL:** No explicit "No providers available" message when `availableProviders` is empty. All providers render as disabled, which is functionally equivalent but lacks the specified message text.
- **PASS:** `npm run build` passes.

### T-083: Update Import to Default to Available Provider
- **PASS:** Import route checks if default provider (`"openai"`) is available via `isProviderAvailable()` (line 78).
- **PASS:** Falls back to first available provider and its first model when default is unavailable (lines 79-84).
- **PASS:** Preserves provider if available.
- **PASS:** `npm run build` passes.

### T-084: Remove Dead Code
- **PASS:** `src/models/ApiKey.ts` deleted.
- **PASS:** `src/lib/encryption.ts` deleted.
- **PASS:** `src/components/settings/` directory deleted.
- **PASS:** `src/app/(protected)/settings/` directory deleted.
- **PASS:** `src/app/api/settings/` directory deleted.
- **PASS:** `__tests__/api/api-keys.test.ts` deleted.
- **PASS:** `__tests__/lib/encryption.test.ts` deleted.
- **PASS:** No remaining imports from deleted files — `grep` confirms only `getProviderApiKey` function name matches.
- **PASS:** `.env.example` has `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`; no `ENCRYPTION_KEY`.
- **PASS:** Protected layout has "Usage" link to `/usage` (line 29-36), no "Settings" link.
- **PASS:** `middleware.ts` matcher includes `/usage`, no `/settings`.
- **PASS:** `npm run build` passes.
- **PASS:** `npm test` passes.

### T-085: Update LLM Chat Route Error Handling
- **PASS:** Chat page 422 handler shows `"Provider ${provider} is not available."` (line 161).
- **PASS:** No "Go to Settings" action button — removed.
- **PASS:** No UI references to Settings page anywhere in `src/`.
- **PASS:** Other error handling (429, 502, 504, network) preserved unchanged.
- **PASS:** `npm run build` passes.

### T-086: Write Tests
- **PASS:** `__tests__/lib/providers-availability.test.ts` — 12 tests covering `getAvailableProviders`, `isProviderAvailable`, `getProviderApiKey` with various env var combinations.
- **PASS:** `__tests__/api/llm-chat.test.ts` — Updated with provider availability mock; tests 422 for unavailable provider; tests token usage recording; tests token tracking failure resilience; preserves orphaned-node-cleanup assertions.
- **PASS:** `__tests__/api/usage.test.ts` — Tests GET endpoint returns correct usage data and empty array.
- **PASS:** `__tests__/api/providers.test.ts` — Tests GET endpoint returns providers and 401 for unauthed.
- **PASS:** `__tests__/components/ModelSelector.test.tsx` — Tests available/unavailable provider rendering, disabled items, and selection behavior.
- **PASS:** No test references `ApiKey`, `encryption`, or `/api/settings/api-keys`.
- **PASS:** All 142 tests pass. `npm run build` passes.

## Bug Detection

No bugs found. Code review of all source files for F-17 reveals:

1. **Token tracking guard condition** (`llm/chat/route.ts:148`): `if (llmResponse.inputTokens || llmResponse.outputTokens)` — this would skip tracking if both values are exactly `0`. However, for a real LLM call that returns `0` tokens (impossible in practice since every call consumes at least 1 token), `callCount` wouldn't increment. Severity: **Low** — purely theoretical edge case. All real providers return non-zero token counts.

2. All promise rejections are handled with try/catch blocks.
3. No data model mismatches — all Mongoose schema fields align with the TypeScript interfaces.
4. API contracts match CLAUDE.md spec for request/response shapes.
5. No missing null/undefined checks on critical paths.
6. No stale closures — UIProvider correctly uses `useRef` pattern for `selectedProviderRef` to avoid stale state in `refreshProviders` callback.

## Security

1. **Auth checks present on all routes:**
   - `GET /api/providers` — checks `session.user.id` (line 6-9). **PASS**
   - `GET /api/token-usage` — checks `session.user.id` (line 6-9). **PASS**
   - `POST /api/llm/chat` — checks `session.user.id` (line 40-43). **PASS**
   - `POST /api/import` — checks `session.user.id` (line 13-16). **PASS**

2. **Data isolation:**
   - Token usage query filters by `userId` (token-usage/route.ts:15). **PASS**
   - LLM chat verifies conversation ownership (llm/chat/route.ts:82-88). **PASS**
   - No cross-user data leakage vectors found.

3. **API key exposure:**
   - API keys read from `process.env` on server side only. Never sent to client. **PASS**
   - `GET /api/providers` returns provider names only, not keys. **PASS**
   - `.env.example` has placeholder values, not real keys. **PASS**

4. **Input validation:**
   - LLM chat validates `provider` against `PROVIDERS` constant (line 55). **PASS**
   - LLM chat validates `model` against provider's model list (line 73-76). **PASS**
   - Content validated as non-empty string (line 50-52). **PASS**

5. **No Mongoose injection risks** — provider validated against enum, userId from session.

No security issues found.

## Architecture Alignment

1. **Folder structure:** Matches CLAUDE.md spec.
   - `src/models/TokenUsage.ts` — correct. **PASS**
   - `src/lib/providers/availability.ts` — correct. **PASS**
   - `src/app/api/providers/route.ts` — correct. **PASS**
   - `src/app/api/token-usage/route.ts` — correct (CLAUDE.md says `token-usage`, not `usage`). **PASS**
   - `src/components/dashboard/TokenUsageCard.tsx` — correct per CLAUDE.md. **PASS**
   - `src/app/(protected)/usage/page.tsx` — correct. **PASS**

2. **Mongoose models:** TokenUsage schema exactly matches CLAUDE.md spec. **PASS**

3. **API routes:** All match CLAUDE.md contracts. **PASS**

4. **Components:** All in correct locations per CLAUDE.md. **PASS**

5. **Data flow:**
   - UIProvider fetches from `/api/providers` and dispatches `SET_AVAILABLE_PROVIDERS`. **PASS**
   - ModelSelector receives `availableProviders` as prop. **PASS**
   - TokenUsageCard fetches from `/api/token-usage` and `/api/providers` internally. **PASS**

6. **No files that shouldn't exist.** All BYO-Key files deleted. **PASS**

7. **Middleware matcher:** `'/dashboard'`, `'/chat/:path*'`, plus API routes and `'/usage'`. No `/settings`. **PASS**

**Acceptable deviations:**
- `LLMResponse.inputTokens`/`outputTokens` are `number` (required) in the implementation vs `number?` (optional) in T-079. CLAUDE.md specifies them as required. This is correct.
- TokenUsageCard component path follows CLAUDE.md (`components/dashboard/`) rather than T-081's proposed `components/usage/`. CLAUDE.md is authoritative.

## Forward Compatibility

### F-18: Auto-Title Conversations
- The LLM chat route (`llm/chat/route.ts`) has the correct structure for adding fire-and-forget auto-title logic. The `parentNodeId === null` check already exists (line 128). Adding auto-title after the successful response block (before `return NextResponse.json(...)`) is straightforward.
- Providers correctly handle system messages (needed for title generation prompt) — Anthropic separates system, Gemini uses `config.systemInstruction`.
- TokenUsage tracking is already in place for the auto-title LLM call to use. **Compatible.**

### F-19: File-Based Logging
- No logging is currently instrumented in F-17's code. The logger utility (`src/lib/logger.ts`) doesn't exist yet — it will be created in F-19.
- All API routes follow a consistent try/catch pattern that makes adding log calls straightforward.
- `.gitignore` does not yet include `logs/` — this will be handled in F-19. **Compatible.**

### General
- `LLMProvider` interface is stable — no further signature changes expected.
- `getAvailableProviders()` is a clean utility that can be imported from anywhere.
- No hardcoded assumptions that would need to be undone for future features.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 1 (ModelSelector missing explicit "No providers available" message text — T-082)
- Recommendation: **PROCEED**
