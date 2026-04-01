# CLAUDE.md — BranchChat Technical Specification

> **MANDATORY**: This is the single source of truth for building BranchChat. AI coding agents and developers MUST follow every specification exactly. Do not improvise file paths, rename components, invent endpoints, change data model fields, or deviate from the folder structure. If something is not specified here, ask before implementing.

---

## Reference Documents

These are the authoritative source documents. If anything in this file seems ambiguous, consult the originals:

- **Software Requirements Document:** `docs/SRD BranchChat.docx`
- **Architecture Design Document:** `docs/Architecture Document.md`
- **Architecture Deliberation Transcript:** `docs/decisions/Architecture Debate.md`
- **Runtime log with workarounds and known issues from previous features:** `docs/Execution Log.md`

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

---

## Folder Structure

```
branch-chat/
├── .env.local
├── .env.example
├── next.config.ts
├── postcss.config.mjs                  # export default { plugins: { "@tailwindcss/postcss": {} } }
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── middleware.ts                        # NextAuth v5 route protection
├── docker-compose.yml
│
├── docs/
│   └── decisions/
│       └── architecture-debate.md      # Deliberation transcript
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── globals.css                 # @import "tailwindcss"; @import "tw-animate-css";
│   │   │                               # @layer base { @import "@xyflow/react/dist/style.css"; }
│   │   │                               # @theme { --color-*: ...; --radius-*: ...; }
│   │   ├── layout.tsx                  # Root: AuthProvider + ToastProvider
│   │   ├── page.tsx                    # Redirect → /login or /dashboard
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (protected)/
│   │   │   ├── layout.tsx              # ConversationProvider + UIProvider + sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── chat/[conversationId]/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts        # POST: create account
│   │       │   └── [...nextauth]/route.ts   # NextAuth v5 catch-all
│   │       ├── conversations/
│   │       │   ├── route.ts                 # GET: list, POST: create
│   │       │   └── [id]/
│   │       │       ├── route.ts             # PATCH: rename, DELETE: cascade
│   │       │       ├── nodes/
│   │       │       │   ├── route.ts         # GET: all nodes
│   │       │       │   └── [nodeId]/route.ts # DELETE: node + descendants
│   │       │       └── export/route.ts      # GET: JSON download
│   │       ├── llm/chat/route.ts            # POST: send + LLM response (maxDuration=60)
│   │       ├── settings/api-keys/
│   │       │   ├── route.ts                 # GET: masked keys
│   │       │   └── [provider]/route.ts      # PUT: set, DELETE: remove
│   │       └── import/route.ts              # POST: import JSON
│   │
│   ├── components/
│   │   ├── auth/          LoginForm.tsx, RegisterForm.tsx
│   │   ├── chat/          ChatPanel, ChatMessage, ChatInput, BranchIndicator, BranchMenu, ModelSelector, LoadingIndicator
│   │   ├── tree/          TreeSidebar, TreeVisualization, TreeNode
│   │   ├── sidebar/       ConversationList, ConversationItem
│   │   ├── settings/      ApiKeyForm, ApiKeyList
│   │   ├── common/        ConfirmDialog, ToastProvider (sonner)
│   │   └── providers/     AuthProvider, ConversationProvider, UIProvider
│   │
│   ├── contexts/          ConversationContext.ts, UIContext.ts
│   ├── hooks/             useConversation, useUI, useTreeLayout, useActivePath
│   │
│   ├── lib/
│   │   ├── auth.ts                     # NextAuth v5: exports { handlers, auth, signIn, signOut }
│   │   ├── db.ts                       # Mongoose 9 connection singleton
│   │   ├── encryption.ts              # AES-256-GCM
│   │   ├── tree.ts                     # getPathToRoot, buildChildrenMap, findDescendants
│   │   ├── tokenEstimator.ts          # 4 chars ≈ 1 token
│   │   ├── contextBuilder.ts          # Walk + truncate at 80%
│   │   └── providers/
│   │       ├── index.ts, types.ts
│   │       ├── openai.ts              # OpenAI SDK v6
│   │       ├── anthropic.ts           # Anthropic SDK v0.80
│   │       ├── gemini.ts              # @google/genai v1.47 (GoogleGenAI class)
│   │       └── mock.ts               # Dev only
│   │
│   ├── models/            User, ApiKey, Conversation, Node (Mongoose 9, async hooks)
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

### API Keys

```typescript
interface IApiKey {
    userId: ObjectId;
    provider: "openai" | "anthropic" | "gemini";
    encryptedKey: string;
    iv: string;
    authTag: string;
    createdAt: Date;
    updatedAt: Date;
}
// { timestamps: true }. Index: { userId: 1, provider: 1 } unique compound.
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

**POST `/api/llm/chat`** — `maxDuration = 60`

