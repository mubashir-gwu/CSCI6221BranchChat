# Task Breakdown — BranchChat Feature Set 2

> Derived from the Architecture Delta Document - Feature Set 2 (v3) and the existing Task Breakdowns (T-001 through T-093, all complete).
> All file paths are relative to `branch-chat/`. The existing codebase is fully built and passing audits through.

---

## Summary Table

| Feature | Tasks | Deliberations | Estimated Complexity |
|---------|-------|---------------|----------------------|
| F-20: Streaming Responses | 12 | 0 | High |
| F-21: Prompt Caching (Claude) | 2 | 0 | Low |
| F-22: File Attachments | 9 | 0 | High |
| F-23: Per-Model Token Usage | 4 | 0 | Medium |
| F-24: Copy Markdown Button | 2 | 0 | Low |
| **TOTAL** | **29** | **0** | — |

All design decisions were resolved in the Architecture Delta Document - Feature Set 2. No deliberations needed — tasks are execution-ready.

---

## Feature Dependency Graph

```
F-20: Streaming Responses (T-094 – T-105)
       │
       ├──► F-21: Prompt Caching (T-106 – T-107)
       │     │
       │     └──► F-22: File Attachments (T-108 – T-116)
       │
       └──► F-23: Per-Model Token Usage (T-117 – T-120)
             │
             └──► F-24: Copy Markdown Button (T-121 – T-122)
```

F-21 is small and runs after F-20 since caching applies to the same provider code. F-22 builds on the streaming provider layer. F-23 is sequenced after streaming since token recording happens in the stream completion handler. F-24 is pure UI with no dependencies.

---

## Risk Flags

| Task(s) | Risk | Mitigation |
|---------|------|------------|
| T-095–T-098 (provider `streamMessage`) | Each provider has different streaming APIs with different field names and error handling | Detailed per-provider instructions with exact field mappings; keep `sendMessage` untouched |
| T-100 (API route SSE rewrite) | Largest single-file rewrite; must preserve orphan cleanup, auto-title, token tracking | Step-by-step orchestration flow specified; test coverage follows immediately |
| T-102 (`useStreamingChat` hook) | Streaming state, batching, abort handling complexity | Hook is self-contained; batching pattern specified |
| T-109, T-111 (attachment provider formatting) | Three different provider content block formats | Format spec from delta doc section 13; each provider verified against pinned SDK version |

---

## F-20: Streaming Responses

**Description:** Replace the synchronous LLM request/response cycle with SSE streaming. Spans provider layer (`streamMessage` method), API route (SSE response), and frontend (streaming hook + progressive rendering). The existing `sendMessage` method is kept intact for auto-title.

**Dependencies:** All prior features (F-01 through F-19) complete.

---

### T-094: Add StreamChunk Type, streamMessage to Provider Interface, and Create Stream Helpers

**Feature:** F-20
**Dependencies:** None (first task)
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/types.ts`:
- Add the `StreamChunk` type (three variants: `token`, `done`, `error`).
- Add `streamMessage(messages: LLMMessage[], model: string): AsyncGenerator<StreamChunk>` to the `LLMProvider` interface.
- Add `LLMAttachment` interface and `attachments?: LLMAttachment[]` to `LLMMessage`.

Create `src/lib/providers/streamHelpers.ts`:
- Export `encodeSSEEvent(event: string, data: object): string` — returns `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`.
- Export `createSSEStream(generator: AsyncGenerator<StreamChunk>, options: { onDone, onError, signal }): ReadableStream` — a utility that wraps an async generator into a `ReadableStream` suitable for an SSE response. The `cancel` callback on the `ReadableStream` should call an abort function to stop the upstream generator. Include the initial padding comment `:\n\n` to flush browser buffers.

**Do NOT yet add `streamMessage` implementations** to the four providers — just add the method signature to the interface. The providers will fail TypeScript until subsequent tasks add their implementations. To keep the app compiling, add a temporary `// @ts-expect-error` in `src/lib/providers/index.ts` where providers are instantiated, OR add stub `streamMessage` implementations that throw `new Error('Not implemented')` to each provider. **Prefer the stub approach** so the app compiles cleanly.

**Acceptance Criteria:**
- `StreamChunk` type exported from `types.ts`
- `LLMProvider` interface has `streamMessage` method
- `LLMAttachment` and `attachments?` on `LLMMessage` in `types.ts`
- `streamHelpers.ts` exists with `encodeSSEEvent` and `createSSEStream`
- All four providers have stub `streamMessage` that throws "Not implemented"
- `npm run build` passes

**Commit Message:** `feat(providers): add StreamChunk type, streamMessage interface, and SSE stream helpers`

---

### T-095: Implement streamMessage in Anthropic Provider

**Feature:** F-20
**Dependencies:** T-094
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/anthropic.ts` — add `streamMessage()` method:

1. Build the request the same way as `sendMessage` (separate system messages for `system` param, map roles, etc.).
2. Call `this.client.messages.stream({ model, system, messages, max_tokens: 4096 })`.
3. Iterate with `for await (const event of stream)`:
   - On `event.type === 'content_block_delta'` where `event.delta.type === 'text_delta'`: yield `{ type: 'token', content: event.delta.text }`.
4. After iteration, call `const finalMessage = await stream.finalMessage()`.
5. Yield `{ type: 'done', content: finalMessage.content[0].text, inputTokens: finalMessage.usage.input_tokens, outputTokens: finalMessage.usage.output_tokens }`.
6. Wrap in try/catch — on error yield `{ type: 'error', message: error.message }`.

**⚠️ WARNING:** Use `client.messages.stream()` (NOT `client.messages.create({ stream: true })`). The `.stream()` method returns a `MessageStream` with `.finalMessage()` convenience method. The `.create({ stream: true })` returns a raw stream without helpers.

**⚠️ WARNING:** System prompts go in the `system` parameter, NOT the messages array. Ensure the existing system message extraction logic is reused.

Keep `sendMessage()` completely untouched — it's used by auto-title.

**Acceptance Criteria:**
- `streamMessage` yields token chunks followed by a done chunk
- System messages are correctly separated into the `system` param
- Token counts are extracted from `stream.finalMessage().usage`
- Errors yield an error chunk
- `sendMessage` is unchanged
- `npm run build` passes

**Commit Message:** `feat(anthropic): implement streamMessage with MessageStream API`

---

### T-096: Implement streamMessage in OpenAI Provider

**Feature:** F-20
**Dependencies:** T-094
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/openai.ts` — add `streamMessage()` method:

