# Task Breakdown — BranchChat Feature Set 3

> Derived from the Architecture Delta Document - Feature Set 3 and the existing Task Breakdowns (T-001 through T-122, all complete).
> All file paths are relative to `branch-chat/`. The existing codebase is fully built and passing audits through Feature Set 2.

---

## CLAUDE.md Update Policy

Unlike previous feature sets, CLAUDE.md is NOT updated in a single upfront task. Instead, CLAUDE.md is updated **after each feature's audit checkpoint passes**. Each audit checkpoint below specifies the CLAUDE.md sections to update for that feature. This ensures CLAUDE.md always reflects verified, working code.

---

## Summary Table

| Feature | Tasks | Deliberations | Estimated Complexity |
|---------|-------|---------------|----------------------|
| F-25: Models Config Update | 1 | 0 | Low |
| F-26: Provider Interface Extension | 2 | 0 | Low |
| F-27: OpenAI Responses API Migration | 3 | 0 | High |
| F-28: Extended Thinking | 10 | 0 | High |
| F-29: Web Search & Citations | 12 | 0 | High |
| F-30: Responsive Layout | 4 | 0 | Medium |
| **TOTAL** | **32** | **0** | — |

All design decisions were resolved in the Architecture Delta Document - Feature Set 3. No deliberations needed — tasks are execution-ready.

---

## Feature Dependency Graph

```
F-25: Models Config Update (T-123)
 │
 └──► F-26: Provider Interface Extension (T-124 – T-125)
       │
       ├──► F-27: OpenAI Responses API Migration (T-126 – T-128)
       │     │
       │     └──► F-28: Extended Thinking (T-129 – T-138)
       │           │
       │           └──► F-29: Web Search & Citations (T-139 – T-150)
       │
       └──► F-30: Responsive Layout (T-151 – T-154)
```

F-25 and F-26 are foundational. F-27 (OpenAI migration) must complete before F-28 (thinking) since OpenAI thinking requires the Responses API. F-29 (web search) depends on F-28 since the chat route and UI changes build incrementally. F-30 (responsive layout) is pure frontend and can run after F-26, but is sequenced last for simplicity.

---

## Risk Flags

| Task(s) | Risk | Mitigation |
|---------|------|------------|
| T-126 (OpenAI Responses API migration) | **HIGH** — Full rewrite of OpenAI provider; request/response format changes entirely. Streaming event model is completely different. | Isolated as its own feature. Detailed field mappings from Architecture Delta Document section 13. Test rewrite follows immediately (T-128). |
| T-127 (attachment formatter update) | Medium — OpenAI attachment format changes (`input_image`/`input_file` replaces `image_url`/`file`). Anthropic and Gemini unchanged. | Only OpenAI case changes; other providers untouched. Format spec in delta doc section 12, gotcha #8. |
| T-130 (Anthropic thinking) | Medium — Temperature must be locked to 1, `max_tokens` must exceed `budget_tokens`. Two different API shapes for "high" vs "max" thinking levels. | Constraints documented in delta doc. Conditional logic per model's `maxThinkingLevel`. |
| T-131 (OpenAI thinking) | Medium — o-series models do not support `temperature` at all. `reasoning` parameter replaces temperature-based control. | `isReasoningModel()` helper; conditionally omit `temperature`. |
| T-139–T-144 (web search across providers) | Medium — Three different citation formats across providers. Token usage tracking field differs per provider. | Per-provider citation extraction spec in delta doc section 12, gotchas #15–#17. |

---

## F-25: Models Config Update

**Description:** Update `src/constants/models.ts` with new model entries and thinking support fields. This is a prerequisite for both extended thinking and web search features.

**Dependencies:** All prior features (F-01 through F-24) complete.

---

### T-123: Add Thinking Support Fields and New Models to models.ts

**Feature:** F-25
**Dependencies:** None (first task)
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/constants/models.ts`:

1. **Add fields to the model config type/interface:**
   - `supportsThinking: boolean` — whether this model supports extended thinking/reasoning.
   - `maxThinkingLevel: string | null` — the highest thinking level this model supports. `null` if thinking not supported. Values vary by provider: `"high"` or `"max"` for Anthropic, `"high"` for OpenAI o-series, `"high"` for Gemini 3.

2. **Update ALL existing model entries** with these new fields. For models that don't support thinking, set `supportsThinking: false` and `maxThinkingLevel: null`. For models that do:
   - `claude-sonnet-4-6` (Anthropic): `supportsThinking: true`, `maxThinkingLevel: "high"`
   - `claude-opus-4-6` (Anthropic): `supportsThinking: true`, `maxThinkingLevel: "max"`
   - Existing OpenAI models (e.g., `gpt-4o`): `supportsThinking: false`, `maxThinkingLevel: null`

3. **Add new model entries:**
   - `o3` (OpenAI): `supportsThinking: true`, `maxThinkingLevel: "high"`
   - `o4-mini` (OpenAI): `supportsThinking: true`, `maxThinkingLevel: "high"`
   - `gemini-3.1-pro-preview` (Gemini): `supportsThinking: true`, `maxThinkingLevel: "high"`

4. **Verify the exported `MODELS` constant** (or whatever the current export name is) includes the updated type and all entries compile.

**Acceptance Criteria:**
- All existing model entries have `supportsThinking` and `maxThinkingLevel` fields
- Three new models added: `o3`, `o4-mini`, `gemini-3.1-pro-preview`
- `o3` and `o4-mini` both have `maxThinkingLevel: "high"`
- TypeScript type for model config includes the new fields
- `npm run build` passes

**Commit Message:** `feat(config): add thinking support fields and new models to models.ts`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Add `supportsThinking` and `maxThinkingLevel` to the models documentation. Add `o3`, `o4-mini`, `gemini-3.1-pro-preview` to the models list. Add reference entries for `docs/Architecture Delta Document - Feature Set 3.md` and `docs/Task Breakdown Document - Feature Set 3.md`.

---

## F-26: Provider Interface Extension

**Description:** Extend the provider interface with `LLMRequestOptions`, `Citation`, updated `StreamChunk` types, and updated `LLMResponse`. Update all four provider implementations to accept the new optional `options` parameter. No behavior changes yet — just the interface plumbing.

**Dependencies:** F-25 (models config updated).

---

### T-124: Extend Provider Types with LLMRequestOptions, Citation, and Updated StreamChunk/LLMResponse

**Feature:** F-26
**Dependencies:** T-123
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/types.ts`:

1. **Add `LLMRequestOptions` interface:**
   ```typescript
   interface LLMRequestOptions {
     webSearchEnabled?: boolean;
     thinkingEnabled?: boolean;
     thinkingLevel?: string;
   }
   ```

2. **Add `Citation` interface:**
   ```typescript
   interface Citation {
     url: string;
     title: string;
   }
   ```

3. **Update `LLMProvider` interface** — add `options?: LLMRequestOptions` as the third parameter to both `sendMessage` and `streamMessage`:
   ```typescript
   sendMessage(messages: LLMMessage[], model: string, options?: LLMRequestOptions): Promise<LLMResponse>;
   streamMessage(messages: LLMMessage[], model: string, options?: LLMRequestOptions): AsyncGenerator<StreamChunk>;
   ```

4. **Add `thinking` variant to `StreamChunk`:**
   ```typescript
   | { type: 'thinking'; content: string }
   ```

5. **Extend the `done` variant of `StreamChunk`** to include:
   ```typescript
   | { type: 'done'; content: string; thinkingContent: string | null; inputTokens: number; outputTokens: number; webSearchRequestCount: number; citations: Citation[] }
   ```

6. **Extend `LLMResponse`** with new fields:
   ```typescript
   interface LLMResponse {
     content: string;
     thinkingContent: string | null;
     provider: string;
     model: string;
     inputTokens: number;
     outputTokens: number;
     webSearchRequestCount: number;
     citations: Citation[];
   }
   ```

7. **Export** all new interfaces.

Also update `src/types/database.ts`:
- Add `thinkingContent?: string | null` and `citations?: { url: string; title: string }[]` to the node-related type.

