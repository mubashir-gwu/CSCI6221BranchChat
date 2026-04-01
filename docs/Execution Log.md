# Execution Log

## F-01: Project Scaffolding & Configuration

**Status:** Complete  
**Date:** 2026-03-31

### T-001: Initialize Next.js 16 Project
- Scaffolded Next.js 16.2.2 with TypeScript, Tailwind, App Router, `src/` directory
- Cleaned boilerplate pages/components
- `npm run build` passes, `npm run dev` starts on localhost:3000

### T-002: Configure Tailwind CSS 4 and PostCSS
- Simplified `postcss.config.mjs` to match spec exactly
- `globals.css` uses `@import "tailwindcss"` (CSS-first, no `tailwind.config.ts`)
- Build passes

### T-003: Install shadcn/ui and Configure Theme
- Deliberation conducted and saved to `docs/decisions/scaffolding/T-003-*`
- Initialized shadcn/ui with new-york style, OKLCH colors, tw-animate-css
- Installed 11 base components: button, input, label, dialog, dropdown-menu, sonner, card, badge, separator, scroll-area, tooltip
- `globals.css` has full OKLCH `--color-*` and `--radius-*` variables in `@theme inline {}` block
- No `tailwind.config.ts` created — pure CSS-first config
- Build passes

### T-004: Create Folder Structure and Placeholder Files
- Created 71 files across all directories specified in Architecture Document §3
- All page routes, API routes, components, contexts, hooks, lib, models, types, and constants have valid TypeScript stubs
- Middleware stub uses passthrough (NextAuth integration deferred to F-02)
- `npm run build` passes with all routes recognized

### T-005: Configure Vitest, Docker Compose, and Environment Templates
- Installed vitest@4, @vitejs/plugin-react, jsdom, @testing-library/react@16, @testing-library/dom, @testing-library/jest-dom
- Created `vitest.config.ts` with jsdom environment, globals, tsconfigPaths
- Added `test` and `test:watch` scripts to package.json
- Created `docker-compose.yml` with MongoDB 7
- Created `.env.example` with all 4 required variables
- `.gitignore` covers `.env*`, `node_modules`, `.next`
- `npm test` exits 0 (no test files yet)
- Build passes

### Revision Pass (2026-03-31)

**Fixes applied: 2/2**

1. **vitest.config.ts path resolution** — Replaced invalid `resolve: { tsconfigPaths: true }` block with `vite-tsconfig-paths` plugin in the plugins array. Config now correctly uses the installed package.
2. **Pin devDependency versions to CLAUDE.md spec** — Updated `@tailwindcss/postcss` from `^4` to `4.2.2`, `tailwindcss` from `^4` to `4.2.2`, `@vitejs/plugin-react` from `^6.0.1` to `^4`, `jsdom` from `^29.0.1` to `^25`, `vite-tsconfig-paths` from `^6.1.1` to `^5`. `npm install`, `npm run build`, and `npm test` all pass.

**Fixes that couldn't be applied:** None

**New concerns noticed:** None

---

## F-02: Database Layer

**Status:** Complete  
**Date:** 2026-03-31

### T-006: Implement MongoDB Connection Singleton
- Installed `mongoose@9.3.3`
- Implemented `src/lib/db.ts` with global cache pattern to prevent multiple connections during Next.js hot-reload
- Reads `MONGODB_URI` from environment, throws if undefined
- `npm run build` passes

### T-007: Implement User Model
- Implemented `src/models/User.ts` with `IUser` interface and Mongoose schema
- Fields: `email` (unique, lowercase, trimmed), `hashedPassword` (required), `timestamps: true`
- Note: Removed explicit `_id: string` from interface — Mongoose 9's `Document` type already provides `_id` as `ObjectId`, and overriding to `string` causes a type conflict
- `npm run build` passes

