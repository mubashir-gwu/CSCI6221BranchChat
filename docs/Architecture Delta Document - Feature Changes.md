# Architecture Delta Document

---

## 1. Change Classification

| # | Change | Classification |
|---|--------|---------------|
| 2 | Tree View click targets (assistant-only clickable) | UI-only |
| 3 | Delete button scoping (user nodes only) | UI-only |
| 4 | Delete button color (muted red) | UI-only |
| 5 | Error toast icon fix (AlertTriangle) | UI-only |
| 12 | Remove ReactFlow connection handles | UI-only |
| 6 | Branch from text bubble ("New branch from here") | UI-only |
| 7 | Minimap toggle | UI-only (+ UIContext state) |
| 10 | Provider availability gating | UI + API (depends on Change 8) |
| 1 | Auto-title conversations | API/Schema change |
| 9 | Theme switching (light/dark/system) | Cross-cutting |
| 8 | Server-level API keys + token tracking | Architectural shift |
| 11 | Extensive file-based logging | Cross-cutting |

Implementation order follows this table (least → most intensive).

---

## 2. Deliberation Transcripts

### Change 8: Server-Level API Keys + Token Tracking

**PROPOSER:**

Replace the entire BYO-Key subsystem. Concretely:

- Remove: `src/models/ApiKey.ts`, `src/lib/encryption.ts`, `src/components/settings/ApiKeyForm.tsx`, `src/components/settings/ApiKeyList.tsx`, `src/app/(protected)/settings/page.tsx`, `src/app/api/settings/api-keys/**`, `__tests__/api/api-keys.test.ts`, `__tests__/lib/encryption.test.ts`.
- API keys become env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.
- New `src/lib/providers/availability.ts` exports `getAvailableProviders()` — checks which env vars are non-empty, returns `string[]`.
- New `GET /api/providers` endpoint returns `{ providers: string[] }` so the client knows what's available.
- LLM provider `sendMessage` signature changes: remove the `apiKey` parameter. Each provider reads its own env var internally (e.g., `process.env.OPENAI_API_KEY`).
- New `TokenUsage` collection tracks cumulative tokens per user per provider. Updated after every successful LLM call from the response metadata.
- The `/settings` page becomes `/dashboard` which shows conversation list (existing) plus a token usage summary card.
- The existing `/dashboard` page already shows conversations — it stays as-is. A new `/usage` page shows the token usage summary. The settings nav link is replaced with a "Usage" link.

**CRITIC:**

1. **LLMProvider interface break**: Removing `apiKey` from `sendMessage` is a breaking interface change. Every provider implementation and every test that calls `sendMessage` must be updated.
2. **Token extraction differs per provider**: OpenAI returns `usage.prompt_tokens`/`usage.completion_tokens`. Anthropic returns `usage.input_tokens`/`usage.output_tokens`. Gemini returns `usageMetadata.promptTokenCount`/`usageMetadata.candidatesTokenCount`. Each provider must return token counts in its `LLMResponse`.
3. **Migration**: Existing `apiKeys` collection data becomes orphaned. Need a note to drop it.
4. **Mock provider**: Has no real token usage. Should return synthetic counts (e.g., estimate from content length) to keep the tracking path exercised.
5. **Dashboard page path**: Currently `/dashboard` exists and shows conversations. Removing `/settings` and adding `/usage` for token tracking keeps the dashboard clean and focused.

**MEDIATOR:**

Decision: Proceed as proposed with these refinements:
- `LLMResponse` gains `inputTokens: number` and `outputTokens: number` fields. Each provider extracts from its native response format.
- `sendMessage` drops the `apiKey` param. Providers read from `process.env` directly.
- Mock provider estimates tokens: `ceil(content.length / 4)` for both input and output.
- Migration: document "drop the `apiKeys` collection" as a one-time step (or just let it sit — no code references it).
- `/settings` page and its nav link are removed. A new `/usage` page displays token usage. Dashboard remains conversation-list only.

---

### Change 9: Theme Switching

**PROPOSER:**

Use `next-themes` (a widely used ~2KB library) for light/dark/system support.

