# Auto-Title Conversations — Audit Report (Cycle 1)
Date: 2026-04-07
Tasks covered: T-087, T-088, T-089

## Spec Compliance

### T-087: Implement Auto-Title Logic in LLM Chat Route

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | After the first message in a new conversation, the title is automatically updated from "New Conversation" to an LLM-generated title | **PASS** | `src/app/api/llm/chat/route.ts:202` — checks `conversation.title === "New Conversation"` and calls `generateTitle()` fire-and-forget. |
| 2 | The response to the user is NOT delayed by the title generation | **PASS** | `route.ts:203-211` — `generateTitle()` is called without `await`, with `.catch()` to suppress errors. The `NextResponse.json(...)` return is on line 214, independent of title generation. |
| 3 | Title is max 200 characters (truncated if longer) | **PASS** | `route.ts:34` — `response.content.trim().slice(0, 200)` enforces the 200-char limit. |
| 4 | If title generation fails, the conversation keeps "New Conversation" and no error is shown to the user | **PASS** | `route.ts:209` — `.catch(() => { ... })` silently catches errors. Test at `llm-chat.test.ts:380-402` confirms the main response is unaffected. |
| 5 | Token usage for the title call is tracked | **PASS** | `route.ts:39-51` — `generateTitle()` calls `TokenUsage.findOneAndUpdate` with `$inc` for the title generation tokens. Test at `llm-chat.test.ts:404-445` verifies two token usage calls. |
| 6 | `npm run build` passes | **PASS** | Build completes successfully with no errors. |

### T-088: Update Client to Reflect Auto-Generated Titles

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | After sending the first message, the conversation title in the sidebar updates to the auto-generated title upon the next conversation list re-fetch | **PASS** | `src/app/(protected)/chat/[conversationId]/page.tsx:206-215` — when `state.activeNodeId === null` (first message), re-fetches `/api/conversations` and dispatches `SET_CONVERSATIONS` to update the sidebar. |
| 2 | No hardcoded `setTimeout` or polling interval in the codebase for title refresh | **PASS** | No `setTimeout` for title refresh anywhere in the chat page. The re-fetch is triggered immediately after the first message response. |
| 3 | If the title generation is slow, "New Conversation" persists until the next natural re-fetch — this is acceptable | **PASS** | The fire-and-forget pattern means the title update in the DB may not be complete by the time the re-fetch happens, but the next navigation/fetch will pick it up. |
| 4 | `npm run build` passes | **PASS** | Confirmed. |

### T-089: Write Tests for Auto-Title

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All tests pass via `npm test` | **PASS** | 147 tests pass across 16 test files. |
| 2 | `npm run build` passes | **PASS** | Confirmed. |

**Test coverage for auto-title:**
- `llm-chat.test.ts:326-483` — 5 dedicated auto-title tests:
  1. Triggers title generation when title is "New Conversation" (line 327)
  2. Does NOT trigger when title is not "New Conversation" (line 367)
  3. Title generation failure doesn't affect main response (line 380)
  4. Token usage tracked for title call (line 404)
  5. Title truncated to 200 characters (line 447)

## Bug Detection

No bugs found.

**Reviewed files:**
- `src/app/api/llm/chat/route.ts` — `generateTitle()` function and its invocation in the POST handler
- `src/app/(protected)/chat/[conversationId]/page.tsx` — client-side title refresh logic
- `src/components/providers/ConversationProvider.tsx` — reducer handles `SET_CONVERSATIONS`
- `src/contexts/ConversationContext.ts` — action types include `UPDATE_CONVERSATION`
- `__tests__/api/llm-chat.test.ts` — auto-title test suite

**Checks performed:**
- **Null/undefined handling**: `generateTitle` properly trims and slices content. The `userId` parameter is passed from the validated session. Provider/model come from the validated request body.
- **Error handling**: `.catch(() => {})` on the fire-and-forget prevents unhandled rejections. Token usage tracking inside `generateTitle` is guarded by the `if (response.inputTokens || response.outputTokens)` check.
- **Race conditions**: The fire-and-forget runs independently of the response. The client re-fetch may or may not pick up the new title depending on timing — this is the intended behavior per the spec.
- **Promise rejection**: No unhandled promise rejections — the `.catch()` on line 209 handles all errors from `generateTitle()`.

## Security

No security issues found.

- **Auth**: `generateTitle()` operates with the already-authenticated `userId` from the session. No additional auth bypass vectors.
- **Data isolation**: `Conversation.findByIdAndUpdate(conversationId, { title })` updates only the conversation that was already ownership-verified at line 124.
- **Input sanitization**: The title content comes from the LLM response, not user input. It's trimmed and length-limited to 200 chars.
- **No API key exposure**: Provider reads keys from `process.env` internally.

## Architecture Alignment

No deviations found.

| Aspect | Specified | Implemented | Match |
|--------|-----------|-------------|-------|
| Auto-title trigger condition | `conversation.title === "New Conversation"` | `conversation.title === "New Conversation"` (route.ts:202) | Yes |
| Fire-and-forget pattern | Call without `await`, catch errors | `generateTitle(...).catch(...)` (route.ts:203-211) | Yes |
| System prompt | "Generate a concise title (max 6 words)..." | Matches exactly (route.ts:28-29) | Yes |
| Title update | `Conversation.findByIdAndUpdate(conversationId, { title })` | Matches (route.ts:36) | Yes |
| Token tracking for title call | Track via `TokenUsage.findOneAndUpdate` with `$inc` | Matches (route.ts:40-51) | Yes |
| Max title length | 200 chars | `.slice(0, 200)` (route.ts:34) | Yes |
| Client refresh | Re-fetch conversation list after first message | `fetch("/api/conversations")` when `state.activeNodeId === null` (page.tsx:206-215) | Yes |
| No `setTimeout` | No polling/timeout | Confirmed — immediate re-fetch only | Yes |
| Helper location | Same file or `src/lib/autoTitle.ts` | Same file (route.ts:17-52) | Acceptable |
| `generateTitle` signature | `(conversationId, firstUserMessage, provider, model)` | Adds `userId` param for token tracking — necessary addition | Acceptable deviation |

## Forward Compatibility

No concerns.

- The `generateTitle()` function is self-contained and does not introduce shared state or global side effects.
- The `UPDATE_CONVERSATION` action type exists in `ConversationContext.ts:17` for future per-conversation title updates if needed, though the current implementation uses `SET_CONVERSATIONS` for the bulk re-fetch.
- The auto-title uses the same `getProvider()` and `sendMessage()` interface as the main chat, so future provider changes will automatically apply.
- Token tracking follows the same `$inc` upsert pattern used by the main chat flow.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
