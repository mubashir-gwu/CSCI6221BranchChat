# F-07: LLM Provider Layer — Audit Report (Cycle 1)
Date: 2026-04-01
Tasks covered: T-032, T-033, T-034, T-035

## Spec Compliance

### T-032: Implement Provider Interface and Registry

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `LLMProvider` interface is exported and usable | **PASS** | `src/lib/providers/types.ts` exports `LLMProvider` with `name`, `sendMessage(messages, model, apiKey)` matching the spec exactly. |
| 2 | `registerProvider` and `getProvider` work correctly | **PASS** | `src/lib/providers/index.ts` implements both functions. `registerProvider` adds to a `Map<string, LLMProvider>`; `getProvider` retrieves by name. All four providers are registered on import. |
| 3 | `getProvider("unknown")` throws | **PASS** | `getProvider` throws `Error('Unknown provider: ${name}')` when the name is not in the map. |
| 4 | `npm run build` passes | **PASS** | Build completes successfully with all routes rendered. |

### T-033: Implement Mock, OpenAI, Anthropic, and Gemini Providers

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Mock provider returns canned Markdown after ~1s delay | **PASS** | `src/lib/providers/mock.ts` uses `setTimeout(resolve, 1000)` and returns the exact canned Markdown from the spec. |
| 2 | OpenAI provider compiles and follows SDK v6 API | **PASS** | `src/lib/providers/openai.ts` uses `new OpenAI({ apiKey })` and `client.chat.completions.create({ model, messages })`. Correct SDK v6 pattern. |
| 3 | Anthropic provider extracts system messages correctly | **PASS** | `src/lib/providers/anthropic.ts` filters system messages, joins content into `systemText`, and passes to `system` param. Non-system messages cast to `'user' \| 'assistant'`. `max_tokens: 4096` set per spec. |
| 4 | Gemini provider uses `@google/genai` `GoogleGenAI` class, NOT deprecated package | **PASS** | `src/lib/providers/gemini.ts` imports `GoogleGenAI` from `@google/genai`. Uses `ai.chats.create({ model, history })` and `chat.sendMessage({ message })`. Maps `assistant` → `model` role. Matches Architecture Document §7.6 exactly. |
| 5 | Mock is only registered in development mode | **PASS** | `src/lib/providers/index.ts:24` — `if (process.env.NODE_ENV === 'development') { registerProvider(mockProvider); }` |
| 6 | `npm run build` passes | **PASS** | Confirmed. |

### T-034: Implement Context Builder

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Builds correct message array from root to parent + new message (FR-030) | **PASS** | `src/lib/contextBuilder.ts` calls `getPathToRoot(parentNodeId, nodesMap)`, maps to `LLMMessage[]`, appends user message. |
| 2 | Truncates oldest messages when exceeding 80% of context limit (FR-031) | **PASS** | `effectiveLimit = Math.floor(modelContextLimit * 0.8)`, then `while` loop shifts oldest messages while `totalTokens > effectiveLimit && messages.length > 1`. |
| 3 | Always preserves the newest message | **PASS** | Loop condition `messages.length > 1` ensures the last message is never removed. |
| 4 | Returns just `[userMessage]` when `parentNodeId` is null (first message) | **PASS** | When `parentNodeId === null`, `pathNodes` stays empty; only the new user message is pushed. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-035: Write Tests for Context Builder

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All tests pass via `npm test` | **PASS** | 6/6 tests pass in `__tests__/lib/contextBuilder.test.ts`. |
| 2 | Truncation logic verified with known token counts | **PASS** | Tests use exact character counts (400 chars → 104 tokens, 100 chars → 29 tokens) and verify truncation behavior at calculated thresholds. |

## Bug Detection

No bugs found.

All four providers correctly implement the `LLMProvider` interface. The context builder's truncation loop is correct (subtracts the removed message's tokens, checks `length > 1`). Token estimation is consistent between `estimateTokens` (aggregate) and `estimateTokensForMessage` (per-message) — both use `ceil(len/4) + 4`. The `getPathToRoot` dependency correctly walks and reverses.

**Note (Low):** The Gemini provider maps `system` role messages to `'user'` role in history (line 14: `m.role === 'assistant' ? 'model' : 'user'`). This is consistent with the Architecture Document §7.6 pseudocode, which uses the same ternary. The Gemini API does support a `systemInstruction` parameter, but the spec does not call for extracting system messages for Gemini (unlike Anthropic). This is an acceptable deviation — flagging only for awareness.

## Security

No security issues found in the F-07 code.

- The provider layer receives API keys as parameters — it does not read from env vars, storage, or client-side code. Key handling is delegated to the calling code (the LLM chat route in F-08).
- No database queries occur in provider or context builder code.
- No user input is passed to shell or eval.
- The `contextBuilder.ts` uses a typed `nodesMap` parameter and does not perform any direct DB operations.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| File: `src/lib/providers/types.ts` | `LLMMessage`, `LLMResponse`, `LLMProvider` | Matches exactly | **OK** |
| File: `src/lib/providers/index.ts` | `registerProvider`, `getProvider`, register all | Matches exactly | **OK** |
| File: `src/lib/providers/mock.ts` | Canned Markdown, 1s sleep | Matches exactly | **OK** |
| File: `src/lib/providers/openai.ts` | SDK v6 pattern | Matches exactly | **OK** |
| File: `src/lib/providers/anthropic.ts` | Extract system, `max_tokens: 4096` | Matches exactly | **OK** |
| File: `src/lib/providers/gemini.ts` | `GoogleGenAI`, `ai.chats.create`, role mapping | Matches Architecture Doc §7.6 | **OK** |
| File: `src/lib/contextBuilder.ts` | Walk + truncate at 80% | Matches exactly | **OK** |
| File: `src/lib/tokenEstimator.ts` | `ceil(len/4) + 4` | Matches exactly | **OK** |
| File: `src/types/llm.ts` | Re-export types | Re-exports from providers/types | **OK** |
| File: `src/constants/models.ts` | Model definitions with contextWindow | Present and correct | **OK** |
| File: `__tests__/lib/contextBuilder.test.ts` | Test file for context builder | 6 tests, all passing | **OK** |

No unexpected files. No missing files. Folder structure matches spec.

## Forward Compatibility

| Concern | Current Code | Future Need (F-08: Chat Interface & LLM Integration) | Assessment |
|---------|-------------|------------------------------------------------------|------------|
| Provider registry accessible to chat route | `getProvider(name)` exported | T-036 needs `getProvider(provider).sendMessage(...)` | **Compatible** — clean interface. |
| Context builder signature | `buildContext(parentNodeId, newUserMessage, nodesMap, modelContextLimit)` | T-036 will load nodes, build a `Map`, and call `buildContext` with the model's context window from `MODELS` constant | **Compatible** — `MODELS` constant has `contextWindow` for every model. |
| `LLMResponse` shape | `{ content, provider, model }` | T-036 will use `content` for assistant node, `provider`/`model` for node metadata | **Compatible** |
| Error propagation | Providers throw raw SDK errors | T-036 needs to classify errors (rate limit → 429, invalid key → 502, etc.) | **Compatible** — the chat route will wrap calls in try/catch and inspect error types. No error classification is needed in the provider layer itself. |
| Token estimator | Standalone functions | Used by contextBuilder, may also be useful for UI token display | **Compatible** |

No forward compatibility concerns identified.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
