# Architecture Delta Document — Feature Set 2

---

## 1. Change Classification

| # | Change | Classification |
|---|--------|---------------|
| F-20 | Streaming Responses | Architectural shift — replaces request/response pattern with SSE streaming across provider layer, API routes, and frontend rendering |
| F-21 | Prompt Caching (Claude-only active) | API change — localized to Claude provider service file |
| F-22 | File Attachments | Cross-cutting — new schema field, upload UX, provider-specific formatting, tree context, export/import |
| F-23 | Per-Model Token Usage | API/Schema change — modified collection key, usage page update |
| F-24 | Copy Message Markdown Button | UI-only — no backend, schema, or API changes |

Implementation order follows this table (streaming foundational → caching localized → attachments builds on streaming → token usage independent → copy button trivial).

---

## 2. Deliberation Transcripts

### F-20: Streaming Responses

**PROPOSER:**

Replace the synchronous LLM call in `POST /api/llm/chat` with an SSE streaming response. The changes span three layers:

**Provider layer** (`src/lib/providers/`): Change `LLMProvider.sendMessage()` to return an async generator (`AsyncGenerator<StreamChunk>`) instead of `Promise<LLMResponse>`. Each provider normalizes its native streaming API into a common `StreamChunk` type:

```typescript
type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; content: string; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string };
```

- **Anthropic**: Use `client.messages.stream()` which returns a `MessageStream`. Iterate with `for await (const event of stream)`, extract text from `event.type === 'content_block_delta'` → `event.delta.text`. On `message_stop`, get final message via `stream.finalMessage()` for `usage.input_tokens` / `usage.output_tokens`.
- **OpenAI**: Use `client.chat.completions.create({ stream: true, stream_options: { include_usage: true } })` which returns `Stream<ChatCompletionChunk>`. Iterate chunks, extract `chunk.choices[0]?.delta?.content`. The final usage-only chunk has `choices: []` (empty) and `chunk.usage` with fields **`prompt_tokens` / `completion_tokens`** (NOT `input_tokens`/`output_tokens` — OpenAI uses different field names than Anthropic). The provider must map these to the normalized `inputTokens`/`outputTokens` in `StreamChunk`.
- **Gemini**: Use `ai.models.generateContentStream()` which returns an async iterable. Extract text via the `chunk.text` getter property (NOT `chunk.candidates[0].content.parts[0].text` — the raw path throws on safety-filtered responses where `candidates` is undefined). Token usage is on `chunk.usageMetadata` (each chunk carries it; the final chunk has cumulative totals) with fields `promptTokenCount` / `candidatesTokenCount`.
- **Mock**: Yield the canned response character-by-character with 10ms delays to simulate streaming. Yield `done` with estimated tokens.

**API route** (`src/app/api/llm/chat/route.ts`): Instead of returning `Response.json(...)`, return a `new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream', ... } })`. The route creates a `ReadableStream` that:
1. Saves user node to DB (before streaming starts).
2. Iterates the provider's async generator.
3. For each `token` chunk, writes `event: token\ndata: {"content":"..."}\n\n`.
4. Accumulates full response text server-side.
5. On `done`: saves assistant node to DB, updates token usage, triggers auto-title if applicable, writes `event: done\ndata: {"nodeId":"...","content":"...","inputTokens":...,"outputTokens":...}\n\n`.
6. On error mid-stream: if content was partially received, saves partial content as assistant node, sends `event: error\n...`. If no content received, deletes user node (existing orphan cleanup).

**Frontend** (`ChatPanel.tsx`, `ChatInput.tsx`, new `useStreamingChat` hook): Replace the current `fetch` + `await response.json()` with a `fetch` + `ReadableStream` reader pattern. A new `useStreamingChat` hook manages:
- The streaming state (`idle`, `streaming`, `error`).
- A progressive `streamingContent` string that the `ChatMessage` component renders.
- An `AbortController` for cleanup on unmount or navigation.
- Disabling the input while streaming.
- On `done` event: dispatches the final node to `ConversationContext` reducer.

**CRITIC:**

1. **Interface break**: Changing `sendMessage` from `Promise<LLMResponse>` to `AsyncGenerator<StreamChunk>` is a breaking change. Every call site (LLM chat route, auto-title) must be updated. The auto-title call doesn't need streaming — it's fire-and-forget and wants the full response. Should we have two methods?
2. **Auto-title interaction**: Auto-title currently calls `provider.sendMessage()` and awaits the full response. If `sendMessage` now returns a generator, auto-title would need to consume the entire stream just to get the title text. This is wasteful.
3. **`maxDuration` on the route**: The current route has `export const maxDuration = 60`. SSE streaming keeps the connection alive. For local deployment this is fine (Node.js, no serverless timeout), but the export should remain for documentation purposes.
4. **Backpressure**: If the client disconnects mid-stream, the server should detect this and abort the provider stream. The `ReadableStream` cancel callback can handle this.
5. **Testing**: The existing `llm-chat.test.ts` tests expect JSON responses. All 16 tests need rewriting to handle SSE streams. This is significant test surface.
6. **Markdown rendering during streaming**: `react-markdown` will re-render on every chunk. This could be expensive. Consider throttling updates (e.g., batch chunks every 50ms into a single setState call) or using `requestAnimationFrame`.

**MEDIATOR:**

