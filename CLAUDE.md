# CLAUDE.md — BranchChat Technical Specification

> **MANDATORY**: This is the single source of truth for building BranchChat. AI coding agents and developers MUST follow every specification exactly. Do not improvise file paths, rename components, invent endpoints, change data model fields, or deviate from the folder structure. If something is not specified here, ask before implementing.

---

## Reference Documents

These are the authoritative source documents. If anything in this file seems ambiguous, consult the originals:

- **Software Requirements Document:** `docs/SRD BranchChat.docx`
- **Architecture Design Document:** `docs/Architecture Document.md`
- **Architecture Delta Document:** `docs/Architecture Delta Document - Feature Set 1.md`
- **Architecture Deliberation Transcript:** `docs/decisions/Architecture Debate.md`
- **Task Breakdown Document:** `docs/Task Breakdown Document - Feature Set 1.md`
- **Runtime log with workarounds and known issues from previous features:** `docs/Execution Log.md`

## Project Root

The Next.js application source code is inside the `branch-chat/` subdirectory, NOT the repository root. All file paths in this document (e.g., `src/app/`, `src/lib/`, `middleware.ts`) are relative to `branch-chat/`. Always `cd branch-chat` before running any commands (`npm install`, `npm run dev`, `npm run build`, etc.) or reading/writing source files.

## Tech Stack (exact versions)

```jsonc
{
    "dependencies": {
        "next": "16.2.1",
        "react": "19.2.4",
        "react-dom": "19.2.4",
        "@xyflow/react": "12.10.2",
        "@dagrejs/dagre": "3.0.0",
        "mongoose": "9.3.3",
        "next-auth": "5.0.0-beta.30",
        "bcryptjs": "3.0.3",
        "openai": "6.33.0",
        "@anthropic-ai/sdk": "0.80.0",
        "@google/genai": "1.47.0",
        "next-themes": "latest",
        "react-markdown": "10.1.0",
        "react-syntax-highlighter": "16.1.1",
    },
    "devDependencies": {
        "tailwindcss": "4.2.2",
        "@tailwindcss/postcss": "4.2.2",
        "postcss": "^8",
        "vitest": "4.1.2",
        "@vitejs/plugin-react": "^4",
        "jsdom": "^25",
        "vite-tsconfig-paths": "^5",
        "@testing-library/react": "16.3.2",
        "@testing-library/dom": "^10",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        "@types/react-syntax-highlighter": "15.5.13",
        "@types/bcryptjs": "^3",
        "tw-animate-css": "^1",
        "typescript": "^5",
    },
}
```

### Version-specific rules agents MUST follow

