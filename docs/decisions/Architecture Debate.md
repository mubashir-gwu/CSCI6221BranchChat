# Architecture Deliberation

## Decision 1: Application Architecture

### Proposer
I recommend a **monolithic Next.js 16 application** using the App Router — no separate backend.

Next.js 16 ships Turbopack as the default bundler, provides API route handlers, and deploys as a single unit on Vercel. The SRD mandates Next.js (App Router) and Vercel deployment. A monolith aligns because:

1. **Single deployment**: Vercel is optimized for Next.js. A separate backend would need Railway/Render, adding cost and two deployment pipelines.
2. **Shared TypeScript types**: Node, Conversation, User types used on both frontend (rendering) and backend (DB ops) share at import time with zero duplication.
3. **Auth simplicity**: NextAuth v5 integrates natively with Next.js middleware and API routes. A split architecture would require shared session stores or JWT validation on both sides.
4. **Bounded scope**: No real-time collaboration (SRD §2.2 item 6), no mobile apps (item 7), no plugin system (item 11). No architectural pressure for microservices.

### Critic
**Cold starts**: Vercel serverless functions have 100-500ms cold start latency. For a chat app where users expect quick acknowledgment before the LLM responds, this adds perceived sluggishness.

**Timeouts**: Even with non-streaming responses (SRD §2.1 item 9), LLM calls can take 5-30 seconds. Vercel's free tier allows 60s via `maxDuration`, but complex prompts with large context could exceed this.

**Future separation**: If the project needs a mobile client or CLI, API routes are coupled to Next.js and would need extraction.

### Mediator
**Decision: Monolithic Next.js 16 application.**

Cold starts are acceptable — LLM response time (seconds) dwarfs cold start (milliseconds). Timeouts: set `maxDuration = 60` on the LLM route handler; document as a known tradeoff. Future separation: acknowledged as technical debt, explicitly out of scope. The deployment simplicity, type sharing, and auth integration are decisive.

---

## Decision 2: Data Model for the Conversation Tree

### Proposer
I recommend a **parent-pointer model with a flat nodes collection** in MongoDB.

Each node stores `parentId` pointing to its parent (`null` for root). No `childrenIds` array stored.

1. **Branching is O(1) writes** (FR-019, FR-020): Insert a new node with `parentId` → branch point. No other nodes modified. Directly satisfies FR-020 ("Creating a branch does not modify any existing branches").
2. **Path reconstruction** (FR-012, FR-030): Walk from current node up to root via `parentId` links, reverse the array. Load all nodes per conversation once, then traverse in-memory.
3. **Subtree deletion** (FR-021): Load all nodes, BFS to find descendants, then `deleteMany`.
4. **MongoDB fit**: Flat documents, no nesting. No 16MB document limit risk.

Why not adjacency list (storing `childrenIds`): requires a write to the parent node on every child creation.
Why not nested document: hits 16MB limit for large conversations, complex atomic branch operations.
Why not materialized path: fragile string manipulation, unnecessary when loading all nodes anyway.

### Critic
**Path reconstruction loads all nodes**: For a 500-node tree, this means loading 500 documents every time we navigate. That's a lot of reads.

**No childrenIds means extra computation**: To render the tree visualization (FR-024), we must compute children by iterating all nodes and grouping by `parentId`.

**Export format** (FR-032): The SRD acceptance criteria mentions `childrenIds` in the export. We'd compute them at export time.

### Mediator
**Decision: Parent-pointer model, childrenIds computed client-side.**

Load all nodes once when a conversation opens, cache in frontend state. Navigation between nodes is client-side tree traversal — no additional DB queries. 500 nodes × ~1KB each = ~500KB, trivial. childrenIds computed via O(n) map on the client. At export time, compute and include childrenIds.

**Indexes**: `{ conversationId: 1 }` (primary query), `{ conversationId: 1, parentId: 1 }` (server-side child lookup).

---

## Decision 3: LLM Context Building

### Proposer
I recommend **walking up the tree at call time**, performed **server-side** in the API route handler.

1. Client sends `POST /api/llm/chat` with `{ conversationId, parentNodeId, content, provider, model }`.
2. Server loads all nodes for the conversation (single query).
3. Server walks from `parentNodeId` to root, collects nodes, reverses to root-first order.
4. Server appends the new user message.
5. Server truncates oldest messages if total tokens exceed 80% of the model's context window.
6. Server formats for the selected provider's API and calls the LLM.

Why walk-at-call-time: no stored path to maintain (branching would require copying the entire ancestor path). Truncation is dynamic per model — same path may be full for one model but truncated for another.

Token estimation: `ceil(content.length / 4) + 4` per message — simple heuristic with a 20% safety margin.

### Critic
**Redundant loading**: Every message send loads all nodes. If a user sends 10 messages in a row, we load the same tree 10 times.

**Token estimation inaccuracy**: 4 chars/token is rough. Code-heavy conversations could undercount significantly.

**Provider formatting**: Different providers need different message formats. This logic must be cleanly separated.

### Mediator
**Decision: Walk the tree at call time, server-side. Conservative token estimation.**

Redundant loading: acceptable at this scale. MongoDB query for 500 documents takes single-digit ms. Token estimation: 4-chars heuristic with 20% safety margin (use 80% of stated limit). If the API still rejects, error handling (FR-034) catches it. Provider formatting: clean abstraction layer with per-provider formatters.