Decision:
- **Two methods on the provider interface**: Keep `sendMessage()` as a non-streaming method returning `Promise<LLMResponse>` for use cases that need the full response (auto-title). Add a new `streamMessage()` method returning `AsyncGenerator<StreamChunk>` for the chat route. Providers implement both — `sendMessage` can internally consume the stream, or use the non-streaming API call. This avoids breaking auto-title and keeps the interface clean.
- **Throttled rendering**: The `useStreamingChat` hook should batch incoming tokens and update state at most every 50ms (via `requestAnimationFrame` or a simple interval) to avoid excessive re-renders.
- **Client disconnect handling**: Use `ReadableStream`'s `cancel` callback to signal an `AbortController` that aborts the provider stream.
- **`maxDuration`**: Keep as-is. Local deployment means no serverless timeout concern.
- **Tests**: Rewrite LLM chat tests to consume SSE streams. Use a helper that reads the stream and collects events into an array for assertion.

---

### F-22: File Attachments

**PROPOSER:**

Add an `attachments` array field to the `Node` schema. Files are stored as base64 in MongoDB. The upload flow:

1. User selects files via a paperclip button or drag-and-drop onto the chat input.
2. Client validates: max 5 files, max 10MB each, allowed MIME types only.
3. Files are read as base64 and included in the POST body to `/api/llm/chat`.
4. Server validates again (size, type, count), saves attachments on the user node.
5. When building the message array for the provider, attachments from all nodes in the path are formatted per-provider.
6. Provider-specific content blocks are constructed in a new `formatAttachments()` utility.

The `LLMChatRequest` interface gains an `attachments` field. The SSE streaming response is unaffected (attachments are input-only).

For export/import: attachments are included as base64 in the JSON export. Import restores them onto nodes.

**CRITIC:**

1. **MongoDB 16MB document limit**: A single node with 5 × 10MB files = ~66.5MB in base64. This exceeds the 16MB limit by ~4x. The per-file limit of 10MB and per-message limit of 5 files does NOT provide safety margin — it blows past it. We need a **per-message total size limit**, not just per-file.
2. **Request body size**: Next.js App Router route handlers have NO configurable body size limit (the Pages Router `bodyParser.sizeLimit` config does not exist in App Router). For local deployment, Node.js has no default limit, but a manual `Content-Length` check should be implemented in the route handler to reject oversized payloads.
3. **Memory pressure**: Storing 10MB base64 strings in MongoDB documents and loading them into memory when building context for every subsequent message means memory usage grows linearly with conversation depth × attachment size. Long conversations with many attachments could cause OOM.
4. **Export file size**: A conversation with many file attachments could produce a multi-hundred-MB JSON export. This is impractical for sharing.
5. **Token cost**: File attachments are re-sent with every message (providers are stateless). A 10MB PDF attached early in a conversation gets sent on every subsequent request. This could be extremely expensive in tokens.

**MEDIATOR:**

Decision — adopt the design with these safety refinements:
- **Per-message total attachment size limit: 20MB** (pre-base64). This keeps the base64 total under ~27MB, well within MongoDB's 16MB limit for a single node when you account for the overhead of other fields (content, metadata) — wait, 27MB > 16MB. Let me recalculate.
  
  Actually, the Critic is right. Let's set **per-file: 5MB, per-message: 5 files, total per-message: 10MB** (pre-base64 = ~13.3MB base64). With node metadata overhead, this stays under 16MB.

- **Next.js body size**: App Router route handlers have no built-in body parser or configurable size limit. For local deployment, implement a manual `Content-Length` check in the route handler (reject >20MB). This is sufficient since Node.js has no default body limit.
- **Memory/token cost warning**: Document this as a known tradeoff. Users are warned in the UI when attaching files that attachments increase cost on every subsequent message. No enforcement — just informational.
- **Export**: Include attachments. Large exports are an accepted tradeoff for self-contained portability.
- **Upload approach**: Use `request.json()` with base64-encoded files in the JSON body. This is simpler than `formData` and keeps the request format consistent. The manual size check guards against abuse.

Final limits: **5MB per file, 5 files per message, 10MB total per message (pre-base64)**.

---

## 3. Data Model Changes

### 3.1 Modified Collection: Nodes — Add `attachments` field

```typescript
// src/models/Node.ts — ADD optional field:
interface Attachment {
  filename: string;       // Original filename
  mimeType: string;       // e.g., "image/png", "application/pdf", "text/plain"
  data: string;           // Base64-encoded file content
  size: number;           // Original file size in bytes (pre-base64)
}

// Add to INode interface:
attachments?: Attachment[];  // Optional, only present on nodes with file attachments

// Add to NodeSchema:
attachments: [{
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  data: { type: String, required: true },
  size: { type: Number, required: true },
  _id: false  // Don't generate _id for subdocuments
}]
```

No index changes — attachments are only read when loading nodes for context building, which already uses `{ conversationId: 1 }`.

### 3.2 Modified Collection: TokenUsage — Change key from provider to model

```typescript
// src/models/TokenUsage.ts — MODIFIED:
export interface ITokenUsage extends Document {
  _id: string;
  userId: Types.ObjectId;
  model: string;           // CHANGED from 'provider' — e.g., "claude-sonnet-4-5-20250929"
  provider: string;        // KEPT as metadata — e.g., "anthropic"
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  updatedAt: Date;
}

// Index changes:
// REMOVE: { userId: 1, provider: 1 } unique
// ADD:    { userId: 1, model: 1 } unique compound
// ADD:    { userId: 1, provider: 1 } non-unique (for aggregation queries)
```

**Migration**: Drop existing `TokenUsage` documents (informational data only, not critical). Simplest approach: `db.tokenusages.drop()`. The new schema will auto-create with the first LLM call.