- **Next.js 16**: Turbopack is default. No custom webpack unless you pass `--webpack`.
- **React 19**: `forwardRef` is gone. Pass `ref` as a regular prop. Do NOT use `React.forwardRef`.
- **Tailwind 4**: CSS-only config via `@theme` in `globals.css`. **NO `tailwind.config.ts`**. PostCSS plugin is `@tailwindcss/postcss`, NOT `tailwindcss`.
- **@xyflow/react 12**: Renamed from `reactflow`. Import: `import { ReactFlow } from '@xyflow/react'`. Dimensions: `node.measured.width`/`node.measured.height` — NOT `node.width`/`node.height`.
- **@google/genai**: Replaces deprecated `@google/generative-ai`. Class: `GoogleGenAI`, NOT `GoogleGenerativeAI`.
- **Mongoose 9**: Hooks MUST be async. `next()` callbacks are removed.
- **next-auth v5**: Env vars use `AUTH_` prefix, NOT `NEXTAUTH_`. Config exports `{ handlers, auth, signIn, signOut }` from `NextAuth()`. `signIn` server action broken on Next.js 16 — use HTTP handlers.
- **shadcn/ui**: Uses `tw-animate-css` (NOT `tailwindcss-animate`). Toasts via `sonner` (NOT old toast). Style: `new-york`. Colors: OKLCH.
- **react-syntax-highlighter**: Turbopack import issues. If `dist/esm/styles/prism` fails, use `--webpack` or switch to `shiki`.
- **next-themes**: Wrap root layout with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`. Add `suppressHydrationWarning` to `<html>` tag.

---

## Folder Structure

```
branch-chat/
├── .env.local
├── .env.example
├── .gitignore                           # includes logs/
├── next.config.ts
├── postcss.config.mjs                   # export default { plugins: { "@tailwindcss/postcss": {} } }
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── middleware.ts                         # NextAuth v5 route protection
├── docker-compose.yml
│
├── docs/
│   └── decisions/
│       └── architecture-debate.md       # Deliberation transcript
│
├── logs/                                # Gitignored; auto-created by logger
│   └── .gitkeep
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── globals.css                  # @import "tailwindcss"; @import "tw-animate-css";
│   │   │                                # @custom-variant dark (&:where(.dark, .dark *));
│   │   │                                # @layer base { @import "@xyflow/react/dist/style.css"; }
│   │   │                                # @theme inline { --color-*: ...; --radius-*: ...; }
│   │   ├── layout.tsx                   # Root: AuthProvider + ThemeProvider + ToastProvider
│   │   ├── page.tsx                     # Redirect → /login or /dashboard
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (protected)/
│   │   │   ├── layout.tsx               # ConversationProvider + UIProvider + sidebar + ThemeToggle
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── chat/[conversationId]/page.tsx
│   │   │   └── usage/page.tsx           # Token usage per provider
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts         # POST: create account
│   │       │   └── [...nextauth]/route.ts    # NextAuth v5 catch-all
│   │       ├── conversations/
│   │       │   ├── route.ts                  # GET: list, POST: create
│   │       │   └── [id]/
│   │       │       ├── route.ts              # PATCH: rename, DELETE: cascade
│   │       │       ├── nodes/
│   │       │       │   ├── route.ts          # GET: all nodes
│   │       │       │   └── [nodeId]/route.ts # DELETE: node + descendants
│   │       │       └── export/route.ts       # GET: JSON download
│   │       ├── llm/chat/route.ts             # POST: send + LLM response (maxDuration=60)
│   │       ├── providers/route.ts            # GET: available providers based on env vars
│   │       ├── token-usage/route.ts          # GET: token usage for current user
│   │       └── import/route.ts               # POST: import JSON
│   │
│   ├── components/
│   │   ├── auth/          LoginForm.tsx, RegisterForm.tsx
│   │   ├── chat/          ChatPanel, ChatMessage, ChatInput, BranchIndicator, BranchMenu, ModelSelector, LoadingIndicator, CopyMarkdownButton
│   │   ├── tree/          TreeSidebar, TreeVisualization, TreeNode
│   │   ├── sidebar/       ConversationList, ConversationItem
│   │   ├── dashboard/     TokenUsageCard
│   │   ├── common/        ConfirmDialog, ToastProvider (sonner), ThemeToggle
│   │   └── providers/     AuthProvider, ConversationProvider, UIProvider
│   │
│   ├── contexts/          ConversationContext.ts, UIContext.ts
│   ├── hooks/             useConversation, useUI, useTreeLayout, useActivePath
│   │
│   ├── lib/
│   │   ├── auth.ts                      # NextAuth v5: exports { handlers, auth, signIn, signOut }
│   │   ├── db.ts                        # Mongoose 9 connection singleton
│   │   ├── logger.ts                    # Structured JSON file logger → logs/app.log
│   │   ├── tree.ts                      # getPathToRoot, buildChildrenMap, findDescendants
│   │   ├── tokenEstimator.ts            # 4 chars ≈ 1 token
│   │   ├── contextBuilder.ts            # Walk + truncate at 80%
│   │   └── providers/
│   │       ├── index.ts, types.ts
│   │       ├── availability.ts          # getAvailableProviders() — checks env vars
│   │       ├── openai.ts               # OpenAI SDK v6
│   │       ├── anthropic.ts            # Anthropic SDK v0.80
│   │       ├── gemini.ts              # @google/genai v1.47 (GoogleGenAI class)
│   │       └── mock.ts               # Dev only
│   │
│   ├── models/            User, Conversation, Node, TokenUsage (Mongoose 9, async hooks)
│   ├── types/             database, api, tree, llm, export
│   └── constants/         providers.ts, models.ts
│
└── __tests__/             mirrors src/
```

---

## Data Model

### Users

```typescript
interface IUser {
    email: string;
    hashedPassword: string;
    createdAt: Date;
    updatedAt: Date;
}
// { timestamps: true }. Index: { email: 1 } unique.
```

### Conversations

```typescript
interface IConversation {
    userId: ObjectId;
    title: string;
    defaultProvider: string;
    defaultModel: string;
    rootNodeId: ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
// { timestamps: true }. Index: { userId: 1, updatedAt: -1 }.
```

### Nodes

```typescript
interface INode {
    conversationId: ObjectId;
    parentId: ObjectId | null;
    role: "user" | "assistant" | "system";
    content: string;
    provider: string | null;
    model: string | null;
    createdAt: Date;
}
// { timestamps: { createdAt: true, updatedAt: false } }.
// Indexes: { conversationId: 1 }, { conversationId: 1, parentId: 1 }.
```

Branching = insert node with `parentId` → branch point. No other nodes modified. `childrenIds` NOT stored — compute client-side.

### TokenUsage

```typescript
interface ITokenUsage {
    userId: Types.ObjectId;
    provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
    model: string;
    inputTokens: number;
    outputTokens: number;
    callCount: number;
    updatedAt: Date;
}
// { timestamps: { createdAt: false, updatedAt: true } }.
// Index: { userId: 1, model: 1 } unique compound.
// Index: { userId: 1, provider: 1 } non-unique (for aggregation queries).
// Upsert on every LLM call with filter { userId, model }, $inc: { inputTokens, outputTokens, callCount: 1 }, $set: { provider }.
```

---

## API Contracts

All routes require auth unless PUBLIC. Return 401 if no session, 403 if wrong owner.

**POST `/api/auth/register`** — PUBLIC: `{ email, password }` → `201 { id, email }`

**GET `/api/conversations`** → `{ conversations[] }`

**POST `/api/conversations`** → `{ title, defaultProvider, defaultModel }` → 201

**PATCH `/api/conversations/[id]`** → `{ title }` → 200

**DELETE `/api/conversations/[id]`** → 200. Cascade: `Node.deleteMany` then `Conversation.deleteOne`.

**GET `/api/conversations/[id]/nodes`** → `{ nodes[] }`. Client builds tree from parentId.

**DELETE `/api/conversations/[id]/nodes/[nodeId]`** → `{ deletedCount, newActiveNodeId }`

**GET `/api/providers`** → `{ providers: string[] }`. Returns available providers based on env vars. Always includes `"mock"` when `NODE_ENV === 'development'`.

**GET `/api/token-usage`** → `{ usage: { model, provider, inputTokens, outputTokens, callCount }[] }`. Returns all TokenUsage docs for the authenticated user, keyed per-model with provider as metadata.

**POST `/api/llm/chat`** — `maxDuration = 60`

```
Request:  { conversationId, parentNodeId, content, provider, model }
201:      { userNode, assistantNode }
422:      "Provider [name] is not configured."
429:      "Rate limited by [provider]."
502:      "[provider] API error"
```

**Steps:** validate → verify ownership → check provider availability via `getAvailableProviders()` → load nodes → walk tree → truncate at 80% → format → insert user node → call LLM → insert assistant node → upsert TokenUsage (`$inc`) → fire-and-forget auto-title (if first message) → return both

**Auto-title:** If `parentNodeId === null` and conversation title is `"New Conversation"`, fire-and-forget a `generateTitle()` call using the same provider. System prompt: "Generate a concise title (max 6 words) for a conversation that starts with this message. Reply with only the title, no quotes or punctuation." On success, `Conversation.findByIdAndUpdate(conversationId, { title })`. Log errors, don't surface them. Track tokens.

**Orphaned node cleanup:** On LLM failure, delete the user node and reset `rootNodeId` if it was the first message.

**GET `/api/conversations/[id]/export`** → JSON download. `{ version: 1, exportedAt, title, nodes[] }` with computed `childrenIds`.

**POST `/api/import`** → `{ jsonData }` → `201 { conversationId, title, nodeCount }`. Validates tree integrity. If imported conversation's `defaultProvider` is unavailable, fall back to first available provider.

---

## State Management

Two React Contexts. Do NOT merge.

**ConversationContext**: `conversations[]`, `activeConversationId`, `nodes: Map`, `activeNodeId`

**UIContext**: `isLoading`, `isSidebarOpen`, `selectedProvider`, `selectedModel`, `availableProviders: string[]`, `isMinimapVisible: boolean`

**Derived (useMemo):** `childrenMap`, `activePath` — never stored.

---

## Key Algorithms

### Dagre Layout — @xyflow/react v12

```
// MUST use node.measured, NOT node.width/height
dagreGraph.setNode(id, { width: node.measured?.width ?? 180, height: node.measured?.height ?? 60 })
// rankdir="TB", nodesep=50, ranksep=70. Edges: type="smoothstep".
```

### Tree Operations

- **getPathToRoot**: Walk parentId → root, reverse. O(depth).
- **buildChildrenMap**: Group by parentId. O(n).
- **findDescendants**: BFS. O(descendants).
- **buildContext**: Walk → messages → truncate oldest first if >80% limit. Token est: `ceil(len/4) + 4`.
- **Import validation**: One root, all parentIds exist, BFS reaches all nodes.

---

## LLM Providers

```typescript
interface LLMProvider {
    name: string;
    sendMessage(
        messages: LLMMessage[],
        model: string,
    ): Promise<LLMResponse>;
}

interface LLMResponse {
    content: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}
```

Each provider reads its API key from the corresponding environment variable internally. No `apiKey` parameter.

- **OpenAI** (v6): `client.chat.completions.create({ model, messages })`. System inline. Reads `OPENAI_API_KEY`. Token counts from `response.usage.prompt_tokens`/`response.usage.completion_tokens`.
- **Anthropic** (v0.80): System → `system` param. `max_tokens: 4096`. Reads `ANTHROPIC_API_KEY`. Token counts from `response.usage.input_tokens`/`response.usage.output_tokens`.
- **Gemini** (`@google/genai`): `new GoogleGenAI({ apiKey })` → `ai.chats.create({ model, history })` → `chat.sendMessage({ message })`. Map `assistant`→`model`. System messages via `config.systemInstruction`. Reads `GEMINI_API_KEY`. Token counts from `response.usageMetadata.promptTokenCount`/`response.usageMetadata.candidatesTokenCount`.
- **Mock**: Sleep 1s, canned Markdown. `NODE_ENV === 'development'` only. Estimates tokens: `ceil(content.length / 4)` for both input and output.

### Provider Availability

`src/lib/providers/availability.ts` exports `getAvailableProviders()` — returns `string[]` of providers whose env var is non-empty. Always includes `"mock"` when `NODE_ENV === 'development'`.

---

## Logging

Server-side only. Structured JSON lines written to `logs/app.log`.

```typescript
// src/lib/logger.ts
// Uses fs.promises.appendFile. Auto-creates logs/ directory.
// Log levels: TRACE, DEBUG, INFO, WARN, ERROR
// Configurable minimum level via LOG_LEVEL env var (default: INFO).
// Format: { timestamp, level, message, context: { userId?, conversationId?, requestId? }, ...extra }
```

**Key events to log:**
- API route entry/exit (method, path, status, duration)
- LLM calls (provider, model, token count, duration)
- LLM message content and response content (DEBUG level only — set `LOG_LEVEL=DEBUG`)
- Auth events (login, register)
- DB operations (create/delete conversation/node)
- Errors with stack traces

Generate a `requestId` (e.g., `crypto.randomUUID()`) per API request for correlation.

No log rotation required (acceptable for course project scope). Manual cleanup as needed.

---

## Theme

- `next-themes` for light/dark/system switching
- `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` wraps root layout
- `suppressHydrationWarning` on `<html>` tag
- `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css` for class-based dark mode with Tailwind 4
- Dark color variables defined in `@theme inline` block in `globals.css` (shadcn `new-york` style generates these)
- `ThemeToggle` component in protected layout header — cycles: light → dark → system (Sun/Moon/Monitor icons from lucide-react)
- Uses `localStorage` for persistence (built into `next-themes`) — no DB persistence needed

---

## Auth

- next-auth 5.0.0-beta.30, JWT strategy, CredentialsProvider
- bcryptjs 10 rounds
- `src/lib/auth.ts` exports `{ handlers, auth, signIn, signOut }` from `NextAuth()`
- `middleware.ts` protects all except `/login`, `/register`, `/api/auth/*`
- Matcher paths: `'/dashboard'`, `'/chat/:path*'`, `'/usage'`
- Every API handler calls `auth()`, checks `session.user.id`
- Every query filters by `userId`
- `signIn` server action broken on Next.js 16 → use HTTP handlers only

---

## Environment Variables

```bash
MONGODB_URI=mongodb://localhost:27017/branch-chat
AUTH_SECRET=<random-string>              # openssl rand -base64 32
AUTH_URL=http://localhost:3000           # production URL in prod
OPENAI_API_KEY=sk-...                   # Optional — provider unavailable if unset
ANTHROPIC_API_KEY=sk-ant-...            # Optional — provider unavailable if unset
GEMINI_API_KEY=AI...                    # Optional — provider unavailable if unset
LOG_LEVEL=INFO                          # TRACE | DEBUG | INFO | WARN | ERROR
# AUTH_ prefix, NOT NEXTAUTH_
# LLM keys are server-level env vars, NOT stored in MongoDB
```

---

## Components

| Component             | Props                                                      | Behavior                                                        |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| **ChatPanel**         | `activePath[]`, `onBranchNavigate`                         | Maps → ChatMessage. Auto-scroll. LoadingIndicator.              |
| **ChatMessage**       | `node`, `childCount`, `isActive`, `onBranchClick`          | react-markdown. Provider color. BranchIndicator if >1 children. Delete button only on user messages; muted red color (`text-red-400/70`). CopyMarkdownButton on all messages. |
| **CopyMarkdownButton**| `{ content: string }`                                      | ClipboardCopy icon button. Copies raw markdown to clipboard. Swaps to Check icon for 2s. No toast. |
| **ChatInput**         | `onSend`, `disabled`, `defaultProvider`, `defaultModel`    | Textarea + send + ModelSelector. Clears on send.                |
| **ModelSelector**     | `value`, `onChange`, `availableProviders`                  | shadcn DropdownMenu, provider-grouped, color-coded. Unavailable providers greyed out (`opacity-50 pointer-events-none`). |
| **BranchIndicator**   | `nodeId`, `branchCount`, `onClick`                         | Badge. Click → BranchMenu.                                      |
| **BranchMenu**        | `parentNodeId`, `children[]`, `activeChildId`, `onSelect`  | Sibling list with preview + color. "New branch from here" option at bottom. |
| **TreeSidebar**       | `isOpen`, `onToggle`                                       | Toggle visible. TreeVisualization when open. |
| **TreeVisualization** | `nodes`, `childrenMap`, `activeNodeId`, `onNodeClick`      | `<ReactFlow>` from `@xyflow/react`. Conditionally renders `<MiniMap>` based on `isMinimapVisible`. Minimap toggle as `<ControlButton>` in ReactFlow Controls toolbar (Map/MapMinus icon, outline style). Styles in globals.css. |
| **TreeNode**          | `{ label, role, provider, isActive, hasMultipleChildren }` | Colored box. Provider dot. Active ring. No connection handles. Only assistant nodes are clickable. |
| **ThemeToggle**       | none                                                       | Cycle button: light → dark → system (Sun/Moon/Monitor icons). Uses `useTheme()` from `next-themes`. |
| **TokenUsageCard**    | none (fetches from `/api/token-usage` internally)          | Table/card showing per-provider token usage (input, output, total calls). |

---

## Commit Message Style

Use conventional commits with a scope: `type(scope): short description`

Examples:
- `feat(chat): add branch navigation`
- `fix(auth): handle expired sessions`
- `docs(spec): update CLAUDE.md for Round 2`
- `chore(deps): install next-themes`

Keep messages short, single-line, no body description.

---

## Setup

```bash
# Local dev
npm install
cp .env.example .env.local              # Fill AUTH_SECRET, and optionally LLM API keys
docker run -d -p 27017:27017 --name branch-chat-mongo mongo:7
npm run dev                              # Turbopack → localhost:3000

# Production (Vercel + Atlas)
# 1. Create Atlas M0 cluster
# 2. Import to Vercel
# 3. Set: MONGODB_URI, AUTH_SECRET, AUTH_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
# 4. Deploy
```