- Install `next-themes`.
- Wrap the root layout with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.
- Tailwind 4 supports dark mode via `@media (prefers-color-scheme: dark)` by default, but class-based toggling requires the `@custom-variant dark (&:where(.dark, .dark *));` directive in `globals.css`.
- Add a `ThemeToggle` component (a cycle button: light → dark → system) in the protected layout header area (near the existing sidebar toggle / logout).
- shadcn/ui components already support dark mode through CSS variables in `:root` and `.dark` selectors — ensure `globals.css` `@theme` block defines both light and dark variable sets.

**CRITIC:**

1. Tailwind 4's default dark mode is media-based, not class-based. `next-themes` uses `class="dark"` on `<html>`. We need the `@custom-variant` directive or it won't work.
2. The existing `globals.css` `@theme` block defines OKLCH colors for shadcn. We need to ensure the dark color definitions are present. shadcn's `new-york` style generates these — verify they're already there from the original implementation.
3. `next-themes` causes a flash of incorrect theme on SSR. Use `suppressHydrationWarning` on `<html>` tag in root layout.

**MEDIATOR:**

Decision: Use `next-themes`. Add `@custom-variant dark (&:where(.dark, .dark *));` to `globals.css`. Ensure dark color variables exist. Add `suppressHydrationWarning` to `<html>`. ThemeToggle goes in the protected layout header. Session-only (no DB persistence) — `next-themes` uses `localStorage` by default which is sufficient.

---

### Change 1: Auto-Title Conversations

**PROPOSER:**

After the LLM chat route handler returns the response to the client, fire an async (non-blocking) title generation call:

1. In `POST /api/llm/chat`, after inserting the assistant node and before `return Response.json(...)`, check if this is the first exchange (i.e., `parentNodeId === null` or the conversation title is still "New Conversation").
2. If yes, fire a `generateTitle()` call using the same provider. This call is **fire-and-forget** — use `void generateTitle(...)` (no `await`). The response returns immediately.
3. `generateTitle()`: calls the provider with system prompt "Generate a concise title (max 6 words) for a conversation that starts with this message. Reply with only the title, no quotes or punctuation." and the user's first message as the only user message.
4. On success, `Conversation.findByIdAndUpdate(conversationId, { title: generatedTitle })`.
5. The client polls or re-fetches the conversation list to pick up the new title (no push mechanism needed — the conversation list already refreshes on navigation).

**CRITIC:**

1. **Fire-and-forget in serverless**: On Vercel, once the response is sent, the function can be killed. But the prompt says local-only deployment now — Node.js process stays alive, so fire-and-forget works fine.
2. **Error handling**: If title generation fails, just log and leave the title as "New Conversation". No user-facing error needed.
3. **Token tracking**: The title generation LLM call also consumes tokens. Should it be tracked in `TokenUsage`? Yes — it's still an LLM call.
4. **Provider reads env var**: Since the provider no longer takes an `apiKey` param, this is straightforward — just call `provider.sendMessage(messages, model)`.

**MEDIATOR:**

Decision: Fire-and-forget async call in the LLM chat route handler. Log errors, don't surface them. Track tokens. Check condition: conversation has title "New Conversation" AND `parentNodeId === null`. This is simple and correct for local deployment.

---

### Change 11: Extensive File-Based Logging

**PROPOSER:**

Create a custom logger at `src/lib/logger.ts`:

