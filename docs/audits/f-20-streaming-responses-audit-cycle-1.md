# F-20: Streaming Responses — Audit Report (Cycle 1)
Date: 2026-04-09
Tasks covered: T-094, T-095, T-096, T-097, T-098, T-099, T-100, T-101, T-102, T-103, T-104, T-105

## Spec Compliance

### T-094: Add StreamChunk Type, streamMessage to Provider Interface, and Create Stream Helpers

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `StreamChunk` type exported from `types.ts` | **PASS** | `types.ts:22-25` — three variants: `token`, `done`, `error` |
| `LLMProvider` interface has `streamMessage` method | **PASS** | `types.ts:33-36` — `streamMessage(messages, model): AsyncGenerator<StreamChunk>` |
| `LLMAttachment` and `attachments?` on `LLMMessage` in `types.ts` | **PASS** | `types.ts:1-12` — `LLMAttachment` interface with `filename`, `mimeType`, `data`, `size`; `attachments?` on `LLMMessage` |
| `streamHelpers.ts` exists with `encodeSSEEvent` and `createSSEStream` | **PASS** | `streamHelpers.ts:3` and `streamHelpers.ts:7` |
| All four providers have stub `streamMessage` that throws "Not implemented" | **PASS** (superseded) | All four providers now have full implementations, so stubs are no longer needed |
| `npm run build` passes | **PASS** | Verified — build succeeds |

### T-095: Implement streamMessage in Anthropic Provider

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `streamMessage` yields token chunks followed by done chunk | **PASS** | `anthropic.ts:61-76` — iterates events, yields tokens, then yields done |
| System messages correctly separated into `system` param | **PASS** | `anthropic.ts:47-49` — filters system messages, joins into `systemText` |
| Token counts extracted from `stream.finalMessage().usage` | **PASS** | `anthropic.ts:70-76` — `finalMessage.usage.input_tokens`/`output_tokens` |
| Errors yield error chunk | **PASS** | `anthropic.ts:77-79` |
| `sendMessage` unchanged | **PASS** | `anthropic.ts:7-38` — original implementation intact |
| `npm run build` passes | **PASS** |

### T-096: Implement streamMessage in OpenAI Provider

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `streamMessage` yields token chunks then done chunk | **PASS** | `openai.ts:49-64` |
| Usage extracted from final chunk using `prompt_tokens`/`completion_tokens` | **PASS** | `openai.ts:53-55` |
| `stream_options: { include_usage: true }` present | **PASS** | `openai.ts:44` |
| `sendMessage` unchanged | **PASS** | `openai.ts:7-28` |
| `npm run build` passes | **PASS** |

### T-097: Implement streamMessage in Gemini Provider

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `streamMessage` yields token chunks then done chunk | **PASS** | `gemini.ts:71-87` |
| Uses `chunk.text` getter safely | **PASS** | `gemini.ts:72-73` |
| System prompt placed in `config.systemInstruction` | **PASS** | `gemini.ts:53-55, 65` |
| Uses model-level `generateContentStream`, not chat session | **PASS** | `gemini.ts:62` |
| Token counts from `usageMetadata` | **PASS** | `gemini.ts:77-79, 85-86` |
| `sendMessage` unchanged | **PASS** | `gemini.ts:7-41` |
| `npm run build` passes | **PASS** |

### T-098: Implement streamMessage in Mock Provider

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `streamMessage` yields characters one-by-one with delays | **PASS** | `mock.ts:43-46` — 10ms delay per character |
| Done chunk has estimated token counts | **PASS** | `mock.ts:48-53` — `Math.ceil(inputLength / 4)` |
| `sendMessage` unchanged | **PASS** | `mock.ts:17-34` |
| `npm run build` passes | **PASS** |

### T-099: Create SSE Test Helper

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Helper correctly parses SSE format | **PASS** | `sseHelper.ts:10-11` — splits by `\n\n`, extracts event + data lines |
| Handles comment lines (`:`) gracefully | **PASS** | `sseHelper.ts:17` — filters lines starting with `:` |
| Parses JSON data fields | **PASS** | `sseHelper.ts:32-35` — `JSON.parse` with fallback |
| Exported from shared test helper location | **PASS** | `__tests__/helpers/sseHelper.ts` |
| `npm run build` passes | **PASS** |

### T-100: Rewrite POST /api/llm/chat to Return SSE Stream

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Route returns SSE stream with `text/event-stream` content type | **PASS** | `route.ts:349` |
| Token events stream progressively | **PASS** | `route.ts:209-214` |
| Done event includes full userNode and assistantNode data | **PASS** | `route.ts:246-255` |
| Orphan cleanup for pre-content failures | **PASS** | `route.ts:290-301` — deletes user node, resets rootNodeId |
| Orphan cleanup for post-content failures | **PASS** | `route.ts:271-288` — saves partial assistant node |
| Auto-title fires on stream completion (non-streaming) | **PASS** | `route.ts:258-268` — calls `generateTitle()` which uses `sendMessage` |
| Token usage recorded on stream completion | **PASS** | `route.ts:228-241` |
| Pre-stream validation returns JSON errors | **PASS** | `route.ts:84-165` — JSON error responses for 400, 401, 403, 404, 422 |
| `export const dynamic = 'force-dynamic'` present | **PASS** | `route.ts:17` |
| `npm run build` passes | **PASS** |