Also update `src/types/api.ts`:
- Add `webSearchEnabled?: boolean` and `thinkingEnabled?: boolean` to the `LLMChatRequest` type.
- Add `thinkingContent`, `citations`, `webSearchRequests` to the SSE done event type.

Also update `src/types/export.ts`:
- Add `thinkingContent?: string | null` and `citations?: { url: string; title: string }[]` to the exported node type.

**Acceptance Criteria:**
- `LLMRequestOptions` and `Citation` interfaces exported from `types.ts`
- `StreamChunk` has `thinking` variant and extended `done` variant
- `LLMResponse` includes `thinkingContent`, `webSearchRequestCount`, `citations`
- `LLMProvider` interface methods accept `options?` parameter
- Database, API, and export types updated with new fields
- `npm run build` passes (providers will have type errors until T-125)

**Note:** The build may fail after this task because existing provider implementations don't yet match the updated `LLMResponse` shape (missing `thinkingContent`, `webSearchRequestCount`, `citations` in return values). T-125 immediately follows to fix this.

**Commit Message:** `feat(providers): extend provider types with thinking and web search interfaces`

---

### T-125: Update All Provider Method Signatures and Return Values

**Feature:** F-26
**Dependencies:** T-124
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Update all four provider files to accept the new `options` parameter and return the extended `LLMResponse` shape. **No behavioral changes** — just signature and return value updates.

1. **`src/lib/providers/openai.ts`:**
   - Add `options?: LLMRequestOptions` as third parameter to `sendMessage` and `streamMessage`.
   - Import `LLMRequestOptions` from `types.ts`.
   - Update `sendMessage` return to include `thinkingContent: null`, `webSearchRequestCount: 0`, `citations: []`.
   - Update the `done` chunk in `streamMessage` to include `thinkingContent: null`, `webSearchRequestCount: 0`, `citations: []`.

2. **`src/lib/providers/anthropic.ts`:**
   - Same signature and return value updates as OpenAI.

3. **`src/lib/providers/gemini.ts`:**
   - Same signature and return value updates as OpenAI.

4. **`src/lib/providers/mock.ts`:**
   - Same signature and return value updates as OpenAI.