- Use `fs.appendFileSync` (or async `fs.promises.appendFile`) to write to `logs/app.log`.
- Structured JSON lines: `{ timestamp, level, message, context: { userId?, conversationId?, requestId? }, ...extra }`.
- Log levels: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`. Configurable minimum level via `LOG_LEVEL` env var (default: `INFO`).
- No external dependency — Node.js `fs` and `path` are sufficient. Log rotation by date is a nice-to-have but not required for a course project.
- Add `logs/` to `.gitignore`.
- Instrument: API route entry/exit, LLM calls (provider, model, token count, duration), auth events (login, register), DB operations (create/delete conversation/node), errors with stack traces.
- Generate a `requestId` (e.g., `crypto.randomUUID()`) per API request for correlation.
- Server-side only. No client-side logging.

**CRITIC:**

1. `fs.appendFileSync` blocks the event loop. For a course project at low traffic this is fine, but `fs.promises.appendFile` is better.
2. Log file could grow unbounded. Add a note about manual cleanup or date-based rotation as future work.
3. Ensure the `logs/` directory is created on first write (check existence, `mkdirSync` if missing).

**MEDIATOR:**

Decision: Custom logger using `fs.promises.appendFile`. Auto-create `logs/` directory. JSON lines format. `LOG_LEVEL` env var. No external dependencies. No rotation (documented as acceptable for course project scope).

---

## 3. Data Model Changes

### 3.1 New Collection: TokenUsage

```typescript
// src/models/TokenUsage.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface ITokenUsage extends Document {
  _id: string;
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  inputTokens: number;    // cumulative
  outputTokens: number;   // cumulative
  callCount: number;       // number of LLM calls
  updatedAt: Date;
}

