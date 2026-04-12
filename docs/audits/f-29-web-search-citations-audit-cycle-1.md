# F-29: Web Search & Citations — Audit Report (Cycle 1)
Date: 2026-04-12
Tasks covered: T-139, T-140, T-141, T-142, T-143, T-144, T-145, T-146, T-147, T-148, T-149, T-150

## Spec Compliance

### T-139: Add citations to Node Schema and webSearchRequests to TokenUsage

- **PASS:** Node schema has `citations` subdocument array with `_id: false`. Evidence: `src/models/Node.ts:12-16` — `citations: [{ url: { type: String, required: true }, title: { type: String, required: true }, _id: false }]`.
- **PASS:** TokenUsage schema has `webSearchRequests` with default 0. Evidence: `src/models/TokenUsage.ts:23` — `webSearchRequests: { type: Number, default: 0 }`.
- **PASS:** `INode` interface updated with `citations?: { url: string; title: string }[]`. Evidence: `src/models/Node.ts:47`.
- **PASS:** `ITokenUsage` interface updated with `webSearchRequests: number`. Evidence: `src/models/TokenUsage.ts:11`.
- **PASS:** All existing tests pass (242/243; 1 pre-existing logger failure unrelated).
- **PASS:** TypeScript compiles without errors in source code.

### T-140: Implement Web Search in Anthropic Provider

- **PASS:** Anthropic adds `web_search_20250305` tool when web search enabled. Evidence: `src/lib/providers/anthropic.ts:73-78` — `buildWebSearchTools()` returns `{ tools: [{ type: 'web_search_20250305', name: 'web_search' }] }`.
- **PASS:** Text extracted only from `TextBlock` entries. Evidence: `src/lib/providers/anthropic.ts:100-111` — `extractThinkingAndText()` only extracts from `type === 'text'` blocks.
- **PASS:** Citations extracted from `TextBlock.citations`, mapped to `{ url, title }`. Evidence: `src/lib/providers/anthropic.ts:80-94` — `extractCitations()` deduplicates by URL.
- **PASS:** `webSearchRequestCount` read from `usage.server_tool_use.web_search_requests`. Evidence: `src/lib/providers/anthropic.ts:96-98`.
- **PASS:** `server_tool_use` and `web_search_tool_result` blocks not yielded as tokens during streaming. Evidence: `src/lib/providers/anthropic.ts:182-192` — only `thinking_delta` and `text_delta` events are yielded; comment at line 191 confirms.

### T-141: Implement Web Search in OpenAI Provider

- **PASS:** OpenAI adds `web_search_preview` tool when web search enabled. Evidence: `src/lib/providers/openai.ts:91-93`.
- **PASS:** Citations extracted from `annotations` on text output. Evidence: `src/lib/providers/openai.ts:43-61` — `extractCitationsFromOutput()` checks `type === 'url_citation'`.
- **PASS:** `webSearchRequestCount` counts `web_search_call` items. Evidence: `src/lib/providers/openai.ts:63-65` — `countWebSearchCalls()`.
- **PASS:** Reasoning and web search coexist for o-series models. Evidence: `src/lib/providers/openai.ts:88-93` — both `reasoning` and `tools` params are set independently.

### T-142: Implement Web Search in Gemini Provider

- **PASS:** Gemini adds `googleSearch` tool when web search enabled. Evidence: `src/lib/providers/gemini.ts:68-70` — `config.tools = [{ googleSearch: {} }]`.
- **PASS:** `tools`, `thinkingConfig`, and `systemInstruction` coexist in config. Evidence: `src/lib/providers/gemini.ts:58-70` — all three are set on the `config` object independently.
- **PASS:** Citations extracted from `groundingMetadata.groundingChunks`. Evidence: `src/lib/providers/gemini.ts:5-19` — `extractGeminiCitations()` maps `chunk.web.uri` to `url`.
- **PASS:** `webSearchRequestCount` is 1 when grounding metadata present. Evidence: `src/lib/providers/gemini.ts:21-23` — `hasGroundingMetadata()` checks for non-empty `groundingChunks`.

### T-143: Implement Web Search in Mock Provider and Update Auto-Title

- **PASS:** Mock provider returns mock citations when web search enabled. Evidence: `src/lib/providers/mock.ts:5-8` — `MOCK_CITATIONS` constant; `mock.ts:56` — `citations: options?.webSearchEnabled ? MOCK_CITATIONS : []`.
- **PASS:** Auto-title explicitly disables web search and thinking. Evidence: `src/app/api/llm/chat/route.ts:37` — `llmProvider.sendMessage(titleMessages, model, { thinkingEnabled: false, webSearchEnabled: false })`.

### T-144: Add webSearchEnabled State to UIContext and Create WebSearchToggle and CitationList Components