### T-008: Implement ApiKey Model
- Implemented `src/models/ApiKey.ts` with `IApiKey` interface
- Fields: `userId` (ref User), `provider` (enum: openai/anthropic/gemini), `encryptedKey`, `iv`, `authTag`
- Compound unique index on `{ userId: 1, provider: 1 }`
- `npm run build` passes

### T-009: Implement Conversation Model
- Implemented `src/models/Conversation.ts` with `IConversation` interface
- Fields: `userId`, `title` (maxlength 200, trimmed), `defaultProvider` (enum includes mock), `defaultModel`, `rootNodeId` (default null)
- Index on `{ userId: 1, updatedAt: -1 }`
- `npm run build` passes

### T-010: Implement Node Model
- Implemented `src/models/Node.ts` with `INode` interface
- Fields: `conversationId`, `parentId` (default null), `role` (user/assistant/system), `content`, `provider` (nullable), `model` (nullable)
- `timestamps: { createdAt: true, updatedAt: false }` — nodes are immutable
- Two indexes: `{ conversationId: 1 }` and `{ conversationId: 1, parentId: 1 }`
- Note: `model` field name conflicts with Mongoose `Document.model()` method. Fixed by using a standalone `INode` interface (not extending `Document`) and untyped `model()` call. Schema field name remains `model` as specified.
- `npm run build` passes

### Revision Pass (2026-03-31)

**Fixes applied: 1/1**

1. **db.ts rejected promise caching** — Wrapped `cached.conn = await cached.promise` in a try/catch. On failure, `cached.promise` is set to `null` and the error re-thrown, allowing subsequent `connectDB()` calls to retry instead of permanently returning a rejected promise.

**Fixes that couldn't be applied:** None

**New concerns noticed:** None

### Final Verification
- `npm run build` passes with no errors
- `npm run dev` starts cleanly on localhost:3000

---

## F-03: Authentication

**Status:** Complete  
**Date:** 2026-03-31

### T-011: Install NextAuth v5 and bcryptjs
- Installed `next-auth@5.0.0-beta.30`, `bcryptjs@3.0.3`, `@types/bcryptjs`
- Pinned exact versions in `package.json` (removed `^` prefix)
- `npm run build` passes

### T-012: Implement NextAuth v5 Configuration
- Replaced stub `src/lib/auth.ts` with full NextAuth v5 CredentialsProvider config
- JWT session strategy, custom `/login` page, jwt/session callbacks for user.id
- Exports: `handlers`, `auth`, `signIn`, `signOut`, plus destructured `GET`/`POST`
- **Workaround:** `src/lib/db.ts` had an eager `MONGODB_URI` check at module scope that broke builds when auth route was imported. Changed to deferred check via `getMongoURI()` function called at connect time.
- Deliberation saved to `docs/decisions/authentication/T-012-debate.md` and `T-012-plan.md`
- `npm run build` passes

### T-013: Implement Auth Route Handlers
- `[...nextauth]/route.ts` imports handlers from auth config
- `register/route.ts`: validates email/password, checks min 8 chars, checks duplicate emails (409), hashes with bcrypt 10 rounds, returns 201 `{ id, email }`
- `npm run build` passes

### T-014: Implement Auth Middleware
- Replaced stub middleware with `export { auth as middleware }` from NextAuth v5
- Matcher protects `(protected)` routes and API routes (conversations, llm, settings, import)
- `/api/auth/*`, `/login`, `/register` remain public
- `npm run build` passes

### T-015: Implement Login and Register Pages + AuthProvider
- `AuthProvider.tsx`: wraps children in `SessionProvider` from `next-auth/react`
- `LoginForm.tsx`: email/password form, uses client-side `signIn("credentials", { redirect: false })`, redirects to `/dashboard` on success, shows error on failure, links to `/register`
- `RegisterForm.tsx`: email/password form, calls `POST /api/auth/register`, auto-signs-in on success, shows appropriate errors (409 → "Email already exists"), links to `/login`
- Auth pages render forms centered on screen
- Root `layout.tsx` wraps children with `AuthProvider` and `Toaster`
- Root `page.tsx` checks auth and redirects to `/dashboard` or `/login`
- `npm run build` passes

