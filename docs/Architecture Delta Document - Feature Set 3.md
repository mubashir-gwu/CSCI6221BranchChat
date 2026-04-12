# Architecture Delta Document -- Feature Set 3

---

## 1. Change Classification

| # | Change | Classification |
|---|--------|---------------|
| C-3 | Responsive Layout (Mobile) | UI-only -- CSS and component-level changes, no backend or schema changes |
| C-2 | Extended Thinking Toggle | Cross-cutting -- new Node schema field, provider layer parameter changes, new StreamChunk type, new SSE event, UI toggle and collapsible display |
| C-1 | Web Search Capability | Architectural shift -- OpenAI provider migrated from Chat Completions API to Responses API, new tool integration across all three providers, citations in response/storage, new StreamChunk type, new SSE event, TokenUsage schema extension |

Implementation order follows this table (least to most intensive).

---

## 2. Deliberation Transcripts

### C-3: Responsive Layout (Mobile)

**PROPOSER:**

Implement a CSS scroll-snap-based swipeable three-panel layout for screens below the `md` breakpoint (768px). The three panels are: conversation sidebar (left), chat panel (center, default), and tree visualization (right).

The approach:

1. Create a horizontal scroll container wrapping all three panels. Each panel is `100vw` wide. Apply `scroll-snap-type: x mandatory` on the container and `scroll-snap-align: start` on each panel.
2. Default scroll position centers on the chat panel (panel index 1). On mount, call `scrollTo({ left: window.innerWidth })` on the container.
3. Add dot indicators at the bottom showing which panel is active. Track the active panel via `scroll` event + `scrollLeft` calculation.
4. On desktop (`md:` and above), use the existing layout unchanged. The scroll container only activates below `md`.
5. ChatInput stays fixed at the bottom of the chat panel. Toggles (web search, thinking) use icon-only mode on mobile.
6. ReactFlow in the tree panel gets full width. Touch gestures (pinch-zoom, drag-pan) are natively supported.

**File changes:**
- `src/app/(protected)/layout.tsx` -- wrap the three panels in a horizontal scroll container on mobile.
- `src/app/globals.css` -- add scroll-snap styles.
- `src/components/chat/ChatInput.tsx` -- compact toggles on mobile.
- New: `src/components/common/PanelIndicator.tsx` -- dot indicators.

**CRITIC:**

1. **Scroll container placement**: The protected layout currently renders a sidebar + main content area. The tree sidebar is rendered inside the chat page, not the layout. This means the scroll container can't wrap all three panels at the layout level -- it needs to be at the chat page level where all three panels coexist.
2. **Conversation sidebar**: The sidebar is currently in the protected layout and conditionally toggles. On mobile, it should become one of the swipeable panels rather than an overlay. This means the sidebar toggle behavior changes on mobile.
3. **Initial scroll position**: `scrollTo` on mount is fragile. If the content hasn't rendered yet, it scrolls to the wrong position. Use `useEffect` with a ref and ensure the container is fully rendered before scrolling. Alternatively, set the initial scroll position via CSS by making the center panel the default snap point.
4. **Panel indicator state**: Tracking scroll position via `scroll` events can be jittery. Use `IntersectionObserver` on each panel instead for more reliable active-panel detection.
5. **Fixed ChatInput on mobile**: The input needs `position: fixed` or `position: sticky` at the bottom of the chat panel, not the viewport. Since the chat panel scrolls vertically (messages) and the parent scrolls horizontally (panels), `sticky` relative to the chat panel container is correct.
6. **No new dependencies**: Confirmed. CSS scroll-snap is widely supported.

**MEDIATOR:**

Decision:
- The swipeable panel container lives at the **chat page level** (`src/app/(protected)/chat/[conversationId]/page.tsx`), not the layout level. On mobile, the sidebar content is extracted from the layout and rendered as the left panel inside the chat page's scroll container.
- Use `useEffect` + `ref.scrollTo` for initial centering on the chat panel. Guard against pre-render with a `requestAnimationFrame` wrapper.
- Use `IntersectionObserver` for active panel detection rather than scroll events.
- ChatInput uses `sticky` positioning at the bottom of the chat panel's vertical scroll area.
- The protected layout's sidebar rendering is conditional: on desktop, it renders normally. On mobile (detected via a `useMediaQuery` hook or Tailwind `md:` classes), the layout hides the sidebar and the chat page renders it as a swipeable panel.
- The dashboard and usage pages do not need the swipeable layout -- they remain single-panel pages.

---

### C-2: Extended Thinking Toggle

**PROPOSER:**

Add extended thinking support across all three providers. The changes span:

**Model config** (`src/constants/models.ts`): Add `supportsThinking: boolean` and `maxThinkingLevel: string | null` to each model entry. Add new models: `o3`, `o4-mini` (OpenAI), `gemini-3.1-pro-preview` (Gemini).

**Provider interface** (`src/lib/providers/types.ts`): Add `LLMRequestOptions` parameter to both `sendMessage` and `streamMessage`. Extend `StreamChunk` with a `thinking` type. Extend `LLMResponse` with `thinkingContent`.

**Provider implementations**:
- Anthropic: Add `thinking: { type: "enabled", budget_tokens: 10000 }` for "high" models, `thinking: { type: "adaptive" }` with `output_config: { effort: "max" }` for Opus. Lock `temperature` to 1, omit `top_k`, ensure `max_tokens > budget_tokens`. Streaming: `thinking_delta` events yield `{ type: 'thinking' }` chunks before `text_delta`.
- OpenAI: Add `reasoning: { effort: "<level>", summary: "auto" }` for o-series models. Omit `temperature` for o-series. Streaming: `response.reasoning_summary_text.delta` events yield thinking chunks.
- Gemini: Add `thinkingConfig: { thinkingLevel: "<level>", includeThoughts: true }` to config. Streaming: parts with `thought: true` yield thinking chunks.

**Node schema**: Add `thinkingContent: string | null` field.

**SSE**: New `event: thinking` SSE event type.

**UI**: Toggle in ChatInput. Collapsible thinking display above assistant response in ChatMessage.