const TokenUsageSchema = new Schema<ITokenUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, enum: ['openai', 'anthropic', 'gemini', 'mock'] },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    callCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TokenUsageSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const TokenUsage = models.TokenUsage || model<ITokenUsage>('TokenUsage', TokenUsageSchema);
```

**Index:** `{ userId: 1, provider: 1 }` unique compound.

**Update pattern:** After each successful LLM call:
```typescript
await TokenUsage.findOneAndUpdate(
  { userId, provider },
  { $inc: { inputTokens: resp.inputTokens, outputTokens: resp.outputTokens, callCount: 1 } },
  { upsert: true }
);
```

### 3.2 Modified Interface: LLMResponse

```typescript
// src/lib/providers/types.ts — ADD fields:
interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;   // NEW
  outputTokens: number;  // NEW
}
```

### 3.3 Modified Interface: LLMProvider

```typescript
// src/lib/providers/types.ts — CHANGE sendMessage signature:
interface LLMProvider {
  name: string;
  sendMessage(messages: LLMMessage[], model: string): Promise<LLMResponse>;
  // REMOVED: apiKey parameter
}
```

### 3.4 Removed Collection: ApiKeys

The `apiKeys` collection is no longer referenced. Drop it or leave it — no code reads from it.

### 3.5 No Changes To: Users, Conversations, Nodes

The `Conversation` model is unchanged — the `title` field already exists and accepts updates via `PATCH`. Auto-title just calls the existing update path.

---

## 4. API Changes

### 4.1 New Endpoint: GET `/api/providers`

```typescript
// src/app/api/providers/route.ts
// Response:
interface ProvidersResponse {
  providers: string[];  // e.g., ["openai", "anthropic", "gemini"] + "mock" in dev
}
// Returns whichever providers have their env var set (non-empty).
// Always includes "mock" when NODE_ENV === 'development'.
```

### 4.2 New Endpoint: GET `/api/token-usage`

```typescript
// src/app/api/token-usage/route.ts
// Response:
interface TokenUsageResponse {
  usage: {
    provider: string;
    inputTokens: number;
    outputTokens: number;
    callCount: number;
  }[];
}
// Fetches all TokenUsage docs for the authenticated user.
```

### 4.3 Modified Endpoint: POST `/api/llm/chat`

Changes:
1. **Remove** API key decryption step. Instead, check that the requested provider is available via `getAvailableProviders()`. If not available, return `422: "Provider [name] is not configured."`.
2. **Add** token tracking: after successful LLM call, `$inc` the user's `TokenUsage` document.
3. **Add** auto-title: if `parentNodeId === null` and conversation title is "New Conversation", fire-and-forget `generateTitle()`.
4. Error code `422` message changes from "No API key found" to "Provider [name] is not configured."

### 4.4 Removed Endpoints

| Endpoint | Reason |
|----------|--------|
| `GET /api/settings/api-keys` | BYO-Key removed |
| `PUT /api/settings/api-keys/[provider]` | BYO-Key removed |
| `DELETE /api/settings/api-keys/[provider]` | BYO-Key removed |

### 4.5 Unchanged Endpoints

All conversation CRUD, node CRUD, export, import, and auth endpoints remain unchanged.

---

## 5. New/Modified Components

### 5.1 New: ThemeToggle

- **File:** `src/components/common/ThemeToggle.tsx`
- **Props:** none
- **Behavior:** Cycle button (Sun → Moon → Monitor icons from lucide-react). Uses `useTheme()` from `next-themes`. Cycles: `light` → `dark` → `system`.

### 5.2 New: TokenUsageCard

- **File:** `src/components/dashboard/TokenUsageCard.tsx`
- **Props:** none (fetches from `/api/token-usage` internally)
- **Behavior:** Displays a table/card showing per-provider token usage (input, output, total calls). Fetches on mount.

### 5.3 Modified: TreeNode

- **File:** `src/components/tree/TreeNode.tsx`
- **Changes:**
  - Remove all `<Handle>` components (source and target). No connection handles rendered.
  - Only call `onNodeClick` if `node.role === 'assistant'`. User nodes render but are not clickable (no pointer cursor, no click handler).

### 5.4 Modified: ChatMessage

- **File:** `src/components/chat/ChatMessage.tsx`
- **Changes:**
  - Delete button only renders when `node.role === 'user'`.
  - Delete button color: change from `text-red-500` / `bg-red-500` to `text-red-400/70` (or equivalent muted variant using Tailwind opacity modifier).

### 5.5 Modified: BranchMenu

- **File:** `src/components/chat/BranchMenu.tsx`
- **Changes:**
  - Add a "New branch from here" option at the bottom of the sibling list (with a `GitBranch` or `Plus` icon from lucide-react).
  - On click, calls `onBranchNavigate(parentNodeId)` — sets the parent node as active, effectively navigating the user to that point so they can type a new message that branches from it.

### 5.6 Modified: ModelSelector

- **File:** `src/components/chat/ModelSelector.tsx`
- **Changes:**
  - Fetches available providers from `/api/providers` (or receives them as prop from parent).
  - Providers NOT in the available list are rendered as disabled/greyed-out items with `opacity-50 pointer-events-none` styling.
  - If no providers available, show disabled state with message "No providers available".

### 5.7 Modified: ToastProvider / Toast usage

- **File:** wherever error toasts are triggered (likely `src/components/chat/ChatInput.tsx` or a shared utility)
- **Changes:** Replace error icon from `X` / `XCircle` to `AlertTriangle` from lucide-react in error toast calls. If using sonner's built-in `toast.error()`, customize the icon prop: `toast.error(message, { icon: <AlertTriangle /> })`.

### 5.8 Modified: TreeSidebar

- **File:** `src/components/tree/TreeSidebar.tsx`
- **Changes:**
  - Add a minimap toggle button (Eye/EyeOff icon) in the sidebar header.
  - Reads/writes `isMinimapVisible` from UIContext.

### 5.9 Modified: TreeVisualization

- **File:** `src/components/tree/TreeVisualization.tsx`
- **Changes:**
  - Conditionally render `<MiniMap>` based on `isMinimapVisible` from UIContext.

### 5.10 New: Usage page

- **File:** `src/app/(protected)/usage/page.tsx`
- **Behavior:** Dedicated page displaying `<TokenUsageCard />` with per-provider token usage stats. Accessible via a nav link (e.g., "Usage" in the sidebar or header). The dashboard page is NOT modified — it remains conversation-list only.

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/models/TokenUsage.ts` | Mongoose schema for per-user per-provider token tracking |
| `src/app/api/providers/route.ts` | GET endpoint returning available providers |
| `src/app/api/token-usage/route.ts` | GET endpoint returning user's token usage |
| `src/lib/providers/availability.ts` | `getAvailableProviders()` utility — checks env vars |
| `src/lib/logger.ts` | Structured file-based logger (JSON lines → `logs/app.log`) |
| `src/components/common/ThemeToggle.tsx` | Light/dark/system theme toggle button |
| `src/components/dashboard/TokenUsageCard.tsx` | Token usage display card for usage page |
| `src/app/(protected)/usage/page.tsx` | Dedicated token usage page |
| `logs/.gitkeep` | Ensure logs directory exists in repo (contents gitignored) |

---

## 7. Modified Files