### 3.3 Modified Interface: LLMProvider — Add `streamMessage` method

```typescript
// src/lib/providers/types.ts — ADD:

type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; content: string; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string };

// ADD to LLMProvider interface:
interface LLMProvider {
  name: string;
  sendMessage(messages: LLMMessage[], model: string): Promise<LLMResponse>;         // UNCHANGED
  streamMessage(messages: LLMMessage[], model: string): AsyncGenerator<StreamChunk>; // NEW
}
```

### 3.4 Modified Interface: LLMMessage — Support multi-part content

```typescript
// src/lib/providers/types.ts — ADD:

interface LLMAttachment {
  filename: string;
  mimeType: string;
  data: string;       // base64
}

// MODIFY LLMMessage:
interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: LLMAttachment[];  // NEW — only on user messages
}
```

### 3.5 No Changes To: Users, Conversations

---

## 4. API Changes

### 4.1 Modified Endpoint: POST `/api/llm/chat` — Streaming SSE response

**This is the most significant API change.** The endpoint changes from returning JSON to returning an SSE stream.

```typescript
// BEFORE (v2.1):
// Returns: Response.json({ userNode, assistantNode })

// AFTER (v3):
// Returns: new Response(readableStream, {
//   headers: {
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     'Connection': 'keep-alive',
//     'X-Accel-Buffering': 'no',
//   }
// })
// 
// Route file must also export:
// export const dynamic = 'force-dynamic';  // Prevent Next.js from caching SSE responses
// export const maxDuration = 60;           // Carried forward from v2.1

// Modified request interface:
interface LLMChatRequest {
  conversationId: string;
  parentNodeId: string | null;
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  model: string;
  attachments?: {                    // NEW
    filename: string;
    mimeType: string;
    data: string;                    // base64
    size: number;
  }[];
}

// SSE event types sent to client:
// event: token
// data: {"content":"chunk of text"}
//
// event: done
// data: {"userNode":{id,parentId,role,content,createdAt,attachments?},"assistantNode":{id,parentId,role,content,provider,model,createdAt},"tokenUsage":{"inputTokens":N,"outputTokens":N}}
//
// event: error
// data: {"message":"error description","partial":true|false}

// Error responses (non-streaming, returned before stream starts):
// 400: Validation errors (missing fields, invalid file types, file size exceeded)
// 401: Unauthorized
// 403: Conversation not owned by user
// 422: "Provider [name] is not configured."
```

**Orchestration flow:**
1. Validate fields + auth + ownership + provider availability (return JSON errors for pre-stream failures).
2. Validate attachments: file count ≤ 5, per-file ≤ 5MB, total ≤ 10MB, allowed MIME types.
3. Save user node to DB (with attachments if present).
4. Start SSE stream.
5. Iterate provider's `streamMessage()` generator, pipe `token` events to client, accumulate text.
6. On `done`: save assistant node, update `TokenUsage` (now per-model), fire auto-title if applicable, send `done` event with full node data.
7. On error: if partial content received → save partial assistant node, send `error` event with `partial: true`. If no content → delete user node (orphan cleanup), send `error` event with `partial: false`.

### 4.2 Modified Endpoint: GET `/api/token-usage`

```typescript
// MODIFIED response to support per-model breakdown:
interface TokenUsageResponse {
  usage: {
    model: string;           // CHANGED from provider-level
    provider: string;        // NEW — metadata for grouping
    inputTokens: number;
    outputTokens: number;
    callCount: number;
  }[];
}
```

### 4.3 File Upload Strategy: Body Size Handling

**⚠️ Next.js App Router does NOT support per-route body size configuration.** The Pages Router `export const config = { api: { bodyParser: { sizeLimit } } }` pattern does not exist in App Router. Route handlers use the standard Web `Request` API (`request.json()` / `request.formData()`) with no configurable parser limit.

**Available options in Next.js 16:**
- `serverActions.bodySizeLimit` in `next.config.ts` — applies to **Server Actions only**, NOT route handlers.
- `proxyClientMaxBodySize` in `next.config.ts` — applies to **the Next.js proxy feature only** (default 10MB).
- For **self-hosted/local deployment** (our case): Node.js itself has no default request body limit, and Next.js App Router route handlers read the raw request stream. In practice, `request.json()` will parse whatever the client sends. Implement a **manual size check** in the route handler before parsing:

```typescript
// In POST /api/llm/chat route handler:
const contentLength = parseInt(request.headers.get('content-length') || '0');
const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB
if (contentLength > MAX_BODY_SIZE) {
  return Response.json({ error: 'Request body too large' }, { status: 413 });
}
const body = await request.json();
```

This is sufficient for local deployment. If ever deployed to Vercel, the platform enforces a hard ~4.5MB limit on serverless function bodies, which would require a different upload strategy (presigned URLs to cloud storage).

### 4.4 No Removed Endpoints

### 4.5 Unchanged Endpoints

All conversation CRUD, node CRUD (GET nodes now returns `attachments` field if present), export (now includes attachments), import (now restores attachments), auth, providers endpoints remain unchanged in their routes but the node data shape includes the new `attachments` field.

---

## 5. New/Modified Components

### 5.1 New: `useStreamingChat` hook

- **File:** `src/hooks/useStreamingChat.ts`
- **Exports:** `{ sendStreamingMessage, streamingContent, streamingState, abortStream }`
- **Behavior:**
  - `sendStreamingMessage(request)`: Initiates fetch to `/api/llm/chat`, reads the SSE stream.
  - Maintains `streamingContent: string` (accumulated tokens), updated via batched `setState` at most every 50ms.
  - `streamingState: 'idle' | 'streaming' | 'error'`.
  - On `done` event: dispatches `ADD_NODES` action to `ConversationContext` with the user and assistant nodes.
  - On unmount or navigation: calls `abortController.abort()` to cancel the fetch.
  - `abortStream()`: Manual abort function exposed for UI use.