**CRITIC:**

1. **Provider interface break**: Adding `options?: LLMRequestOptions` to `sendMessage` and `streamMessage` is a signature change. All four providers (openai, anthropic, gemini, mock) and all call sites (chat route, auto-title) must be updated. Since the parameter is optional, existing call sites without options will still compile, but auto-title should explicitly pass `{ thinkingEnabled: false }` to avoid waste.
2. **Anthropic temperature constraint**: When thinking is enabled, temperature must be 1. Currently, Anthropic's `sendMessage` and `streamMessage` may set `temperature` explicitly. If they do, that must be conditionally overridden when thinking is on. If they don't set temperature (using the API default), no change needed for non-thinking calls.
3. **OpenAI o-series temperature constraint**: `temperature` is NOT supported on o-series models at all, regardless of whether thinking is enabled. The current OpenAI provider likely passes temperature. This must be conditionally omitted based on model ID. A helper function `isReasoningModel(modelId)` would be clean.
4. **`max_tokens` vs `budget_tokens` for Anthropic**: The spec says `max_tokens` must be greater than `budget_tokens`. The current Anthropic provider uses `max_tokens: 4096`. With `budget_tokens: 10000`, this violates the constraint. When thinking is enabled, `max_tokens` must be bumped to at least `budget_tokens + 4096` = 14096 or higher (e.g., 16384).
5. **Node schema migration**: Adding `thinkingContent: string | null` is backward-compatible (nullable optional field). Existing nodes will have `undefined` which is functionally null. No migration needed.
6. **Export/Import**: `thinkingContent` should be included in JSON exports and restored on import.
7. **Mock provider**: Should mock thinking content when `thinkingEnabled` is true. Yield some canned thinking text before the response.

**MEDIATOR:**

Decision:
- Add `options?: LLMRequestOptions` as an optional third parameter to both `sendMessage` and `streamMessage` on the `LLMProvider` interface. This is backward-compatible.
- Auto-title explicitly passes `{ webSearchEnabled: false, thinkingEnabled: false }`.
- Anthropic: when thinking is enabled, set `temperature: 1` and increase `max_tokens` to 16384. When thinking is disabled, behavior is unchanged.
- OpenAI: create a helper `isReasoningModel(modelId: string): boolean` that checks against known o-series model IDs. When true, omit `temperature`. Note: this helper is also needed for Change 1 (Responses API) since o-series requires `reasoning` instead of `temperature`.
- Node schema: `thinkingContent` defaults to `null`. Included in export/import.
- Mock provider: when thinking is enabled, yield 3 thinking chunks with canned text before the regular response.

---

### C-1: Web Search Capability

**PROPOSER:**

Add web search as a provider-managed server-side tool. The implementation varies by provider:

**OpenAI -- Responses API Migration**: The current OpenAI provider uses the Chat Completions API (`client.chat.completions.create`). Web search as a built-in tool is only available on the Responses API. Migrate the entire OpenAI provider to use `client.responses.create()`.

Key migration changes:
- `messages` parameter becomes `input`.
- System messages go into the `instructions` field instead of a `{ role: "system" }` message.
- Non-streaming response: `response.output_text` for text, `response.output` for structured output items.
- Streaming: event types change from `chunk.choices[0].delta.content` to `response.output_text.delta` events.
- Token fields change from `prompt_tokens`/`completion_tokens` to `input_tokens`/`output_tokens`.
- Web search: add `tools: [{ type: "web_search_preview" }]` when enabled.
- Reasoning: add `reasoning: { effort, summary: "auto" }` for o-series.
- Citations: `annotations` array on text output with `{ type: "url_citation", url, title, start_index, end_index }`.
- Attachments: The Responses API supports file URLs, but inline base64 is different. The `type: "input_image"` block replaces `type: "image_url"`, and `type: "input_file"` replaces `type: "file"` for PDFs. Verify exact format against SDK.

**Anthropic**: Add `tools: [{ type: "web_search_20250305", name: "web_search" }]`. Response includes `ServerToolUseBlock`, `WebSearchToolResultBlock`, and `TextBlock` with `citations`. Extract text from `TextBlock` entries. Track `usage.server_tool_use.web_search_requests`.

**Gemini**: Add `tools: [{ googleSearch: {} }]` to config. Response includes `groundingMetadata` with `groundingChunks` containing source URLs.

**Citations storage and display**: Store citations on the Node as a `citations` field (array of `{ url, title }`). Display as numbered footnote-style links below the message text.

**Context building**: Web search tool-use/result blocks are NOT included in context for subsequent messages. Only the final text is stored in `content`. Citations are stored separately.

**CRITIC:**

1. **OpenAI migration scope is massive**: The entire `openai.ts` provider file is rewritten. Both `sendMessage` and `streamMessage` change fundamentally. The attachment formatting also changes (Responses API uses different content block types). This is the single riskiest change in this feature set.
2. **Attachment format for Responses API**: The Chat Completions API uses `{ type: "image_url", image_url: { url: "data:..." } }` for images and `{ type: "file", file: { filename, file_data: "data:..." } }` for PDFs. The Responses API uses `{ type: "input_image", image_url: "data:..." }` for images and `{ type: "input_file", file_data: "data:...", filename }` for files. The `attachmentFormatter.ts` must be updated for OpenAI's format.
3. **LLMResponse interface**: Both thinking and web search modify `LLMResponse`. Design once: add `thinkingContent`, `webSearchRequestCount`, and `citations` fields.
4. **TokenUsage schema**: Adding `webSearchRequests` to track web search costs. This is a new `$inc` field on the upsert. Backward-compatible since new field defaults to 0.
5. **Interaction between thinking and web search on OpenAI**: For o-series models, `reasoning` and `tools` (web search) can coexist. The response may contain reasoning summaries, web search tool calls, and text output interleaved. The provider must handle all three block types.
6. **Citations on Node schema**: Adding `citations` as an array field is backward-compatible. Existing nodes have no citations (undefined/empty). Export/import must handle this.
7. **SSE event for citations**: The `done` event should include citations. No separate SSE event type needed for citations -- they arrive with the final response.

