# Architecture Design Document — BranchChat

**Version 2.0 | March 31, 2026**

> Major design decisions were debated through a structured Proposer/Critic/Mediator deliberation. The full transcript is at `docs/decisions/architecture-debate.md`. This document presents the final decisions and their complete specifications.

---

## 1. Architecture Overview

BranchChat is a monolithic Next.js 16 application using the App Router, deployed on Vercel with MongoDB Atlas as the persistence layer. We chose a monolith because the SRD mandates Vercel deployment (optimized for Next.js), NextAuth v5 integrates natively with Next.js middleware, and the bounded scope does not justify multi-service overhead. See Decision 1 in `architecture-debate.md`.

Next.js 16 ships Turbopack as the default bundler for both development and production. The application uses React 19 (shipped with Next.js 16), Tailwind CSS 4 (CSS-first configuration), and @xyflow/react v12 (formerly ReactFlow) for tree visualization.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL (Production)                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Next.js 16 App Router (Turbopack)          │   │
│  │                                                              │   │
│  │  ┌─────────────────────┐    ┌────────────────────────────┐   │   │
│  │  │   Client Components │    │   API Route Handlers       │   │   │
│  │  │  Chat Panel         │    │   /api/auth/*              │   │   │
│  │  │  Tree Sidebar       │    │   /api/conversations/*     │   │   │
│  │  │  (@xyflow/react 12  │    │   /api/llm/chat            │   │   │
│  │  │   + Dagre 3)        │    │   /api/settings/api-keys/* │   │   │
│  │  │  Model Selector     │    │   /api/import               │   │   │
│  │  │                     │    │                            │   │   │
│  │  │  State: Context +   │    │  ┌──────────────────────┐  │   │   │
│  │  │  useReducer         │    │  │  LLM Provider Layer  │  │   │   │
│  │  └─────────────────────┘    │  │  OpenAI 6 │ Anthr.  │  │   │   │
│  │                             │  │  GenAI 1  │ Mock    │  │   │   │
│  │                             │  └──────────────────────┘  │   │   │
│  │                             └────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────┐                                               │
│  │  middleware.ts    │   NextAuth v5 JWT gate                        │
│  └──────────────────┘                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              MongoDB Atlas / Local Docker (mongo:7)                   │
│   Collections:  users  │  apiKeys  │  conversations  │  nodes        │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow for sending a message:**
1. User types message → client dispatches to `POST /api/llm/chat`.
2. Route handler validates auth, decrypts API key, loads all nodes from MongoDB.
3. Walks tree from parent node to root, assembles history, truncates tokens.
4. Calls LLM provider via the Provider Layer.
5. Inserts user node + assistant node into MongoDB.
6. Returns both nodes. Client reducer updates state, tree, and chat.

---

## 2. Tech Stack Decisions

For each choice, the deliberation reference is noted where applicable.

| Technology | Version | Purpose | Risk / Note |
|---|---|---|---|
| Next.js | 16.2.1 | Full-stack framework | Turbopack default; `next lint` removed. See Decision 1. |
| React | 19.2.4 | UI rendering | `forwardRef` removed; ref is a regular prop. |
| TypeScript | ^5 | Type safety | |
| Tailwind CSS | 4.2.2 | Styling | CSS-first config. No `tailwind.config.ts`. See below. |
| @tailwindcss/postcss | 4.2.2 | PostCSS plugin | Replaces direct `tailwindcss` PostCSS usage. |
| shadcn/ui | latest | Components | `new-york` style, OKLCH colors, `tw-animate-css`, `sonner` for toasts. |
| @xyflow/react | 12.10.2 | Tree visualization | Renamed from `reactflow`. `node.measured.width` API. See Decision 4. |
| @dagrejs/dagre | 3.0.0 | Tree layout | Maintained dagre fork. |
| MongoDB | 7.x | Database | Local Docker dev; Atlas production. |
| Mongoose | 9.3.3 | ODM | Async-only hooks; `next()` removed. UUID returns `bson.UUID`. |
| next-auth | 5.0.0-beta.30 | Auth | Install `next-auth@beta`. `AUTH_` env prefix. See Decision 7. |
| bcryptjs | 3.0.3 | Password hashing | Pure JS, zero native deps. |
| openai | 6.33.0 | OpenAI client | Responses API primary. |
| @anthropic-ai/sdk | 0.80.0 | Anthropic client | 0.x semver. |
| @google/genai | 1.47.0 | Gemini client | **Replaces deprecated `@google/generative-ai`**. `GoogleGenAI` class. |
| react-markdown | 10.1.0 | Markdown rendering | ESM-only. `className` prop removed. |
| react-syntax-highlighter | 16.1.1 | Code highlighting | Turbopack import issues; use `--webpack` fallback. |
| vitest | 4.1.2 | Test runner | |
| @testing-library/react | 16.3.2 | Component testing | `@testing-library/dom` is a required peer dep. |

---

## 3. Folder Structure

Every directory and file that will exist in the project:

```
branch-chat/
├── .env.local                          # Environment variables (git-ignored)
├── .env.example                        # Template with placeholder values
├── next.config.ts                      # Next.js configuration
├── postcss.config.mjs                  # { "@tailwindcss/postcss": {} }
├── tsconfig.json                       # TypeScript configuration
├── vitest.config.ts                    # Vitest + @vitejs/plugin-react + jsdom
├── package.json                        # Dependencies and scripts
├── middleware.ts                        # NextAuth v5 route protection
├── docker-compose.yml                  # Local MongoDB (mongo:7, port 27017)
│
├── docs/
│   └── decisions/
│       └── architecture-debate.md      # Deliberation transcript
│
├── public/                             # Static assets
│
├── src/
│   ├── app/
│   │   ├── globals.css                 # Tailwind 4: @import "tailwindcss"; @import "tw-animate-css";
│   │   │                               # @layer base { @import "@xyflow/react/dist/style.css"; }
│   │   │                               # @theme { --color-*: ...; --radius-*: ...; }
│   │   ├── layout.tsx                  # Root layout: AuthProvider + ToastProvider + global styles
│   │   ├── page.tsx                    # Landing redirect → /login or /dashboard
│   │   │
│   │   ├── (auth)/                     # Auth route group (public)
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Login page
│   │   │   └── register/
│   │   │       └── page.tsx            # Registration page
│   │   │
│   │   ├── (protected)/                # Protected route group (requires auth)
│   │   │   ├── layout.tsx              # Dashboard layout: ConversationProvider + UIProvider + sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Conversation list, new/import actions
│   │   │   ├── chat/
│   │   │   │   └── [conversationId]/
│   │   │   │       └── page.tsx        # Chat view for a conversation
│   │   │   └── settings/
│   │   │       └── page.tsx            # API key management
│   │   │
│   │   └── api/                        # API route handlers
│   │       ├── auth/
│   │       │   ├── register/
│   │       │   │   └── route.ts        # POST: create account
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts        # NextAuth v5 catch-all handler
│   │       ├── conversations/
│   │       │   ├── route.ts            # GET: list, POST: create
│   │       │   └── [id]/
│   │       │       ├── route.ts        # PATCH: rename, DELETE: delete + cascade nodes
│   │       │       ├── nodes/
│   │       │       │   ├── route.ts    # GET: all nodes for conversation
│   │       │       │   └── [nodeId]/
│   │       │       │       └── route.ts # DELETE: node + descendants
│   │       │       └── export/
│   │       │           └── route.ts    # GET: export conversation as JSON download
│   │       ├── llm/
│   │       │   └── chat/
│   │       │       └── route.ts        # POST: send message + get LLM response (maxDuration=60)
│   │       ├── settings/
│   │       │   └── api-keys/
│   │       │       ├── route.ts        # GET: list masked keys
│   │       │       └── [provider]/
│   │       │           └── route.ts    # PUT: set/update key, DELETE: remove key
│   │       └── import/
│   │           └── route.ts            # POST: import JSON tree
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx           # Email/password login form
│   │   │   └── RegisterForm.tsx        # Email/password registration form
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx           # Main chat message list (root-to-activeNode)
│   │   │   ├── ChatMessage.tsx         # Single message: Markdown + provider color + branch badge
│   │   │   ├── ChatInput.tsx           # Message textarea + send button + ModelSelector
│   │   │   ├── BranchIndicator.tsx     # Badge on branch-point messages (clickable)
│   │   │   ├── BranchMenu.tsx          # Dropdown listing sibling branches for navigation
│   │   │   ├── ModelSelector.tsx       # Provider + model dropdown (color-coded)
│   │   │   └── LoadingIndicator.tsx    # Pulsing dots while awaiting LLM response
│   │   ├── tree/
│   │   │   ├── TreeSidebar.tsx         # Collapsible sidebar panel
│   │   │   ├── TreeVisualization.tsx   # @xyflow/react canvas with Dagre layout
│   │   │   └── TreeNode.tsx            # Custom @xyflow/react node component
│   │   ├── sidebar/
│   │   │   ├── ConversationList.tsx    # Left sidebar conversation list
│   │   │   └── ConversationItem.tsx    # Single conversation: title + rename/delete
│   │   ├── settings/
│   │   │   ├── ApiKeyForm.tsx          # Single provider key input form
│   │   │   └── ApiKeyList.tsx          # Renders one ApiKeyForm per provider
│   │   ├── common/
│   │   │   ├── ConfirmDialog.tsx       # Reusable confirmation dialog
│   │   │   └── ToastProvider.tsx       # shadcn sonner toast wrapper
│   │   └── providers/
│   │       ├── AuthProvider.tsx         # NextAuth SessionProvider wrapper
│   │       ├── ConversationProvider.tsx # ConversationContext + useReducer
│   │       └── UIProvider.tsx           # UIContext (loading, sidebar, selectedModel)
│   │
│   ├── contexts/
│   │   ├── ConversationContext.ts      # createContext + types for conversation state
│   │   └── UIContext.ts                # createContext + types for UI state
│   │
│   ├── hooks/
│   │   ├── useConversation.ts          # Hook to access ConversationContext
│   │   ├── useUI.ts                    # Hook to access UIContext
│   │   ├── useTreeLayout.ts            # Dagre layout computation (memoized)
│   │   └── useActivePath.ts            # Root-to-activeNode path (memoized)
│   │
│   ├── lib/
│   │   ├── auth.ts                     # NextAuth v5 config: exports { handlers, auth, signIn, signOut }
│   │   ├── db.ts                       # Mongoose 9 connection singleton
│   │   ├── encryption.ts              # AES-256-GCM encrypt/decrypt for API keys
│   │   ├── tree.ts                     # getPathToRoot, buildChildrenMap, findDescendants
│   │   ├── tokenEstimator.ts          # Token count estimation (4 chars ≈ 1 token)
│   │   ├── contextBuilder.ts          # Assemble + truncate conversation history for LLM
│   │   └── providers/
│   │       ├── index.ts               # Provider registry + getProvider(name)
│   │       ├── types.ts               # LLMProvider interface, LLMMessage, LLMResponse
│   │       ├── openai.ts              # OpenAI SDK v6 implementation
│   │       ├── anthropic.ts           # Anthropic SDK v0.80 implementation
│   │       ├── gemini.ts              # @google/genai v1.47 implementation (GoogleGenAI class)
│   │       └── mock.ts                # Dev only: canned Markdown after 1s delay
│   │
│   ├── models/                         # Mongoose 9 schemas (async hooks only, no next() callbacks)
│   │   ├── User.ts
│   │   ├── ApiKey.ts
│   │   ├── Conversation.ts
│   │   └── Node.ts
│   │
│   ├── types/
│   │   ├── database.ts                # Database document types
│   │   ├── api.ts                      # API request/response interfaces
│   │   ├── tree.ts                     # TreeNode, ChildrenMap types
│   │   ├── llm.ts                      # LLM message/response types
│   │   └── export.ts                   # Export/import JSON format types
│   │
│   └── constants/
│       ├── providers.ts               # Provider definitions: { name, color, models[] }
│       └── models.ts                   # Hardcoded model list with context window sizes
│
└── __tests__/                          # Test files mirror src/ structure
    ├── api/
    │   ├── conversations.test.ts
    │   ├── nodes.test.ts
    │   ├── llm-chat.test.ts
    │   ├── api-keys.test.ts
    │   └── import-export.test.ts
    ├── lib/
    │   ├── tree.test.ts
    │   ├── contextBuilder.test.ts
    │   ├── encryption.test.ts
    │   └── tokenEstimator.test.ts
    └── components/
        ├── ChatPanel.test.tsx
        ├── TreeVisualization.test.tsx
        ├── ModelSelector.test.tsx
        └── BranchIndicator.test.tsx
```

---

## 4. Data Model

We chose a parent-pointer model with a flat nodes collection. See Decision 2 in `architecture-debate.md` for why this was preferred over adjacency list, nested documents, and materialized paths.

### 4.1 Users Collection

```typescript
// src/models/User.ts
import { Schema, model, models, Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;             // unique, lowercase, trimmed
  hashedPassword: string;    // bcryptjs hash, 10 salt rounds
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashedPassword: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>('User', UserSchema);
```

**Index:** `{ email: 1 }` unique.

### 4.2 API Keys Collection

```typescript
// src/models/ApiKey.ts
export interface IApiKey extends Document {
  _id: string;
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini';
  encryptedKey: string;      // AES-256-GCM ciphertext (hex)
  iv: string;                // 12-byte initialization vector (hex)
  authTag: string;           // GCM auth tag (hex)
  createdAt: Date;
  updatedAt: Date;
}

ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });
```

**Index:** `{ userId: 1, provider: 1 }` unique compound.

### 4.3 Conversations Collection

```typescript
// src/models/Conversation.ts
export interface IConversation extends Document {
  _id: string;
  userId: Types.ObjectId;
  title: string;             // 1-200 chars, trimmed
  defaultProvider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  defaultModel: string;
  rootNodeId: Types.ObjectId | null;  // set after first message
  createdAt: Date;
  updatedAt: Date;
}

ConversationSchema.index({ userId: 1, updatedAt: -1 });
```

**Index:** `{ userId: 1, updatedAt: -1 }`.

### 4.4 Nodes Collection

```typescript
// src/models/Node.ts
export interface INode extends Document {
  _id: string;
  conversationId: Types.ObjectId;
  parentId: Types.ObjectId | null;   // null = root node
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock' | null;  // null for user msgs
  model: string | null;              // null for user msgs
  createdAt: Date;
}

// timestamps: { createdAt: true, updatedAt: false }
NodeSchema.index({ conversationId: 1 });
NodeSchema.index({ conversationId: 1, parentId: 1 });
```

**Indexes:** `{ conversationId: 1 }`, `{ conversationId: 1, parentId: 1 }`.

**Tree rules:** Branching = insert a node with `parentId` → branch point. No other nodes modified. `childrenIds` computed client-side, not stored.

---

## 5. API Design

We chose RESTful resource-based endpoints. See Decision 6 in `architecture-debate.md`. All routes require auth unless marked PUBLIC. Every route verifies conversation ownership via `userId`.

### 5.1 Authentication

**POST `/api/auth/register`** — PUBLIC
```typescript
interface RegisterRequest { email: string; password: string; }  // min 8 chars
// 201: { id: string; email: string }
// 400: "Email and password are required" | "Password must be at least 8 characters"
// 409: "An account with this email already exists"
```

**`/api/auth/[...nextauth]`** — NextAuth v5 catch-all. Exports `handlers.GET` and `handlers.POST` from `src/lib/auth.ts`.

### 5.2 Conversations

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/conversations` | — | `{ conversations: { id, title, defaultProvider, defaultModel, rootNodeId, createdAt, updatedAt }[] }` |
| POST | `/api/conversations` | `{ title, defaultProvider, defaultModel }` | 201: created conversation |
| PATCH | `/api/conversations/[id]` | `{ title }` | 200: `{ id, title, updatedAt }` |
| DELETE | `/api/conversations/[id]` | — | 200: `{ deleted: true }`. Cascades: `Node.deleteMany` then `Conversation.deleteOne`. |

### 5.3 Nodes

| Method | Path | Response |
|---|---|---|
| GET | `/api/conversations/[id]/nodes` | `{ nodes: { id, parentId, role, content, provider, model, createdAt }[] }` |
| DELETE | `/api/conversations/[id]/nodes/[nodeId]` | `{ deletedCount, newActiveNodeId }`. BFS to find descendants, then deleteMany. |

### 5.4 LLM Chat

**POST `/api/llm/chat`** — Set `export const maxDuration = 60` in route file.
```typescript
interface LLMChatRequest {
  conversationId: string;
  parentNodeId: string | null;     // null = first message
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  model: string;
}

interface LLMChatResponse {
  userNode: { id, parentId, role: 'user', content, provider: null, model: null, createdAt };
  assistantNode: { id, parentId, role: 'assistant', content, provider, model, createdAt };
}

// Errors: 422 (no key), 429 (rate limit), 502 (invalid key / API error), 504 (timeout)
```

**Orchestration** (see Decision 3 in `architecture-debate.md`):
1. Validate fields → 2. Verify ownership → 3. Decrypt API key (missing→422)
4. Load all nodes → 5. Walk parentNodeId→root, reverse → 6. Append user message
7. Estimate tokens, truncate oldest if >80% of model limit → 8. Format for provider
9. Insert user node → 10. Call LLM → 11. Success: insert assistant node, return both
12. Failure: keep user node for retry, return error code

### 5.5 Settings — API Keys

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/settings/api-keys` | — | `{ keys: { provider, maskedKey, updatedAt }[] }` |
| PUT | `/api/settings/api-keys/[provider]` | `{ apiKey }` | 200. Upsert with AES-256-GCM. |
| DELETE | `/api/settings/api-keys/[provider]` | — | 200. |

### 5.6 Export & Import

| Method | Path | Details |
|---|---|---|
| GET | `/api/conversations/[id]/export` | JSON download. `Content-Disposition: attachment`. Includes `childrenIds` computed at export time. |
| POST | `/api/import` | `{ jsonData: ExportedTree }` → 201. Validates tree integrity, generates new IDs, remaps parentIds. |

```typescript
interface ExportedTree {
  version: 1;
  exportedAt: string;
  title: string;
  nodes: { id, parentId, childrenIds: string[], role, content, provider, model, createdAt }[];
}
```

---

## 6. Component Architecture

### Pages

| File | Renders | Data Flow |
|---|---|---|
| `layout.tsx` (root) | AuthProvider → ToastProvider → children | Pure wrapper |
| `(auth)/login/page.tsx` | LoginForm | Redirects if authenticated |
| `(auth)/register/page.tsx` | RegisterForm | Redirects if authenticated |
| `(protected)/layout.tsx` | ConversationProvider → UIProvider → sidebar + children | Fetches conversation list |
| `(protected)/dashboard/page.tsx` | ConversationList + create/import buttons | Reads from ConversationContext |
| `(protected)/chat/[id]/page.tsx` | ChatPanel + ChatInput + TreeSidebar | Loads nodes, sets activeConversationId |
| `(protected)/settings/page.tsx` | ApiKeyList | Fetches/manages keys |

### Chat Components

| Component | Props | Key Behavior |
|---|---|---|
| **ChatPanel** | `activePath: TreeNode[]`, `onBranchNavigate` | Maps path → ChatMessage. Auto-scrolls. Shows LoadingIndicator. |
| **ChatMessage** | `node`, `childCount`, `isActive`, `onBranchClick` | react-markdown rendering. Provider color border. BranchIndicator if childCount > 1. |
| **ChatInput** | `onSend`, `disabled`, `defaultProvider`, `defaultModel` | State: message, provider/model. Clears on send. |
| **ModelSelector** | `value: {provider, model}`, `onChange`, `availableProviders` | shadcn DropdownMenu, grouped by provider, color-coded. |
| **BranchIndicator** | `nodeId`, `branchCount`, `onClick` | Badge with count. Click opens BranchMenu. |
| **BranchMenu** | `parentNodeId`, `children[]`, `activeChildId`, `onSelect` | Sibling list with truncated preview + provider color. |

### Tree Components

| Component | Props | Key Behavior |
|---|---|---|
| **TreeSidebar** | `isOpen`, `onToggle` | Toggle always visible. Renders TreeVisualization when open. |
| **TreeVisualization** | `nodes`, `childrenMap`, `activeNodeId`, `onNodeClick` | `useTreeLayout` for Dagre. `<ReactFlow>` from `@xyflow/react`. Styles in globals.css. |
| **TreeNode** | `{ label, role, provider, isActive, hasMultipleChildren }` | Colored box, provider dot, active ring. |

---

## 7. Key Algorithms

Detailed pseudocode for non-trivial logic. See Decisions 2, 3, and 4 in `architecture-debate.md`.

### 7.1 Tree Path Reconstruction

```
function getPathToRoot(nodeId, nodesMap):
    path = []
    currentId = nodeId
    WHILE currentId IS NOT null:
        node = nodesMap.get(currentId)
        IF node IS null: THROW "Node not found"
        path.push(node)
        currentId = node.parentId
    path.reverse()
    RETURN path                    // root first, target last
    // O(depth)
```

### 7.2 Build Children Map

```
function buildChildrenMap(nodes):
    childrenMap = new Map()
    FOR EACH [nodeId, node] IN nodes:
        IF NOT childrenMap.has(nodeId): childrenMap.set(nodeId, [])
        IF node.parentId IS NOT null:
            IF NOT childrenMap.has(node.parentId): childrenMap.set(node.parentId, [])
            childrenMap.get(node.parentId).push(nodeId)
    RETURN childrenMap             // O(n)
```

### 7.3 Find Descendants (for subtree deletion)

```
function findDescendants(nodeId, childrenMap):
    descendants = []
    queue = [nodeId]
    WHILE queue IS NOT empty:
        currentId = queue.shift()
        children = childrenMap.get(currentId) OR []
        FOR EACH childId IN children:
            descendants.push(childId)
            queue.push(childId)
    RETURN descendants             // O(k) where k = descendants
```

### 7.4 Context Building with Token Truncation

See Decision 3 in `architecture-debate.md` for the design rationale.

```
function buildContext(parentNodeId, newUserMessage, nodesMap, modelContextLimit):
    IF parentNodeId IS NOT null:
        pathNodes = getPathToRoot(parentNodeId, nodesMap)
    ELSE:
        pathNodes = []

    messages = pathNodes.map(n => ({ role: n.role, content: n.content }))
    messages.push({ role: "user", content: newUserMessage })

    effectiveLimit = floor(modelContextLimit * 0.80)    // 20% safety margin
    totalTokens = estimateTokens(messages)

    WHILE totalTokens > effectiveLimit AND messages.length > 1:
        removed = messages.shift()                       // drop oldest
        totalTokens -= estimateTokensForMessage(removed)

    RETURN messages

function estimateTokens(messages):
    total = 0
    FOR EACH msg IN messages:
        total += ceil(msg.content.length / 4) + 4       // +4 message overhead
    RETURN total
```

### 7.5 Dagre Tree Layout (@xyflow/react v12)

See Decision 4 in `architecture-debate.md`. **Critical**: v12 uses `node.measured.width`, not `node.width`.

```
function computeLayout(nodes, childrenMap, activeNodeId):
    graph = new dagre.graphlib.Graph()
    graph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 70, marginx: 20, marginy: 20 })
    graph.setDefaultEdgeLabel(() => ({}))

    FOR EACH [nodeId, node] IN nodes:
        graph.setNode(nodeId, {
            width: node.measured?.width ?? 180,      // v12: measured, NOT node.width
            height: node.measured?.height ?? 60
        })

    FOR EACH [parentId, children] IN childrenMap:
        FOR EACH childId IN children:
            graph.setEdge(parentId, childId)

    dagre.layout(graph)

    rfNodes = nodes → map to { id, type: "treeNode", position: { x: pos.x-90, y: pos.y-30 }, data: {...} }
    rfEdges = childrenMap → map to { id, source, target, type: "smoothstep" }
    RETURN { rfNodes, rfEdges }
```

### 7.6 LLM Provider Implementations

```typescript
// src/lib/providers/types.ts
interface LLMMessage { role: 'user' | 'assistant' | 'system'; content: string; }
interface LLMResponse { content: string; provider: string; model: string; }
interface LLMProvider {
  name: string;
  sendMessage(messages: LLMMessage[], model: string, apiKey: string): Promise<LLMResponse>;
}
```

**OpenAI** (SDK v6): `new OpenAI({ apiKey })` → `client.chat.completions.create({ model, messages })`.

**Anthropic** (SDK v0.80): `new Anthropic({ apiKey })` → extract system messages into `system` param → `client.messages.create({ model, max_tokens: 4096, system, messages })`.

**Google Gemini** (@google/genai v1.47 — NOT @google/generative-ai):
```
const ai = new GoogleGenAI({ apiKey });
const history = messages.slice(0,-1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
const chat = ai.chats.create({ model, history });
const response = await chat.sendMessage({ message: lastMessage });
return { content: response.text, provider: 'gemini', model };
```

**Mock** (dev only): Sleep 1s → return canned Markdown. Registered only when `NODE_ENV === 'development'`.

### 7.7 Import Validation

```
function validateTreeIntegrity(nodes):
    roots = nodes.filter(n => n.parentId === null)
    IF roots.length !== 1: THROW "Must have exactly one root"

    ids = new Set(nodes.map(n => n.id))
    FOR EACH node IN nodes:
        IF node.parentId !== null AND NOT ids.has(node.parentId):
            THROW "References non-existent parent"

    // BFS from root to verify all reachable
    reachable = BFS(roots[0].id, childrenMap)
    IF reachable.size !== nodes.length: THROW "Disconnected nodes"
```

---

## 8. Environment Variables

| Variable | Dev Value | Prod Value |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/branch-chat` | Atlas connection string |
| `AUTH_SECRET` | Any random string (`openssl rand -base64 32`) | Strong random string |
| `AUTH_URL` | `http://localhost:3000` | Production URL |
| `ENCRYPTION_KEY` | Any 64-char hex (`openssl rand -hex 32`) | Strong production key |

Note: NextAuth v5 uses the `AUTH_` prefix, not `NEXTAUTH_`. LLM provider API keys are stored per-user in MongoDB, not as environment variables.

---

## 9. Deployment Architecture

### Local Development
```bash
npm install
cp .env.example .env.local       # Fill AUTH_SECRET, ENCRYPTION_KEY
docker run -d -p 27017:27017 --name branch-chat-mongo mongo:7
npm run dev                       # Turbopack dev server → localhost:3000
```
Mock provider available automatically. No external API keys needed.

### Production (Vercel + MongoDB Atlas)
1. Create MongoDB Atlas M0 free-tier cluster.
2. Import repo to Vercel.
3. Set env vars in Vercel dashboard: `MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL`, `ENCRYPTION_KEY`.
4. Deploy. Turbopack builds automatically.

---

## 10. Security Considerations

- **Auth flow**: Register → bcryptjs hash (10 rounds) → store. Login → CredentialsProvider → compare → JWT cookie. Session validated via `auth()` in middleware and every route handler.
- **Data isolation**: Every MongoDB query scoped by `userId`. Node operations verify conversation ownership first.
- **API key encryption**: AES-256-GCM. `ENCRYPTION_KEY` in env var. IV (12 bytes) + authTag stored per key. Decryption only server-side in LLM route. Masked display: `sk-...abc`.
- **Input validation**: Provider/model validated against hardcoded list. Email format + password length on registration. Import JSON validated for tree integrity. react-markdown sanitizes HTML by default.
- **CSRF**: NextAuth v5 built-in protection. JWT cookie is `httpOnly`, `sameSite: lax`.
- **Known issue**: NextAuth v5 `signIn` server action fails on Next.js 16 (issue #13388). Workaround: use HTTP route handlers (`handlers.GET`/`handlers.POST`) only.

---

## 11. Known Tradeoffs & Technical Debt

| # | Tradeoff | Current Approach | Production Alternative | Deliberation Ref |
|---|---|---|---|---|
| 1 | Vercel serverless timeout | `maxDuration=60` on LLM route | Vercel Pro (300s) or persistent backend | Decision 1, Critic concern 2 |
| 2 | No encryption key rotation | Single `ENCRYPTION_KEY` | Key versioning + re-encryption migration | Decision 7, Critic concern 2 |
| 3 | Approximate token estimation | 4 chars/token + 20% margin | Provider-specific tokenizers (tiktoken, etc.) | Decision 3, Critic concern 2 |
| 4 | No rate limiting | BYO-Key self-limits | Upstash Redis rate limiter | Decision 6, Critic concern 2 |
| 5 | Context re-renders | Context + useReducer, two-context split | Zustand with selectors | Decision 5, Critic concern 1 |
| 6 | next-auth v5 still beta | Pin exact 5.0.0-beta.30 | Monitor stable release; consider Better Auth | Decision 7, Critic concern 1 |
| 7 | react-syntax-highlighter Turbopack issues | `--webpack` flag fallback | Migrate to `shiki` | — |
| 8 | next-auth signIn server action bug (Next.js 16) | Use HTTP route handlers only | Await fix in next-auth#13388 | Decision 7, Known issue |
| 9 | No server-side session revocation | JWT sessions (no DB lookup) | Database sessions or JWT blacklist | Decision 7, Critic concern 3 |
| 10 | Full node reload per LLM call | Load all nodes every time | Redis/Vercel KV cache with TTL | Decision 3, Critic concern 1 |
