# F-28: Extended Thinking — Audit Report (Cycle 2)
Date: 2026-04-12
Tasks covered: T-129, T-130, T-131, T-132, T-133, T-134, T-135, T-136, T-137, T-138

## Cycle 1 Fix Verification

### Fix 1: Stale closure on `uiState.thinkingEnabled` in `handleSend`
**FIXED.** `uiState.thinkingEnabled` is now included in the `useCallback` dependency array at `page.tsx:212`.

### Fix 2: Mock model `supportsThinking: false`
**FIXED.** Mock model config at `models.ts:26` now has `supportsThinking: true, maxThinkingLevel: 'high'`, enabling developers to test the full thinking flow end-to-end without API keys.

## Spec Compliance

### T-129: Add thinkingContent to Node Schema
- **PASS:** `thinkingContent` field exists on NodeSchema with `{ type: String, default: null }` (`src/models/Node.ts:11`).
- **PASS:** `INode` interface includes `thinkingContent?: string | null` (`src/models/Node.ts:41`).

### T-130: Implement Extended Thinking in Anthropic Provider
- **PASS:** `buildThinkingParams()` adds `thinking: { type: 'enabled', budget_tokens: 10000 }` for "high" level models (`anthropic.ts:67`).
- **PASS:** For "max" level (Opus), uses `thinking: { type: 'adaptive' }` with `output_config: { effort: 'max' }` (`anthropic.ts:58-63`).
- **PASS:** Temperature locked to 1 when thinking is enabled (`anthropic.ts:61,68`).
- **PASS:** `max_tokens` bumped to 16384 when thinking is enabled (`anthropic.ts:62,69`).
- **PASS:** Streaming yields `thinking` chunks from `thinking_delta` events (`anthropic.ts:151-154`).
- **PASS:** `thinkingContent` populated in `done` chunk (`anthropic.ts:167`).
- **PASS:** `sendMessage` extracts thinking from response content blocks via `extractThinkingAndText` (`anthropic.ts:73-84,111`).

### T-131: Implement Extended Thinking in OpenAI Provider
- **PASS:** `sendMessage` adds `reasoning: { effort, summary: 'auto' }` for o-series models when thinking enabled (`openai.ts:64-66`).
- **PASS:** Non-reasoning models ignore `thinkingEnabled` (only applied when `isReasoningModel(model)` is true).
- **PASS:** Streaming yields `thinking` chunks from `response.reasoning_summary_text.delta` events (`openai.ts:128-131`).
- **PASS:** `thinkingContent` populated in `done` chunk (`openai.ts:137`).
- **PASS:** Reasoning summaries extracted from response output items (`openai.ts:72-79`).

### T-132: Implement Extended Thinking in Gemini Provider
- **PASS:** `thinkingConfig` with `thinkingLevel` and `includeThoughts: true` added when thinking enabled (`gemini.ts:42-47`).
- **PASS:** `systemInstruction` preserved alongside `thinkingConfig` — both set on the `config` object (`gemini.ts:38-47`).
- **PASS:** Thought-flagged parts (`part.thought === true`) extracted as thinking content (`gemini.ts:57-65`).
- **PASS:** `streamMessage` yields `thinking` chunks for thought parts (`gemini.ts:129-131`).
- **PASS:** `thinkingContent` populated in `done` chunk (`gemini.ts:152`).

### T-133: Implement Extended Thinking in Mock Provider
- **PASS:** `sendMessage` returns canned `thinkingContent` when thinking enabled (`mock.ts:45`).
- **PASS:** `streamMessage` yields 3 thinking chunks before text chunks (`mock.ts:63-66`).
- **PASS:** `done` chunk includes `thinkingContent` (`mock.ts:79`).

### T-134: Add Thinking State to UIContext and UIProvider
- **PASS:** `thinkingEnabled: boolean` in `UIState` with default `false` (`UIContext.ts:13`, `UIProvider.tsx:15`).
- **PASS:** `TOGGLE_THINKING` action toggles `thinkingEnabled` (`UIProvider.tsx:42-43`).
- **PASS:** `SET_THINKING_ENABLED` action sets `thinkingEnabled` to payload (`UIProvider.tsx:45-46`).
- **PASS:** Model-aware auto-disable: `useEffect` watches `selectedModel`/`selectedProvider` and disables thinking if model doesn't support it (`UIProvider.tsx:104-110`).

### T-135: Create ThinkingToggle and ThinkingBlock Components
- **PASS:** ThinkingToggle renders `Brain` icon from lucide-react (`ThinkingToggle.tsx:34`).
- **PASS:** Disabled state applies `opacity-50 pointer-events-none` (`ThinkingToggle.tsx:28`).
- **PASS:** Tooltip on hover when disabled shows "Not available for {modelName}" (`ThinkingToggle.tsx:38-41`).
- **PASS:** Active state styling `bg-primary/10 text-primary` when enabled (`ThinkingToggle.tsx:29`).
- **PASS:** Icon-only on mobile, icon + "Thinking" label on desktop via `hidden md:inline` (`ThinkingToggle.tsx:35`).
- **PASS:** ThinkingBlock is collapsible, default collapsed (`ThinkingBlock.tsx:12`).
- **PASS:** ChevronDown/ChevronUp icons toggle (`ThinkingBlock.tsx:22-26`).
- **PASS:** Pulsing animation when `isStreaming` (`ThinkingBlock.tsx:27`).
- **PASS:** Content rendered as plain text with muted styling (`ThinkingBlock.tsx:36`).
- **PASS:** Left border accent with `border-l-2 border-muted pl-3` (`ThinkingBlock.tsx:36`).