### T-016: Implement Logout Functionality
- Protected layout has temporary header with "BranchChat" title and "Logout" button
- Logout calls `signOut({ callbackUrl: "/login" })` from `next-auth/react`
- `npm run build` passes

### Revision Pass (2026-03-31)

**Fixes applied: 5/5**

1. **Middleware matcher pattern** — Replaced `'/(protected)/:path*'` with explicit URL paths `'/dashboard'`, `'/chat/:path*'`, `'/settings'`. Route groups are file-system only and don't appear in request URLs, so the original pattern never matched.
2. **Auth redirect on login page** — Added server-side `auth()` check; redirects to `/dashboard` if already authenticated. Page is now async/dynamic.
3. **Auth redirect on register page** — Same as fix #2 for the register page.
4. **Register 409 error message** — Changed `"Email already exists"` to `"An account with this email already exists"` to match Architecture Document §5.1.
5. **Removed unnecessary exports from auth.ts** — Removed `export const { GET, POST } = handlers;` from `src/lib/auth.ts`. These are only needed in the route handler file (`[...nextauth]/route.ts`), which already imports and re-exports them correctly.

**Fixes that couldn't be applied:** None

**New concerns noticed:** None

### Final Verification
- `npm run build` passes with no errors
- `npm run dev` starts cleanly on localhost:3000

---

## F-04: Protected Layout & Conversation Management

**Status:** Complete  
**Date:** 2026-03-31

### T-017: Implement Shared Types
- Implemented `src/types/database.ts` — client-side interfaces mirroring Mongoose documents (DBUser, DBApiKey, DBConversation, DBNode)
- Implemented `src/types/api.ts` — request/response interfaces for all API endpoints
- Implemented `src/types/tree.ts` — TreeNode interface and ChildrenMap type
- Implemented `src/types/llm.ts` — re-exports LLMMessage, LLMResponse from providers/types
- Implemented `src/types/export.ts` — ExportedTree interface per Architecture Document §5.6
- Implemented `src/constants/providers.ts` — provider definitions with name, displayName, color
- Implemented `src/constants/models.ts` — hardcoded model list with context window sizes
- `npm run build` passes

### T-018: Implement ConversationContext and UIContext
- Deliberation conducted and saved to `docs/decisions/conversation-management/T-018-*`
- Two-context split as specified: ConversationContext for data, UIContext for UI state
- `ConversationContext` — state: conversations, activeConversationId, nodes (Map), activeNodeId; 9 action types via useReducer
- `UIContext` — state: isLoading, isSidebarOpen, isTreeOpen, selectedProvider, selectedModel; 4 action types
- Both providers use `useMemo` for context value stability
- ConversationProvider fetches conversations on mount via `GET /api/conversations`
- Hooks `useConversation()` and `useUI()` throw descriptive errors when used outside providers
- `npm run build` passes

### T-019: Implement Conversation API Routes
- `GET /api/conversations` — lists user's conversations sorted by updatedAt desc
- `POST /api/conversations` — creates conversation with title/provider/model validation
- `PATCH /api/conversations/[id]` — renames with ownership check, title validation
- `DELETE /api/conversations/[id]` — cascade deletes nodes then conversation with ownership check
- All routes authenticate via `auth()` and scope queries by userId
- `npm run build` passes

### T-020: Implement Nodes API Routes
- Implemented `src/lib/tree.ts` — getPathToRoot, buildChildrenMap, findDescendants utility functions
- `GET /api/conversations/[id]/nodes` — returns all nodes with ownership verification
- `DELETE /api/conversations/[id]/nodes/[nodeId]` — BFS cascading deletion with newActiveNodeId
- `npm run build` passes