| File | Delta Description |
|------|-------------------|
| `src/lib/providers/types.ts` | Add `inputTokens`, `outputTokens` to `LLMResponse`. Remove `apiKey` param from `LLMProvider.sendMessage`. |
| `src/lib/providers/openai.ts` | Remove `apiKey` param. Read `process.env.OPENAI_API_KEY`. Extract token counts from `response.usage`. |
| `src/lib/providers/anthropic.ts` | Remove `apiKey` param. Read `process.env.ANTHROPIC_API_KEY`. Extract token counts from `response.usage`. |
| `src/lib/providers/gemini.ts` | Remove `apiKey` param. Read `process.env.GEMINI_API_KEY`. Extract token counts from `response.usageMetadata`. |
| `src/lib/providers/mock.ts` | Remove `apiKey` param. Return estimated tokens: `ceil(content.length / 4)`. |
| `src/lib/providers/index.ts` | Update `getProvider()` to not require key validation. Remove any imports from `ApiKey.ts` (F-05 audit exported `API_KEY_PROVIDERS` from there — now use `src/constants/providers.ts` instead). |
| `src/app/api/llm/chat/route.ts` | Remove key decryption. Add provider availability check via `getAvailableProviders()`. Add token tracking `$inc`. Add fire-and-forget auto-title. Add logging instrumentation. **Preserve**: orphaned user node cleanup on LLM failure (added in F-12 audit — `Node.deleteOne` + `rootNodeId` reset). Change 422 message from "No API key found" to "Provider [name] is not configured." Remove import of `decrypt` from encryption.ts and `ApiKey` model. |
| `src/app/api/import/route.ts` | On import, if the conversation's `defaultProvider` is unavailable, fall back to first available provider. |
| `src/constants/providers.ts` | Add an exported `VALID_PROVIDERS` array (or similar) to replace `API_KEY_PROVIDERS` that was previously exported from `src/models/ApiKey.ts`. Used for provider validation in API routes. |
| `src/components/tree/TreeNode.tsx` | Remove `<Handle>` components. Disable click on user nodes. |
| `src/components/chat/ChatMessage.tsx` | Delete button: show only on user nodes. Muted red color. |
| `src/components/chat/BranchMenu.tsx` | Add "New branch from here" option. |
| `src/components/chat/ModelSelector.tsx` | Grey out unavailable providers. Fetch/receive available providers list. |
| `src/components/tree/TreeSidebar.tsx` | Add minimap toggle button. |
| `src/components/tree/TreeVisualization.tsx` | Conditionally render `<MiniMap>`. |
| `src/components/common/ToastProvider.tsx` (or toast call sites) | Replace error icon with `AlertTriangle`. |
| `src/contexts/UIContext.ts` | Add `isMinimapVisible: boolean` (default `true`), `toggleMinimap` action. |
| `src/components/providers/UIProvider.tsx` | Add `isMinimapVisible` state + `TOGGLE_MINIMAP` reducer action. Change `refreshProviders` to fetch from `/api/providers` instead of `/api/settings/api-keys` (preserving the `useRef` stale-closure fix from F-12). |
| `src/app/(protected)/dashboard/page.tsx` | Remove API key banner that checks `GET /api/settings/api-keys`. Optionally replace with a check against `/api/providers` to show "No providers configured" warning. |
| `src/app/(protected)/chat/[conversationId]/page.tsx` | Update 422 error toast: remove "Go to Settings" action button (no settings page). Change message to "Provider [name] is not configured on this server." Also update provider fetch from `/api/settings/api-keys` to `/api/providers`. |
| `src/app/(protected)/layout.tsx` | Add `<ThemeToggle />` in header. Remove settings/API-keys nav link. Add "Usage" nav link pointing to `/usage`. |
| `src/app/layout.tsx` | Wrap with `next-themes` `<ThemeProvider>`. Add `suppressHydrationWarning` to `<html>`. |
| `src/app/globals.css` | Add `@custom-variant dark (&:where(.dark, .dark *));`. Ensure dark color variables in `@theme`. |
| `.env.example` | Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LOG_LEVEL`. Remove `ENCRYPTION_KEY`. |
| `.env.local` (template) | Same as above. |
| `.gitignore` | Add `logs/`. |
| `middleware.ts` | Matcher uses explicit paths (not route groups). Remove `/settings`, add `/usage`. Final list: `'/dashboard'`, `'/chat/:path*'`, `'/usage'`. |
| `package.json` | Add `next-themes` dependency. |
| All API route handlers | Add logging instrumentation (request entry/exit, errors). |
| All existing LLM-related tests | Update `sendMessage` calls to remove `apiKey` argument. Update mocks that reference `ApiKey` model or `decrypt`. Update `llm-chat.test.ts` mocks for the new availability check (mock `getAvailableProviders` instead of `ApiKey.findOne`). Preserve orphaned-node-cleanup assertions from F-12 audit. |

---

## 8. Deleted Files / Dead Code

| File/Directory | Reason |
|----------------|--------|
| `src/models/ApiKey.ts` | BYO-Key removed |
| `src/lib/encryption.ts` | No longer encrypting/decrypting keys |
| `src/components/settings/ApiKeyForm.tsx` | BYO-Key removed |
| `src/components/settings/ApiKeyList.tsx` | BYO-Key removed |
| `src/app/(protected)/settings/page.tsx` | BYO-Key removed; token usage moved to `/usage` |
| `src/app/api/settings/api-keys/route.ts` | BYO-Key removed |
| `src/app/api/settings/api-keys/[provider]/route.ts` | BYO-Key removed |
| `src/app/api/settings/` (entire directory) | No remaining routes under settings |
| `__tests__/api/api-keys.test.ts` | No API key endpoints |
| `__tests__/lib/encryption.test.ts` | No encryption module |

---

## 9. Environment Variables

### New

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENAI_API_KEY` | Server-level OpenAI key | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Server-level Anthropic key | `sk-ant-...` |
| `GEMINI_API_KEY` | Server-level Google Gemini key | `AIza...` |
| `LOG_LEVEL` | Minimum log level | `INFO` (default if unset) |