**MEDIATOR:**

Decision:
- **OpenAI migration**: Full rewrite of `openai.ts` to use the Responses API. This is non-negotiable for web search. The `attachmentFormatter.ts` must also be updated for the new format.
- **LLMResponse and LLMRequestOptions**: Design both interfaces once for this entire feature set (thinking + web search). `LLMRequestOptions` has `webSearchEnabled`, `thinkingEnabled`, `thinkingLevel`. `LLMResponse` has `content`, `thinkingContent`, `provider`, `model`, `inputTokens`, `outputTokens`, `webSearchRequestCount`, `citations`.
- **Node schema**: Add both `thinkingContent: string | null` and `citations: { url: string, title: string }[]` in this feature set.
- **TokenUsage schema**: Add `webSearchRequests: number` field, `$inc`'d alongside token counts.
- **Attachment formatter**: Update OpenAI's format in `attachmentFormatter.ts` to match the Responses API content block types.
- **StreamChunk `done` type**: Extend to include `thinkingContent`, `citations`, and `webSearchRequestCount`.
- **Auto-title**: Explicitly passes `{ webSearchEnabled: false, thinkingEnabled: false }` to avoid unnecessary tool use and cost.

### Cross-Cutting: Combined Provider Interface Design

Both C-1 and C-2 modify the provider interface. The final combined design:

```typescript
// src/lib/providers/types.ts

interface LLMRequestOptions {
  webSearchEnabled?: boolean;
  thinkingEnabled?: boolean;
  thinkingLevel?: string;   // "high", "max", etc.
}

interface LLMProvider {
  name: string;
  sendMessage(messages: LLMMessage[], model: string, options?: LLMRequestOptions): Promise<LLMResponse>;
  streamMessage(messages: LLMMessage[], model: string, options?: LLMRequestOptions): AsyncGenerator<StreamChunk>;
}

interface Citation {
  url: string;
  title: string;
}

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

type StreamChunk =
  | { type: 'thinking'; content: string }
  | { type: 'token'; content: string }
  | { type: 'done'; content: string; thinkingContent: string | null; inputTokens: number; outputTokens: number; webSearchRequestCount: number; citations: Citation[] }
  | { type: 'error'; message: string };
```

---

## 3. Data Model Changes

### 3.1 Modified Collection: Nodes -- Add `thinkingContent` and `citations`

```typescript
// src/models/Node.ts -- ADD fields:

// Add to INode interface:
thinkingContent?: string | null;   // Thinking/reasoning content from the model (assistant nodes only)
citations?: { url: string; title: string }[];  // Web search citations (assistant nodes only)

// Add to NodeSchema:
thinkingContent: { type: String, default: null },
citations: [{
  url: { type: String, required: true },
  title: { type: String, required: true },
  _id: false
}],
```

No index changes needed. Both fields are only read when loading nodes for display, which uses existing indexes.

**Migration**: No migration required. Both fields are optional/nullable. Existing nodes will have `undefined` for both, which is functionally equivalent to `null`/empty-array.

### 3.2 Modified Collection: TokenUsage -- Add `webSearchRequests`

```typescript
// src/models/TokenUsage.ts -- ADD field:

// Add to ITokenUsage interface:
webSearchRequests: number;

// Add to TokenUsageSchema:
webSearchRequests: { type: Number, default: 0 },
```

No index changes. The upsert pattern becomes:

```typescript
await TokenUsage.findOneAndUpdate(
  { userId, model },
  {
    $inc: { inputTokens, outputTokens, callCount: 1, webSearchRequests },
    $set: { provider },
  },
  { upsert: true }
);
```

**Migration**: No migration required. Existing documents will have `webSearchRequests: undefined`, which Mongoose treats as 0 for `$inc` operations. Alternatively, the schema default of 0 handles new documents.

### 3.3 Modified Interface: LLMProvider -- Add `options` parameter

See "Cross-Cutting: Combined Provider Interface Design" in section 2 for the full combined interface. The key changes:

```typescript
// src/lib/providers/types.ts -- MODIFY:

// ADD new interfaces:
interface LLMRequestOptions { ... }
interface Citation { ... }

// MODIFY existing:
// LLMProvider.sendMessage: add third param `options?: LLMRequestOptions`
// LLMProvider.streamMessage: add third param `options?: LLMRequestOptions`
// LLMResponse: add `thinkingContent`, `webSearchRequestCount`, `citations` fields
// StreamChunk: add `thinking` variant, extend `done` variant with new fields
```

### 3.4 No Changes To: Users, Conversations

---

## 4. API Changes

### 4.1 Modified Endpoint: POST `/api/llm/chat` -- Add thinking and web search support

```typescript
// MODIFIED request interface:
interface LLMChatRequest {
  conversationId: string;
  parentNodeId: string | null;
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  model: string;
  attachments?: { filename: string; mimeType: string; data: string; size: number }[];
  webSearchEnabled?: boolean;    // NEW
  thinkingEnabled?: boolean;     // NEW
}
```

SSE event changes:

```
// NEW event type:
event: thinking
data: {"content":"thinking chunk text"}

// MODIFIED done event:
event: done
data: {
  "userNode": { ... },
  "assistantNode": { id, parentId, role, content, provider, model, createdAt, thinkingContent, citations },
  "tokenUsage": { "inputTokens": N, "outputTokens": N, "webSearchRequests": N }
}
```

Route handler changes:
1. Extract `webSearchEnabled` and `thinkingEnabled` from request body.
2. Look up model config to determine `thinkingLevel` (use `maxThinkingLevel` from models.ts).
3. Pass `LLMRequestOptions` to `provider.streamMessage()`.
4. Handle new `thinking` StreamChunk type: write `event: thinking\ndata: ...\n\n`.
5. On `done`: save `thinkingContent` and `citations` on the assistant node. Update TokenUsage with `webSearchRequests`.
6. Auto-title: pass `{ webSearchEnabled: false, thinkingEnabled: false }` to `provider.sendMessage()`.