### T-021: Implement Protected Layout with Conversation Sidebar
- Updated protected layout to wrap children with ConversationProvider + UIProvider
- Layout: sidebar (w-64) with ConversationList + logout button, main content area
- `ConversationList` — sorted conversation items, "New Conversation" dialog with title input
- `ConversationItem` — click navigates, inline rename, delete with ConfirmDialog
- `ConfirmDialog` — reusable shadcn Dialog with confirm/cancel, destructive variant
- `ToastProvider` already in root layout from F-03
- `npm run build` passes

### T-022: Implement Dashboard Page
- Empty state: "No conversations yet" with create button
- Returning state: "Welcome back" with sidebar prompt
- API key banner: checks `GET /api/settings/api-keys`, shows warning when no keys configured
- `npm run build` passes

### T-023: Write Tests for Conversation and Node API
- `__tests__/api/conversations.test.ts` — 13 tests covering GET, POST, PATCH, DELETE
- `__tests__/api/nodes.test.ts` — 8 tests covering GET and DELETE with cascading
- Tests mock auth, db, and Mongoose models; no external dependencies
- All 21 tests pass via `npm test`

### Final Verification
- `npm run build` passes with no errors
- `npm run dev` starts cleanly on localhost:3000
- `npm test` — 21 tests pass (2 test files)

## F-04 Audit Cycle 1 — Fixes

**Status:** Complete  
**Date:** 2026-03-31

### Fixes Applied (4/4)

1. **Wrapped all API route handlers in try-catch with CastError handling** — `conversations/route.ts`, `[id]/route.ts`, `[id]/nodes/route.ts`, `[id]/nodes/[nodeId]/route.ts`. Invalid ObjectId now returns `400 { error: "Invalid ID format" }` instead of unhandled 500. All other unexpected errors return `500 { error: "Internal server error" }`.

2. **Wrapped `request.json()` in inner try-catch for malformed body handling** — `conversations/route.ts` (POST), `[id]/route.ts` (PATCH). Missing or invalid JSON body now returns `400 { error: "Invalid request body" }`.

3. **Removed `showCloseButton={false}` from ConfirmDialog** — `ConfirmDialog.tsx`. Removed unrecognized prop from `<DialogContent>`.

4. **Replaced direct Toaster import with ToastProvider in root layout** — `layout.tsx`. Now imports and renders `ToastProvider` from `@/components/common/ToastProvider` as specified by T-021.

### Fixes That Could Not Be Applied
- None

### New Concerns Noticed
- None

### Verification
- `npm run build` passes with no errors

---

## F-05: API Key Management

**Status:** Complete  
**Date:** 2026-03-31

### T-024: Implement AES-256-GCM Encryption Utilities
- Implemented `src/lib/encryption.ts` with `encrypt`, `decrypt`, and `maskKey` functions
- Used lazy key buffer initialization to avoid build-time errors when `ENCRYPTION_KEY` env var is absent
- `encrypt` uses 12-byte random IV, AES-256-GCM, returns hex-encoded `{ encryptedKey, iv, authTag }`
- `maskKey` shows first 3 + "..." + last 3 chars; returns "***" for keys ≤6 chars

### T-025: Implement API Key API Routes
- `GET /api/settings/api-keys` — returns masked keys with provider and updatedAt, scoped by userId
- `PUT /api/settings/api-keys/[provider]` — validates provider against allowlist, encrypts key, upserts into ApiKey collection
- `DELETE /api/settings/api-keys/[provider]` — deletes key scoped by userId and provider
- All routes check auth, validate provider, scope queries by userId

### T-026: Implement Settings Page UI
- `ApiKeyForm` — per-provider card with password input, Save/Delete buttons, masked key display, toast feedback
- `ApiKeyList` — fetches keys on mount, renders form per provider (openai, anthropic, gemini; mock excluded)
- `settings/page.tsx` — renders ApiKeyList with "API Key Settings" heading