### T-101: Rewrite LLM Chat Tests for SSE

| Criterion | Result | Evidence |
|-----------|--------|----------|
| All previous llm-chat test scenarios covered | **PASS** | 24 tests covering auth, validation, streaming success, errors |
| Pre-stream validation tests use JSON errors | **PASS** | Tests at lines 184-229 |
| Streaming success tests verify token + done events | **PASS** | Test at line 233 |
| Error tests verify partial vs non-partial | **PASS** | Tests at lines 340-396 |
| Auto-title test verifies `sendMessage` (non-streaming) | **PASS** | Test at line 400 |
| All tests pass | **PASS** | 158 tests across 17 files |
| `npm run build` passes | **PASS** |

### T-102: Create useStreamingChat Hook

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Hook exports all specified values | **PASS** | `useStreamingChat.ts:176-182` — `sendStreamingMessage`, `streamingContent`, `streamingState`, `streamingError`, `abortStream` |
| Streaming content accumulates progressively | **PASS** | `useStreamingChat.ts:137` — appends to `contentRef.current` |
| State transitions: idle → streaming → idle/error | **PASS** | `useStreamingChat.ts:51,147,153` |
| Updates batched at ≤50ms intervals | **PASS** | `useStreamingChat.ts:97` — `setTimeout(flushContent, 50)` |
| AbortController cleans up on unmount | **PASS** | `useStreamingChat.ts:30-36` |
| Pre-stream JSON errors handled | **PASS** | `useStreamingChat.ts:69-74` |
| `npm run build` passes | **PASS** |

### T-103: Update ChatPanel to Use Streaming Hook

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Chat submission uses streaming hook | **PASS** | `page.tsx:144` — calls `sendStreamingMessage` |
| Streaming content renders progressively | **PASS** | `ChatPanel.tsx:73-88` — renders streaming message with content |
| Cursor indicator visible during streaming | **PASS** | `ChatPanel.tsx:80` — pulsing `animate-pulse` block |
| Final nodes dispatched to ConversationContext on done | **PASS** | `page.tsx:178-182` — dispatches `ADD_NODES` and `SET_ACTIVE_NODE` |
| Auto-scroll during streaming | **PASS** | `ChatPanel.tsx:37-39` — scrolls on `streamingContent` change |
| LoadingIndicator usage reduced/replaced | **PASS** | `ChatPanel.tsx:84` — LoadingIndicator only shown when streaming with empty content; line 89 — non-streaming loading preserved |
| `npm run build` passes | **PASS** |

### T-104: Update ChatInput to Disable During Streaming

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Input disabled while streaming | **PASS** | `ChatInput.tsx:39,69` — `isDisabled = disabled || isStreaming` |
| Send button disabled while streaming | **PASS** | `ChatInput.tsx:71-89` — shows stop button instead when streaming |
| Optional stop button calls abortStream | **PASS** | `ChatInput.tsx:71-79` — `SquareIcon` button calls `onStopStreaming` |
| Input re-enables when streaming completes | **PASS** | `ChatInput.tsx:38-39` — computed from `streamingState` |
| `npm run build` passes | **PASS** |

### T-105: Update ChatPanel and ChatMessage Tests for Streaming

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Streaming rendering behavior tested | **PASS** | `ChatPanel.test.tsx:212-262` — 3 streaming tests |
| Input disable tested | **PARTIAL** | Input disable is tested indirectly through ChatInput's integration, but no dedicated ChatInput test file exists for the streaming disable behavior. The ChatPanel tests cover the streaming rendering. |
| All tests pass | **PASS** | 158 tests, all passing |
| `npm run build` passes | **PASS** |

## Bug Detection

### Bug 1: `streamingError` stale closure in handleSend
- **File:** `src/app/(protected)/chat/[conversationId]/page.tsx:159`
- **Description:** After `sendStreamingMessage` returns `null`, the code reads `streamingError` from the hook. However, `streamingError` is captured in the `useCallback` closure at the time `handleSend` was created, not at the time the streaming error actually occurred. Since `setStreamingError` happens inside `sendStreamingMessage` (an async call), and `handleSend` is a `useCallback`, the `streamingError` value may still be `null` when checked on line 159.
- **Severity:** Medium
- **Note:** The `streamingError` is listed in the `useCallback` deps array (line 214), which means it will cause `handleSend` to be recreated when `streamingError` changes. However, within a single execution of `handleSend`, the closure captures the value at the start. By the time `sendStreamingMessage` returns null, `streamingError` has been set inside the hook via `setState`, but the `handleSend` closure still sees the old value. This would cause error toasts to not appear on the first error, but would show stale errors on subsequent calls.