- **PASS:** `webSearchEnabled` available in UIContext, defaults to `true`. Evidence: `src/contexts/UIContext.ts:14` — `webSearchEnabled: boolean`; `src/components/providers/UIProvider.tsx:16` — `webSearchEnabled: true`.
- **PASS:** `TOGGLE_WEB_SEARCH` action works. Evidence: `src/contexts/UIContext.ts:26` — action type defined; `src/components/providers/UIProvider.tsx:49-50` — reducer toggles value.
- **PASS:** WebSearchToggle renders Globe icon with toggle behavior. Evidence: `src/components/chat/WebSearchToggle.tsx:4` — imports `Globe` from lucide-react; click triggers `onToggle`.
- **PASS:** WebSearchToggle shows icon-only on mobile, icon+label on desktop. Evidence: `src/components/chat/WebSearchToggle.tsx:26` — `<span className="hidden md:inline text-xs">Search</span>`.
- **PASS:** CitationList renders numbered links, opens in new tab. Evidence: `src/components/chat/CitationList.tsx:14-22` — `target="_blank" rel="noopener noreferrer"`, `[{index + 1}]` numbering.
- **PASS:** CitationList renders nothing for empty array. Evidence: `src/components/chat/CitationList.tsx:8` — `if (!citations || citations.length === 0) return null`.

### T-145: Update ChatInput and ChatMessage for Web Search UI

- **PASS:** ChatInput renders both WebSearchToggle and ThinkingToggle. Evidence: `src/components/chat/ChatInput.tsx:172-185` — both components rendered in the toggles row.
- **PASS:** ChatMessage renders CitationList below content for messages with citations. Evidence: `src/components/chat/ChatMessage.tsx:165-168` — checks `node.citations` array and renders `<CitationList>`.
- **PASS:** ChatPanel wires up web search state. Evidence: `src/app/(protected)/chat/[conversationId]/page.tsx:366-367` — passes `webSearchEnabled` and `onWebSearchToggle` to ChatInput.

### T-146: Update useStreamingChat to Send Toggle States and Chat API Route for Web Search

- **PASS:** `webSearchEnabled` sent in fetch body from streaming hook. Evidence: `src/hooks/useStreamingChat.ts:15` — `webSearchEnabled?: boolean` in request interface; `page.tsx:159` — `webSearchEnabled: uiState.webSearchEnabled`.
- **PASS:** Chat route passes `webSearchEnabled` in options to provider. Evidence: `src/app/api/llm/chat/route.ts:229` — `webSearchEnabled: webSearchEnabled ?? false` in `llmOptions`.
- **PASS:** Citations saved on assistant node. Evidence: `src/app/api/llm/chat/route.ts:285` — `...(chunk.citations?.length ? { citations: chunk.citations } : {})`.
- **PASS:** `webSearchRequests` incremented in TokenUsage. Evidence: `src/app/api/llm/chat/route.ts:302` — `webSearchRequests: chunk.webSearchRequestCount ?? 0` in `$inc`.
- **PASS:** Citations included in done SSE event via serialized assistant node. Evidence: `src/app/api/llm/chat/route.ts:71` — `serializeNode()` includes `citations` when present.

### T-147: Update Token Usage API and TokenUsageCard for Web Search Requests

- **PASS:** `/api/token-usage` response includes `webSearchRequests` per model. Evidence: `src/app/api/token-usage/route.ts:34` — `webSearchRequests: u.webSearchRequests ?? 0`.
- **PASS:** TokenUsageCard displays web search request counts. Evidence: `src/components/dashboard/TokenUsageCard.tsx:126-129` — displays "Web searches: N".

### T-148: Update Export/Import for Citations

- **PASS:** Exported JSON includes `citations` for nodes that have them. Evidence: `src/app/api/conversations/[id]/export/route.ts:67` — `...(n.citations?.length ? { citations: n.citations } : {})`.
- **PASS:** Imported JSON restores `citations` onto nodes. Evidence: `src/app/api/import/route.ts:115` — `...(node.citations?.length ? { citations: node.citations.filter(...) } : {})`.
- **PASS:** Invalid citation data (missing url/title) is silently skipped. Evidence: `src/app/api/import/route.ts:115` — `.filter((c: any) => c?.url && c?.title)`.

### T-149: Write Tests for Thinking and Web Search Features

- **PASS:** Anthropic thinking params test exists. Evidence: `__tests__/lib/providers/anthropic.test.ts:187-213`.
- **PASS:** Anthropic web search tool test exists. Evidence: `__tests__/lib/providers/anthropic.test.ts:215-250`.
- **PASS:** OpenAI reasoning params tests exist. Evidence: `__tests__/lib/providers/openai.test.ts:298-320`.
- **PASS:** OpenAI web search tests exist. Evidence: `__tests__/lib/providers/openai.test.ts:322-357`.
- **PASS:** LLM chat route thinking SSE events tested. Evidence: `__tests__/api/llm-chat.test.ts:474-489`.
- **PASS:** LLM chat route web search citations tested. Evidence: `__tests__/api/llm-chat.test.ts:491-565`.
- **PASS:** Export/import thinkingContent and citations tests exist. Evidence: `__tests__/api/import-export.test.ts:499-596`.