1. Build messages the same way as `sendMessage`.
2. Call `this.client.chat.completions.create({ model, messages, stream: true, stream_options: { include_usage: true } })`.
3. Iterate the async iterable:
   - If `chunk.choices[0]?.delta?.content` exists: yield `{ type: 'token', content: chunk.choices[0].delta.content }`.
   - Accumulate content into a local string.
   - **The final chunk has `choices: []` (empty array) and `chunk.usage` with token data.** Detect this by checking `chunk.choices.length === 0 && chunk.usage`.
4. On final chunk: yield `{ type: 'done', content: accumulated, inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }`.

**⚠️ WARNING:** `stream_options: { include_usage: true }` is REQUIRED — without it, the final chunk won't contain usage data.

**⚠️ WARNING:** OpenAI uses `prompt_tokens`/`completion_tokens` (NOT `input_tokens`/`output_tokens`). Map accordingly.

5. Wrap in try/catch — on error yield `{ type: 'error', message: error.message }`.

Keep `sendMessage()` unchanged.

**Acceptance Criteria:**
- `streamMessage` yields token chunks then done chunk
- Usage extracted from final chunk using correct OpenAI field names (`prompt_tokens`/`completion_tokens`)
- `stream_options: { include_usage: true }` is present in the API call
- `sendMessage` unchanged
- `npm run build` passes

**Commit Message:** `feat(openai): implement streamMessage with usage tracking`

---

### T-097: Implement streamMessage in Gemini Provider

**Feature:** F-20
**Dependencies:** T-094
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/gemini.ts` — add `streamMessage()` method:

1. Build the request: separate system messages for `config.systemInstruction`. Map `assistant` role to `model`. Build `contents` array from non-system messages.
2. Call `this.ai.models.generateContentStream({ model, contents, config: { systemInstruction } })`.
3. Iterate the async iterable:
   - **Use `chunk.text` getter** (NOT `chunk.candidates[0].content.parts[0].text`). The raw path throws on safety-filtered responses where `candidates` is undefined.
   - If `chunk.text` is truthy, yield `{ type: 'token', content: chunk.text }` and accumulate.
   - Track `chunk.usageMetadata` — each chunk carries it, the final chunk has cumulative totals.
4. After iteration, yield `{ type: 'done', content: accumulated, inputTokens: lastUsage.promptTokenCount, outputTokens: lastUsage.candidatesTokenCount }`.

**⚠️ WARNING:** Use `ai.models.generateContentStream()` (the model-level method), NOT `ai.chats.create().sendMessageStream()`. The current v2.1 uses `ai.chats.create()` for non-streaming, but for streaming use the model-level API to avoid chat session state issues. The message history must be passed in the `contents` field.

**⚠️ WARNING:** System prompts go in `config.systemInstruction`, NOT in the contents array.

**⚠️ WARNING:** Token usage is on `chunk.usageMetadata` (on each chunk directly, not on a wrapper). Fields: `promptTokenCount` / `candidatesTokenCount`.

5. Wrap in try/catch — on error yield `{ type: 'error', message: error.message }`.

Keep `sendMessage()` unchanged.

**Acceptance Criteria:**
- `streamMessage` yields token chunks then done chunk
- Uses `chunk.text` getter safely
- System prompt placed in `config.systemInstruction`
- Uses model-level `generateContentStream`, not chat session
- Token counts from `usageMetadata` using correct field names
- `sendMessage` unchanged
- `npm run build` passes

**Commit Message:** `feat(gemini): implement streamMessage with generateContentStream`

---

### T-098: Implement streamMessage in Mock Provider

**Feature:** F-20
**Dependencies:** T-094
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/mock.ts` — add `streamMessage()` method:

1. Use the existing canned response text.
2. Yield it character-by-character with `await new Promise(r => setTimeout(r, 10))` between characters, each as `{ type: 'token', content: char }`.
3. After all characters, yield `{ type: 'done', content: fullText, inputTokens: Math.ceil(inputLength/4), outputTokens: Math.ceil(fullText.length/4) }`.

Keep `sendMessage()` unchanged.

**Acceptance Criteria:**
- `streamMessage` yields characters one-by-one with delays
- Done chunk has estimated token counts
- `sendMessage` unchanged
- `npm run build` passes

**Commit Message:** `feat(mock): implement streamMessage with character-by-character simulation`

---

### T-099: Create SSE Test Helper

**Feature:** F-20
**Dependencies:** T-094
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `__tests__/helpers/sseHelper.ts`:

```typescript
export async function collectSSEEvents(response: Response): Promise<{ event: string; data: any }[]> {
  // Read the response body as text
  // Split by double newline
  // Parse each event block: extract 'event:' and 'data:' lines
  // JSON.parse the data field
  // Return array of { event, data } objects
  // Skip comment lines (starting with ':')
}
```

This helper will be used by all SSE-related tests in subsequent tasks. Also export a type for the parsed event.