### 5.2 New: `FileUploadArea` component

- **File:** `src/components/chat/FileUploadArea.tsx`
- **Props:** `{ files: File[], onFilesChange: (files: File[]) => void, disabled: boolean }`
- **Behavior:**
  - Renders a paperclip icon button that opens a file picker.
  - Supports drag-and-drop onto the chat input area.
  - Shows preview thumbnails for images, filename chips for PDFs/text.
  - Validates file types and sizes client-side; shows toast on rejection.
  - Each file chip has a remove (X) button.
  - Accepted types: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf`, `.txt`, `.md`, `.csv`.

### 5.3 New: `CopyMarkdownButton` component

- **File:** `src/components/chat/CopyMarkdownButton.tsx`
- **Props:** `{ content: string }`
- **Behavior:**
  - Small `ClipboardCopy` icon button (from lucide-react).
  - On click: `navigator.clipboard.writeText(content)`.
  - Swaps icon to `Check` for 2 seconds, then reverts.
  - No toast — the icon change is sufficient feedback.

### 5.4 Modified: `ChatMessage`

- **File:** `src/components/chat/ChatMessage.tsx`
- **Changes:**
  - Add `<CopyMarkdownButton content={node.content} />` to the message action area.
  - **react-markdown v10 fix**: If the existing `<Markdown>` component uses a `className` prop, it must be replaced with a wrapper `<div className="prose"><Markdown>...</Markdown></div>` — the `className` prop was removed in v10.0.0 and silently does nothing.
  - If `node.attachments` exists and is non-empty, render attachment previews:
    - Images: inline thumbnail (base64 `<img>` with max-height).
    - PDFs: clickable chip showing filename + PDF icon. Click opens base64 data URL in new tab.
    - Text files: expandable chip showing filename. Click expands to show content.
  - When in streaming state (content still arriving), render the progressive `streamingContent` instead of `node.content`. Show a pulsing cursor indicator at the end.

### 5.5 Modified: `ChatInput`

- **File:** `src/components/chat/ChatInput.tsx`
- **Changes:**
  - Integrate `<FileUploadArea>` below the textarea.
  - When sending, read each file as base64 via `FileReader`, include in request body.
  - Disable input and send button while `streamingState === 'streaming'`.
  - Clear attached files after successful send.
  - Add drag-and-drop event handlers on the input container.

### 5.6 Modified: `ChatPanel`

- **File:** `src/components/chat/ChatPanel.tsx`
- **Changes:**
  - Replace direct fetch call with `useStreamingChat` hook.
  - While streaming, render a temporary `ChatMessage` at the bottom with `streamingContent` and a streaming indicator.
  - Remove `LoadingIndicator` component usage (replaced by inline streaming content).
  - Auto-scroll behavior: scroll to bottom on each token batch update during streaming.

### 5.7 Modified: `TokenUsageCard`

- **File:** `src/components/dashboard/TokenUsageCard.tsx`
- **Changes:**
  - Display grouped by provider with per-model breakdown:
    ```
    Anthropic
      claude-sonnet-4-5: 12,400 input / 3,200 output
    OpenAI
      gpt-4o: 5,600 input / 1,400 output
    ```
  - Group the `usage` array by `provider`, then list models within each group.

### 5.8 Modified: `LoadingIndicator`

- **File:** `src/components/chat/LoadingIndicator.tsx`
- **Changes:** This component may be repurposed or removed. With streaming, the "loading" state is replaced by progressive text rendering. If kept, it's only shown during the brief pre-stream setup (user node save). Alternatively, the streaming message component can show a pulsing cursor when `streamingContent` is empty and `streamingState === 'streaming'`.

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/hooks/useStreamingChat.ts` | SSE stream consumer hook — manages streaming state, content accumulation, abort |
| `src/components/chat/FileUploadArea.tsx` | File upload button + drag-and-drop + preview chips |
| `src/components/chat/CopyMarkdownButton.tsx` | Copy raw markdown to clipboard with icon feedback |
| `src/lib/providers/attachmentFormatter.ts` | Transforms `Attachment[]` into provider-specific content blocks (Claude/OpenAI/Gemini formats) |
| `src/lib/providers/streamHelpers.ts` | SSE serialization helpers: `encodeSSEEvent(event, data)`, stream creation utilities |

---

## 7. Modified Files