### T-136: Update useStreamingChat Hook for Thinking SSE Events
- **PASS:** `streamingThinkingContent` state added (`useStreamingChat.ts:32`).
- **PASS:** Resets on new stream start (`useStreamingChat.ts:70`).
- **PASS:** Handles `event: thinking` SSE events, accumulates content (`useStreamingChat.ts:173-175`).
- **PASS:** `thinkingEnabled` sent in fetch body via the `StreamingChatRequest` interface (`useStreamingChat.ts:14`).
- **PASS:** `streamingThinkingContent` exposed in hook return value (`useStreamingChat.ts:233`).

### T-137: Update ChatInput, ChatMessage, and ChatPanel for Thinking UI
- **PASS:** ChatInput renders `ThinkingToggle` with correct props (`page.tsx:355-358`).
- **PASS:** ChatMessage renders `ThinkingBlock` above content for completed messages with `thinkingContent` (`ChatMessage.tsx:115-117`).
- **PASS:** ChatMessage renders streaming `ThinkingBlock` during active streaming (`ChatMessage.tsx:120-122`).
- **PASS:** ChatPanel passes `streamingThinkingContent` to the streaming bubble (`ChatPanel.tsx:86-87`).

### T-138: Update Chat API Route for Thinking Support and Export/Import
- **PASS:** Chat route extracts `thinkingEnabled` from request body (`route.ts:98`).
- **PASS:** Builds `LLMRequestOptions` with `thinkingEnabled` and `thinkingLevel` from model config (`route.ts:225-228`).
- **PASS:** `thinking` SSE events emitted for thinking chunks (`route.ts:258-262`).
- **PASS:** `thinkingContent` saved on assistant node (`route.ts:282`).
- **PASS:** `thinkingContent` included in serialized node via `serializeNode` (`route.ts:70`).
- **PASS:** Export includes `thinkingContent` (`export/route.ts:66`).
- **PASS:** Import restores `thinkingContent` (`import/route.ts:114`).

## Bug Detection

No bugs found. All cycle 1 issues have been resolved.

The previously flagged "informational" issue about `top_k` not being explicitly omitted in the Anthropic provider remains a non-issue — `top_k` is never set anywhere in the provider.

## Security

No security issues. Same assessment as cycle 1:

- **Auth:** Chat route checks `auth()` and `session.user.id` before processing. Conversation ownership verified.
- **Data isolation:** All queries filter by `userId`. No cross-user data access possible.
- **Input validation:** `thinkingEnabled` is a boolean from request body, used only to conditionally add provider params. No injection risk.
- **API key exposure:** Provider API keys read server-side only from env vars. No client-side exposure.

## Architecture Alignment

- **Folder structure:** All files in correct locations per CLAUDE.md. `ThinkingToggle.tsx` and `ThinkingBlock.tsx` in `src/components/chat/`.
- **Mongoose model:** `thinkingContent` field matches spec (`String, default: null`).
- **API routes:** Chat route correctly handles `thinkingEnabled`, builds options, passes to provider. SSE events match spec format.
- **Provider implementations:** All four providers implement `options?: LLMRequestOptions`. SDK usage patterns match spec.
- **Data flow:** UIContext -> ChatPage -> ChatInput (toggle) and ChatPanel (display). useStreamingChat accumulates thinking content. All as designed.
- **Types:** `LLMRequestOptions`, `StreamChunk` (with `thinking` variant), `LLMResponse` (with `thinkingContent`) all match CLAUDE.md spec.
- **CLAUDE.md:** Components list and table include ThinkingToggle and ThinkingBlock. All interfaces documented accurately.

No deviations from architecture.

## Forward Compatibility

- **Web Search (F-29):** `LLMRequestOptions` already includes `webSearchEnabled`. `StreamChunk` `done` type has `webSearchRequestCount` and `citations`. All providers return `webSearchRequestCount: 0` and `citations: []` — ready for F-29.
- **Export/Import:** `ExportedTree` type already includes `citations` field. Ready for F-29.
- **UIContext:** `webSearchEnabled` is not yet in UIContext (will be added in F-29). No conflicts.
- **Database:** `DBNode` type already includes `citations` field. No conflict.

No hardcoded assumptions that would need undoing.

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate. The cycle 1 update (adding ThinkingToggle and ThinkingBlock to the components list and table) is already in place.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- CLAUDE.md updates: 0
- Recommendation: PROCEED