```
Request:  { conversationId, parentNodeId, content, provider, model }
201:      { userNode, assistantNode }
422:      "No API key found for [provider]."
429:      "Rate limited by [provider]."
502:      "Invalid API key" | "[provider] API error"
```

**Steps:** validate → verify ownership → decrypt key → load nodes → walk tree → truncate at 80% → format → insert user node → call LLM → insert assistant node → return both

**GET `/api/settings/api-keys`** → `{ keys: { provider, maskedKey, updatedAt }[] }`

**PUT `/api/settings/api-keys/[provider]`** → `{ apiKey }` → 200. Upsert AES-256-GCM.

**DELETE `/api/settings/api-keys/[provider]`** → 200

**GET `/api/conversations/[id]/export`** → JSON download. `{ version: 1, exportedAt, title, nodes[] }` with computed `childrenIds`.

**POST `/api/import`** → `{ jsonData }` → `201 { conversationId, title, nodeCount }`. Validates tree integrity.

---

## State Management

Two React Contexts. Do NOT merge.

**ConversationContext**: `conversations[]`, `activeConversationId`, `nodes: Map`, `activeNodeId`

**UIContext**: `isLoading`, `isSidebarOpen`, `selectedProvider`, `selectedModel`

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
        apiKey: string,
    ): Promise<LLMResponse>;
}
```

- **OpenAI** (v6): `client.chat.completions.create({ model, messages })`. System inline.
- **Anthropic** (v0.80): System → `system` param. `max_tokens: 4096`.
- **Gemini** (`@google/genai`): `new GoogleGenAI({ apiKey })` → `ai.chats.create({ model, history })` → `chat.sendMessage({ message })`. Map `assistant`→`model`.
- **Mock**: Sleep 1s, canned Markdown. `NODE_ENV === 'development'` only.

---

## Encryption

AES-256-GCM. Key: `ENCRYPTION_KEY` (64 hex chars). IV: 12 random bytes. Auth tag stored alongside. Mask: first 3 + "..." + last 3 chars.

---

## Auth

- next-auth 5.0.0-beta.30, JWT strategy, CredentialsProvider
- bcryptjs 10 rounds
- `src/lib/auth.ts` exports `{ handlers, auth, signIn, signOut }` from `NextAuth()`
- `middleware.ts` protects all except `/login`, `/register`, `/api/auth/*`
- Every API handler calls `auth()`, checks `session.user.id`
- Every query filters by `userId`
- `signIn` server action broken on Next.js 16 → use HTTP handlers only

---

## Environment Variables

```bash
MONGODB_URI=mongodb://localhost:27017/branch-chat
AUTH_SECRET=<random-string>              # openssl rand -base64 32
AUTH_URL=http://localhost:3000           # production URL in prod
ENCRYPTION_KEY=<64-char-hex-string>      # openssl rand -hex 32
# AUTH_ prefix, NOT NEXTAUTH_
# LLM keys in MongoDB, NOT here
```

---

## Components

| Component             | Props                                                      | Behavior                                                        |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| **ChatPanel**         | `activePath[]`, `onBranchNavigate`                         | Maps → ChatMessage. Auto-scroll. LoadingIndicator.              |
| **ChatMessage**       | `node`, `childCount`, `isActive`, `onBranchClick`          | react-markdown. Provider color. BranchIndicator if >1 children. |
| **ChatInput**         | `onSend`, `disabled`, `defaultProvider`, `defaultModel`    | Textarea + send + ModelSelector. Clears on send.                |
| **ModelSelector**     | `value`, `onChange`, `availableProviders`                  | shadcn DropdownMenu, provider-grouped, color-coded.             |
| **BranchIndicator**   | `nodeId`, `branchCount`, `onClick`                         | Badge. Click → BranchMenu.                                      |
| **BranchMenu**        | `parentNodeId`, `children[]`, `activeChildId`, `onSelect`  | Sibling list with preview + color.                              |
| **TreeSidebar**       | `isOpen`, `onToggle`                                       | Toggle visible. TreeVisualization when open.                    |
| **TreeVisualization** | `nodes`, `childrenMap`, `activeNodeId`, `onNodeClick`      | `<ReactFlow>` from `@xyflow/react`. Styles in globals.css.      |
| **TreeNode**          | `{ label, role, provider, isActive, hasMultipleChildren }` | Colored box. Provider dot. Active ring.                         |

---

## Setup

```bash
# Local dev
npm install
cp .env.example .env.local              # Fill AUTH_SECRET, ENCRYPTION_KEY
docker run -d -p 27017:27017 --name branch-chat-mongo mongo:7
npm run dev                              # Turbopack → localhost:3000

# Production (Vercel + Atlas)
# 1. Create Atlas M0 cluster
# 2. Import to Vercel
# 3. Set: MONGODB_URI, AUTH_SECRET, AUTH_URL, ENCRYPTION_KEY
# 4. Deploy
```