### Removed

| Variable | Reason |
|----------|--------|
| `ENCRYPTION_KEY` | No longer encrypting API keys |

### Unchanged

`MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL` — no changes.

---

## 10. State Management Changes

### UIContext — Added Fields

```typescript
// src/contexts/UIContext.ts — ADD:
isMinimapVisible: boolean;  // default: true

// New action:
type UIAction = ... | { type: 'TOGGLE_MINIMAP' };
```

### ConversationContext — No Changes

No new fields. Auto-title updates the conversation title in MongoDB; the client picks it up on next conversation list fetch (existing `GET /api/conversations` call).

### Removed State

The `selectedProvider`/`selectedModel` in UIContext may need to validate against available providers on initial load. If the stored provider is unavailable, fall back to the first available. This is a behavioral change, not a new field.

---

## 11. Migration Checklist

Ordered steps to go from current state (v2.0) to new state (v2.1):

1. **Update CLAUDE.md** — First task. Reflect all changes from this delta document.
2. **Add `logs/` to `.gitignore`** and create `logs/.gitkeep`.
3. **Install `next-themes`**: `npm install next-themes`.
4. **UI-only fixes** (Changes 2, 3, 4, 5, 12): Modify `TreeNode.tsx`, `ChatMessage.tsx`, toast icon. No backend changes.
5. **Branch from bubble** (Change 6): Add "New branch from here" to `BranchMenu.tsx`.
6. **Minimap toggle** (Change 7): Add `isMinimapVisible` to UIContext/UIProvider. Add toggle to TreeSidebar. Conditionally render MiniMap.
7. **Theme switching** (Change 9): Configure `next-themes` in root layout, add `@custom-variant` to globals.css, add `ThemeToggle` component.
8. **Create logger** (Change 11): Create `src/lib/logger.ts`. Add `LOG_LEVEL` to `.env.example`.
9. **Server-level API keys** (Change 8):
   a. Create `src/lib/providers/availability.ts`.
   b. Create `src/app/api/providers/route.ts`.
   c. Modify `LLMProvider` interface — remove `apiKey`, add token fields to `LLMResponse`.
   d. Update all four provider implementations (openai, anthropic, gemini, mock).
   e. Create `src/models/TokenUsage.ts`.
   f. Create `src/app/api/token-usage/route.ts`.
   g. Modify `POST /api/llm/chat` — remove decryption, add availability check, add token tracking, add auto-title. **Preserve orphaned user node cleanup** (F-12 audit).
   h. Delete: `ApiKey` model, `encryption.ts`, settings components, settings page, settings API routes, related tests.
   i. Move `API_KEY_PROVIDERS` constant from deleted `ApiKey.ts` to `src/constants/providers.ts`.
   j. Update `UIProvider.refreshProviders` to call `/api/providers` instead of `/api/settings/api-keys`.
   k. Update `ModelSelector` to grey out unavailable providers.
   l. Update chat page: remove "Go to Settings" action from 422 toast. Change provider fetch to `/api/providers`.
   m. Update dashboard page: remove API key banner.
   n. Update import route to fall back on unavailable provider.
   o. Update `middleware.ts` matcher: remove `/settings`, add `/usage`.