### T-027: Write Tests for Encryption and API Key Routes
- `__tests__/lib/encryption.test.ts` — round-trip, tamper detection (authTag + ciphertext), maskKey variants (10 tests)
- `__tests__/api/api-keys.test.ts` — GET/PUT/DELETE with auth, validation, and success cases (8 tests)
- All 18 F-05 tests pass; full suite 39/39

### Known Issues / Workarounds
- Encryption key buffer is lazily initialized via `getKeyBuffer()` function instead of module-level constant, because `process.env.ENCRYPTION_KEY` is not available at Next.js build time (static analysis phase). This is intentional — the env var is only needed at runtime.

### Verification
- `npm run build` passes with no errors
- `npm run dev` starts without errors
- All 39 tests pass

## F-05 Audit Cycle 1 — Fixes

**Status:** Complete  
**Date:** 2026-03-31

### Fixes Applied (2/2)

1. **Per-key error handling in GET route** — Wrapped the per-key `decrypt()`+`maskKey()` call inside `.map()` in a try/catch. On failure, returns `{ provider, maskedKey: "[error]", updatedAt }` so the user can still see and delete corrupted entries. Logs the error server-side via `console.error`.

2. **Deduplicate ALLOWED_PROVIDERS from ApiKey model enum** — Exported `API_KEY_PROVIDERS` constant and `ApiKeyProvider` type from `src/models/ApiKey.ts`. The schema enum and the `[provider]/route.ts` validation both reference this single constant. Removed the hardcoded `ALLOWED_PROVIDERS` from the route file. Updated test mock to include the new export.

### Fixes That Could Not Be Applied
- None

### New Concerns Noticed
- None

### Verification
- `npm run build` passes with no errors
- All 39 tests pass

---

## F-06: Core Tree Utilities

**Status:** Complete  
**Date:** 2026-04-01

### T-028: Implement Tree Path and Children Map Functions
- `getPathToRoot` and `buildChildrenMap` were already implemented in `src/lib/tree.ts` during earlier scaffold/API work
- Uses typed `TreeNode` and `ChildrenMap` from `src/types/tree.ts`
- `getPathToRoot` walks parentId chain to root, reverses for root-first order
- `buildChildrenMap` groups nodes by parentId into a Map
- Build passes

### T-029: Implement Find Descendants Function
- `findDescendants` was already implemented in `src/lib/tree.ts`
- Uses BFS via queue to collect all descendant node IDs (excluding the start node)
- Returns empty array for leaf nodes
- Build passes

### T-030: Implement Token Estimator
- Implemented `estimateTokens` and `estimateTokensForMessage` in `src/lib/tokenEstimator.ts`
- Formula: `Math.ceil(content.length / 4) + 4` per message (4 chars ≈ 1 token + 4 overhead)
- Build passes

### T-031: Write Tests for Tree Utilities and Token Estimator
- Created `__tests__/lib/tree.test.ts` with 15 tests covering:
  - `getPathToRoot`: linear chain, root node, missing node, branching tree
  - `buildChildrenMap`: linear, branching, single-node, empty map
  - `findDescendants`: leaf, linear chain, branching tree, subtree, exclusion of self, unknown node
- Created `__tests__/lib/tokenEstimator.test.ts` with 6 tests covering:
  - Single message estimation (short, empty, long)
  - Multiple messages, empty array, varying lengths
- All 21 new tests pass (60 total across project)

### Workarounds & Known Issues
- None

### Verification
- `npm run build` passes with no errors
- `npm run dev` starts on localhost:3000
- All tests pass

---

## F-08: Chat Interface & LLM Integration

**Status:** Complete  
**Date:** 2026-04-01