**Acceptance Criteria:**
- Helper correctly parses SSE format (event + data lines separated by `\n\n`)
- Handles comment lines (`:`) gracefully
- Parses JSON data fields
- Exported from a shared test helper location
- `npm run build` passes

**Commit Message:** `test: create SSE event collection helper for streaming tests`

---

### T-100: Rewrite POST /api/llm/chat to Return SSE Stream

**Feature:** F-20
**Dependencies:** T-095, T-096, T-097, T-098, T-099
**Estimated Complexity:** High ⚠️ RISK
**Execution Mode:** PLAN-THEN-AUTO
**Deliberation Required:** No

**Detailed Description:**

**Major rewrite** of `src/app/api/llm/chat/route.ts`. This is the highest-risk task in this round.

Add route-level exports:
```typescript
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
```

The orchestration flow:

1. **Pre-stream validation** (return JSON errors — these happen before the stream starts):
   - Parse body via `request.json()`.
   - Validate required fields (`conversationId`, `parentNodeId`, `content`, `provider`, `model`).
   - Auth check → 401.
   - Conversation ownership check → 403.
   - Provider availability check → 422.
   - (Attachment validation will be added in F-22.)

2. **Save user node** to DB (before streaming starts). Include any `attachments` from request body (though attachments aren't sent yet — this prepares the code path).

3. **Create a `ReadableStream`** and return it as the SSE response with headers:
   ```typescript
   {
     'Content-Type': 'text/event-stream',
     'Cache-Control': 'no-cache',
     'Connection': 'keep-alive',
     'X-Accel-Buffering': 'no',
   }
   ```

4. **Inside the stream**: Call `provider.streamMessage(messages, model)`. For each chunk:
   - `token`: Write `event: token\ndata: {"content":"..."}\n\n` to stream. Accumulate content.
   - `done`: Save assistant node to DB. Update `TokenUsage` (still per-provider for now — F-23 changes this to per-model). Fire auto-title if applicable (fire-and-forget, same as before). Write `event: done\ndata: {"userNode":{...},"assistantNode":{...},"tokenUsage":{...}}\n\n`.
   - `error`: Apply orphan cleanup logic (see below). Write `event: error\ndata: {"message":"...","partial":true|false}\n\n`.

5. **Orphaned node cleanup (CRITICAL):**
   - If the stream fails BEFORE any content arrives: delete user node, reset `rootNodeId` if first message → `partial: false`.
   - If the stream fails AFTER some content arrived: keep both nodes, save partial content as assistant node → `partial: true`.

6. **Auto-title** must fire from the stream `done` handler, not the old response handler. Same logic: if `parentNodeId === null` and title is `"New Conversation"`, fire-and-forget `provider.sendMessage()` (non-streaming) for title generation.

7. **Client disconnect**: Use `request.signal` to detect disconnects. Pass it through to the `ReadableStream` cancel callback to abort the provider stream.

**⚠️ WARNING:** The `UIProvider.refreshProviders` has a `useRef` stale-closure fix that MUST be preserved. Do not modify any context providers in this task.

**⚠️ WARNING:** The middleware matcher uses explicit URL paths (`'/chat/:path*'`, etc.). The endpoint path is unchanged (`/api/llm/chat`), so no middleware changes needed.

**Acceptance Criteria:**
- Route returns SSE stream with `text/event-stream` content type
- Token events stream progressively
- Done event includes full userNode and assistantNode data
- Orphan cleanup works for both pre-content and post-content failures
- Auto-title fires on stream completion (non-streaming call via `sendMessage`)
- Token usage recorded on stream completion
- Pre-stream validation returns JSON errors (400, 401, 403, 422)
- `export const dynamic = 'force-dynamic'` present
- `npm run build` passes

**Commit Message:** `feat(api): rewrite POST /api/llm/chat to return SSE streaming response`

---

### T-101: Rewrite LLM Chat Tests for SSE

**Feature:** F-20
**Dependencies:** T-100, T-099
**Estimated Complexity:** High
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Rewrite `__tests__/api/llm-chat.test.ts` to handle SSE responses instead of JSON.

- Use the `collectSSEEvents` helper from T-099.
- All existing test scenarios must be preserved but adapted:
  - Successful message: verify token events followed by done event with userNode + assistantNode.
  - Pre-stream errors (missing fields, unauthorized, wrong owner, unavailable provider): verify JSON error responses (these still return JSON, not SSE).
  - Provider error: verify error event in stream with appropriate `partial` flag.
  - Orphan node cleanup: verify user node is deleted on pre-content failure, kept on post-content failure.
  - Auto-title: verify `sendMessage` is called (not `streamMessage`) for title generation.
  - Token usage recording: verify `TokenUsage.findOneAndUpdate` called with correct values.

- Mock the provider's `streamMessage` to return a controlled async generator:
  ```typescript
  async function* mockStreamGenerator(): AsyncGenerator<StreamChunk> {
    yield { type: 'token', content: 'Hello' };
    yield { type: 'token', content: ' world' };
    yield { type: 'done', content: 'Hello world', inputTokens: 10, outputTokens: 5 };
  }
  ```

- For error tests, mock generators that yield `error` chunks or throw.

Reference: v2.1 test baseline had ~103 tests across 13 files. This task replaces the `llm-chat.test.ts` tests entirely.

**Acceptance Criteria:**
- All previous llm-chat test scenarios covered with SSE-aware assertions
- Pre-stream validation tests unchanged (still JSON errors)
- Streaming success tests verify token + done events
- Error tests verify partial vs non-partial error handling
- Auto-title test verifies `sendMessage` (non-streaming) is used
- All tests pass
- `npm run build` passes

**Commit Message:** `test: rewrite llm-chat tests for SSE streaming responses`

---

### T-102: Create useStreamingChat Hook

**Feature:** F-20
**Dependencies:** T-100
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/hooks/useStreamingChat.ts`:

**Exports:** `{ sendStreamingMessage, streamingContent, streamingState, streamingError, abortStream }`

**State (local, NOT in context):**
- `streamingContent: string` — accumulated tokens.
- `streamingState: 'idle' | 'streaming' | 'error'`.
- `streamingError: string | null`.
- Internal `AbortController` ref.

**`sendStreamingMessage(request: LLMChatRequest)`:**
1. Set state to `streaming`, clear content.
2. Create `AbortController`, store in ref.
3. `fetch('/api/llm/chat', { method: 'POST', body: JSON.stringify(request), signal: controller.signal })`.
4. If response is not ok (pre-stream JSON error): parse JSON, set error state, return.
5. Read the `response.body` stream using `getReader()` + `TextDecoder`.
6. Parse incoming SSE events (split by `\n\n`, extract `event:` and `data:` lines).
7. On `token` event: append content. **Batch state updates** — accumulate tokens in a local variable, flush to `setState` at most every 50ms using `requestAnimationFrame` or `setTimeout`.
8. On `done` event: set final content, set state to `idle`, return the parsed done data (userNode, assistantNode) so the caller can dispatch to `ConversationContext`.
9. On `error` event: set error state.
10. On `AbortError` (user navigated away): silent cleanup, set state to `idle`.

**`abortStream()`:** Calls `controller.abort()`.

**Cleanup:** On unmount, abort any active stream.

**⚠️ WARNING:** Batched rendering is critical for performance. Without it, `react-markdown` re-renders the full accumulated content on every chunk, causing visible jank. Batch at 50ms minimum.

**Acceptance Criteria:**
- Hook exports all specified values
- Streaming content accumulates progressively
- State transitions: idle → streaming → idle (success) or idle → streaming → error
- Updates are batched at ≤50ms intervals
- AbortController cleans up on unmount
- Pre-stream JSON errors are handled
- `npm run build` passes

**Commit Message:** `feat(hooks): create useStreamingChat hook with batched rendering`

---

### T-103: Update ChatPanel to Use Streaming Hook

**Feature:** F-20
**Dependencies:** T-102
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatPanel.tsx`:

1. Import and use the `useStreamingChat` hook.
2. Replace the existing `fetch` + `await response.json()` chat submission logic with `sendStreamingMessage()`.
3. On `done` event data returned from the hook: dispatch `ADD_NODES` (or equivalent action) to `ConversationContext` with the userNode and assistantNode from the done event.
4. While `streamingState === 'streaming'`, render a temporary `ChatMessage` component at the bottom of the message list with:
   - `content` set to `streamingContent` from the hook.
   - A pulsing cursor indicator at the end (CSS animation, e.g., a blinking `▊` character or a small animated dot).
   - `role: 'assistant'`.
5. Remove or reduce usage of `LoadingIndicator` — the "three dots loading" pattern is replaced by the streaming text itself. Keep `LoadingIndicator` visible only during the brief pre-stream setup phase (between send click and first token arrival) if desired, or show the pulsing cursor on empty content.
6. Auto-scroll: on each token batch update during streaming, scroll to the bottom of the message list.

**⚠️ WARNING:** The `UIProvider.refreshProviders` has a `useRef` stale-closure fix. Do NOT modify `UIProvider` or the way it's consumed. Only modify `ChatPanel`'s own submission logic.

**Acceptance Criteria:**
- Chat submission uses streaming hook instead of JSON fetch
- Streaming content renders progressively in the chat
- Cursor indicator visible during streaming
- Final nodes dispatched to ConversationContext on done
- Auto-scroll during streaming
- LoadingIndicator usage reduced/replaced
- `npm run build` passes

**Commit Message:** `feat(chat): update ChatPanel to use streaming chat hook`

---

### T-104: Update ChatInput to Disable During Streaming

**Feature:** F-20
**Dependencies:** T-103
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatInput.tsx`:

1. Accept a `streamingState` prop (or read from a shared source — the hook state must be accessible).
2. Disable the textarea and send button when `streamingState === 'streaming'`.
3. Optionally show a "Stop" button that calls `abortStream()` to cancel the in-progress stream.

If the hook state needs to be shared between `ChatPanel` and `ChatInput`, either:
- Pass it as props from `ChatPanel` (preferred — keep it simple).
- Or lift the hook to a shared parent.

**Acceptance Criteria:**
- Input disabled while streaming
- Send button disabled while streaming
- Optional stop button calls abortStream
- Input re-enables when streaming completes or errors
- `npm run build` passes

**Commit Message:** `feat(chat): disable ChatInput during streaming with optional stop button`

---

### T-105: Update ChatPanel and ChatMessage Tests for Streaming

**Feature:** F-20
**Dependencies:** T-103, T-104
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Update `__tests__/components/ChatPanel.test.tsx` (and `ChatMessage.test.tsx` if it exists):

- Mock the `useStreamingChat` hook to control streaming state.
- Test that:
  - While streaming, a temporary message with streaming content is rendered.
  - Send button is disabled during streaming.
  - On done, final nodes appear in the conversation.
  - Cursor indicator is visible during streaming.
- For ChatMessage: test that it renders progressive content when given streaming props.

**Acceptance Criteria:**
- Streaming rendering behavior tested
- Input disable tested
- All tests pass
- `npm run build` passes

**Commit Message:** `test: update ChatPanel and ChatMessage tests for streaming behavior`

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-21: Prompt Caching (Claude-only)

**Description:** Add `cache_control` breakpoints to Anthropic API requests to enable prompt caching. Cache writes cost 25% more, but cache reads are 90% cheaper — net benefit comes from repeated reads in multi-turn conversations. Localized to the Anthropic provider file only.

**Dependencies:** F-20 complete (streaming must be in place since caching applies to `streamMessage` as well as `sendMessage`).

---

### T-106: Add cache_control Breakpoints to Anthropic Provider

**Feature:** F-21
**Dependencies:** T-105 (F-20 complete)
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/anthropic.ts` — in BOTH `sendMessage` and `streamMessage`:

When building the request, add `cache_control: { type: "ephemeral" }` to exactly TWO positions:

1. **System prompt content block** — the system parameter content block:
   ```typescript
   system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
   ```
2. **Last message content block** — the final element of the `messages` array. If the last message has text content:
   ```typescript
   messages[messages.length - 1].content = [
     { type: 'text', text: originalText, cache_control: { type: 'ephemeral' } }
   ];
   ```

**⚠️ WARNING:** Claude allows max 4 `cache_control` breakpoints per request — using 2 is optimal. Do NOT add more.

**⚠️ WARNING:** Do NOT persist `cache_control` flags in the database. Add them dynamically when building the request, right before sending.

**⚠️ WARNING:** The `cache_control` must be applied AFTER building the full message array including any attachments (which are added in F-22). For now, apply it to the text-only messages. F-22 will need to ensure cache_control is on the fully-built content blocks.

If the system prompt is empty or absent, skip the system-level breakpoint. If there are no messages, skip the message-level breakpoint.

**Acceptance Criteria:**
- System prompt content block has `cache_control` when present
- Last message content block has `cache_control`
- Applied in both `sendMessage` and `streamMessage`
- No `cache_control` in database/stored data
- Exactly 2 breakpoints used
- `npm run build` passes

**Commit Message:** `feat(anthropic): add prompt caching with cache_control breakpoints`

---

### T-107: Write Tests for Prompt Caching

**Feature:** F-21
**Dependencies:** T-106
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Add tests in `__tests__/lib/providers/anthropic.test.ts` (create if it doesn't exist, or add to existing provider tests):

- Test that `sendMessage` request includes `cache_control` on system content block.
- Test that `streamMessage` request includes `cache_control` on last message content block.
- Test that no `cache_control` is added when system prompt is absent.
- Mock the Anthropic client to capture the request payload and assert on it.

**Acceptance Criteria:**
- Cache control breakpoint placement verified in tests
- Both sendMessage and streamMessage covered
- All tests pass
- `npm run build` passes

**Commit Message:** `test: add prompt caching tests for Anthropic provider`

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-22: File Attachments

**Description:** Allow users to attach files (images, PDFs, text) to chat messages. Files are stored as base64 in MongoDB on the Node document. Provider-specific formatting transforms attachments into the correct content blocks for each LLM. Export/import includes attachments.

**Dependencies:** F-20 and F-21 complete (the provider layer must be stable, and caching interaction with content blocks must be understood).

---

### T-108: Add Attachment Schema to Node Model and Update Types

**Feature:** F-22
**Dependencies:** T-107 (F-21 complete)
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/models/Node.ts`:
- Add `attachments` subdocument array to the schema:
  ```typescript
  attachments: [{
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: String, required: true },
    size: { type: Number, required: true },
    _id: false
  }]
  ```
- Add `attachments?: Attachment[]` to the `INode` interface.

Modify `src/types/database.ts` (or wherever the frontend `Attachment` type lives):
- Add `Attachment` interface: `{ filename: string; mimeType: string; data: string; size: number; }`.
- Add `attachments?: Attachment[]` to the node type used by the frontend.

Modify `src/types/api.ts`:
- Update `LLMChatRequest` to include `attachments?: { filename: string; mimeType: string; data: string; size: number; }[]`.

Modify `src/types/export.ts`:
- Add `attachments?` to the exported node type.

**Acceptance Criteria:**
- Node schema has `attachments` subdocument array
- All TypeScript types updated
- No index changes needed
- `npm run build` passes

**Commit Message:** `feat(schema): add attachments field to Node model and update types`

---

### T-109: Create Attachment Formatter Utility

**Feature:** F-22
**Dependencies:** T-108
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/lib/providers/attachmentFormatter.ts`:

Export `formatAttachmentsForProvider(attachments: LLMAttachment[], provider: string): any[]` — returns an array of provider-specific content blocks.

**Anthropic format:**
- Images: `{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }`
- PDFs: `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }`
- Text files (`.txt`, `.md`, `.csv`): Decode base64 to UTF-8 text, inline as `{ type: 'text', text: '[File: filename]\n' + decodedText }`

**OpenAI format:**
- Images: `{ type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Data } }`
- PDFs: `{ type: 'file', file: { filename: filename, file_data: 'data:application/pdf;base64,' + base64Data } }`
  - **Note:** `file_data` must be a data URI with prefix, not raw base64.
- Text files: Decode base64 to UTF-8 text, inline as `{ type: 'text', text: '[File: filename]\n' + decodedText }`

**Gemini format:**
- Images and PDFs: `{ inlineData: { mimeType: mimeType, data: base64Data } }`
- Text files: Decode base64 to UTF-8 text, inline as `{ text: '[File: filename]\n' + decodedText }`

**Mock format:**
- Return empty array (mock doesn't process attachments, but will acknowledge filenames in T-112).

**⚠️ WARNING:** For text files (.txt, .md, .csv), decode from base64 to UTF-8 and inline as text for ALL providers. Don't send text files as binary blobs.

**⚠️ WARNING:** `.md` files may have MIME type `text/plain` — treat both `text/plain` and `text/markdown` as text files.

**Acceptance Criteria:**
- Correct content block format for each provider
- Text files decoded from base64 to UTF-8 and inlined
- OpenAI PDFs use data URI format for `file_data`
- `npm run build` passes

**Commit Message:** `feat(providers): create attachment formatter with per-provider content blocks`

---

### T-110: Update Context Builder to Include Attachments

**Feature:** F-22
**Dependencies:** T-108, T-109
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/contextBuilder.ts`:

When building the `LLMMessage[]` array by walking the path to root, include `attachments` from each node:
- If `node.attachments` exists and is non-empty, map each `Attachment` to `LLMAttachment` (same fields minus `size`) and set it on the `LLMMessage.attachments` field.
- The `LLMAttachment` type was added to `types.ts` in T-094.

**⚠️ WARNING:** Include attachments from ALL nodes in the path, not just the current node. Each historical message retains its attachments for full context.

The token estimation for truncation should account for attachment size — estimate each attachment as `Math.ceil(attachment.size / 4)` additional tokens (rough estimate for base64 content). This ensures the truncation logic doesn't send conversations that are too large.

**Acceptance Criteria:**
- Attachments from all path nodes are included in the message array
- `LLMMessage.attachments` populated from `node.attachments`
- Token estimation accounts for attachment size
- `npm run build` passes

**Commit Message:** `feat(context): include attachments from all path nodes in LLM message array`

---

### T-111: Add Attachment Validation and Integration in Chat Route

**Feature:** F-22
**Dependencies:** T-109, T-110
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/llm/chat/route.ts`:

1. **Body size check** — Add manual `Content-Length` check before `request.json()`:
   ```typescript
   const contentLength = parseInt(request.headers.get('content-length') || '0');
   const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB
   if (contentLength > MAX_BODY_SIZE) {
     return Response.json({ error: 'Request body too large' }, { status: 413 });
   }
   ```

2. **Attachment validation** (after parsing body, before saving user node):
   - If `attachments` present:
     - File count ≤ 5, else 400.
     - Each file size ≤ 5MB (`attachment.size <= 5 * 1024 * 1024`), else 400.
     - Total size ≤ 10MB (`sum of attachment.size <= 10 * 1024 * 1024`), else 400.
     - Each MIME type in allowed list: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown`, `text/csv`, else 400.

3. **Save attachments on user node** — When creating the user node, include `attachments` from the request body.

4. **Provider message building** — The context builder (modified in T-110) already includes attachments in the `LLMMessage` array. In each provider's `streamMessage` (and `sendMessage`), use `formatAttachmentsForProvider` from T-109 to transform `LLMAttachment[]` into provider-specific content blocks when building the API request.

   This means modifying each provider's message building logic in `streamMessage` and `sendMessage` to:
   - Check if the message has `attachments`.
   - If yes, convert the content from a simple string to multi-part content with text + attachment blocks using `formatAttachmentsForProvider`.

**⚠️ WARNING:** For the Anthropic provider, `cache_control` must be applied AFTER building the full content blocks (including attachments). Ensure the cache_control logic from T-106 runs on the final, fully-built content array.

**⚠️ WARNING:** MongoDB document size limit is 16MB. With base64 overhead (33%), a 10MB pre-base64 total = ~13.3MB base64. With node metadata, this stays under 16MB.

**Acceptance Criteria:**
- Body size check rejects >20MB payloads with 413
- Attachment validation rejects invalid files with 400
- Attachments saved on user node in DB
- Providers format attachments using `formatAttachmentsForProvider`
- Anthropic cache_control applied after attachment content blocks
- `npm run build` passes

**Commit Message:** `feat(api): add attachment validation and provider formatting in chat route`

---

### T-112: Update Mock Provider to Acknowledge Attachments

**Feature:** F-22
**Dependencies:** T-111
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/mock.ts`:

In both `sendMessage` and `streamMessage`, if the last user message has `attachments`:
- Prepend to the response: `"I see you've attached: [filename1, filename2, ...]. "` followed by the canned response.

This provides visible feedback during development that attachments are being passed through correctly.

**Acceptance Criteria:**
- Mock acknowledges attachment filenames in response
- Works for both streaming and non-streaming
- `npm run build` passes

**Commit Message:** `feat(mock): acknowledge file attachments in mock provider responses`

---

### T-113: Create FileUploadArea Component and Integrate into ChatInput

**Feature:** F-22
**Dependencies:** T-108
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/components/chat/FileUploadArea.tsx`:

**Props:** `{ files: File[], onFilesChange: (files: File[]) => void, disabled: boolean }`

**Behavior:**
- Renders a paperclip icon button (from lucide-react, e.g., `Paperclip`) that opens a hidden `<input type="file" multiple>`.
- Supports drag-and-drop onto the component area.
- Shows preview chips for attached files:
  - Images: small thumbnail (use `URL.createObjectURL`).
  - PDFs/text: filename chip with file type icon.
  - Each chip has an `X` button to remove.
- Client-side validation:
  - Max 5 files — toast on excess.
  - Max 5MB per file — toast on oversize.
  - Max 10MB total — toast on excess.
  - Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf`, `.txt`, `.md`, `.csv` — toast on invalid type.
- When `disabled` is true, the paperclip button and drag-and-drop are inactive.

Modify `src/components/chat/ChatInput.tsx`:

1. Add state: `const [files, setFiles] = useState<File[]>([])`.
2. Render `<FileUploadArea files={files} onFilesChange={setFiles} disabled={streamingState === 'streaming'} />` below (or beside) the textarea.
3. On send: read each file as base64 via `FileReader.readAsArrayBuffer()` + convert to base64 string. Include in request body as `attachments: [{ filename, mimeType, data, size }]`.
4. Clear files after successful send.
5. Add drag-and-drop event handlers (`onDragOver`, `onDrop`) on the input container that delegate to `FileUploadArea`.

**⚠️ WARNING:** Use `FileReader.readAsDataURL()` and strip the `data:...;base64,` prefix, OR use `readAsArrayBuffer()` + manual conversion. The `readAsDataURL` approach is simpler but includes the data URI prefix that must be stripped before sending as raw base64.

**⚠️ WARNING:** `.md` files may be detected as `text/plain` by the browser. Accept both `text/plain` and `text/markdown` MIME types.

**Acceptance Criteria:**
- Paperclip button opens file picker
- Drag-and-drop supported
- Preview chips shown with remove button
- Client-side validation enforced with toast feedback
- Files read as base64 and included in request
- Files cleared after send
- Disabled during streaming
- `npm run build` passes

**Commit Message:** `feat(chat): create FileUploadArea component and integrate into ChatInput`

---

### T-114: Update ChatMessage to Display Attachment Previews

**Feature:** F-22
**Dependencies:** T-108
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatMessage.tsx`:

If `node.attachments` exists and is non-empty, render attachment previews above or below the message content:

- **Images** (`image/*`): Inline thumbnail using base64 data URL: `<img src={'data:' + att.mimeType + ';base64,' + att.data} />` with `max-h-48` and `rounded` styling. Clickable to open full size in new tab.
- **PDFs** (`application/pdf`): Clickable chip showing filename + a PDF icon (from lucide-react, e.g., `FileText`). On click, open `data:application/pdf;base64,${att.data}` in a new tab.
- **Text files** (`text/*`): Expandable chip showing filename. On click, expand to show the decoded text content (decode base64 to UTF-8 using `atob()` or `TextDecoder`).

**Acceptance Criteria:**
- Image attachments render as thumbnails
- PDF attachments render as clickable chips
- Text attachments render as expandable chips
- No attachment UI shown when `attachments` is empty/undefined
- `npm run build` passes

**Commit Message:** `feat(chat): display attachment previews in ChatMessage`

---

### T-115: Update Export and Import to Include Attachments

**Feature:** F-22
**Dependencies:** T-108
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/conversations/[id]/export/route.ts`:
- When serializing nodes, include the `attachments` field if present. The existing node query already loads full documents — just ensure `attachments` is not excluded from the response mapping.

Modify `src/app/api/import/route.ts`:
- When restoring nodes from imported JSON, include `attachments` from the import data if present.
- No additional validation needed on import — the data was already validated when originally saved.

**⚠️ WARNING:** Exports with many attachments can be very large. This is an accepted tradeoff for self-contained portability. No enforcement needed.

**Acceptance Criteria:**
- Exported JSON includes `attachments` on nodes that have them
- Imported conversations restore attachments onto nodes
- Round-trip: export → import preserves all attachments
- `npm run build` passes

**Commit Message:** `feat(export): include file attachments in export/import`

---

### T-116: Write Tests for File Attachments

**Feature:** F-22
**Dependencies:** T-111, T-113, T-115
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Add/update tests:

**In `__tests__/api/llm-chat.test.ts`** (add to existing SSE tests from T-101):
- Test: valid attachments are saved on user node.
- Test: file count > 5 → 400 error.
- Test: file > 5MB → 400 error.
- Test: total > 10MB → 400 error.
- Test: invalid MIME type → 400 error.
- Test: body > 20MB → 413 error.

**In `__tests__/api/import-export.test.ts`** (add to existing):
- Test: export includes attachments.
- Test: import restores attachments.

**In `__tests__/lib/providers/attachmentFormatter.test.ts`** (new file):
- Test: Anthropic format for images, PDFs, text files.
- Test: OpenAI format (data URI for PDFs).
- Test: Gemini format (inlineData).
- Test: text file decoding from base64.

**Acceptance Criteria:**
- Attachment validation tests cover all limit scenarios
- Export/import round-trip tested with attachments
- Provider formatting tested for all three providers
- All tests pass
- `npm run build` passes

**Commit Message:** `test: add file attachment tests for validation, formatting, and export/import`

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-23: Per-Model Token Usage

**Description:** Change the `TokenUsage` collection key from `provider` to `model` for finer-grained tracking. Update the schema, token recording logic, and the `/usage` page to show per-model breakdown grouped by provider.

**Dependencies:** F-20 complete (token recording happens in the stream completion handler).

---

### T-117: Update TokenUsage Schema for Per-Model Tracking

**Feature:** F-23
**Dependencies:** T-105 (F-20 complete)
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/models/TokenUsage.ts`:

1. Add `model: string` field (required).
2. Keep `provider: string` field (metadata for grouping).
3. Change the unique compound index from `{ userId: 1, provider: 1 }` to `{ userId: 1, model: 1 }`.
4. Add a non-unique index `{ userId: 1, provider: 1 }` for aggregation queries.
5. Update the `ITokenUsage` interface accordingly.

**Migration:** Create a migration script or inline code that drops existing `tokenusages` collection on startup if schema mismatch is detected. Simplest approach: add a one-time migration check. Or just document that existing token usage data will be lost and the collection should be dropped manually (`db.tokenusages.drop()`). Since this is informational-only data, loss is acceptable.

**⚠️ WARNING:** The model identifier string must be consistent. Use the exact model string from the provider (e.g., `"claude-sonnet-4-5-20250929"`, `"gpt-4o"`, `"gemini-2.0-flash"`). This is whatever is passed in the `model` field of the LLM chat request.

**Acceptance Criteria:**
- Schema has `model` field with unique compound index `{ userId, model }`
- `provider` field kept as non-unique indexed metadata
- Interface updated
- Old data migration documented (drop collection)
- `npm run build` passes

**Commit Message:** `feat(schema): update TokenUsage for per-model tracking`

---

### T-118: Update Token Recording Logic in Chat Route

**Feature:** F-23
**Dependencies:** T-117
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify the token recording in `src/app/api/llm/chat/route.ts` (in the stream `done` handler):

Change from:
```typescript
await TokenUsage.findOneAndUpdate(
  { userId, provider },
  { $inc: { inputTokens, outputTokens, callCount: 1 } },
  { upsert: true }
);
```

To:
```typescript
await TokenUsage.findOneAndUpdate(
  { userId, model },
  { $inc: { inputTokens, outputTokens, callCount: 1 }, $set: { provider } },
  { upsert: true }
);
```

The `model` value comes from the request body. The `provider` is set via `$set` so it's always present on upsert.

Also update the auto-title token recording (if it records tokens) to use the same pattern.

**Acceptance Criteria:**
- Token usage keyed by `{ userId, model }` not `{ userId, provider }`
- `$set: { provider }` ensures provider metadata is present
- Auto-title token recording also updated
- `npm run build` passes

**Commit Message:** `feat(api): update token recording to use per-model key`

---

### T-119: Update Token Usage API Route and Usage Page

**Feature:** F-23
**Dependencies:** T-117, T-118
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/token-usage/route.ts`:
- Query returns all `TokenUsage` docs for the user (unchanged query).
- Response now includes `model` and `provider` fields per entry:
  ```typescript
  { usage: [{ model, provider, inputTokens, outputTokens, callCount }] }
  ```

Modify `src/components/dashboard/TokenUsageCard.tsx`:
- Group usage entries by `provider`, then show per-model breakdown within each group:
  ```
  Anthropic
    claude-sonnet-4-5: 12,400 input / 3,200 output (45 calls)
  OpenAI
    gpt-4o: 5,600 input / 1,400 output (12 calls)
  ```
- Use the existing card styling. Add sub-headings for providers and indented rows for models.
- Handle empty state (no usage data).

**Acceptance Criteria:**
- API returns `model` and `provider` per usage entry
- TokenUsageCard groups by provider with per-model breakdown
- Empty state handled
- `npm run build` passes

**Commit Message:** `feat(usage): update token usage API and UI for per-model breakdown`

---

### T-120: Write Tests for Per-Model Token Usage

**Feature:** F-23
**Dependencies:** T-118, T-119
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Add/update tests:

**In `__tests__/api/llm-chat.test.ts`** (update existing token recording test):
- Verify `TokenUsage.findOneAndUpdate` is called with `{ userId, model }` filter and `$set: { provider }`.

**In `__tests__/api/token-usage.test.ts`** (if exists, or add to relevant test file):
- Verify response includes `model` and `provider` fields.

**Acceptance Criteria:**
- Token recording test uses per-model key
- API response shape tested
- All tests pass
- `npm run build` passes

**Commit Message:** `test: add per-model token usage tests`

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-24: Copy Markdown Button

**Description:** Add a button to each chat message that copies the raw markdown content to the clipboard with visual feedback. Pure UI change, no backend or schema changes.

**Dependencies:** F-23 complete (sequenced last as a quick win).

---

### T-121: Create CopyMarkdownButton Component and Add to ChatMessage

**Feature:** F-24
**Dependencies:** T-120 (F-23 complete)
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/components/chat/CopyMarkdownButton.tsx`:

**Props:** `{ content: string }`

**Behavior:**
- Render a small icon button using `ClipboardCopy` from lucide-react.
- On click: `navigator.clipboard.writeText(content)`.
- Swap icon to `Check` (lucide-react) for 2 seconds, then revert to `ClipboardCopy`. Use local state + `setTimeout`.
- No toast — icon change is sufficient feedback.
- Style: small, muted, same treatment as other action buttons on ChatMessage (e.g., the branch button).

Modify `src/components/chat/ChatMessage.tsx`:
- Import and render `<CopyMarkdownButton content={node.content} />` in the message action area alongside existing action buttons.
- Only show on assistant messages (or both user and assistant — match existing action button pattern).
- Don't show while streaming (content is still arriving).

**⚠️ NOTE:** Also check if `react-markdown` v10 `className` prop issue exists. If the existing `<Markdown>` uses `className` prop directly, fix it: wrap with `<div className="prose"><Markdown>...</Markdown></div>`. The `className` prop was removed in v10.0.0 and silently does nothing.

**Acceptance Criteria:**
- Copy button visible on chat messages
- Clicking copies raw markdown to clipboard
- Icon swaps to Check for 2 seconds
- No toast notification
- Not shown during streaming
- `npm run build` passes

**Commit Message:** `feat(chat): add copy markdown button to chat messages`

---

### T-122: Write Tests for CopyMarkdownButton

**Feature:** F-24
**Dependencies:** T-121
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `__tests__/components/chat/CopyMarkdownButton.test.tsx`:

- Test: renders clipboard icon.
- Test: on click, calls `navigator.clipboard.writeText` with the content.
- Test: icon changes to check mark after click.
- Test: icon reverts after 2 seconds (use `vi.useFakeTimers`).

Mock `navigator.clipboard.writeText`.

**Acceptance Criteria:**
- All copy behavior tested
- Icon transition tested with fake timers
- All tests pass
- `npm run build` passes

**Commit Message:** `test: add CopyMarkdownButton tests`

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## End of Task Breakdown — Feature Set 2

**Total: 29 tasks (T-094 through T-122) across 5 features (F-20 through F-24).**

### Execution Summary

| Phase | Feature | Tasks | Key Risk |
|-------|---------|-------|----------|
| 1 | Streaming Responses | T-094–T-105 | API route rewrite (T-100), test rewrite (T-101) |
| 2 | Prompt Caching | T-106–T-107 | None (localized) |
| 3 | File Attachments | T-108–T-116 | Provider formatting (T-109, T-111), body size handling |
| 4 | Per-Model Token Usage | T-117–T-120 | Schema migration (drop collection) |
| 5 | Copy Markdown Button | T-121–T-122 | None (trivial) |