| File | Delta Description |
|------|-------------------|
| **Provider Layer** | |
| `src/lib/providers/types.ts` | Add `StreamChunk` type, `streamMessage` method to `LLMProvider`, `LLMAttachment` interface, `attachments?` field on `LLMMessage`. |
| `src/lib/providers/openai.ts` | Add `streamMessage()`: uses `stream: true` + `stream_options: { include_usage: true }`. Add attachment formatting in message builder (images as `image_url`, PDFs as `file` type or text fallback, text files inline). Keep `sendMessage()` for auto-title. |
| `src/lib/providers/anthropic.ts` | Add `streamMessage()`: uses `client.messages.stream()`. Add `cache_control` breakpoints (F-21): system prompt content block + last message content block. Add attachment formatting (images as `image` source, PDFs as `document` source, text inline). Keep `sendMessage()`. |
| `src/lib/providers/gemini.ts` | Add `streamMessage()`: uses `ai.models.generateContentStream()`. Add attachment formatting (`inlineData` for images/PDFs, text inline). System prompt stays in `config.systemInstruction`, NOT in contents array. Keep `sendMessage()`. |
| `src/lib/providers/mock.ts` | Add `streamMessage()`: yields canned response character-by-character with 10ms delays. Acknowledge attachments in response: "I see you've attached: [filenames]". |
| `src/lib/providers/index.ts` | No changes needed — provider registry unchanged. |
| **API Routes** | |
| `src/app/api/llm/chat/route.ts` | **Major rewrite.** Return SSE stream instead of JSON. Add attachment validation. Use `provider.streamMessage()`. Accumulate text server-side. On done: save assistant node + update TokenUsage (now keyed by model, not provider) + fire auto-title. Preserve orphan cleanup for pre-stream failures. Preserve `maxDuration = 60`. |
| `src/app/api/token-usage/route.ts` | Update query: fetch by `userId`, return `model` and `provider` fields. |
| `src/app/api/conversations/[id]/export/route.ts` | Include `attachments` field when serializing nodes. No other changes. |
| `src/app/api/import/route.ts` | Accept and restore `attachments` field on imported nodes. |
| **Models** | |
| `src/models/Node.ts` | Add `attachments` subdocument array to schema. |
| `src/models/TokenUsage.ts` | Change unique index from `{ userId, provider }` to `{ userId, model }`. Add `model` field. Keep `provider` as metadata. Add non-unique index `{ userId, provider }`. |
| **Components** | |
| `src/components/chat/ChatPanel.tsx` | Use `useStreamingChat` hook. Render streaming message. Remove LoadingIndicator (or repurpose). |
| `src/components/chat/ChatInput.tsx` | Integrate `FileUploadArea`. Read files as base64 on send. Disable during streaming. |
| `src/components/chat/ChatMessage.tsx` | Add `CopyMarkdownButton`. Render attachment previews. Handle streaming content display. |
| `src/components/dashboard/TokenUsageCard.tsx` | Group usage by provider with per-model breakdown. |
| **Context/State** | |
| `src/contexts/ConversationContext.ts` | Add `streamingContent: string | null` and `streamingNodeParentId: string | null` to state (or manage in hook — see State Management section). |
| `src/lib/contextBuilder.ts` | When building messages array, include `attachments` from each node's data. Transform `Attachment[]` to `LLMAttachment[]`. |
| **Types** | |
| `src/types/database.ts` | Add `Attachment` interface. Add `attachments?` to node type. |
| `src/types/api.ts` | Update `LLMChatRequest` to include `attachments?`. Add SSE event type interfaces. |
| `src/types/export.ts` | Add `attachments?` to exported node type. |
| **Config** | |
| `next.config.ts` | No body size config needed (App Router has none). Only modify if other config changes are required. |
| **Tests** | |
| `__tests__/api/llm-chat.test.ts` | **Major rewrite.** All tests must consume SSE streams instead of JSON. Add helper to collect SSE events. Add tests for: streaming token events, done event with node data, error mid-stream, error pre-stream (orphan cleanup), file attachment validation, file attachment in request body. |
| `__tests__/api/import-export.test.ts` | Add tests for export/import with attachments. |
| `__tests__/components/ChatPanel.test.tsx` | Update for streaming rendering behavior. |

---

## 8. Deleted Files / Dead Code

| File/Code | Reason |
|-----------|--------|
| `src/components/chat/LoadingIndicator.tsx` | Replaced by inline streaming content rendering. **Optional** — can be kept as a brief pre-stream indicator, but the pulsing dots pattern is no longer the primary loading state. Decision: keep the file but it's only used during the brief pre-stream setup phase; the primary "loading" is now the streaming text itself. |

No files are deleted in this feature set. `LoadingIndicator` is deprecated in usage but can remain.

---

## 9. Environment Variables

### No New Environment Variables

All changes use existing configuration. Streaming, caching, file attachments, and per-model tracking require no new env vars.

### No Removed Environment Variables

### Unchanged

`MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`.

---

## 10. State Management Changes

### ConversationContext — No structural changes

Streaming state is managed in the `useStreamingChat` hook via local state (`useState`), not in the global context. The hook dispatches to `ConversationContext` only on stream completion (adding the final user + assistant nodes). This avoids flooding the reducer with per-token updates.

### UIContext — No changes

### New Hook State: `useStreamingChat`

```typescript
// Managed internally, not in context:
{
  streamingContent: string;               // Accumulated tokens
  streamingState: 'idle' | 'streaming' | 'error';
  streamingError: string | null;
  abortController: AbortController | null;
}
```

---

## 11. Migration Checklist

Ordered steps to go from current state (v2.1) to new state (v3):

1. **Update CLAUDE.md** — First task (T-094). Reflect all changes from this delta document.
2. **Provider interface update** (F-20 foundation):
   a. Add `StreamChunk` type and `streamMessage` to `LLMProvider` interface in `types.ts`.
   b. Add `LLMAttachment` interface and `attachments?` to `LLMMessage`.
   c. Implement `streamMessage()` in all four providers (anthropic, openai, gemini, mock). Keep existing `sendMessage()` intact.
   d. Create `src/lib/providers/streamHelpers.ts` with SSE encoding utilities.
3. **Prompt caching** (F-21):
   a. In `src/lib/providers/anthropic.ts`, add `cache_control: { type: "ephemeral" }` to system prompt content block and last message content block when building the request — applies to both `sendMessage` and `streamMessage`.