### T-036: Implement LLM Chat API Route
- Deliberation conducted and saved to `docs/decisions/chat-llm-integration/T-036-*`
- Implemented full 12-step orchestration in `src/app/api/llm/chat/route.ts` per Architecture Document §5.4
- Validates provider against PROVIDERS, model against MODELS, mock only in development
- Auth check, conversation ownership verification, API key decryption (skip for mock)
- Builds context via `buildContext()` with token truncation at 80% of model limit
- Inserts user node, calls LLM, inserts assistant node, returns both with 201
- Sets `rootNodeId` on first message (parentNodeId === null)
- Error classification: 422 (no key), 429 (rate limit), 502 (invalid key / API error)
- User node preserved on LLM failure for retry (FR-035)
- `maxDuration = 60` exported
- CastError and malformed JSON handling match existing route patterns
- Build passes

### T-037: Implement ModelSelector Component
- Implemented `src/components/chat/ModelSelector.tsx` using shadcn DropdownMenu
- Groups models by provider with color-coded dots
- Only shows providers with API keys configured (via `availableProviders` prop)
- Mock provider shown only in development
- Selected value displays provider + model name with color indicator
- Build passes

### T-038: Implement ChatMessage Component
- Installed `react-markdown@10.1.0`, `react-syntax-highlighter@16.1.1`, `@types/react-syntax-highlighter@15.5.13`
- Implemented `src/components/chat/ChatMessage.tsx` with react-markdown + Prism syntax highlighting
- User messages styled with primary background, assistant messages with muted background + provider color left border
- Provider/model badge on assistant messages
- BranchIndicator shown when `childCount > 1`
- Also implemented `BranchIndicator.tsx` (badge with branch icon and count) and `BranchMenu.tsx` (sibling list with preview + provider color)
- Build passes

### T-039: Implement ChatInput and LoadingIndicator Components
- Implemented `src/components/chat/ChatInput.tsx` with textarea, send button, ModelSelector
- Enter sends, Shift+Enter for newline, clears on send, disabled when loading
- Pre-selects parent node's provider/model via props
- Implemented `src/components/chat/LoadingIndicator.tsx` with animated bouncing dots
- Build passes

### T-040: Implement ChatPanel Component
- Implemented `src/components/chat/ChatPanel.tsx` using shadcn ScrollArea
- Maps `activePath` to ChatMessage components with childCount from childrenMap
- Auto-scrolls to bottom on new messages or loading state change
- Shows LoadingIndicator when `isLoading` is true
- Empty state message when no messages
- Implemented `src/hooks/useActivePath.ts` — memoized hook using `getPathToRoot`
- Build passes

### T-041: Implement Chat Page (Wire Everything Together)
- Implemented `src/app/(protected)/chat/[conversationId]/page.tsx`
- On mount: fetches nodes, builds nodesMap, walks to deepest leaf for activeNodeId
- Fetches available providers via `GET /api/settings/api-keys`
- Message send flow: POST to `/api/llm/chat`, adds nodes to state, sets active to assistant node
- Error handling with toast notifications
- Pre-fills ModelSelector from active node's provider/model or conversation defaults
- Fixed TypeScript circular inference issue with explicit `string[]` type annotation
- Build passes

### T-042: Markdown Rendering Fix for Turbopack
- Tested `npm run dev` (Turbopack) — react-markdown v10 and react-syntax-highlighter work correctly
- No `--webpack` fallback needed, no `transpilePackages` config required
- Turbopack correctly bundles ESM-only react-markdown and Prism syntax highlighter
- No code changes required

### T-043: Write Tests for LLM Chat Route
- Created `__tests__/api/llm-chat.test.ts` with 16 tests
- Tests cover: auth (401), validation (400), missing key (422), ownership (403/404), successful send (201), first message rootNodeId, context building, mock provider without key, rate limit (429), invalid key (502), generic error (502), user node preservation on failure
- All tests mock LLM providers — no real API calls
- All 82 tests pass (16 new + 66 existing)

### Workarounds & Known Issues
- **TypeScript circular inference**: `const children = childrenMap.get(currentId) ?? []` inside a while loop caused "implicitly has type 'any'" error. Fixed by adding explicit `string[]` type annotation.
- **Tailwind 4 class naming**: `break-words` → `wrap-break-word` per Tailwind 4 canonical class names.