### T-150: Write Tests for ThinkingToggle, ThinkingBlock, WebSearchToggle, CitationList Components

- **PASS:** ThinkingToggle tests cover Brain icon, onToggle, disabled state, tooltip. Evidence: `__tests__/components/chat/ThinkingToggle.test.tsx`.
- **PASS:** ThinkingBlock tests cover collapsed default, expand/collapse, streaming pulsing. Evidence: `__tests__/components/chat/ThinkingBlock.test.tsx`.
- **PASS:** WebSearchToggle tests cover Globe icon, onToggle, active styling. Evidence: `__tests__/components/chat/WebSearchToggle.test.tsx`.
- **PASS:** CitationList tests cover numbered links, new tab, empty array. Evidence: `__tests__/components/chat/CitationList.test.tsx`.

## Bug Detection

No bugs found. All code paths reviewed:

- **Provider implementations:** All three providers (Anthropic, OpenAI, Gemini) correctly handle web search tool addition, citation extraction, and web search request counting. Deduplication by URL is properly implemented in all providers.
- **Streaming paths:** Anthropic streaming correctly ignores `server_tool_use` and `web_search_tool_result` deltas. OpenAI streaming correctly handles `web_search_call` items on completion. Gemini streaming correctly extracts `groundingMetadata` from the last candidate.
- **Chat route:** `webSearchEnabled` is properly extracted from request body (line 99), passed in options (line 229), citations saved on assistant node (line 285), and `webSearchRequests` incremented in TokenUsage (line 302). Null-safe with `?? 0` fallbacks.
- **UI state flow:** `webSearchEnabled` state flows correctly from UIContext → ChatPage → ChatInput → WebSearchToggle, and is sent in the streaming request body.
- **Auto-title:** Correctly passes `{ thinkingEnabled: false, webSearchEnabled: false }` to prevent unnecessary tool use.
- **Export/import:** Citations are conditionally included when present and filtered for valid entries on import.

## Security

No security issues found.

- **Auth:** All routes (token-usage, llm/chat, export, import) check `auth()` and return 401 if unauthenticated.
- **Data isolation:** All database queries filter by `userId` or verify conversation ownership.
- **No API key exposure:** All provider API keys are read server-side from environment variables.
- **Input validation:** Citations in import are validated for `url` and `title` presence. The `webSearchEnabled` boolean in the request body has a safe default (`?? false`).
- **No injection risks:** CitationList renders URLs via `href` attribute (not `dangerouslySetInnerHTML`). The `rel="noopener noreferrer"` attribute is present on all external links.

## Architecture Alignment

- **Folder structure:** All files are in the correct locations per CLAUDE.md. New components `WebSearchToggle.tsx` and `CitationList.tsx` are in `src/components/chat/` as specified.
- **Mongoose models:** Node schema matches spec with `citations` subdocument array (`_id: false`). TokenUsage schema matches with `webSearchRequests` field (Number, default 0).
- **API contracts:** `POST /api/llm/chat` correctly accepts `webSearchEnabled` and returns citations in the done event. `GET /api/token-usage` includes `webSearchRequests`. Export includes citations. Import restores them with validation.
- **Provider implementations:** All match the specified SDK usage patterns:
  - Anthropic: `tools: [{ type: "web_search_20250305", name: "web_search" }]`
  - OpenAI: `tools: [{ type: "web_search_preview" }]`
  - Gemini: `tools: [{ googleSearch: {} }]`
- **LLM interfaces:** `LLMRequestOptions`, `Citation`, `LLMResponse`, `StreamChunk` all match CLAUDE.md exactly.
- **Data flow:** WebSearchToggle → UIContext → ChatPage → useStreamingChat → API → Provider → Response → CitationList. Correct and complete.
- **No unexpected files or missing files.**

## Forward Compatibility

- **F-30 (Responsive Layout):** The WebSearchToggle already uses `hidden md:inline` for responsive icon-only on mobile. ChatInput's toggles row (`mt-2 flex items-center gap-2`) is ready for compact mobile styling. No issues anticipated.
- **Schema backward compatibility:** Both `citations` and `webSearchRequests` are optional/defaulted fields. Existing documents without these fields will work correctly (undefined treated as empty array / 0).
- **Provider interface stability:** The `LLMRequestOptions` interface is flexible for future additions. The `options?` parameter is optional throughout.

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate. All interfaces, API contracts, components, and schema fields are correctly documented.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- CLAUDE.md updates: 0
- Recommendation: PROCEED