5. **Update any call sites that read `LLMResponse`** to handle the new fields (they should be backward-compatible since all new fields have default values, but verify the chat route handler and auto-title function don't destructure in a way that would break).

**Acceptance Criteria:**
- All four providers accept `options?: LLMRequestOptions` on `sendMessage` and `streamMessage`
- All `sendMessage` return values include `thinkingContent: null`, `webSearchRequestCount: 0`, `citations: []`
- All `streamMessage` `done` chunks include the same defaults
- No behavioral changes — all providers work exactly as before
- `npm run build` passes
- Existing tests pass (run `npm test`)

**Commit Message:** `refactor(providers): update all provider signatures for LLMRequestOptions`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Update `LLMProvider` interface to show `options?` parameter. Add `LLMRequestOptions` and `Citation` interfaces. Update `LLMResponse` and `StreamChunk` documentation. Update INode, ITokenUsage, and API contract type documentation.

---

## F-27: OpenAI Responses API Migration

**Description:** Migrate the OpenAI provider from the Chat Completions API to the Responses API (`client.responses.create()`). This is the highest-risk task in Feature Set 3. Both `sendMessage` and `streamMessage` are fully rewritten. The attachment formatter is updated for the new content block format. No thinking or web search functionality yet — just the base migration.

**Dependencies:** F-26 (provider interface extended).

---

### T-126: Rewrite OpenAI Provider for Responses API

**Feature:** F-27
**Dependencies:** T-125
**Estimated Complexity:** High
**Execution Mode:** PLAN-THEN-AUTO
**Deliberation Required:** No

**Detailed Description:**

**RISK: HIGH.** This task rewrites the entire `src/lib/providers/openai.ts` file. The Chat Completions API (`client.chat.completions.create()`) is replaced with the Responses API (`client.responses.create()`).

**Before implementing:** Verify the installed `openai` SDK version supports `client.responses.create()`. Run: `npm ls openai` and confirm version is `^6.33.0` or higher. If not, update `package.json` and run `npm install`.

**Key migration changes in `sendMessage`:**

1. Replace `client.chat.completions.create()` with `client.responses.create()`.
2. **System messages:** Extract system messages from the `messages` array and pass them as the `instructions` parameter (a single string). Concatenate multiple system messages with newlines.
3. **Messages field:** The `messages` parameter becomes `input`. Format: array of `{ role, content }` objects. The `role` values are the same (`user`, `assistant`) except `system` is replaced by the `instructions` field. If any system messages remain in the array, change their role to `"developer"`.
4. **Model parameter:** Unchanged.
5. **Temperature:** Pass `temperature` as before, but add an `isReasoningModel()` helper function that checks if the model ID starts with `o` followed by a digit (e.g., `o3`, `o4-mini`). When `isReasoningModel()` returns true, **omit temperature entirely** from the request.
6. **Response parsing:**
   - Text content: `response.output_text` (replaces `response.choices[0].message.content`).
   - Token usage: `response.usage.input_tokens` and `response.usage.output_tokens` (replaces `prompt_tokens`/`completion_tokens`).
7. **Return value:** Map to `LLMResponse` with `thinkingContent: null`, `webSearchRequestCount: 0`, `citations: []`.

**Key migration changes in `streamMessage`:**

1. Replace `client.chat.completions.create({ stream: true })` with `client.responses.create({ stream: true })`.
2. Same `instructions`/`input` field mapping as `sendMessage`.
3. Same `isReasoningModel()` temperature omission.
4. **Streaming events:** The Responses API streams differently. Use the async iterable pattern:
   ```typescript
   const stream = await client.responses.create({ ...params, stream: true });
   for await (const event of stream) {
     if (event.type === 'response.output_text.delta') {
       yield { type: 'token', content: event.delta };
     } else if (event.type === 'response.completed') {
       const usage = event.response.usage;
       yield {
         type: 'done',
         content: fullContent,
         thinkingContent: null,
         inputTokens: usage?.input_tokens ?? 0,
         outputTokens: usage?.output_tokens ?? 0,
         webSearchRequestCount: 0,
         citations: [],
       };
     }
   }
   ```
5. Accumulate `fullContent` from text deltas for the `done` chunk.
6. **Error handling:** Preserve existing error handling patterns (catch and yield error chunks, or throw).

**Helper function:**
```typescript
function isReasoningModel(modelId: string): boolean {
  return /^o\d/.test(modelId);
}
```
Export this helper for reuse in thinking (T-131) and web search (T-141) tasks.

**Do NOT implement thinking (reasoning) or web search in this task.** Those are added in F-28 and F-29.

**Acceptance Criteria:**
- `sendMessage` uses `client.responses.create()` with `instructions` and `input` fields
- `streamMessage` uses `client.responses.create({ stream: true })` with correct event handling
- `isReasoningModel()` helper correctly identifies o-series models
- Temperature is omitted for o-series models
- Token usage reads from `input_tokens`/`output_tokens`
- Non-streaming response reads from `response.output_text`
- `npm run build` passes
- Manual test: sending a message to OpenAI returns a valid response (if API key is configured)

**Commit Message:** `feat(openai): migrate provider to Responses API`

---

### T-127: Update Attachment Formatter for OpenAI Responses API

**Feature:** F-27
**Dependencies:** T-126
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/attachmentFormatter.ts`:

Update the OpenAI attachment formatting case ONLY. Anthropic and Gemini formats are unchanged.

**Image attachments (OpenAI):**
- Old format (Chat Completions): `{ type: "image_url", image_url: { url: "data:${mimeType};base64,${data}" } }`
- New format (Responses API): `{ type: "input_image", image_url: "data:${mimeType};base64,${data}" }`
- Note: The `image_url` field is now a flat string, not a nested object.

**File/PDF attachments (OpenAI):**
- Old format (Chat Completions): `{ type: "file", file: { filename, file_data: "data:${mimeType};base64,${data}" } }`
- New format (Responses API): `{ type: "input_file", file_data: "data:${mimeType};base64,${data}", filename }`
- Note: Flat structure, no nested `file` object.

**Acceptance Criteria:**
- OpenAI image attachments use `type: "input_image"` with flat `image_url` string
- OpenAI file attachments use `type: "input_file"` with flat `file_data` and `filename`
- Anthropic attachment formatting unchanged
- Gemini attachment formatting unchanged
- `npm run build` passes

**Commit Message:** `fix(attachments): update OpenAI format for Responses API`

---

### T-128: Update OpenAI Provider and Attachment Formatter Tests

**Feature:** F-27
**Dependencies:** T-127
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Update existing test files to match the Responses API changes.

1. **`__tests__/lib/providers/openai.test.ts`** (if it exists; otherwise check for provider tests in `__tests__/`):
   - Update mocks to mock `client.responses.create()` instead of `client.chat.completions.create()`.
   - Update response shape assertions: `output_text` instead of `choices[0].message.content`.
   - Update token usage assertions: `input_tokens`/`output_tokens` instead of `prompt_tokens`/`completion_tokens`.
   - Update streaming tests: mock the async iterable with `response.output_text.delta` events instead of `chunk.choices[0].delta.content`.
   - Add test: `isReasoningModel` returns true for `o3`, `o4-mini`, false for `gpt-4o`.
   - Add test: temperature is omitted when model is o-series.

2. **`__tests__/lib/providers/attachmentFormatter.test.ts`:**
   - Update OpenAI image attachment test: expect `type: "input_image"` with flat `image_url` string.
   - Update OpenAI file attachment test: expect `type: "input_file"` with flat structure.
   - Anthropic and Gemini tests unchanged.

3. **`__tests__/api/llm-chat.test.ts`:**
   - If this test file mocks the OpenAI provider directly, update the mock to match new return shape (with `thinkingContent`, `webSearchRequestCount`, `citations` defaults).
   - Verify the mock provider calls use the updated signature.

**Acceptance Criteria:**
- All updated tests pass (`npm test`)
- OpenAI provider tests validate Responses API behavior
- Attachment formatter tests validate new OpenAI format
- `npm run build` passes

**Commit Message:** `test(openai): update tests for Responses API migration`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Rewrite the OpenAI provider description to document Responses API usage (`client.responses.create()`), `instructions` field, `input` field, `input_tokens`/`output_tokens`, `isReasoningModel()` helper, and updated attachment format. Update the `POST /api/llm/chat` steps if any orchestration changed.

---

## F-28: Extended Thinking

**Description:** Add extended thinking support across all providers. Includes Node schema update, provider implementations (Anthropic, OpenAI, Gemini, Mock), UI components (ThinkingToggle, ThinkingBlock), streaming hook updates, chat API route changes, UIContext state, and export/import updates.

**Dependencies:** F-27 (OpenAI Responses API migration complete).

---

### T-129: Add thinkingContent to Node Schema

**Feature:** F-28
**Dependencies:** T-128
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/models/Node.ts`:

1. **Add to `INode` interface:**
   ```typescript
   thinkingContent?: string | null;
   ```

2. **Add to `NodeSchema`:**
   ```typescript
   thinkingContent: { type: String, default: null },
   ```

No migration needed. Existing nodes will have `undefined` for `thinkingContent`, which is functionally equivalent to `null`.

**Acceptance Criteria:**
- `thinkingContent` field exists on the Node schema with default `null`
- `INode` interface includes the field
- `npm run build` passes
- Existing tests pass

**Commit Message:** `feat(schema): add thinkingContent field to Node model`

---

### T-130: Implement Extended Thinking in Anthropic Provider

**Feature:** F-28
**Dependencies:** T-129
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/anthropic.ts`:

**Before implementing:** Verify `@anthropic-ai/sdk` version is `^0.80.0`. Run: `npm ls @anthropic-ai/sdk`.

**`sendMessage` changes when `options?.thinkingEnabled` is true:**

1. Look up the model's `maxThinkingLevel` from `MODELS` config (import from `src/constants/models.ts`).
2. **If `maxThinkingLevel` is `"high"`:** Add to the request params:
   ```typescript
   thinking: { type: "enabled", budget_tokens: 10000 }
   ```
3. **If `maxThinkingLevel` is `"max"` (Opus):** Add to the request params:
   ```typescript
   thinking: { type: "adaptive" },
   output_config: { effort: "max" }
   ```
4. **Temperature constraint:** When thinking is enabled, set `temperature: 1` (override any existing temperature value).
5. **max_tokens constraint:** When thinking is enabled with `budget_tokens`, set `max_tokens: 16384` (must be greater than `budget_tokens: 10000`).
6. **Omit `top_k`** when thinking is enabled (incompatible).
7. **Parse response:** The response `content` array will include `{ type: "thinking", thinking: "..." }` blocks before `{ type: "text", text: "..." }` blocks. Extract thinking content from thinking blocks and text content from text blocks.
8. **Return:** Set `thinkingContent` in the `LLMResponse` to the concatenated thinking block content. If thinking is disabled, `thinkingContent` remains `null`.

**`streamMessage` changes when `options?.thinkingEnabled` is true:**

1. Same request param changes as `sendMessage`.
2. **Streaming events:** The Anthropic SDK streaming emits:
   - `content_block_start` with `content_block.type === "thinking"` — signals start of thinking block
   - `content_block_delta` with `delta.type === "thinking_delta"` and `delta.thinking` — thinking content deltas
   - `content_block_start` with `content_block.type === "text"` — signals start of text block
   - `content_block_delta` with `delta.type === "text_delta"` and `delta.text` — text content deltas
3. **Yield `thinking` chunks** from `thinking_delta` events:
   ```typescript
   yield { type: 'thinking', content: delta.thinking };
   ```
4. **Track accumulated thinking content** for the `done` chunk.
5. **`done` chunk:** Include the full `thinkingContent` string.

**When `options?.thinkingEnabled` is false or undefined:** No changes to existing behavior. `thinkingContent` is `null`.

**Acceptance Criteria:**
- Anthropic `sendMessage` adds thinking config when enabled, with correct temperature and max_tokens overrides
- Anthropic `streamMessage` yields `thinking` chunks from thinking_delta events
- "high" and "max" thinking levels produce different API configs
- Temperature locked to 1 when thinking is enabled
- `max_tokens` bumped to 16384 when thinking is enabled
- `thinkingContent` populated in response/done chunk when thinking is enabled
- `npm run build` passes

**Commit Message:** `feat(anthropic): implement extended thinking support`

---

### T-131: Implement Extended Thinking in OpenAI Provider

**Feature:** F-28
**Dependencies:** T-130
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/openai.ts`:

**`sendMessage` changes when `options?.thinkingEnabled` is true AND `isReasoningModel(model)` is true:**

1. Add to the request params:
   ```typescript
   reasoning: { effort: options.thinkingLevel ?? "high", summary: "auto" }
   ```
   The `effort` value comes from `options.thinkingLevel` (which is the model's `maxThinkingLevel` from the MODELS config). Both `o3` and `o4-mini` have `maxThinkingLevel: "high"`, so this will typically be `"high"`.
2. Temperature is already omitted for reasoning models (from T-126).
3. **Parse response:** The response `output` array may contain items with `type: "reasoning"`. Extract the reasoning summary text. The main text is in `response.output_text`.
4. **Return:** Set `thinkingContent` to the reasoning summary content.

**Note:** If `thinkingEnabled` is true but the model is NOT a reasoning model (e.g., `gpt-4o`), ignore the thinking option. Non-o-series models don't support reasoning.

**`streamMessage` changes when thinking is enabled and model is o-series:**

1. Same `reasoning` param as `sendMessage`.
2. **Streaming events:** Listen for `response.reasoning_summary_text.delta` events:
   ```typescript
   if (event.type === 'response.reasoning_summary_text.delta') {
     yield { type: 'thinking', content: event.delta };
   }
   ```
3. Accumulate reasoning content for the `done` chunk's `thinkingContent`.

**Acceptance Criteria:**
- OpenAI `sendMessage` adds `reasoning` param for o-series models when thinking enabled
- OpenAI `streamMessage` yields `thinking` chunks from reasoning summary deltas
- Non-reasoning models ignore `thinkingEnabled`
- `thinkingContent` populated in done chunk for o-series models
- `npm run build` passes

**Commit Message:** `feat(openai): implement reasoning/thinking support for o-series models`

---

### T-132: Implement Extended Thinking in Gemini Provider

**Feature:** F-28
**Dependencies:** T-130
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/gemini.ts`:

**Before implementing:** Verify `@google/genai` version is `^1.47.0`. Run: `npm ls @google/genai`.

**`sendMessage` changes when `options?.thinkingEnabled` is true:**

1. Add to the `config` parameter:
   ```typescript
   thinkingConfig: {
     thinkingLevel: options.thinkingLevel ?? "high",
     includeThoughts: true,
   }
   ```
   Valid `thinkingLevel` values for Gemini 3 models: `"minimal"`, `"low"`, `"medium"`, `"high"`. Do NOT use numeric `thinkingBudget` (that is Gemini 2.5 only).
2. **Ensure `systemInstruction` is not displaced** when adding `thinkingConfig` to the config object. Both should coexist.
3. **Parse response:** Response parts with `thought: true` flag appear before regular parts. Use `chunk.text` getter which automatically excludes thought parts. Separately extract thought parts by filtering for `part.thought === true`.
4. **Return:** Set `thinkingContent` to concatenated thought part text.

**`streamMessage` changes when thinking is enabled:**

1. Same `thinkingConfig` addition to config.
2. **Streaming:** Thought parts arrive first with `thought: true` on the part object. When processing streaming chunks, check each part for the `thought` flag:
   ```typescript
   // If part has thought: true, yield as thinking chunk
   yield { type: 'thinking', content: partText };
   ```
3. Accumulate thinking content for the `done` chunk.

**Acceptance Criteria:**
- Gemini adds `thinkingConfig` with correct `thinkingLevel` when thinking enabled
- `systemInstruction` preserved alongside `thinkingConfig`
- Thought-flagged parts extracted as thinking content
- `streamMessage` yields `thinking` chunks for thought parts
- `npm run build` passes

**Commit Message:** `feat(gemini): implement extended thinking support`

---

### T-133: Implement Extended Thinking in Mock Provider

**Feature:** F-28
**Dependencies:** T-130
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/mock.ts`:

**When `options?.thinkingEnabled` is true:**

1. **`sendMessage`:** Return `thinkingContent: "Mock thinking: analyzing the request...\nConsidering multiple approaches...\nFormulating response..."` in the `LLMResponse`.

2. **`streamMessage`:** Before yielding text tokens, yield 3 thinking chunks:
   ```typescript
   yield { type: 'thinking', content: 'Mock thinking: analyzing the request...' };
   yield { type: 'thinking', content: '\nConsidering multiple approaches...' };
   yield { type: 'thinking', content: '\nFormulating response...' };
   ```
   Then proceed with normal text token streaming. Include the full thinking text in the `done` chunk's `thinkingContent`.

**When thinking is disabled:** Behavior unchanged, `thinkingContent: null`.

**Acceptance Criteria:**
- Mock provider yields canned thinking chunks when thinking is enabled
- `sendMessage` returns thinking content string
- `streamMessage` yields 3 thinking chunks before text chunks
- `done` chunk includes `thinkingContent`
- `npm run build` passes

**Commit Message:** `feat(mock): add thinking support to mock provider`

---

### T-134: Add Thinking State to UIContext and UIProvider

**Feature:** F-28
**Dependencies:** T-133
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/contexts/UIContext.ts`:**
   - Add `thinkingEnabled: boolean` to the state interface (default: `false`).
   - Add new action types:
     ```typescript
     | { type: 'TOGGLE_THINKING' }
     | { type: 'SET_THINKING_ENABLED'; payload: boolean }
     ```

2. **Modify `src/components/providers/UIProvider.tsx`:**
   - Add `thinkingEnabled: false` to initial state.
   - Add reducer cases:
     - `TOGGLE_THINKING`: toggle `thinkingEnabled`.
     - `SET_THINKING_ENABLED`: set `thinkingEnabled` to `payload`.
   - **Model-aware auto-disable:** Add a `useEffect` that watches `selectedModel`. When the selected model changes, look up its `supportsThinking` flag from the `MODELS` config. If `supportsThinking` is `false`, dispatch `SET_THINKING_ENABLED` with `false`.
   - **IMPORTANT:** Follow the existing `useRef` pattern for any callbacks to avoid stale closures (see UIProvider `refreshProviders` pattern in the Execution Log).

**Acceptance Criteria:**
- `thinkingEnabled` available in UIContext
- `TOGGLE_THINKING` and `SET_THINKING_ENABLED` actions work
- When user switches to a model that doesn't support thinking, `thinkingEnabled` is auto-set to `false`
- No stale closure issues
- `npm run build` passes

**Commit Message:** `feat(ui): add thinkingEnabled state to UIContext`

---

### T-135: Create ThinkingToggle and ThinkingBlock Components

**Feature:** F-28
**Dependencies:** T-134
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Create `src/components/chat/ThinkingToggle.tsx`:**
   - Props: `{ enabled: boolean; onToggle: () => void; disabled: boolean; modelName?: string }`
   - Renders a toggle button with a `Brain` icon from `lucide-react`.
   - When `disabled` is true: `opacity-50 pointer-events-none`.
   - Tooltip on hover when disabled: "Not available for {modelName}".
   - Active state styling: when `enabled` is true, use a highlighted/filled style (e.g., `bg-primary/10 text-primary` or similar to match existing UI patterns).
   - On mobile (below `md` breakpoint): icon only. On desktop: icon + "Thinking" label.

2. **Create `src/components/chat/ThinkingBlock.tsx`:**
   - Props: `{ content: string; isStreaming?: boolean }`
   - Renders a collapsible section above the assistant's response text.
   - Default state: collapsed.
   - Header: clickable row with "Thinking..." text and a `ChevronDown`/`ChevronUp` icon (from `lucide-react`). When `isStreaming` is true, add a pulsing animation to the header text.
   - Content: muted text (`text-muted-foreground`), slightly smaller font size (`text-sm`), indented with a left border accent (`border-l-2 border-muted pl-3`).
   - Content renders as plain text, NOT markdown.
   - Transition: use a height transition or CSS animation for smooth expand/collapse.

**Acceptance Criteria:**
- ThinkingToggle renders Brain icon, toggles on click, shows disabled state
- ThinkingToggle shows icon-only on mobile, icon+label on desktop
- ThinkingBlock is collapsible, default collapsed
- ThinkingBlock shows pulsing indicator when streaming
- ThinkingBlock renders plain text with muted styling
- `npm run build` passes

**Commit Message:** `feat(chat): create ThinkingToggle and ThinkingBlock components`

---

### T-136: Update useStreamingChat Hook for Thinking SSE Events

**Feature:** F-28
**Dependencies:** T-135
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/hooks/useStreamingChat.ts`:

1. **Add `streamingThinkingContent` state** (local state, same pattern as `streamingContent`):
   ```typescript
   const [streamingThinkingContent, setStreamingThinkingContent] = useState<string>('');
   ```

2. **Reset on stream start:** When a new stream begins, reset `streamingThinkingContent` to `''`.

3. **Handle `event: thinking` SSE events:** In the SSE event parsing loop, when the event type is `thinking`:
   ```typescript
   case 'thinking':
     setStreamingThinkingContent(prev => prev + data.content);
     break;
   ```

4. **Handle `done` event:** The `done` event now includes `thinkingContent`. Extract and make available.

5. **Include `thinkingEnabled` and `webSearchEnabled` in the fetch body:** When initiating the streaming request (`POST /api/llm/chat`), include these fields from the UI state:
   ```typescript
   body: JSON.stringify({
     ...existingFields,
     thinkingEnabled,
     webSearchEnabled,
   }),
   ```
   These values should be passed as parameters to the hook or read from UIContext.

6. **Expose `streamingThinkingContent`** in the hook's return value.

**Acceptance Criteria:**
- `streamingThinkingContent` accumulates from `thinking` SSE events
- Resets on new stream start
- `thinkingEnabled` sent in fetch body
- `streamingThinkingContent` exposed in hook return
- `npm run build` passes

**Commit Message:** `feat(hooks): handle thinking SSE events in useStreamingChat`

---

### T-137: Update ChatInput, ChatMessage, and ChatPanel for Thinking UI

**Feature:** F-28
**Dependencies:** T-136
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/components/chat/ChatInput.tsx`:**
   - Add props: `thinkingEnabled: boolean`, `onThinkingToggle: () => void`, `thinkingDisabled: boolean`, `selectedModel?: string`.
   - Render `<ThinkingToggle>` in a toggles row above or beside the textarea (follow existing layout patterns).
   - Pass through the props to ThinkingToggle.

2. **Modify `src/components/chat/ChatMessage.tsx`:**
   - Import `ThinkingBlock`.
   - If `node.thinkingContent` exists and is non-empty (for completed messages), render `<ThinkingBlock content={node.thinkingContent} />` above the message content (above the markdown rendering).
   - For the **streaming message** (the currently-streaming assistant response): accept a `streamingThinkingContent` prop. If it's non-empty, render `<ThinkingBlock content={streamingThinkingContent} isStreaming={true} />`.

3. **Modify `src/components/chat/ChatPanel.tsx`:**
   - Get `thinkingEnabled` from UIContext.
   - Get `streamingThinkingContent` from the `useStreamingChat` hook.
   - Pass `thinkingEnabled` and `onThinkingToggle` (dispatch `TOGGLE_THINKING`) to `ChatInput`.
   - Pass `thinkingDisabled` (derived from selected model's `supportsThinking`) to `ChatInput`.
   - Pass `streamingThinkingContent` to the streaming `ChatMessage`.
   - Pass `thinkingEnabled` to `useStreamingChat` (if not already reading from context).

**Acceptance Criteria:**
- ChatInput renders ThinkingToggle with correct enabled/disabled state
- ChatMessage renders ThinkingBlock above content for completed messages with thinkingContent
- ChatMessage renders streaming ThinkingBlock during active streaming
- ChatPanel wires up thinking state between context, hook, input, and messages
- `npm run build` passes

**Commit Message:** `feat(chat): integrate thinking toggle and block into chat UI`

---

### T-138: Update Chat API Route for Thinking Support and Export/Import for thinkingContent

**Feature:** F-28
**Dependencies:** T-137
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/app/api/llm/chat/route.ts`:**
   - Extract `thinkingEnabled` from the request body.
   - Look up the selected model in the `MODELS` config to get `maxThinkingLevel`.
   - Build `LLMRequestOptions`:
     ```typescript
     const options: LLMRequestOptions = {
       thinkingEnabled: thinkingEnabled && modelConfig?.supportsThinking,
       thinkingLevel: modelConfig?.maxThinkingLevel ?? undefined,
     };
     ```
   - Pass `options` to `provider.streamMessage()`.
   - **Handle `thinking` StreamChunk:** When the generator yields `{ type: 'thinking' }`, write an SSE event:
     ```
     event: thinking\ndata: {"content":"..."}\n\n
     ```
   - **On `done` chunk:** Save `thinkingContent` on the assistant node:
     ```typescript
     assistantNode.thinkingContent = doneChunk.thinkingContent;
     await assistantNode.save();
     ```
   - Include `thinkingContent` in the `done` SSE event data sent to the client.

2. **Modify `src/app/api/conversations/[id]/export/route.ts`:**
   - When serializing nodes for export, include `thinkingContent` field (will be `null` or `undefined` for nodes without thinking, which is fine).

3. **Modify `src/app/api/import/route.ts`:**
   - When creating nodes from imported JSON, restore `thinkingContent` from the imported data (if present).

**Acceptance Criteria:**
- Chat route extracts `thinkingEnabled` from request and passes options to provider
- `thinking` SSE events emitted for thinking chunks
- `thinkingContent` saved on assistant node
- `thinkingContent` included in `done` SSE event
- Export includes `thinkingContent`
- Import restores `thinkingContent`
- `npm run build` passes

**Commit Message:** `feat(api): add thinking support to chat route and export/import`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Add `thinkingContent` to INode. Document thinking support per provider (Anthropic thinking param, temperature lock, max_tokens bump; OpenAI reasoning for o-series; Gemini thinkingConfig). Add `thinkingEnabled` to UIContext. Add ThinkingToggle, ThinkingBlock to components table. Update ChatMessage, ChatInput, ChatPanel entries. Update SSE event documentation with `event: thinking`. Update export/import to note thinkingContent.

---

## F-29: Web Search & Citations

**Description:** Add web search as a provider-managed server-side tool across all providers. Includes citations storage and display, TokenUsage tracking for search requests, UI toggles, and API updates.

**Dependencies:** F-28 (Extended Thinking complete — the chat route, streaming hook, and UI changes from thinking are built upon).

---

### T-139: Add citations to Node Schema and webSearchRequests to TokenUsage

**Feature:** F-29
**Dependencies:** T-138
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/models/Node.ts`:**
   - Add `citations` to `INode` interface:
     ```typescript
     citations?: { url: string; title: string }[];
     ```
   - Add to `NodeSchema`:
     ```typescript
     citations: [{
       url: { type: String, required: true },
       title: { type: String, required: true },
       _id: false,
     }],
     ```

2. **Modify `src/models/TokenUsage.ts`:**
   - Add `webSearchRequests` to `ITokenUsage` interface:
     ```typescript
     webSearchRequests: number;
     ```
   - Add to `TokenUsageSchema`:
     ```typescript
     webSearchRequests: { type: Number, default: 0 },
     ```

No migrations needed. Both fields are backward-compatible.

**Acceptance Criteria:**
- Node schema has `citations` subdocument array with `_id: false`
- TokenUsage schema has `webSearchRequests` with default 0
- Interfaces updated
- `npm run build` passes
- Existing tests pass

**Commit Message:** `feat(schema): add citations to Node and webSearchRequests to TokenUsage`

---

### T-140: Implement Web Search in Anthropic Provider

**Feature:** F-29
**Dependencies:** T-139
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/anthropic.ts`:

**`sendMessage` changes when `options?.webSearchEnabled` is true:**

1. Add to the request params:
   ```typescript
   tools: [{ type: "web_search_20250305", name: "web_search" }]
   ```
   If `tools` already exists (from other features), append to the array.
2. **Parse response:** The response `content` array may include:
   - `{ type: "server_tool_use" }` — the search tool invocation (ignore, don't store)
   - `{ type: "web_search_tool_result" }` — the search results (ignore, don't store)
   - `{ type: "text", text: "...", citations?: [...] }` — the final text with citations
3. **Extract text** from `TextBlock` entries only (`type === "text"`).
4. **Extract citations** from `TextBlock.citations` arrays. Each citation has `{ type: "web_search_result_location", url, title, cited_text }`. Map to `Citation[]` with only `url` and `title`. Deduplicate by URL.
5. **Track web search requests:** Read `response.usage.server_tool_use?.web_search_requests` (number of search requests made). Return as `webSearchRequestCount`.

**`streamMessage` changes when web search is enabled:**

1. Same `tools` param addition.
2. During streaming, `server_tool_use` and `web_search_tool_result` blocks will stream through. Ignore these (don't yield them as tokens).
3. Only yield `token` chunks from `text_delta` events on `text` blocks.
4. On stream completion (`finalMessage()`), extract citations and `webSearchRequestCount` as in `sendMessage`.
5. Include in `done` chunk.

**Context isolation note:** The web search tool-use/result blocks are NOT stored in `Node.content`. Only the final text is stored. This is already handled since `Node.content` is set from the `done` chunk's `content` field, which only contains the text.

**Acceptance Criteria:**
- Anthropic adds `web_search_20250305` tool when web search enabled
- Text extracted only from `TextBlock` entries
- Citations extracted from `TextBlock.citations`, mapped to `{ url, title }`
- `webSearchRequestCount` read from `usage.server_tool_use.web_search_requests`
- `server_tool_use` and `web_search_tool_result` blocks not yielded as tokens
- `npm run build` passes

**Commit Message:** `feat(anthropic): implement web search tool integration`

---

### T-141: Implement Web Search in OpenAI Provider

**Feature:** F-29
**Dependencies:** T-140
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/openai.ts`:

**`sendMessage` changes when `options?.webSearchEnabled` is true:**

1. Add to the request params:
   ```typescript
   tools: [{ type: "web_search_preview" }]
   ```
2. **Parse response:** The response `output` array may contain items of various types. Text output items may have an `annotations` array with citation objects: `{ type: "url_citation", url, title, start_index, end_index }`.
3. **Extract citations** from annotations on text output items. Map to `Citation[]` with `url` and `title`. Deduplicate by URL.
4. **Track web search requests:** Count items with `type === "web_search_call"` in the response `output` array. Return as `webSearchRequestCount`.
5. Text content: use `response.output_text` as before.

**`streamMessage` changes when web search is enabled:**

1. Same `tools` param.
2. Text deltas arrive via `response.output_text.delta` events as normal.
3. On `response.completed` event, extract citations from `event.response.output` annotations and count `web_search_call` items.
4. Include in `done` chunk.

**Note:** `reasoning` and `tools` (web search) can coexist for o-series models.

**Acceptance Criteria:**
- OpenAI adds `web_search_preview` tool when web search enabled
- Citations extracted from `annotations` on text output
- `webSearchRequestCount` counts `web_search_call` items
- Reasoning and web search coexist for o-series models
- `npm run build` passes

**Commit Message:** `feat(openai): implement web search tool integration`

---

### T-142: Implement Web Search in Gemini Provider

**Feature:** F-29
**Dependencies:** T-140
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/lib/providers/gemini.ts`:

**`sendMessage` changes when `options?.webSearchEnabled` is true:**

1. Add to the `config` parameter:
   ```typescript
   tools: [{ googleSearch: {} }]
   ```
   Ensure this coexists with `thinkingConfig` and `systemInstruction` if present.
2. **Parse response:** Citations are in `response.candidates[0].groundingMetadata.groundingChunks`. Each `groundingChunk` has `{ web: { uri, title } }`.
3. **Extract citations:** Map `groundingChunks` to `Citation[]`: `{ url: chunk.web.uri, title: chunk.web.title }`. Deduplicate by URL.
4. **Track web search requests:** If `groundingMetadata` is present and non-empty, count as 1 web search request.
5. Text content: use `response.text` as normal.

**`streamMessage` changes when web search is enabled:**

1. Same `tools` addition to config.
2. Text streaming works as normal.
3. `groundingMetadata` is available on the **final** chunk. On the last chunk, extract citations and web search count.
4. Include in `done` chunk.

**Acceptance Criteria:**
- Gemini adds `googleSearch` tool when web search enabled
- `tools`, `thinkingConfig`, and `systemInstruction` coexist in config
- Citations extracted from `groundingMetadata.groundingChunks`
- `webSearchRequestCount` is 1 when grounding metadata present
- `npm run build` passes

**Commit Message:** `feat(gemini): implement Google Search grounding integration`

---

### T-143: Implement Web Search in Mock Provider and Update Auto-Title

**Feature:** F-29
**Dependencies:** T-142
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/lib/providers/mock.ts`:**
   - When `options?.webSearchEnabled` is true:
     - `sendMessage`: Return `citations: [{ url: "https://example.com/result1", title: "Mock Search Result 1" }, { url: "https://example.com/result2", title: "Mock Search Result 2" }]` and `webSearchRequestCount: 1`.
     - `streamMessage`: Normal text streaming. On `done` chunk, include the mock citations and `webSearchRequestCount: 1`.
   - When web search is disabled: `citations: []`, `webSearchRequestCount: 0` (existing defaults).

2. **Update auto-title call** in `src/app/api/llm/chat/route.ts`:
   - Find the auto-title `provider.sendMessage()` call (the fire-and-forget title generation).
   - Pass `{ webSearchEnabled: false, thinkingEnabled: false }` as the `options` parameter:
     ```typescript
     provider.sendMessage(titleMessages, model, { webSearchEnabled: false, thinkingEnabled: false })
     ```
   - This prevents unnecessary tool use and cost during title generation.

**Acceptance Criteria:**
- Mock provider returns mock citations when web search enabled
- Auto-title explicitly disables web search and thinking
- `npm run build` passes

**Commit Message:** `feat(mock): add web search to mock provider; disable features for auto-title`

---

### T-144: Add webSearchEnabled State to UIContext and Create WebSearchToggle and CitationList Components

**Feature:** F-29
**Dependencies:** T-143
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/contexts/UIContext.ts`:**
   - Add `webSearchEnabled: boolean` to the state interface (default: `true`).
   - Add action type: `| { type: 'TOGGLE_WEB_SEARCH' }`.

2. **Modify `src/components/providers/UIProvider.tsx`:**
   - Add `webSearchEnabled: true` to initial state.
   - Add reducer case for `TOGGLE_WEB_SEARCH`: toggle `webSearchEnabled`.

3. **Create `src/components/chat/WebSearchToggle.tsx`:**
   - Props: `{ enabled: boolean; onToggle: () => void }`
   - Renders a toggle button with a `Globe` icon from `lucide-react`.
   - Active state styling: when enabled, highlighted style (same pattern as ThinkingToggle).
   - On mobile (below `md`): icon only. On desktop: icon + "Search" label.

4. **Create `src/components/chat/CitationList.tsx`:**
   - Props: `{ citations: { url: string; title: string }[] }`
   - Renders numbered footnote-style links below the message text.
   - Each citation: `[N] title` as a clickable `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"`.
   - Styling: smaller font (`text-xs`), muted color (`text-muted-foreground`), separated from message content by a thin divider (`border-t border-border mt-3 pt-2`).
   - If `citations` array is empty, render nothing.

**Acceptance Criteria:**
- `webSearchEnabled` available in UIContext, defaults to `true`
- `TOGGLE_WEB_SEARCH` action works
- WebSearchToggle renders Globe icon with toggle behavior
- WebSearchToggle shows icon-only on mobile, icon+label on desktop
- CitationList renders numbered links, opens in new tab
- CitationList renders nothing for empty array
- `npm run build` passes

**Commit Message:** `feat(chat): add web search state, toggle, and citation list components`

---

### T-145: Update ChatInput and ChatMessage for Web Search UI

**Feature:** F-29
**Dependencies:** T-144
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/components/chat/ChatInput.tsx`:**
   - Add props: `webSearchEnabled: boolean`, `onWebSearchToggle: () => void`.
   - Render `<WebSearchToggle>` alongside `<ThinkingToggle>` in the toggles row.

2. **Modify `src/components/chat/ChatMessage.tsx`:**
   - Import `CitationList`.
   - If `node.citations` exists, is an array, and has length > 0, render `<CitationList citations={node.citations} />` below the message content (below the markdown rendering, above any action buttons).

3. **Modify `src/components/chat/ChatPanel.tsx`:**
   - Get `webSearchEnabled` from UIContext.
   - Pass `webSearchEnabled` and `onWebSearchToggle` (dispatch `TOGGLE_WEB_SEARCH`) to `ChatInput`.
   - Pass `webSearchEnabled` to `useStreamingChat` (if not already reading from context).

**Acceptance Criteria:**
- ChatInput renders both WebSearchToggle and ThinkingToggle
- ChatMessage renders CitationList below content for messages with citations
- ChatPanel wires up web search state
- `npm run build` passes

**Commit Message:** `feat(chat): integrate web search toggle and citations into chat UI`

---

### T-146: Update useStreamingChat to Send Toggle States and Chat API Route for Web Search

**Feature:** F-29
**Dependencies:** T-145
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/hooks/useStreamingChat.ts`:**
   - Ensure `webSearchEnabled` is included in the fetch body (may already be partially done in T-136). Verify both `thinkingEnabled` and `webSearchEnabled` are sent:
     ```typescript
     body: JSON.stringify({
       ...existingFields,
       thinkingEnabled,
       webSearchEnabled,
     }),
     ```

2. **Modify `src/app/api/llm/chat/route.ts`:**
   - Extract `webSearchEnabled` from the request body (alongside `thinkingEnabled` from T-138).
   - Add `webSearchEnabled` to the `LLMRequestOptions`:
     ```typescript
     const options: LLMRequestOptions = {
       thinkingEnabled: thinkingEnabled && modelConfig?.supportsThinking,
       thinkingLevel: modelConfig?.maxThinkingLevel ?? undefined,
       webSearchEnabled,
     };
     ```
   - **On `done` chunk:** Save `citations` on the assistant node:
     ```typescript
     if (doneChunk.citations?.length) {
       assistantNode.citations = doneChunk.citations;
     }
     ```
   - **TokenUsage upsert:** Add `webSearchRequests` to the `$inc` operation:
     ```typescript
     $inc: {
       inputTokens: doneChunk.inputTokens,
       outputTokens: doneChunk.outputTokens,
       callCount: 1,
       webSearchRequests: doneChunk.webSearchRequestCount,
     }
     ```
   - Include `citations` and `webSearchRequests` in the `done` SSE event data.

**Acceptance Criteria:**
- `webSearchEnabled` sent in fetch body from streaming hook
- Chat route passes `webSearchEnabled` in options to provider
- Citations saved on assistant node
- `webSearchRequests` incremented in TokenUsage
- `citations` and `webSearchRequests` included in `done` SSE event
- `npm run build` passes

**Commit Message:** `feat(api): add web search support to chat route with citation storage`

---

### T-147: Update Token Usage API and TokenUsageCard for Web Search Requests

**Feature:** F-29
**Dependencies:** T-146
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/app/api/token-usage/route.ts`:**
   - Include `webSearchRequests` in the response for each usage entry. The field is already on the schema (from T-139), so just ensure it's included in the query projection/response mapping.

2. **Modify `src/components/dashboard/TokenUsageCard.tsx`:**
   - Display `webSearchRequests` count per model alongside existing token counts.
   - Format: add a row or column showing "Web searches: N" after the token breakdown.
   - If `webSearchRequests` is 0, still show it (consistent with showing 0 token counts).

**Acceptance Criteria:**
- `/api/token-usage` response includes `webSearchRequests` per model
- TokenUsageCard displays web search request counts
- `npm run build` passes

**Commit Message:** `feat(usage): display web search request counts in token usage`

---

### T-148: Update Export/Import for Citations

**Feature:** F-29
**Dependencies:** T-147
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/app/api/conversations/[id]/export/route.ts`:**
   - When serializing nodes, include `citations` field (will be `undefined`/empty array for nodes without citations).

2. **Modify `src/app/api/import/route.ts`:**
   - When creating nodes from imported JSON, restore `citations` from the imported data (if present). Validate that each citation has `url` and `title` strings.

**Note:** `thinkingContent` export/import was already handled in T-138. This task adds `citations` to the same export/import flow.

**Acceptance Criteria:**
- Exported JSON includes `citations` for nodes that have them
- Imported JSON restores `citations` onto nodes
- Invalid citation data (missing url/title) is silently skipped
- `npm run build` passes

**Commit Message:** `feat(export): include citations in conversation export/import`

---

### T-149: Write Tests for Thinking and Web Search Features

**Feature:** F-29
**Dependencies:** T-148
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Update and add tests across multiple test files:

1. **`__tests__/lib/providers/anthropic.test.ts`:**
   - Add test: thinking params added when `thinkingEnabled: true` (temperature=1, max_tokens=16384, thinking config).
   - Add test: "max" thinking level uses adaptive thinking with output_config.
   - Add test: web search tool added when `webSearchEnabled: true`.
   - Add test: citations extracted from TextBlock.citations.
   - Add test: webSearchRequestCount extracted from usage.

2. **`__tests__/lib/providers/openai.test.ts`** (already updated in T-128, add more):
   - Add test: reasoning params added for o-series when thinking enabled.
   - Add test: non-o-series models ignore thinkingEnabled.
   - Add test: web_search_preview tool added when webSearchEnabled.
   - Add test: citations extracted from annotations.

3. **`__tests__/api/llm-chat.test.ts`:**
   - Add test: `thinking` SSE events emitted when provider yields thinking chunks.
   - Add test: `thinkingContent` saved on assistant node.
   - Add test: web search disabled for auto-title.
   - Add test: `citations` included in done event.
   - Add test: `webSearchRequests` incremented in TokenUsage.
   - Update mock provider calls to include options parameter.

4. **`__tests__/api/import-export.test.ts`:**
   - Add test: exported JSON includes `thinkingContent` and `citations`.
   - Add test: imported JSON restores `thinkingContent` and `citations` on nodes.

**Acceptance Criteria:**
- All new tests pass
- Existing tests still pass
- Provider thinking and web search behavior covered
- API route SSE event and persistence covered
- Export/import roundtrip covered
- `npm run build` passes

**Commit Message:** `test: add thinking and web search tests for providers, API, and export/import`

---

### T-150: Write Tests for ThinkingToggle, ThinkingBlock, WebSearchToggle, CitationList Components

**Feature:** F-29
**Dependencies:** T-149
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create component test files:

1. **`__tests__/components/chat/ThinkingToggle.test.tsx`:**
   - Test: renders Brain icon.
   - Test: calls onToggle on click.
   - Test: disabled state applies opacity and prevents click.
   - Test: shows tooltip with model name when disabled.

2. **`__tests__/components/chat/ThinkingBlock.test.tsx`:**
   - Test: renders collapsed by default.
   - Test: clicking header expands to show content.
   - Test: clicking again collapses.
   - Test: `isStreaming` shows pulsing indicator.

3. **`__tests__/components/chat/WebSearchToggle.test.tsx`:**
   - Test: renders Globe icon.
   - Test: calls onToggle on click.
   - Test: active state styling when enabled.

4. **`__tests__/components/chat/CitationList.test.tsx`:**
   - Test: renders numbered citations with correct links.
   - Test: links open in new tab (`target="_blank"`).
   - Test: renders nothing for empty array.

**Acceptance Criteria:**
- All component tests pass
- Toggle, block, and citation behaviors tested
- `npm run build` passes

**Commit Message:** `test: add component tests for thinking and web search UI`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Add `citations` to INode. Add `webSearchRequests` to ITokenUsage. Document web search per provider (Anthropic `web_search_20250305`, OpenAI `web_search_preview`, Gemini `googleSearch`). Add `webSearchEnabled` to UIContext. Add WebSearchToggle, CitationList to components table. Update ChatMessage, ChatInput, ChatPanel entries for citation display. Update `/api/token-usage` response. Update auto-title to note `{ webSearchEnabled: false, thinkingEnabled: false }`. Update export/import for citations.

---

## F-30: Responsive Layout

**Description:** Implement a CSS scroll-snap-based swipeable three-panel layout for mobile screens (below `md` breakpoint). The three panels are: conversation sidebar (left), chat panel (center, default), and tree visualization (right). Desktop layout is unchanged.

**Dependencies:** F-29 (all backend and UI features complete, so ChatInput has all toggles ready for compact mobile styling).

---

### T-151: Add Scroll-Snap CSS and Create PanelIndicator Component

**Feature:** F-30
**Dependencies:** T-150
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/app/globals.css`:**
   Add scroll-snap styles for mobile panel layout (inside a suitable layer or at the end of the file):

   ```css
   /* Mobile swipeable panel layout */
   .panel-container {
     overflow-x: auto;
     scroll-snap-type: x mandatory;
     -webkit-overflow-scrolling: touch;
     display: flex;
     height: 100dvh;
   }

   .panel-item {
     scroll-snap-align: start;
     min-width: 100vw;
     flex-shrink: 0;
   }

   /* Hide scrollbar for panel container */
   .panel-container::-webkit-scrollbar {
     display: none;
   }
   .panel-container {
     -ms-overflow-style: none;
     scrollbar-width: none;
   }
   ```

   Use `100dvh` (dynamic viewport height) for the container height to account for mobile browser chrome.

2. **Create `src/components/common/PanelIndicator.tsx`:**
   - Props: `{ activeIndex: number; count: number }`
   - Renders `count` dots horizontally centered.
   - The dot at `activeIndex` is filled/highlighted (`bg-primary`). Others are muted (`bg-muted`).
   - Dot size: `w-2 h-2 rounded-full`.
   - Container: `flex gap-2 justify-center py-2`.
   - Only rendered on mobile (hidden on `md:` and above): wrap in a `<div className="md:hidden">`.

**Acceptance Criteria:**
- Scroll-snap CSS classes defined in globals.css
- Uses `100dvh` for mobile viewport
- Scrollbar hidden on panel container
- PanelIndicator renders correct number of dots
- Active dot highlighted, others muted
- PanelIndicator hidden on desktop (`md:hidden`)
- `npm run build` passes

**Commit Message:** `feat(ui): add scroll-snap CSS and PanelIndicator component`

---

### T-152: Implement Mobile Swipeable Layout in Chat Page

**Feature:** F-30
**Dependencies:** T-151
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/(protected)/chat/[conversationId]/page.tsx`:

1. **Mobile layout (below `md`):** Wrap the three panels (conversation sidebar content, chat panel, tree sidebar) in a horizontal scroll-snap container:
   ```tsx
   <div ref={containerRef} className="panel-container md:hidden">
     <div className="panel-item">{/* ConversationList content */}</div>
     <div className="panel-item">{/* ChatPanel */}</div>
     <div className="panel-item">{/* TreeSidebar content */}</div>
   </div>
   ```

2. **Desktop layout (md and above):** Render the existing layout unchanged. Use `hidden md:flex` (or similar) on the desktop container.

3. **Initial scroll to center panel:** On mount, scroll to the chat panel (index 1):
   ```typescript
   useEffect(() => {
     if (containerRef.current) {
       requestAnimationFrame(() => {
         containerRef.current?.scrollTo({ left: window.innerWidth, behavior: 'instant' });
       });
     }
   }, []);
   ```

4. **Active panel detection:** Use `IntersectionObserver` with `threshold: 0.5` on each panel:
   ```typescript
   useEffect(() => {
     const panels = containerRef.current?.children;
     if (!panels) return;
     const observer = new IntersectionObserver(
       (entries) => {
         entries.forEach((entry) => {
           if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
             setActivePanel(Number(entry.target.dataset.panelIndex));
           }
         });
       },
       { threshold: 0.5, root: containerRef.current }
     );
     Array.from(panels).forEach((panel, i) => {
       (panel as HTMLElement).dataset.panelIndex = String(i);
       observer.observe(panel);
     });
     return () => observer.disconnect();
   }, []);
   ```

5. **Render `<PanelIndicator>`** at the bottom of the mobile view, outside the scroll container, with `activeIndex={activePanel}` and `count={3}`.

6. **Pass sidebar content as a panel:** Render `ConversationList` directly in the chat page's mobile scroll container. The component reads from `ConversationContext` (provided by the layout), so it works in both locations.

**Acceptance Criteria:**
- Mobile: three-panel horizontal scroll with snap behavior
- Desktop: existing layout unchanged
- Default scroll position on chat panel
- IntersectionObserver tracks active panel
- PanelIndicator shows correct active dot
- `npm run build` passes

**Commit Message:** `feat(layout): implement mobile swipeable three-panel layout`

---

### T-153: Modify Protected Layout for Mobile Sidebar Extraction

**Feature:** F-30
**Dependencies:** T-152
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/(protected)/layout.tsx`:

1. **Desktop behavior (md and above):** Unchanged. The sidebar (`ConversationList`) renders normally in the layout.

2. **Mobile behavior (below md):** The sidebar should NOT render in the layout because it's rendered as a swipeable panel in the chat page (T-152). Use Tailwind responsive classes to hide the sidebar on mobile:
   ```tsx
   <aside className="hidden md:block ...existing-classes...">
     <ConversationList ... />
   </aside>
   ```

3. **Rendering approach:** The `ConversationList` component is rendered in two places: the layout (desktop only, via `hidden md:block`) and the chat page (mobile only, via `md:hidden`). The Tailwind responsive classes ensure only one renders at a time. Since both locations are within the protected layout's `ConversationProvider`, the component works identically in either location.

4. **Non-chat pages (dashboard, usage):** These pages don't have the three-panel layout. On mobile, the sidebar is hidden (since it's `hidden md:block` in the layout). For course project scope, this is acceptable.

**Acceptance Criteria:**
- Desktop: sidebar renders in layout as before
- Mobile: sidebar hidden in layout (`hidden md:block`)
- Chat page renders ConversationList as a mobile panel
- Dashboard and usage pages work without sidebar on mobile
- `npm run build` passes

**Commit Message:** `feat(layout): conditionally hide sidebar on mobile for swipeable panels`

---

### T-154: Adjust ChatInput for Compact Mobile Toggle Layout

**Feature:** F-30
**Dependencies:** T-153
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatInput.tsx`:

1. **Mobile toggle layout:** The ThinkingToggle and WebSearchToggle should use compact (icon-only) mode on mobile. This was specified in T-135 and T-144 (the toggles already support icon-only on mobile via `md:` breakpoint classes), but verify the layout is clean:
   - Toggles row: `flex gap-2 items-center` above or beside the textarea.
   - On mobile: toggles are small icon buttons in a compact row.
   - On desktop: toggles show icon + label.

2. **Sticky positioning:** On mobile, the ChatInput should use `sticky bottom-0` positioning within the chat panel's vertical scroll area. Verify it stays visible at the bottom while scrolling through messages.

3. **Ensure the toggles row doesn't overflow** on small screens. Use `flex-wrap` if needed, or keep toggles small enough that they fit in a single row.

**Acceptance Criteria:**
- Toggles show icon-only on mobile, icon+label on desktop
- ChatInput is sticky at bottom of chat panel on mobile
- No overflow issues on small screens
- `npm run build` passes

**Commit Message:** `feat(chat): optimize ChatInput toggle layout for mobile`

→ **AUDIT CHECKPOINT: Run full audit. Then update CLAUDE.md:** Add PanelIndicator to components table. Document mobile scroll-snap layout in the chat page section. Note sidebar rendering split (layout on desktop, chat page on mobile). Add scroll-snap CSS classes to globals.css documentation. Update ChatInput entry for compact mobile toggle layout.

---

## End of Task Breakdown — Feature Set 3

**Total: 32 tasks (T-123 through T-154) across 6 features (F-25 through F-30).**

### Execution Summary

| Phase | Feature | Tasks | Key Risk |
|-------|---------|-------|----------|
| 1 | Models Config Update | T-123 | None (isolated config change) |
| 2 | Provider Interface Extension | T-124–T-125 | Type errors between T-124 and T-125 (resolved immediately) |
| 3 | OpenAI Responses API Migration | T-126–T-128 | **HIGH**: Full provider rewrite, new streaming event model |
| 4 | Extended Thinking | T-129–T-138 | Medium: Temperature/max_tokens constraints per provider |
| 5 | Web Search & Citations | T-139–T-150 | Medium: Three different citation formats, token tracking |
| 6 | Responsive Layout | T-151–T-154 | Low: Pure CSS + frontend, no backend changes |

### SDK Version Verification Reminder

Before implementing provider changes, the builder agent should verify SDK versions:
- `openai` >= 6.33.0 (Responses API, reasoning, web_search_preview)
- `@anthropic-ai/sdk` >= 0.80.0 (web_search_20250305, thinking, ServerToolUseBlock)
- `@google/genai` >= 1.47.0 (thinkingConfig, googleSearch, groundingMetadata)

Run `npm ls openai @anthropic-ai/sdk @google/genai` to confirm.