### Verification
- `npm run build` passes with no errors
- `npm run dev` starts on localhost:3000 (Turbopack, syntax highlighting works)
- All 82 tests pass (8 test files)

## F-08: Chat Interface & LLM Integration — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-01

### Fixes Applied (6/6)

1. **ChatInput selection state not synced with prop changes** — Added `useEffect` in `ChatInput.tsx` to sync `selection` state when `defaultProvider`/`defaultModel` props change.
2. **Gemini provider does not handle system role messages** — Separated system messages from history and passed via `config.systemInstruction` in `gemini.ts`.
3. **No loading indicator during initial node fetch** — Added `SET_LOADING` true/false around `loadNodes()` in `chat/[conversationId]/page.tsx`.
4. **First-child leaf selection ignores previously active branch** — Added URL hash (`#nodeId`) check on page load; update hash on send, branch navigate, and initial leaf walk.
5. **Auth check after input validation leaks valid provider/model names** — Moved auth check to immediately after JSON parsing in `llm/chat/route.ts`, before any input validation.
6. **parentNodeId not validated against conversation** — Added explicit check after building `nodesMap` in `llm/chat/route.ts`, returns 400 if parentNodeId not found.

### Verification
- `npm run build` passes with no errors

## F-08: Chat Interface & LLM Integration — Audit Cycle 2 Fixes

**Status:** Complete  
**Date:** 2026-04-01

### Fixes Applied (1/1)

1. **Tests not updated for parentNodeId validation fix** — Updated the default `mockNodeFind` mock in `beforeEach` (`__tests__/api/llm-chat.test.ts`) to return a node with `_id: "node-1"` so parentNodeId validation passes. All 8 previously failing tests now pass (16/16 total).

### Verification
- All 16 tests in `__tests__/api/llm-chat.test.ts` pass
- `npm run build` passes with no errors
- No new concerns noticed

## F-08: Gemini Model ID Fix

**Status:** Complete  
**Date:** 2026-04-01

### Issue
The Gemini model ID `gemini-2.0-flash` is no longer available on Google's free tier (quota is 0). Testing with the standalone `@google/genai` SDK confirmed the API returns 429 `RESOURCE_EXHAUSTED` with `limit: 0` for this model. The correct current model ID is `gemini-3-flash-preview`.

### Fix
Updated the Gemini model entry in:
- `src/constants/models.ts` — `gemini-2.0-flash` → `gemini-3-flash-preview`, display name → `Gemini 3 Flash`
- `docs/Task Breakdown Document.md` — same change in the T-017 models constant definition

### Workaround / Notes
- The audit report for F-04 (`docs/audits/f-04-*-audit-cycle-1.md`) references the old model name in a passing note; left as-is since it reflects what was true at audit time.
- If Google deprecates this model in the future, update the `gemini` array in `src/constants/models.ts` again.

## F-09: Tree Branching & Navigation

**Status:** Complete  
**Date:** 2026-04-01

### T-044: Implement Branch Creation Flow
- Deliberation conducted and saved to `branch-chat/docs/decisions/tree-branching/T-044-*`
- Added `findDeepestLeaf` utility to `src/lib/tree.ts` for navigating to branch endpoints
- Updated `ChatPanel` to accept `nodesMap` and pass resolved child nodes + active child ID to `ChatMessage`
- Updated `page.tsx` to pass `nodesMap` through to ChatPanel
- Branch creation already worked via existing `handleSend` flow (uses `activeNodeId` as `parentNodeId`)

### T-045: Implement BranchIndicator Integration
- `BranchIndicator` component already existed from F-08
- Updated `ChatMessage` to toggle a `BranchMenu` popup when indicator is clicked
- Added click-outside handler to close the menu
- Branch menu shows all children of the branch point with content previews

### T-046: Implement BranchMenu Sibling Navigation
- Updated `handleBranchNavigate` in `page.tsx` to use `findDeepestLeaf`
- Selecting a branch from the menu navigates to the deepest leaf of that subtree
- Active branch is highlighted in the menu via `activeChildId`