4. **Streaming API route** (F-20 continued):
   a. Rewrite `POST /api/llm/chat` to return SSE stream.
   b. Preserve orphan node cleanup, auto-title, token tracking.
   c. Token tracking now uses `{ userId, model }` key (F-23).
   d. Configure body size limit in `next.config.ts`.
5. **Per-model token usage schema** (F-23):
   a. Update `TokenUsage` model: add `model` field, change unique index.
   b. Update `/api/token-usage` response format.
   c. Update `TokenUsageCard` component for per-model display.
   d. Drop existing `tokenusages` collection: `db.tokenusages.drop()`.
6. **File attachments — backend** (F-22):
   a. Add `attachments` to Node schema.
   b. Create `src/lib/providers/attachmentFormatter.ts`.
   c. Update `contextBuilder.ts` to pass attachments through the message array.
   d. Add attachment validation in chat route (type, size, count).
   e. Update export/import routes to include attachments.
7. **File attachments — frontend** (F-22):
   a. Create `FileUploadArea` component.
   b. Integrate into `ChatInput`.
   c. Update `ChatMessage` to render attachment previews.
8. **Streaming frontend** (F-20 continued):
   a. Create `useStreamingChat` hook.
   b. Update `ChatPanel` to use the hook, render streaming content.
   c. Update `ChatInput` to disable during streaming.
9. **Copy markdown button** (F-24):
   a. Create `CopyMarkdownButton` component.
   b. Add to `ChatMessage` action area.
10. **Update types** (cross-cutting):
    a. `src/types/database.ts` — add `Attachment`, update node type.
    b. `src/types/api.ts` — update `LLMChatRequest`, add SSE event types.
    c. `src/types/export.ts` — add attachments to exported node.
11. **Update tests**:
    a. Rewrite `llm-chat.test.ts` for SSE responses.
    b. Add file attachment tests.
    c. Add export/import with attachments tests.
    d. Update `ChatPanel` tests for streaming.

---

## 12. Implementation Gotchas

### Carried forward from v2.1 (still relevant):

1. **Middleware uses explicit URL paths, not route groups.** No new pages in this feature set, so the matcher (`'/dashboard'`, `'/chat/:path*'`, `'/usage'`) is unchanged.

2. **`API_KEY_PROVIDERS` / `VALID_PROVIDERS` lives in `src/constants/providers.ts`** (migrated in v2.1). If any new provider validation is added, use this constant.

3. **UIProvider `refreshProviders` stale-closure fix** — uses `useRef`. No changes needed in this feature set, but don't break it when modifying the chat flow.

4. **Orphaned user node cleanup** — In the streaming case, this has nuanced behavior:
   - If the stream fails BEFORE any content is received → delete user node + reset `rootNodeId` if first message (same as v2.1).
   - If the stream fails AFTER some content was received → keep both nodes, save partial content.
   - The implementation must distinguish these two cases.

5. **Gemini system prompts** go in `config.systemInstruction`, NOT the history array. This applies to BOTH `sendMessage` (auto-title) and `streamMessage`. When building streaming requests for Gemini, ensure system messages are separated.

6. **`globals.css` uses `@theme inline {}`** — no CSS changes needed in this feature set.

### New for v3:

7. **Streaming + caching + attachments all interact in the provider layer.** When building a Claude request for `streamMessage()`:
   - First: separate system messages for the `system` param.
   - Second: build the `messages` array with attachments formatted as content blocks.
   - Third: add `cache_control` breakpoints to system prompt and last message.
   - Fourth: start the stream.
   - Order matters — `cache_control` must be on the fully-built content blocks.

8. **OpenAI streaming `usage` requires `stream_options: { include_usage: true }`**. Without this flag, the final chunk will NOT contain usage data. Additionally, **OpenAI uses different field names** than Anthropic: `prompt_tokens` / `completion_tokens` (not `input_tokens` / `output_tokens`). The OpenAI provider must map these when yielding the `done` StreamChunk:
    ```typescript
    // OpenAI provider mapping:
    yield { type: 'done', content: accumulated, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
    ```

9. **Gemini streaming** uses `ai.models.generateContentStream()` (not `ai.chats.create().sendMessageStream()`). The current v2.1 implementation uses `ai.chats.create()` for non-streaming. For streaming, use the model-level method to avoid chat session state issues. The message history must be passed in the `contents` field. **Critical: use `chunk.text` getter** (not `chunk.candidates[0].content.parts[0].text`) — the raw `candidates` path throws a null-reference error on safety-filtered responses where `candidates` is `undefined`. Token usage is on `chunk.usageMetadata` (on each chunk, not on a wrapper):
    ```typescript
    for await (const chunk of stream) {
      const text = chunk.text;              // ✅ safe getter
      const usage = chunk.usageMetadata;    // ✅ on the chunk itself
    }
    ```

10. **Anthropic `client.messages.stream()` vs `client.messages.create({ stream: true })`**: The SDK's `.stream()` method returns a `MessageStream` with convenience methods like `.on('text', ...)` and `.finalMessage()`. The `.create({ stream: true })` returns a raw `Stream<RawMessageStreamEvent>`. Prefer `.stream()` for the helper methods — specifically `stream.finalMessage()` gives the complete `Message` object with `usage` stats, avoiding manual accumulation.

11. **SSE format is strict**: Each event must be `event: type\ndata: json\n\n` (note double newline). The `data` field must be a single line (no newlines in the JSON). Use `JSON.stringify()` which produces single-line output by default. **Add `export const dynamic = 'force-dynamic'`** to the chat route file to prevent Next.js from caching the SSE response. Also add `'X-Accel-Buffering': 'no'` to the response headers if behind NGINX. Note: some browsers buffer streaming responses until **1,024 bytes** have been received — consider sending an initial padding comment (`:\n\n`) to flush the buffer.