### 4.2 Modified Endpoint: GET `/api/token-usage`

```typescript
// MODIFIED response:
interface TokenUsageResponse {
  usage: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    callCount: number;
    webSearchRequests: number;   // NEW
  }[];
}
```

### 4.3 Modified Endpoint: GET `/api/conversations/[id]/export`

Include `thinkingContent` and `citations` fields when serializing assistant nodes.

### 4.4 Modified Endpoint: POST `/api/import`

Restore `thinkingContent` and `citations` fields from imported JSON onto nodes.

### 4.5 Unchanged Endpoints

All conversation CRUD, node CRUD, auth, and providers endpoints remain unchanged.

---

## 5. New/Modified Components

### 5.1 New: `ThinkingToggle` component

- **File:** `src/components/chat/ThinkingToggle.tsx`
- **Props:** `{ enabled: boolean; onToggle: () => void; disabled: boolean; modelName?: string }`
- **Behavior:**
  - Renders a toggle button with a Brain icon (from lucide-react).
  - When `disabled` is true (model doesn't support thinking), the toggle is greyed out with `opacity-50 pointer-events-none`.
  - Shows tooltip with model name when disabled: "Not available for [model]".
  - On mobile (below `md`): icon-only. On desktop: icon + "Thinking" label.

### 5.2 New: `WebSearchToggle` component

- **File:** `src/components/chat/WebSearchToggle.tsx`
- **Props:** `{ enabled: boolean; onToggle: () => void }`
- **Behavior:**
  - Renders a toggle button with a Globe icon (from lucide-react).
  - Enabled by default. Click toggles on/off.
  - On mobile: icon-only. On desktop: icon + "Search" label.

### 5.3 New: `ThinkingBlock` component

- **File:** `src/components/chat/ThinkingBlock.tsx`
- **Props:** `{ content: string }`
- **Behavior:**
  - Collapsible section rendered above the assistant's response text.
  - Default state: collapsed.
  - Header: clickable "Thinking..." text with a ChevronDown/ChevronUp icon.
  - Content: muted text (`text-muted-foreground`), slightly smaller font size, indented with a left border accent.
  - Renders thinking content as plain text (not markdown).

### 5.4 New: `CitationList` component

- **File:** `src/components/chat/CitationList.tsx`
- **Props:** `{ citations: { url: string; title: string }[] }`
- **Behavior:**
  - Renders numbered footnote-style links below the message text.
  - Each citation: `[N] title` as a clickable link (`<a>` tag) opening in a new tab.
  - Compact styling: smaller font, muted color, separated from message content by a thin divider.

### 5.5 New: `PanelIndicator` component

- **File:** `src/components/common/PanelIndicator.tsx`
- **Props:** `{ activeIndex: number; count: number }`
- **Behavior:**
  - Renders `count` dots horizontally centered at the bottom of the screen.
  - The dot at `activeIndex` is filled/highlighted. Others are outlined/muted.
  - Only rendered on mobile (hidden on `md:` and above).

### 5.6 Modified: `ChatMessage`

- **File:** `src/components/chat/ChatMessage.tsx`
- **Changes:**
  - If `node.thinkingContent` exists and is non-empty, render `<ThinkingBlock content={node.thinkingContent} />` above the message content.
  - If `node.citations` exists and is non-empty, render `<CitationList citations={node.citations} />` below the message content.
  - During streaming: if `streamingThinkingContent` is provided (from the chat panel), render a ThinkingBlock with that content, showing a pulsing indicator while thinking is in progress.

### 5.7 Modified: `ChatInput`

- **File:** `src/components/chat/ChatInput.tsx`
- **Props changes:** Add `webSearchEnabled`, `onWebSearchToggle`, `thinkingEnabled`, `onThinkingToggle`, `thinkingDisabled` (model doesn't support it), `selectedModel`.
- **Changes:**
  - Add `<WebSearchToggle>` and `<ThinkingToggle>` in a toggles row above or beside the textarea.
  - On mobile (below `md`): toggles show icons only, compact layout.
  - On desktop: toggles show icon + label.
  - The thinking toggle's `disabled` state is derived from the selected model's `supportsThinking` field.

### 5.8 Modified: `ChatPanel`

- **File:** `src/components/chat/ChatPanel.tsx`
- **Changes:**
  - Track `streamingThinkingContent` separately from `streamingContent` in the streaming chat hook.
  - Pass `streamingThinkingContent` to the streaming ChatMessage for live thinking display.
  - Pass `webSearchEnabled`, `thinkingEnabled` toggles through to `ChatInput`.

### 5.9 Modified: `TokenUsageCard`

- **File:** `src/components/dashboard/TokenUsageCard.tsx`
- **Changes:**
  - Display `webSearchRequests` count per model alongside token counts.
  - Format: `"Web searches: N"` after the token breakdown.

### 5.10 Modified: `ModelSelector`

- **File:** `src/components/chat/ModelSelector.tsx`
- **Changes:**
  - Add new models to the displayed list: `o3`, `o4-mini` (OpenAI), `gemini-3.1-pro-preview` (Gemini).
  - These are driven by the updated `MODELS` constant, so the selector itself only needs to render whatever models are in the config.

### 5.11 Modified: Chat page (responsive layout)

- **File:** `src/app/(protected)/chat/[conversationId]/page.tsx`
- **Changes:**
  - On mobile (below `md`): wrap the conversation sidebar, chat panel, and tree sidebar in a horizontal scroll-snap container.
  - Each panel is `100vw` wide on mobile, snapping to boundaries.
  - Default to the center panel (chat) on mount.
  - Render `<PanelIndicator>` at the bottom on mobile.
  - On desktop: render the existing layout unchanged.

### 5.12 Modified: Protected layout (sidebar extraction for mobile)

- **File:** `src/app/(protected)/layout.tsx`
- **Changes:**
  - The sidebar (`ConversationList`) is conditionally rendered based on viewport. On desktop: normal sidebar behavior. On mobile: the sidebar content is not rendered in the layout (it moves to the chat page's swipeable container).
  - Use a shared state or prop to signal whether the sidebar should render at the layout level.

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/components/chat/ThinkingToggle.tsx` | Toggle for extended thinking in ChatInput area |
| `src/components/chat/WebSearchToggle.tsx` | Toggle for web search in ChatInput area |
| `src/components/chat/ThinkingBlock.tsx` | Collapsible display of thinking/reasoning content above assistant messages |
| `src/components/chat/CitationList.tsx` | Numbered footnote-style citation links below assistant messages |
| `src/components/common/PanelIndicator.tsx` | Dot indicators for mobile swipeable panel navigation |

---

## 7. Modified Files

| File | Delta Description |
|------|-------------------|
| **Constants** | |
| `src/constants/models.ts` | Add `supportsThinking` and `maxThinkingLevel` fields to all model entries. Add new models: `o3`, `o4-mini` (OpenAI), `gemini-3.1-pro-preview` (Gemini). Full updated config in Section 2 (from the stage prompt). |
| **Provider Layer** | |
| `src/lib/providers/types.ts` | Add `LLMRequestOptions`, `Citation` interfaces. Add `thinking` variant to `StreamChunk`. Extend `done` variant. Add `options?` param to `sendMessage`/`streamMessage`. Extend `LLMResponse` with `thinkingContent`, `webSearchRequestCount`, `citations`. |
| `src/lib/providers/openai.ts` | **Full rewrite.** Migrate from Chat Completions API to Responses API. Both `sendMessage` and `streamMessage` use `client.responses.create()`. Handle `instructions` field (replaces system role), `input` field (replaces messages), new streaming event types (`response.output_text.delta`, `response.reasoning_summary_text.delta`), new token field names (`input_tokens`/`output_tokens`). Add web search tool (`web_search_preview`). Add reasoning params for o-series. Extract citations from `annotations`. Add `isReasoningModel()` helper. |
| `src/lib/providers/anthropic.ts` | Add `options` param. When `thinkingEnabled`: add `thinking` config, set `temperature: 1`, increase `max_tokens` to 16384. When `webSearchEnabled`: add `tools: [{ type: "web_search_20250305", name: "web_search" }]`. Handle `thinking` blocks in response. Handle `server_tool_use`/`web_search_tool_result` blocks. Extract citations from `TextBlock.citations`. Track `usage.server_tool_use.web_search_requests`. Streaming: yield `thinking` chunks from `thinking_delta` events. |
| `src/lib/providers/gemini.ts` | Add `options` param. When `thinkingEnabled`: add `thinkingConfig: { thinkingLevel, includeThoughts: true }` to config. When `webSearchEnabled`: add `tools: [{ googleSearch: {} }]` to config. Handle `thought: true` parts. Extract citations from `groundingMetadata.groundingChunks`. Streaming: yield `thinking` chunks from thought-flagged parts. |
| `src/lib/providers/mock.ts` | Add `options` param. When `thinkingEnabled`: yield canned thinking chunks. When `webSearchEnabled`: include mock citations in response. |
| `src/lib/providers/attachmentFormatter.ts` | Update OpenAI format for Responses API: `type: "input_image"` with `image_url` string (replaces `type: "image_url"` with nested object), `type: "input_file"` with `file_data` and `filename` (replaces `type: "file"` with nested object). Anthropic and Gemini formats unchanged. |
| **API Routes** | |
| `src/app/api/llm/chat/route.ts` | Extract `webSearchEnabled`/`thinkingEnabled` from request body. Look up model config for `thinkingLevel`. Build `LLMRequestOptions`. Pass to `streamMessage`. Handle `thinking` StreamChunk: emit `event: thinking` SSE. On `done`: save `thinkingContent`, `citations` on assistant node, `$inc: { webSearchRequests }` on TokenUsage. Auto-title: pass `{ webSearchEnabled: false, thinkingEnabled: false }`. |
| `src/app/api/token-usage/route.ts` | Include `webSearchRequests` in response. |
| `src/app/api/conversations/[id]/export/route.ts` | Include `thinkingContent` and `citations` fields in exported nodes. |
| `src/app/api/import/route.ts` | Restore `thinkingContent` and `citations` from imported JSON. |
| **Models** | |
| `src/models/Node.ts` | Add `thinkingContent` (String, default null) and `citations` (subdocument array, `_id: false`) to schema. |
| `src/models/TokenUsage.ts` | Add `webSearchRequests` (Number, default 0) to schema. |
| **Components** | |
| `src/components/chat/ChatMessage.tsx` | Render `ThinkingBlock` above content when `thinkingContent` is present. Render `CitationList` below content when `citations` is present. Handle streaming thinking content. |
| `src/components/chat/ChatInput.tsx` | Add `WebSearchToggle` and `ThinkingToggle`. Compact mobile layout for toggles. New props for toggle states and handlers. |
| `src/components/chat/ChatPanel.tsx` | Track `streamingThinkingContent`. Pass toggle states. Send `webSearchEnabled`/`thinkingEnabled` in streaming request. |
| `src/components/dashboard/TokenUsageCard.tsx` | Display `webSearchRequests` per model. |
| `src/components/chat/ModelSelector.tsx` | No code changes needed if it reads from `MODELS` constant dynamically. Verify it renders new models. |
| **Pages** | |
| `src/app/(protected)/chat/[conversationId]/page.tsx` | Responsive layout: mobile scroll-snap container wrapping three panels. Desktop layout unchanged. `PanelIndicator`. Initial scroll to center panel. Pass `webSearchEnabled`/`thinkingEnabled` state to ChatPanel. |
| `src/app/(protected)/layout.tsx` | Mobile: conditionally hide sidebar (rendered in chat page instead). Desktop: unchanged. |
| **Hooks** | |
| `src/hooks/useStreamingChat.ts` | Accumulate `streamingThinkingContent` from `thinking` SSE events. Include in the state exposed to ChatPanel. Send `webSearchEnabled`/`thinkingEnabled` in the fetch body. |
| **Styles** | |
| `src/app/globals.css` | Add scroll-snap styles for mobile panel layout. Add responsive utility classes. |
| **Contexts** | |
| `src/contexts/UIContext.ts` | Add `webSearchEnabled` (default: true), `thinkingEnabled` (default: false) fields. |
| `src/components/providers/UIProvider.tsx` | Add state + dispatch for `webSearchEnabled` and `thinkingEnabled` toggles. Reset `thinkingEnabled` to false when selected model doesn't support thinking. |
| **Types** | |
| `src/types/database.ts` | Add `thinkingContent?: string \| null` and `citations?: { url: string; title: string }[]` to node type. |
| `src/types/api.ts` | Update `LLMChatRequest` with `webSearchEnabled?` and `thinkingEnabled?`. Add `thinkingContent`, `citations`, `webSearchRequests` to SSE done event type. |
| `src/types/export.ts` | Add `thinkingContent?` and `citations?` to exported node type. |
| **Tests** | |
| `__tests__/api/llm-chat.test.ts` | Add tests for thinking chunks in SSE, web search disabled for auto-title, citations in done event, webSearchRequests tracking. Update mock provider calls to match new signature. |
| `__tests__/lib/providers/anthropic.test.ts` | Add tests for thinking params, web search tool, citation extraction. |
| `__tests__/lib/providers/attachmentFormatter.test.ts` | Update OpenAI format assertions for Responses API block types. |
| `__tests__/api/import-export.test.ts` | Add tests for thinkingContent and citations in export/import. |

---

## 8. Deleted Files / Dead Code

No files are deleted in this feature set.

The OpenAI provider (`openai.ts`) is fully rewritten (Responses API replaces Chat Completions API), but the file itself is not deleted -- it is modified in place.

---

## 9. Environment Variables

### No New Environment Variables

All changes use existing API keys and configuration. Web search, extended thinking, and responsive layout require no new env vars.

### No Removed Environment Variables

### Unchanged

`MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`.

---

## 10. State Management Changes

### UIContext -- Added Fields

```typescript
// src/contexts/UIContext.ts -- ADD:
webSearchEnabled: boolean;   // default: true
thinkingEnabled: boolean;    // default: false

// New actions:
type UIAction =
  | ...existing...
  | { type: 'TOGGLE_WEB_SEARCH' }
  | { type: 'TOGGLE_THINKING' }
  | { type: 'SET_THINKING_ENABLED'; payload: boolean };
```

The `SET_THINKING_ENABLED` action is used to programmatically disable thinking when the user switches to a model that doesn't support it.

### UIProvider -- New Behavior

When `selectedModel` changes, check the new model's `supportsThinking` flag. If `false`, dispatch `SET_THINKING_ENABLED` with `false`.

### ConversationContext -- No Changes

Streaming state for thinking content is managed in the `useStreamingChat` hook via local state, same pattern as existing `streamingContent`.

### useStreamingChat Hook -- Extended State

```typescript
// Managed internally, not in context:
{
  streamingContent: string;                // UNCHANGED
  streamingThinkingContent: string;        // NEW -- accumulated thinking chunks
  streamingState: 'idle' | 'streaming' | 'error';  // UNCHANGED
  streamingError: string | null;           // UNCHANGED
  abortController: AbortController | null; // UNCHANGED
}
```

---

## 11. Migration Checklist

Ordered steps to go from current state (v3) to new state (v4):

1. **Update CLAUDE.md** -- First task. Reflect all changes from this delta document.
2. **Models config update** (foundation for C-2 and C-1):
   a. Update `src/constants/models.ts` to add `supportsThinking`, `maxThinkingLevel` fields to all existing models, and add new models (`o3`, `o4-mini`, `gemini-3.1-pro-preview`).
3. **Provider interface update** (foundation for C-2 and C-1):
   a. Add `LLMRequestOptions`, `Citation` interfaces to `types.ts`.
   b. Add `options?` parameter to `sendMessage`/`streamMessage` on `LLMProvider`.
   c. Extend `StreamChunk` with `thinking` type. Extend `done` variant.
   d. Extend `LLMResponse` with `thinkingContent`, `webSearchRequestCount`, `citations`.
4. **Responsive layout** (C-3):
   a. Add scroll-snap CSS to `globals.css`.
   b. Create `PanelIndicator` component.
   c. Modify chat page for mobile swipeable layout.
   d. Modify protected layout to conditionally hide sidebar on mobile.
   e. Adjust `ChatInput` for compact mobile toggles.
5. **Extended thinking -- backend** (C-2):
   a. Add `thinkingContent` field to Node schema.
   b. Implement thinking in Anthropic provider (thinking config, temperature lock, max_tokens bump, thinking delta handling).
   c. Implement thinking in Gemini provider (thinkingConfig, thought-flagged parts).
   d. Implement thinking in Mock provider (canned thinking chunks).
   e. Note: OpenAI thinking (reasoning) is deferred to step 7 since it requires the Responses API migration.
6. **Extended thinking -- frontend** (C-2):
   a. Add `thinkingEnabled` to UIContext/UIProvider with model-aware auto-disable.
   b. Create `ThinkingToggle` component.
   c. Create `ThinkingBlock` component.
   d. Update `ChatInput` with ThinkingToggle.
   e. Update `ChatMessage` with ThinkingBlock rendering.
   f. Update `useStreamingChat` to handle `thinking` SSE events and accumulate `streamingThinkingContent`.
   g. Update `ChatPanel` to pass thinking content to streaming message.
7. **Web search + OpenAI migration -- backend** (C-1):
   a. Add `webSearchRequests` to TokenUsage schema.
   b. Add `citations` field to Node schema (if not already done in step 5a).
   c. **Rewrite `openai.ts`** to use Responses API. Implement both `sendMessage` and `streamMessage`. Handle `instructions` field, `input` field, new streaming events, reasoning params for o-series, web search tool, citation extraction.
   d. Update `attachmentFormatter.ts` for OpenAI Responses API format (`input_image`, `input_file`).
   e. Add web search to Anthropic provider (tools array, citation extraction, web search request tracking).
   f. Add web search to Gemini provider (googleSearch tool, groundingMetadata citation extraction).
   g. Add web search to Mock provider (mock citations).
   h. Update auto-title call to pass `{ webSearchEnabled: false, thinkingEnabled: false }`.
8. **Web search -- frontend** (C-1):
   a. Add `webSearchEnabled` to UIContext/UIProvider.
   b. Create `WebSearchToggle` component.
   c. Create `CitationList` component.
   d. Update `ChatInput` with WebSearchToggle.
   e. Update `ChatMessage` with CitationList rendering.
   f. Update `useStreamingChat` to send `webSearchEnabled`/`thinkingEnabled` in fetch body.
9. **API route updates** (cross-cutting):
   a. Update `POST /api/llm/chat`: extract new request fields, pass options, handle thinking chunks, save thinkingContent/citations, track webSearchRequests.
   b. Update `GET /api/token-usage`: include webSearchRequests.
   c. Update export route: include thinkingContent/citations.
   d. Update import route: restore thinkingContent/citations.
10. **Token usage display** (C-1):
    a. Update `TokenUsageCard` to show webSearchRequests.
11. **Update types** (cross-cutting):
    a. `src/types/database.ts` -- add thinkingContent, citations to node type.
    b. `src/types/api.ts` -- update LLMChatRequest, SSE event types.
    c. `src/types/export.ts` -- add thinkingContent, citations to exported node.
12. **Update tests**:
    a. Update provider tests for new options parameter.
    b. Add thinking and web search tests for each provider.
    c. Update llm-chat route tests for new SSE events and request fields.
    d. Update attachment formatter tests for OpenAI Responses API format.
    e. Update export/import tests for new node fields.

---

## 12. Implementation Gotchas

### Carried forward from v3 (still relevant):

1. **Middleware uses explicit URL paths, not route groups.** No new pages in this feature set, so the matcher (`'/dashboard'`, `'/chat/:path*'`, `'/usage'`) is unchanged.

2. **`VALID_PROVIDERS` lives in `src/constants/providers.ts`** (migrated in v2.1). Provider validation uses this constant.

3. **UIProvider `refreshProviders` stale-closure fix** -- uses `useRef`. Do not break this when adding new state fields to UIContext.

4. **Orphaned user node cleanup** -- Unchanged. The streaming error handling (partial vs no content) from v3 is preserved.

5. **Gemini system prompts** go in `config.systemInstruction`. When adding `tools` and `thinkingConfig` to the config parameter, ensure `systemInstruction` is not displaced.

6. **Anthropic `client.messages.stream()` returns `MessageStream`** -- use `.on('text', ...)` and `.finalMessage()`. When adding thinking support, listen for `thinking` content block events (type `content_block_start` with `type: "thinking"`, then `content_block_delta` with `delta.type === "thinking_delta"`).

7. **Streaming + caching + attachments + thinking + web search all interact in the provider layer.** For Anthropic `streamMessage`, the build order is:
   - Separate system messages for the `system` param.
   - Build the `messages` array with attachments formatted as content blocks.
   - Add `cache_control` breakpoints to system prompt and last message.
   - Add `thinking` config if enabled (constraints: temperature=1, max_tokens=16384).
   - Add `tools` array if web search enabled.
   - Start the stream.

### New for v4:

8. **OpenAI Responses API migration -- attachment format change.** The Chat Completions API uses `{ type: "image_url", image_url: { url: "data:..." } }` for images. The Responses API uses `{ type: "input_image", image_url: "data:..." }` (note: flat string, not nested object). For PDFs, Chat Completions uses `{ type: "file", file: { filename, file_data } }`. Responses API uses `{ type: "input_file", file_data, filename }` (flat structure). The `attachmentFormatter.ts` must be updated for OpenAI ONLY. Anthropic and Gemini formats are unchanged.

9. **OpenAI Responses API -- `input` field format.** The Responses API accepts messages in a slightly different format than Chat Completions. The `input` field accepts an array of objects with `role` and `content`, similar to Chat Completions but with `role: "developer"` replacing `role: "system"`. Alternatively, use the `instructions` field for system prompts (preferred). The `sendMessage`/`streamMessage` methods must map the `LLMMessage[]` array accordingly.

10. **OpenAI o-series models -- temperature incompatibility.** The o3 and o4-mini models do NOT support `temperature`. If the provider currently passes `temperature` in the request, it must be conditionally omitted when the model is o-series. Use `isReasoningModel()` helper.

11. **Anthropic thinking + max_tokens constraint.** When thinking is enabled, `max_tokens` must be greater than `budget_tokens`. With `budget_tokens: 10000` and current `max_tokens: 4096`, the constraint is violated. Bump `max_tokens` to 16384 when thinking is enabled.

12. **Anthropic extended thinking for Opus (`maxThinkingLevel: "max"`).** Uses `thinking: { type: "adaptive" }` with `output_config: { effort: "max" }` instead of the `budget_tokens` approach. This is a different API shape from the "high" thinking level.

13. **Gemini thinking level values.** For Gemini 3 models, use discrete string levels: `"minimal"`, `"low"`, `"medium"`, `"high"`. Do NOT use numeric `thinkingBudget` (that is for Gemini 2.5 only).

14. **Web search context isolation.** Web search tool-use and tool-result blocks must NOT be included in the context for subsequent messages. Only the final text content is stored in `Node.content`. The search results are ephemeral. When building context via `contextBuilder.ts`, this is already handled because only `Node.content` is read.

15. **Gemini web search citations location.** Citations are in `response.candidates[0].groundingMetadata.groundingChunks`, NOT in the regular response parts. Each `groundingChunk` has a `web` property with `{ uri, title }`. Map `uri` to `url` for the `Citation` interface.

16. **Anthropic web search citations.** Response `TextBlock` entries may contain a `citations` array. Each citation has `{ type: "web_search_result_location", url, title, cited_text }`. Extract `url` and `title` only.

17. **OpenAI web search citations.** Text output items have an `annotations` array with `{ type: "url_citation", url, title, start_index, end_index }`. Extract `url` and `title`.

18. **OpenAI Responses API streaming events.** The event model is different from Chat Completions. Key events:
    - `response.output_text.delta` -- text content deltas (replaces `choices[0].delta.content`).
    - `response.reasoning_summary_text.delta` -- reasoning summary deltas (only for o-series with `summary: "auto"`).
    - `response.completed` -- final event with full `response` object including `usage`.
    - Token usage: `response.usage.input_tokens` and `response.usage.output_tokens` (NOT `prompt_tokens`/`completion_tokens`).

19. **CSS scroll-snap container setup.** The horizontal scroll container must have `overflow-x: auto` (not `scroll`), `scroll-snap-type: x mandatory`, and `-webkit-overflow-scrolling: touch` for iOS momentum scrolling. Each child panel needs `scroll-snap-align: start` and `min-width: 100vw`. Use `flex-shrink: 0` on panels to prevent compression.

20. **Mobile viewport height.** On mobile browsers, `100vh` includes the address bar. Use `100dvh` (dynamic viewport height) for the scroll container height to account for mobile browser chrome.

21. **IntersectionObserver for panel detection.** Create one observer with `threshold: 0.5` on each panel element. When a panel's intersection ratio exceeds 0.5, it becomes the active panel. This is more reliable than scroll-position math.

---

## 13. Package Version Notes and Task Builder Warnings

### 13.1 `openai` -- Pinned at `^6.33.0`

**Responses API availability**: The Responses API (`client.responses.create()`) was introduced in the OpenAI Node.js SDK around v4.85+ and is stable in v6.x. Key differences from Chat Completions:

- Method: `client.responses.create()` (NOT `client.chat.completions.create()`)
- System messages: Use `instructions` parameter (string) instead of `{ role: "system" }` in messages
- Messages field: `input` (replaces `messages`)
- Token usage fields: `input_tokens`/`output_tokens` (NOT `prompt_tokens`/`completion_tokens`)
- Streaming: pass `stream: true` in the params. Returns an async iterable of SSE events. Text deltas arrive as `response.output_text.delta` events.
- Web search: `tools: [{ type: "web_search_preview" }]`
- Reasoning: `reasoning: { effort: "high", summary: "auto" }` for o-series models
- Attachments: `{ type: "input_image", image_url: "data:..." }` for images, `{ type: "input_file", file_data: "data:...", filename: "..." }` for files

**o-series model constraints:**
- `temperature` is NOT supported -- omit entirely
- `reasoning` parameter replaces temperature-based control
- Compatible with `tools` (web search) simultaneously

### 13.2 `@anthropic-ai/sdk` -- Pinned at `^0.80.0`

**Extended thinking API** (verified for SDK 0.80.x):
- `thinking: { type: "enabled", budget_tokens: N }` -- enables thinking with a token budget
- `thinking: { type: "adaptive" }` with `output_config: { effort: "max" }` -- adaptive thinking for highest-capability models
- Constraints: `temperature` must be 1, `top_k` incompatible, `max_tokens` must exceed `budget_tokens`
- Response: content array includes `{ type: "thinking", thinking: "..." }` blocks before `{ type: "text", text: "..." }` blocks
- Streaming: `content_block_start` with `type: "thinking"`, then `content_block_delta` with `delta.type === "thinking_delta"` and `delta.thinking` field

**Web search tool** (verified for SDK 0.80.x):
- `tools: [{ type: "web_search_20250305", name: "web_search" }]` -- server-side tool, no client tool loop
- Response includes `ServerToolUseBlock` (`type: "server_tool_use"`), `WebSearchToolResultBlock` (`type: "web_search_tool_result"`), and `TextBlock` (`type: "text"`)
- `TextBlock` entries may have `citations` array
- Usage: `usage.server_tool_use.web_search_requests` (number of search requests made)

### 13.3 `@google/genai` -- Pinned at `^1.47.0`

**Extended thinking** (verified for `@google/genai` 1.47.x):
- `config.thinkingConfig: { thinkingLevel: "high", includeThoughts: true }` -- discrete levels for Gemini 3 models
- Valid `thinkingLevel` values for Gemini 3: `"minimal"`, `"low"`, `"medium"`, `"high"`
- Do NOT use `thinkingBudget` (numeric) -- that is Gemini 2.5 only
- Response: parts with `thought: true` flag appear before regular parts
- Streaming: thought parts arrive first with `thought: true` on the part object
- Use `chunk.text` getter which automatically excludes thought parts from the text output

**Google Search grounding** (verified for `@google/genai` 1.47.x):
- `config.tools: [{ googleSearch: {} }]` -- enables Google Search grounding
- Response: `response.candidates[0].groundingMetadata` contains:
  - `searchEntryPoint` -- the search query used
  - `groundingChunks` -- array of `{ web: { uri, title } }` objects (citations)
- Streaming: `groundingMetadata` is available on the final chunk

### 13.4 Cross-Provider Token and Feature Matrix

| Feature | Anthropic | OpenAI (Responses API) | Gemini |
|---------|-----------|----------------------|--------|
| Thinking param | `thinking: { type, budget_tokens }` | `reasoning: { effort, summary }` | `thinkingConfig: { thinkingLevel }` |
| Thinking in response | `{ type: "thinking" }` blocks | `type: "reasoning"` output items | Parts with `thought: true` |
| Thinking streaming | `thinking_delta` events | `reasoning_summary_text.delta` | Thought-flagged parts first |
| Web search param | `tools: [{ type: "web_search_20250305" }]` | `tools: [{ type: "web_search_preview" }]` | `tools: [{ googleSearch: {} }]` |
| Citations location | `TextBlock.citations[]` | `annotations[]` on text output | `groundingMetadata.groundingChunks[]` |
| Citation fields | `{ url, title, cited_text }` | `{ url, title, start_index, end_index }` | `{ web: { uri, title } }` |
| Search cost tracking | `usage.server_tool_use.web_search_requests` | Count `web_search_call` items in output | 1 if `groundingMetadata` present |
| Temperature with thinking | Must be 1 | Not supported on o-series | Default (1.0) |
| Attachment format | `image` source, `document` source | `input_image`, `input_file` | `inlineData` |