### T-047: Implement Node Deletion from Chat
- Added delete button (Trash2 icon) to `ChatMessage`, visible on hover via Tailwind `group-hover`
- `ConfirmDialog` shown before deletion with destructive styling
- `handleDeleteNode` in `page.tsx` calls `DELETE /api/conversations/:id/nodes/:nodeId`
- On success: removes deleted node + all descendants from state, navigates to parent's deepest leaf
- Handles edge case of deleting root (clears active node)

### T-048: Write Tests for Branching Components
- Created `__tests__/components/BranchIndicator.test.tsx` (4 tests): badge rendering, click callback, correct count
- Created `__tests__/components/ChatPanel.test.tsx` (5 tests): empty state, message rendering, branch indicator visibility, loading state
- All 91 tests pass across the full suite

## F-09 Audit Cycle 2: Fix Revision Findings

**Status:** Complete  
**Date:** 2026-04-01

### Fixes Applied (2/2)

1. **Stale childrenMap after deletion** — Removed `findDeepestLeaf` call in `handleDeleteNode` (`page.tsx`). Now sets `activeNodeId` directly to `data.newActiveNodeId` returned by the API, avoiding stale `childrenMap` from pre-deletion render.

2. **Root node deletion does not clear conversation.rootNodeId** — Added check in `DELETE /api/conversations/[id]/nodes/[nodeId]` route: if the deleted node has `parentId === null`, updates `conversation.rootNodeId` to `null`.

### Build Verification
- `npm run build` passes after both fixes

---

## F-10: Tree Visualization

**Status:** Complete  
**Date:** 2026-04-01

### T-049: Install @xyflow/react v12 and dagre
- Installed `@xyflow/react@12.10.2` and `@dagrejs/dagre@3.0.0`
- Added ReactFlow CSS import to `globals.css` inside `@layer base`
- Build passes

### T-050: Implement useTreeLayout Hook with Dagre
- Deliberation saved to `docs/decisions/tree-visualization/T-050-debate.md` and `T-050-plan.md`
- Implemented `src/hooks/useTreeLayout.ts` with Dagre graph layout
- Uses `rankdir: "TB"`, `nodesep: 50`, `ranksep: 70`, constant node dimensions 180x60
- Returns `rfNodes` (type `treeNode`, with label/role/provider/isActive/hasMultipleChildren data) and `rfEdges` (type `smoothstep`)
- Memoized with `useMemo`

### T-051: Implement Custom TreeNode Component
- Implemented `src/components/tree/TreeNode.tsx` with provider color border, role icons (User/Bot from lucide), active ring highlight, truncated content preview, and branch indicator (GitBranch icon)
- Uses `Handle` from `@xyflow/react` for Top/Bottom connections
- Wrapped in `memo` for performance

### T-052: Implement TreeVisualization and TreeSidebar
- `TreeVisualization` renders `<ReactFlow>` with custom `nodeTypes`, `Controls`, and `MiniMap`. Supports pan/zoom and node click navigation. Shows empty state when no nodes.
- `TreeSidebar` is a collapsible right-side panel (320px wide) with toggle button always visible. Connected to `UIContext.isTreeOpen` state via `TOGGLE_TREE` action.
- Wired into `chat/[conversationId]/page.tsx`: clicking a tree node sets `activeNodeId` and updates URL hash. Layout uses flex row with chat taking remaining space.

### T-053: Write Tests
- `TreeVisualization.test.tsx`: 4 tests — correct node count, active node highlight, node click callback, empty state
- `ModelSelector.test.tsx`: 4 tests — provider groups with colors, current selection display, onChange callback, provider filtering by API keys
- All 8 new tests pass, full suite of 99 tests passes

### Build Verification
- `npm run build` passes with no errors
- All 99 tests pass via `npx vitest run`