12. **`AbortController` propagation for client disconnect**: When the client disconnects (navigates away, closes tab), the `ReadableStream`'s `cancel` callback fires. This must signal the provider to stop the upstream stream. For Anthropic, call `stream.abort()`. For OpenAI, the `Stream` object has a `controller.abort()`. For Gemini, use the `AbortSignal` passed to the API call. **Additionally**, Next.js 16 route handlers expose `request.signal` — pass this to the provider stream setup so the abort propagates automatically without needing a custom `AbortController`.

13. **Next.js App Router has NO body size configuration for route handlers.** The Pages Router `export const config = { api: { bodyParser: { sizeLimit } } }` pattern does not exist in App Router. `serverActions.bodySizeLimit` in `next.config.ts` applies to Server Actions only. `proxyClientMaxBodySize` applies to the proxy feature only. For local deployment (Node.js), there is no default body limit — implement a manual `Content-Length` check in the route handler to reject payloads over 20MB. See Section 4.3 for the implementation pattern.

14. **Base64 encoding in browser**: Use `FileReader.readAsDataURL()` and strip the `data:...;base64,` prefix, or use `FileReader.readAsArrayBuffer()` + manual base64 conversion. The `readAsDataURL` approach is simpler but includes the data URI prefix that must be stripped.

15. **react-markdown v10 re-rendering during streaming**: Two sub-issues:
    - **`className` prop was removed in v10.0.0** (the only breaking change in v10). Wrap the component instead: `<div className="prose"><Markdown>{content}</Markdown></div>`. If the existing codebase uses `<Markdown className="prose">`, this will silently fail (no error, but no class applied).
    - **Performance**: Without throttling, `react-markdown` re-parses and re-renders the full accumulated content on every `setState`. Benchmarks show 5–15ms per render for simple content, 50ms+ for complex markdown. At 10–50 tokens/second, this creates visible jank. The `useStreamingChat` hook must batch updates (every 50ms via `requestAnimationFrame` or `setTimeout`). For production quality, implement block-level memoization: split the markdown into blocks (paragraphs, code blocks, etc.), memoize already-rendered blocks, and only re-render the last (still-growing) block. This is the pattern used by the Vercel AI SDK (`MemoizedMarkdown`).

16. **Token usage `$inc` now uses `model` as the key**, not `provider`. The update pattern changes from:
    ```typescript
    await TokenUsage.findOneAndUpdate(
      { userId, provider },
      { $inc: { inputTokens, outputTokens, callCount: 1 } },
      { upsert: true }
    );
    ```
    to:
    ```typescript
    await TokenUsage.findOneAndUpdate(
      { userId, model },
      { $inc: { inputTokens, outputTokens, callCount: 1 }, $set: { provider } },
      { upsert: true }
    );
    ```
    Note the `$set: { provider }` — on upsert, the provider metadata must be set.