---

## Decision 4: Tree Visualization Approach

### Proposer
I recommend **@xyflow/react v12** (formerly ReactFlow) with **Dagre** for layout.

The SRD mandates ReactFlow (§2.3). In v12, the package is renamed to `@xyflow/react` with `@xyflow/react` as the npm package. Key v12 change: measured node dimensions moved from `node.width`/`node.height` to `node.measured.width`/`node.measured.height`.

**Layout**: Use `@dagrejs/dagre` 3.0.0 to compute x/y positions. Top-to-bottom orientation (`rankdir: "TB"`). Node dimensions read from `node.measured` with fallback defaults.

**Styles**: Import `@xyflow/react/dist/style.css` in `globals.css` inside `@layer base {}` — NOT in a component (Tailwind 4 requires CSS-level imports).

### Critic
**Dagre adds ~30KB** to the bundle. For a course project, acceptable.

**Re-layout on every change**: When a node is added, the entire tree must be re-laid out. At 500 nodes, Dagre layout takes <10ms, but ReactFlow re-render of all nodes could cause jank.

**Vertical scrolling**: A deep conversation tree in top-to-bottom layout requires scrolling. Left-to-right might be more natural.

### Mediator
**Decision: @xyflow/react v12 + Dagre 3.0.0, top-to-bottom.**

Bundle size acceptable. Re-layout performance fine at 500 nodes — memoize via `useCallback`. Top-to-bottom orientation: the tree sidebar is vertical, root at top matches "conversation flows down." Use `fitView()` on tree changes.

---

## Decision 5: State Management

### Proposer
I recommend **React Context + useReducer** with a **two-context split**.

**ConversationContext** (stable data): `conversations[]`, `activeConversationId`, `nodes Map`, `activeNodeId`.
**UIContext** (volatile data): `isLoading`, `isSidebarOpen`, `selectedProvider`, `selectedModel`.

Derived values (`activePath`, `childrenMap`) computed via `useMemo`, never stored.

Why not Redux/Zustand: ~10 reducer actions total. No async middleware needed. React Context works natively with Next.js client components. The two-context split prevents loading state changes from re-rendering the tree.

### Critic
**Re-renders**: Context causes all consumers to re-render when any value changes. No selector pattern like Zustand.

**Devtools**: No equivalent to Redux Devtools for Context+useReducer.

### Mediator
**Decision: Context + useReducer, two-context split.**

The two-context split mitigates the re-render concern. Memoize expensive computations. At 500 nodes, even a full tree re-render takes <16ms. If performance becomes an issue, migrate to Zustand (similar API, straightforward swap).

---

## Decision 6: API Design

### Proposer
I recommend **RESTful resource-based endpoints** using Next.js App Router route handlers.

14 endpoints total. Resources map directly to SRD entities. A separate `POST /api/llm/chat` handles the message+LLM orchestration (not a pure CRUD operation).

Export is `GET /api/conversations/[id]/export` (read operation, not POST).

### Critic
**Two-step message flow**: The LLM endpoint creates both user and assistant nodes atomically. If the user wanted to create a node without triggering an LLM call, there's no separate endpoint. The SRD doesn't require this but it's noted.

**No rate limiting**: A user could hammer the LLM endpoint. Self-limiting via BYO-Key, but the server has no protection.

### Mediator
**Decision: RESTful endpoints. Export as GET. LLM chat as single orchestrating POST. No rate limiting (documented debt).**

---

## Decision 7: Auth and Data Isolation

### Proposer
I recommend **NextAuth v5 (next-auth@beta, 5.0.0-beta.30)** with JWT sessions, middleware for route protection, and per-query user scoping.

**Layer 1 — Middleware**: `middleware.ts` uses NextAuth's `auth()` to redirect unauthenticated users to `/login`. Protects all routes except `/login`, `/register`, `/api/auth/*`.

**Layer 2 — Per-query scoping**: Every database query includes `userId` from the session. Even if an attacker guesses a conversation ID, the query won't return data.

**NextAuth v5 specifics**: Environment variables use `AUTH_` prefix (not `NEXTAUTH_`). Config exports `{ handlers, auth, signIn, signOut }` from `NextAuth()`. JWT strategy (no DB session lookup per request).

**API key encryption**: AES-256-GCM. `ENCRYPTION_KEY` env var (32-byte hex). Decryption only server-side in the LLM route handler.

**Known issue**: The `signIn` server action has a bug on Next.js 16 (GitHub issue #13388). Use HTTP route handlers (`handlers.GET`/`handlers.POST`) instead.

### Critic
**NextAuth v5 is still beta** after 2+ years. Auth.js recently merged with Better Auth. The long-term trajectory is uncertain.

**No key rotation**: If `ENCRYPTION_KEY` is compromised, all stored API keys are exposed.

**JWT sessions can't be revoked server-side**: No invalidation after password change.

### Mediator
**Decision: NextAuth v5 beta (pinned to 5.0.0-beta.30). JWT sessions. Middleware + per-query scoping.**

The beta is widely used in production and is the only version with active development. Pin the exact version. Key rotation and session revocation are documented as technical debt. The `signIn` server action bug is worked around by using HTTP handlers only.
