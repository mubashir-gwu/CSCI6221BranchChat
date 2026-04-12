# OpenAI Responses API Migration — Audit Report (Cycle 1)
Date: 2026-04-12
Tasks covered: T-126, T-127, T-128

## Spec Compliance

### T-126: Rewrite OpenAI Provider for Responses API

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `sendMessage` uses `client.responses.create()` with `instructions` and `input` fields | **PASS** | `openai.ts:65` calls `client.responses.create(params)`, `buildInstructionsAndInput()` at line 13 extracts system messages into `instructions` string and non-system messages into `input` array |
| 2 | `streamMessage` uses `client.responses.create({ stream: true })` with correct event handling | **PASS** | `openai.ts:100` calls `client.responses.create(params)` with `stream: true` at line 91. Handles `response.output_text.delta` (line 105) and `response.completed` (line 109) events |
| 3 | `isReasoningModel()` helper correctly identifies o-series models | **PASS** | `openai.ts:9-11` — uses regex `/^o\d/`, exported for reuse. Tests confirm `o3`→true, `o4-mini`→true, `gpt-4o`→false |
| 4 | Temperature is omitted for o-series models | **PASS** | `openai.ts:61-63` and `openai.ts:96-98` — temperature only set when `!isReasoningModel(model)`. Tests at lines 137-145 and 251-271 verify |
| 5 | Token usage reads from `input_tokens`/`output_tokens` | **PASS** | `openai.ts:73-74` reads `response.usage?.input_tokens` and `response.usage?.output_tokens` |
| 6 | Non-streaming response reads from `response.output_text` | **PASS** | `openai.ts:68` reads `response.output_text ?? ''` |
| 7 | `npm run build` passes | **PASS** | Build completes successfully |

### T-127: Update Attachment Formatter for OpenAI Responses API

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | OpenAI image attachments use `type: "input_image"` with flat `image_url` string | **PASS** | `attachmentFormatter.ts:49-52` — `{ type: 'input_image', image_url: \`data:...\` }` |
| 2 | OpenAI file attachments use `type: "input_file"` with flat `file_data` and `filename` | **PASS** | `attachmentFormatter.ts:42-46` — `{ type: 'input_file', file_data: \`data:...\`, filename }` |
| 3 | Anthropic attachment formatting unchanged | **PASS** | `attachmentFormatter.ts:15-33` — Anthropic format uses `image`, `document`, and `text` types as before |
| 4 | Gemini attachment formatting unchanged | **PASS** | `attachmentFormatter.ts:56-67` — Gemini format uses `inlineData` and `text` as before |
| 5 | `npm run build` passes | **PASS** | Build completes successfully |

### T-128: Update OpenAI Provider and Attachment Formatter Tests

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All updated tests pass (`npm test`) | **PASS** | 21 test files, 207 tests, all passing |
| 2 | OpenAI provider tests validate Responses API behavior | **PASS** | `openai.test.ts` — 14 tests covering `isReasoningModel`, `sendMessage` with instructions/input, token usage, temperature handling, streaming events |
| 3 | Attachment formatter tests validate new OpenAI format | **PASS** | `attachmentFormatter.test.ts:87-108` — tests verify `input_image` with flat `image_url` and `input_file` with flat structure |
| 4 | `npm run build` passes | **PASS** | Build completes successfully |

## Bug Detection

### Low: Error chunk test is incomplete (openai.test.ts:273-295)

**File:** `__tests__/lib/providers/openai.test.ts:273-295`
**Description:** The "yields error chunk on exception" test doesn't actually verify that an error chunk is yielded. It sets up an empty events array and collects chunks, but performs no assertions about error behavior. The comment at line 294 acknowledges this: "The error path is tested via the try/catch when create() throws" but this path is not actually tested.
**Severity:** Low — The error handling logic in the source code (`openai.ts:122-124`) is correct (catches errors and yields error chunks). The test just doesn't exercise it. Not a runtime bug.

No other bugs found. The implementation is clean and correct.

## Security

No security issues found.

- **Auth:** The OpenAI provider is a library module called from the authenticated `llm/chat` route. No direct route exposure.
- **API key exposure:** `OPENAI_API_KEY` is read from `process.env` server-side only (`openai.ts:51`, `openai.ts:85`). Not exposed to the client.
- **Input validation:** The `buildInstructionsAndInput` function processes `LLMMessage[]` which is validated upstream in the chat route.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| File location | `src/lib/providers/openai.ts` | `src/lib/providers/openai.ts` | **Match** |
| API method | `client.responses.create()` | `client.responses.create()` | **Match** |
| System messages | Extract to `instructions` param | `buildInstructionsAndInput()` extracts and concatenates | **Match** |
| Messages field | `input` replaces `messages` | Uses `input` field | **Match** |
| Token fields | `input_tokens`/`output_tokens` | `response.usage?.input_tokens`/`output_tokens` | **Match** |
| Response text | `response.output_text` | `response.output_text ?? ''` | **Match** |
| Streaming events | `response.output_text.delta`, `response.completed` | Handles both events correctly | **Match** |
| Temperature | Omit for o-series via `isReasoningModel()` | Conditional omission with regex `/^o\d/` | **Match** |
| `isReasoningModel` | Exported helper | Exported from `openai.ts` | **Match** |
| Attachment images | `type: "input_image"`, flat `image_url` | Matches spec | **Match** |
| Attachment files | `type: "input_file"`, flat `file_data` + `filename` | Matches spec | **Match** |

No architectural deviations found.

## Forward Compatibility

| Concern | Assessment |
|---------|------------|
| **F-28 (Extended Thinking):** OpenAI thinking requires `reasoning` parameter for o-series | `isReasoningModel()` is exported and ready for use. The `options` parameter is already accepted but not used — correct, as thinking is deferred to F-28. |
| **F-29 (Web Search):** OpenAI web search requires `tools: [{ type: "web_search_preview" }]` | The `params` object is built dynamically with `Record<string, unknown>`, making it easy to add `tools`. The `options` parameter is plumbed through. |
| **Streaming extensibility:** Need to handle `reasoning_summary_text.delta` and citation annotations | The `for await` loop over events has an open structure — new event types can be handled by adding `else if` branches. |
| **Attachment compatibility:** Anthropic/Gemini formats unchanged | Confirmed — only OpenAI case was modified in `attachmentFormatter.ts`. |

No forward compatibility concerns.

## CLAUDE.md Updates

1. **Updated OpenAI provider description** (line 370): Changed from `client.chat.completions.create({ model, messages })` / `prompt_tokens`/`completion_tokens` to `client.responses.create({ model, input, instructions })` / `input_tokens`/`output_tokens`. Added `isReasoningModel()` helper documentation and streaming event types.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 1 (incomplete error test — cosmetic, not a runtime bug)
- CLAUDE.md updates: 1
- Recommendation: **PROCEED**