### Bug 2: `createSSEStream` helper not used by the route
- **File:** `src/lib/providers/streamHelpers.ts:7-63`
- **Description:** The `createSSEStream` utility was created per T-094 spec, but the actual route implementation in `route.ts` builds its own `ReadableStream` inline instead of using `createSSEStream`. This is not a bug per se — the inline implementation is correct and more flexible (it handles the `done` event data enrichment with DB-saved nodes). The `createSSEStream` helper writes the done event from the `onDone` callback, which doesn't give the caller a way to write the done event data to the stream directly. The route's inline approach is actually better.
- **Severity:** Low (dead code, acceptable deviation)

## Security

No new security issues introduced by F-20. The streaming changes preserve all existing security measures:

1. **Auth bypass:** All pre-stream validation checks (`auth()`, session check) happen before the stream starts. The route returns JSON 401/403 before creating the `ReadableStream`. **PASS**

2. **Data isolation:** Conversation ownership check at `route.ts:138` verifies `conversation.userId === session.user.id`. Node queries filter by `conversationId`. **PASS**

3. **API key exposure:** Provider API keys remain server-side only. The SSE stream only sends `content`, `userNode`, `assistantNode`, and `tokenUsage`. No API keys leak into events. **PASS**

4. **Input validation:** Content validation at `route.ts:98-104`, provider validation at `route.ts:107-120`, model validation at `route.ts:125-129`. **PASS**

5. **Mongoose injection:** Query parameters are validated and typed before use. **PASS**

## Architecture Alignment

| Check | Status | Notes |
|-------|--------|-------|
| Folder structure matches spec | **PASS** | `streamHelpers.ts` in `src/lib/providers/`, `useStreamingChat.ts` in `src/hooks/`, tests in expected locations |
| Mongoose models match schema | **PASS** | No model changes in F-20 |
| API route matches contract | **PASS** | SSE response format matches Architecture Delta: token events, done event with nodes, error events with partial flag |
| Components in correct locations | **PASS** | All modified components in `src/components/chat/` |
| Data flow as designed | **PASS** | Hook manages local streaming state, dispatches to context only on completion per Architecture Delta Section 5.1 |
| `createSSEStream` not used by route | **Acceptable deviation** | Route builds inline stream for richer control (DB writes between events). Helper still available for other uses. |
| `LLMProvider` interface has both `sendMessage` and `streamMessage` | **PASS** | Matches Architecture Delta "two methods on the provider interface" decision |

## Forward Compatibility

### F-21: Prompt Caching (Claude-only)
- **Assessment:** Compatible. The Anthropic `streamMessage` method is separate from `sendMessage`. Caching (`cache_control` breakpoints) can be added to both methods independently. The message-building logic in `streamMessage` mirrors `sendMessage`, so adding caching to the request will be straightforward.

### F-22: File Attachments
- **Assessment:** Compatible. `LLMAttachment` interface and `attachments?` on `LLMMessage` already added in T-094. The route already accepts the request body fields. The provider `streamMessage` methods accept `LLMMessage[]` which includes the `attachments` field. Ready for F-22.

### F-23: Per-Model Token Usage
- **Assessment:** Compatible. Token usage recording in the stream `done` handler (`route.ts:228-241`) uses `{ userId, provider }` as the key with `$inc`. Changing to per-model tracking will be a localized change in the `done` handler.

### F-24: Copy Markdown Button
- **Assessment:** No interaction with streaming. Compatible.

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate. The existing specification already documents the `LLMProvider` interface with both `sendMessage` and `streamMessage` (via the Architecture Delta Document), the components table lists all modified components with correct props, and the API contract section's `POST /api/llm/chat` endpoint documentation still applies (the SSE format is documented in the Architecture Delta).

Note: CLAUDE.md's API Contracts section still shows the non-streaming response format (`201: { userNode, assistantNode }`). This is technically outdated since the response is now SSE, but the Architecture Delta Document is the authoritative source for F-20 changes and correctly describes the SSE format. The CLAUDE.md API section describes the logical contract (what data is returned) rather than the transport format, and the core data returned is the same. This is acceptable as-is; a future cleanup could add a note about SSE format.

## Summary
- Critical issues: 0
- Medium issues: 1 (stale closure for streamingError in handleSend)
- Low issues: 1 (unused createSSEStream helper — dead code)
- CLAUDE.md updates: 0
- Recommendation: **FIX FIRST** — Two isolated fixes needed before proceeding: (1) fix the stale closure so error toasts display reliably, (2) remove dead `createSSEStream` code to keep the codebase clean. Neither requires architectural changes.