17. **File attachment MIME type validation**: Validate on both client and server. Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown`, `text/csv`. Note that `.md` files may be detected as `text/plain` by the browser — accept both and normalize.

18. **OpenAI PDF support via `type: "file"` is confirmed working.** The `type: "file"` content block with inline `file: { filename: "doc.pdf", file_data: "data:application/pdf;base64,..." }` was introduced ~March 2025 and is documented in OpenAI's official "File inputs" guide. Note: `file_data` must be a data URI (with the `data:application/pdf;base64,` prefix), not raw base64. For images, use `type: "image_url"` with `image_url: { url: "data:image/png;base64,..." }`. File URLs (http/https) are supported only in the Responses API, not Chat Completions.

19. **Test baseline**: v2.1 ended with tests across 13 files (minus 18 removed = ~103 tests adjusted). The streaming rewrite of `llm-chat.test.ts` is the largest testing effort. Create an SSE test helper:
    ```typescript
    async function collectSSEEvents(response: Response): Promise<{event: string, data: any}[]> {
      // Read the stream, parse SSE format, return array of events
    }
    ```

20. **Export file size with attachments**: A conversation with many file attachments can produce very large JSON exports. No enforcement is needed, but the export route should set appropriate response headers and consider streaming the JSON response for very large exports.

---

## 13. Package Version Notes & Task Builder Warnings

This section documents version-specific API behaviors verified against the exact packages in `package.json`. The task breakdown agent **must** reference this section when writing implementation tasks.

### 13.1 `@anthropic-ai/sdk` — Pinned at `^0.80.0`

⚠️ **Semver trap**: For 0.x packages, `^0.80.0` resolves to `>=0.80.0 <0.81.0` — NOT `<1.0.0`. This means `npm install` will never pull 0.81.0+ unless the range is updated. The latest as of April 2026 is 0.85.0. If newer features are needed, the range must be explicitly widened.

**Verified APIs:**
- `client.messages.stream(params)` — exists, returns `MessageStream` (async iterable + event emitter).
- `stream.finalMessage()` — returns `Promise<Message>` with `usage.input_tokens` / `usage.output_tokens`.
- `stream.finalText()` — convenience for text extraction.
- Streaming events: `message_start` → `content_block_start` → `content_block_delta` (with `delta.text` when `delta.type === 'text_delta'`) → `content_block_stop` → `message_delta` → `message_stop`.
- `cache_control: { type: "ephemeral" }` on content blocks — confirmed. Supports optional `ttl: "1h"` for 1-hour caching (not needed for BranchChat, but available).
- **`client.messages.create({ stream: true })`** — also works but returns raw `Stream<RawMessageStreamEvent>` with no `.finalMessage()` helper. Use `.stream()` instead.

### 13.2 `openai` — Pinned at `^6.33.0`

**Verified APIs:**
- `client.chat.completions.create({ stream: true, stream_options: { include_usage: true } })` — returns async iterable of `ChatCompletionChunk`.
- Text: `chunk.choices[0]?.delta?.content`.
- Usage: **final chunk has `choices: []` (empty array)** and `chunk.usage` with `prompt_tokens` / `completion_tokens`. Map these to `inputTokens`/`outputTokens` in the normalized layer.
- Images: `{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }`.
- PDFs: `{ type: "file", file: { filename: "doc.pdf", file_data: "data:application/pdf;base64,..." } }` — note `file_data` is a **data URI** with prefix, not raw base64.
- Text files: `{ type: "text", text: "[File: name.txt]\n<contents>" }`.
- v6 breaking change was minimal (type change on `ResponseFunctionToolCallOutputItem.output`); streaming API is stable since v4.

### 13.3 `@google/genai` — Pinned at `^1.47.0`

**Verified APIs:**
- `new GoogleGenAI({ apiKey })` — constructor confirmed.
- `ai.models.generateContentStream({ model, contents, config })` — returns async iterable of `GenerateContentResponse`.
- 🔴 **Use `chunk.text` getter**, NOT `chunk.candidates[0].content.parts[0].text`. The raw path throws on safety-filtered responses. The `.text` getter handles null candidates, multi-part responses, and thought-part exclusion.
- `chunk.usageMetadata` — on each chunk (not on a wrapper). Fields: `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`.
- `config.systemInstruction` — accepts a string, string array, or `Content` object. Singular, not plural.
- Inline files: `{ inlineData: { mimeType: "application/pdf", data: "<base64>" } }` — confirmed for images and PDFs.
- Contents can be a flat array mixing strings and Part objects — SDK auto-wraps into `Content` objects with `role: "user"`.

### 13.4 `next` (Next.js) — Pinned at `16.2.2`

**Verified behaviors:**
- App Router route handlers can return `new Response(readableStream)` with SSE headers — confirmed, documented as primary streaming pattern.
- `export const maxDuration = 60` — works as route segment config.
- `export const dynamic = 'force-dynamic'` — required on SSE routes to prevent caching.
- 🔴 **No per-route body size config in App Router.** `serverActions.bodySizeLimit` applies to Server Actions only. Use manual `Content-Length` check.
- **Next.js 16 breaking change**: Dynamic route handler `params` is now a `Promise` and must be awaited: `const { id } = await params`. This affects existing `[conversationId]` and `[id]` routes. If existing routes don't already `await params`, they will break during this feature set's changes. Verify during task execution.
- SSE quirk: add `'X-Accel-Buffering': 'no'` header; some browsers buffer until 1024 bytes received.
- `request.signal` — use for detecting client disconnect in route handlers.

### 13.5 `react-markdown` — Pinned at `^10.1.0`

**Verified behaviors:**
- 🔴 **`className` prop removed in v10.0.0.** Must wrap: `<div className="prose"><Markdown>{content}</Markdown></div>`. If existing code uses `<Markdown className="...">`, it silently does nothing — no error, but no class applied. Check existing ChatMessage component.
- Compatible with `remark-gfm` ^4.0.1 — confirmed.
- Progressive re-rendering works but performance degrades: 5–15ms per render for simple content, 50ms+ for complex markdown. Batch state updates at 50ms minimum. For production quality, implement block-level memoization (split into paragraphs, memoize completed blocks, only re-render the last growing block).

### 13.6 `@xyflow/react` — Pinned at `^12.10.2`

- `node.measured.width` / `node.measured.height` — confirmed correct for v12. `node.width`/`node.height` now set **fixed** dimensions (for SSR); `node.measured` holds DOM-measured values.
- `node.measured` is `undefined` before initial measurement — guard access with `node.measured?.width ?? 180`.
- No changes needed in this feature set, but existing code must already handle this.

### 13.7 `mongoose` — Pinned at `^9.3.3`

- `findOneAndUpdate` with `$inc` + `$set` + `upsert: true` — works unchanged. Only array-syntax pipeline updates (`[{ $set: {...} }]`) require `{ updatePipeline: true }` in Mongoose 9.
- Subdocument arrays with `_id: false` — works. A TypeScript type-inference bug with `_id: false` was fixed in v9.2.3 (we're on 9.3.3, so no issue).
- `pre` middleware no longer receives `next()` callback — must use async/await. Already handled in v2.0 architecture (noted as a Mongoose 9 breaking change).

### 13.8 Cross-Provider Token Field Name Mapping

Each provider uses different field names for token counts. The provider implementations must normalize to `inputTokens`/`outputTokens`:

| Provider | Input Tokens Field | Output Tokens Field | Source Object |
|----------|-------------------|---------------------|---------------|
| Anthropic | `usage.input_tokens` | `usage.output_tokens` | `stream.finalMessage().usage` |
| OpenAI | `usage.prompt_tokens` | `usage.completion_tokens` | `chunk.usage` (final chunk only) |
| Gemini | `usageMetadata.promptTokenCount` | `usageMetadata.candidatesTokenCount` | `chunk.usageMetadata` |
| Mock | `ceil(content.length / 4)` | `ceil(content.length / 4)` | Estimated |