10. **Provider availability gating** (Change 10): Handled as part of step 9.
11. **Auto-title** (Change 1): Handled as part of step 9g.
12. **Token usage page**: Create `TokenUsageCard` component and `/usage` page. Add "Usage" nav link in protected layout.
13. **Instrument logging** (Change 11 cont.): Add logger calls to all API routes, LLM calls, auth events, DB operations.
14. **Update `.env.example`**: Add new vars, remove `ENCRYPTION_KEY`.
15. **Update tests**: Remove API key tests, update LLM test mocks to match new `sendMessage` signature and new availability check pattern.
16. **Optional**: Drop the `apiKeys` MongoDB collection (`db.apiKeys.drop()`) — no code references it but it will sit inert if not dropped.

---

## 12. Implementation Notes from Execution Log

These are gotchas and patterns from the original build that the coding agent must be aware of:

1. **Middleware uses explicit URL paths, not route groups.** `(protected)` is filesystem-only. The matcher currently lists `'/dashboard'`, `'/chat/:path*'`, `'/settings'`. Must update to `'/dashboard'`, `'/chat/:path*'`, `'/usage'`.

2. **`API_KEY_PROVIDERS` constant and `ApiKeyProvider` type are exported from `src/models/ApiKey.ts`** (F-05 audit fix). The LLM chat route and possibly other files import these for provider validation. When deleting `ApiKey.ts`, migrate this constant to `src/constants/providers.ts`.

3. **UIProvider `refreshProviders` has a stale-closure fix** (F-12 audit). It uses a `useRef` + `useEffect` pattern to avoid stale `state.selectedProvider` in the callback. When changing the fetch URL from `/api/settings/api-keys` to `/api/providers`, preserve this pattern — do not replace it with a naive `useCallback` that captures state directly.

4. **Chat page 422 toast has a "Go to Settings" action button** (F-12 audit). Since `/settings` no longer exists, this button must be removed. The 422 error message should change to indicate a server-level configuration issue, not a user-fixable one.

5. **Dashboard page has an API key banner** (T-022) that fetches `GET /api/settings/api-keys` and shows a warning when no keys are configured. This banner must be removed or replaced with a provider availability check.

6. **Orphaned user node cleanup on LLM failure** (F-12 audit). The LLM route deletes the user node on failure and resets `rootNodeId` if it was the first message. This logic must be preserved in the modified route.

7. **`globals.css` uses `@theme inline {}`** (T-003). The `inline` keyword is significant — dark mode color variables must also be inside this block or in a `.dark` selector that Tailwind 4 recognizes.

8. **Gemini system role handling** (F-08 audit). System messages are separated and passed via `config.systemInstruction`, not in the history array. The auto-title call uses a system prompt, so ensure the Gemini provider handles this correctly for title generation.

9. **Test count baseline**: 121 tests across 13 test files as of the completed original build. Tests to remove: `api-keys.test.ts` (8 tests), `encryption.test.ts` (10 tests). Tests to modify: `llm-chat.test.ts` (16 tests), `ModelSelector.test.tsx`.
