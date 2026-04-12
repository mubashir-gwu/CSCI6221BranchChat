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

### Audit Cycle 1 Fixes
- **Date:** 2026-04-01
- 2/2 fixes applied successfully from `docs/signals/f-10-tree-visualization/REQUIRES_REVISION`
- Fix 1: `useTreeLayout.ts` — replaced hardcoded `NODE_WIDTH`/`NODE_HEIGHT` in `graph.setNode()` with `node.measured?.width ?? 180` / `node.measured?.height ?? 60` per spec §7.5
- Fix 2: `useTreeLayout.ts` — added guard `nodes.has(parentId) && nodes.has(childId)` before `graph.setEdge()` to prevent dangling edges
- `npm run build` passes after fixes
- No new concerns noticed

### Audit Cycle 2 Fixes
- **Date:** 2026-04-01
- 1/1 fix applied successfully from `docs/signals/f-10-tree-visualization/REQUIRES_REVISION`
- Fix 1: `useTreeLayout.ts` — added missing `nodes.has()` guard to rfEdges loop (lines 64-72), matching the guard already present in the Dagre edge loop
- `npm run build` passes after fix
- No new concerns noticed

---

## F-11: Export & Import

**Status:** Complete  
**Date:** 2026-04-01

### T-054: Implement Export API Route
- Implemented `GET /api/conversations/:id/export` with auth + ownership check
- Returns `ExportedTree` JSON with `Content-Disposition: attachment` header
- Computes `childrenIds` server-side from parentId relationships
- Includes `version: 1`, `exportedAt`, `title`, and all node metadata

### T-055: Implement Import Validation
- Added `validateTreeIntegrity()` to `src/lib/tree.ts`
- Validates: exactly one root, all parentIds reference existing nodes, all nodes reachable via BFS
- Throws descriptive errors for each violation type

### T-056: Implement Import API Route
- Implemented `POST /api/import` with auth check and full validation
- Validates version, tree integrity, and node array presence
- Generates new ObjectIds for all nodes with old→new ID remapping
- Creates new Conversation and inserts all remapped nodes via `insertMany`
- Returns 201 with `{ conversationId, title, nodeCount }`

### T-057: Wire Export/Import Buttons in UI
- Added Export button to chat page header bar (triggers file download)
- Added Import button to ConversationList sidebar (opens file picker)
- Import: reads file client-side, parses JSON, sends to API, navigates to new conversation on success
- Error toasts for invalid JSON and API failures

### T-058: Write Tests for Export and Import
- Created `__tests__/api/import-export.test.ts` with 20 tests covering export, import, and round-trip
- Added 6 `validateTreeIntegrity` tests to `__tests__/lib/tree.test.ts`
- All 121 tests pass across 13 test files
- `npm run build` passes with no errors

## F-12: Error Handling & Polish

**Status:** Complete  
**Date:** 2026-04-01

### T-059: Implement LLM Error Handling with Toast Notifications
- Replaced generic error toast with status-code-specific messages in chat page `handleSend`
- 422 → missing API key message, 429 → rate limit with Retry button, 502 → invalid key or API error, 504 → timeout with Retry, network error → Retry button
- No partial assistant nodes created on failure (user optimistic node removed on error)

### T-060: Implement Provider Availability Check in ModelSelector
- Moved available providers fetch from chat page local state into UIProvider (cached in UIContext)
- Removed workaround from commit d3dc7d7 — provider auto-fallback now handled in UIProvider
- ModelSelector now shows ALL providers, disabling those without keys with "(no key)" label
- Selecting a disabled provider shows toast directing user to Settings
- Mock provider always enabled in development

### T-061: Add Keyboard Shortcuts and Accessibility Basics
- Added `aria-label` to BranchIndicator, ChatMessage delete button, ChatInput textarea/send button
- Added `role="menu"` and `role="menuitem"` with `aria-current` to BranchMenu
- Added `role="button"`, `tabIndex`, keyboard handler (Enter/Space), `aria-label`, `aria-current` to ConversationItem
- Added `aria-label` to TreeVisualization ReactFlow container
- Added `aria-label` to ConversationItem rename/delete buttons
- Enter/Shift+Enter behavior on chat input was already correct from F-08
- ConfirmDialog uses shadcn Dialog which already handles focus trapping

### T-062: Final Integration Verification and Build Check
- `npm run build` passes with zero errors
- `npm test` passes: 121 tests across 13 test files
- Updated ModelSelector test to match new T-060 behavior (providers shown but disabled instead of hidden)

## F-12: Error Handling & Polish — Audit Cycle 2 Fixes

**Status:** Complete  
**Date:** 2026-04-01

### Fixes Applied: 3/3

1. **Orphaned user node on LLM failure** — `src/app/api/llm/chat/route.ts`: Added `Node.deleteOne` cleanup in the LLM error catch block. If the failed message was the first in a conversation, `rootNodeId` is also reset to `null`. This prevents orphaned user nodes from creating duplicate branches on retry.

2. **422 toast missing clickable settings link** — `src/app/(protected)/chat/[conversationId]/page.tsx`: Added `useRouter` and changed the 422 toast to use sonner's `action` option with a "Go to Settings" button that navigates to `/settings`.

3. **Stale closure in UIProvider.refreshProviders** — `src/components/providers/UIProvider.tsx`: Replaced `state.selectedProvider` dependency in `useCallback` with a `useRef` that syncs via `useEffect`. The callback now has an empty dependency array and reads the ref for current state.

### Build Verification
- `npm run build` passes with zero errors

### Audit Cycle 2 — Fixer Pass

**Fixes applied:** 2/2

1. **Test mock missing `Node.deleteOne`** — `__tests__/api/llm-chat.test.ts`: Added `mockNodeDeleteOne` to the Node mock and initialized it with `mockResolvedValue({ deletedCount: 1 })` in `beforeEach`. This unblocks the 3 LLM error tests (429/502) that were hitting `TypeError` on the unmocked `deleteOne` call.

2. **Stale test "should preserve user node on LLM failure for retry"** — `__tests__/api/llm-chat.test.ts`: Renamed to "should delete user node on LLM failure to prevent orphans" and added assertion that `mockNodeDeleteOne` was called with the user node's `_id`.

**Build:** passes. **Tests:** 16/16 pass.

## F-14: UI Fixes & Polish

**Status:** Complete  
**Date:** 2026-04-07

### T-065: Make Only Assistant Nodes Clickable in Tree View
- Updated `TreeVisualization.tsx` `onNodeClick` handler to ignore clicks on user nodes (`data.role === 'user'`)
- Updated `TreeNode.tsx` to apply `cursor-default` on user nodes and `cursor-pointer hover:border-primary/50` on assistant nodes

### T-066: Scope Delete Button to User Messages Only
- Updated `ChatMessage.tsx` to conditionally render delete button and confirm dialog only when `isUser` is true

### T-067: Change Delete Button to Muted Red
- Changed delete button styling from `bg-destructive text-destructive-foreground` to `text-red-400/70` with `hover:text-red-500` transition

### T-068: Fix Error Toast Icon
- Updated `ToastProvider.tsx` to pass `icons={{ error: <AlertTriangle /> }}` to sonner `<Toaster>` component

### T-069: Remove ReactFlow Connection Handles from Tree Nodes
- Made `<Handle>` elements invisible via zero-size Tailwind classes while keeping them in DOM for edge rendering

### T-070: Write/Update Tests for UI Fixes
- Added test: user node click does NOT call `onNodeClick` in `TreeVisualization.test.tsx`
- Added test: delete button renders for user messages only in `ChatPanel.test.tsx`
- All 124 tests pass, build passes

---

## F-15: Branch from Bubble & Minimap Toggle

**Status:** Complete  
**Date:** 2026-04-07

### T-071: Add "New Branch from Here" to BranchMenu
- Added `onNavigateToNode` prop to `BranchMenu`, `ChatMessage`, and `ChatPanel`
- BranchMenu renders a "+ New branch from here" option at the bottom, separated by a divider
- Clicking it calls `handleTreeNodeClick` which sets the parent assistant node as `activeNodeId`, allowing the user to type a new branch
- Existing branch navigation options still work
- Build passes

### T-072: Add Minimap Toggle to Tree Sidebar
- Added `isMinimapVisible: boolean` (default `true`) to `UIState` in `UIContext.ts`
- Added `TOGGLE_MINIMAP` action to reducer in `UIProvider.tsx`
- Exposed `isMinimapVisible` and `toggleMinimap` convenience function from `useUI` hook
- Added Eye/EyeOff toggle button in `TreeSidebar.tsx` header next to "Tree View" label
- `TreeVisualization.tsx` conditionally renders `<MiniMap>` based on `isMinimapVisible`
- Session-only preference (resets on reload)
- Build passes

### T-073: Write Tests for Branch from Bubble and Minimap Toggle
- Created `__tests__/components/BranchMenu.test.tsx` with 4 tests: renders option, hides when no callback, calls navigate with parentNodeId, existing options still work
- Updated `__tests__/components/TreeVisualization.test.tsx` with 2 new tests: MiniMap renders when visible, MiniMap hidden when not visible
- Added `useUI` mock and updated ReactFlow mock to pass through children
- All 11 tests in these files pass, build passes

## F-16: Theme Switching

**Status:** Complete  
**Date:** 2026-04-07

### T-074: Install next-themes and Configure ThemeProvider
- `next-themes` was already installed; added `ThemeProvider` wrapper in root layout (`layout.tsx`)
- Added `suppressHydrationWarning` to `<html>` tag
- Fixed `@custom-variant dark` to use `(&:where(.dark, .dark *))` per CLAUDE.md spec
- Dark mode CSS variables already present in `globals.css`
- Build passes, no hydration errors

### T-075: Create ThemeToggle Component
- Created `src/components/common/ThemeToggle.tsx` with shadcn DropdownMenu
- Three options: Light (Sun icon), Dark (Moon icon), System (Monitor icon)
- Uses `useTheme()` from `next-themes`
- Placed in protected layout sidebar header alongside BranchChat title
- Build passes

### T-076: Write Tests for ThemeToggle Component
- Created `__tests__/components/ThemeToggle.test.tsx` with 5 tests
- Tests: renders without crashing, shows three options, calls setTheme for dark/light/system
- Mocks `next-themes` `useTheme` hook
- All 135 tests pass (15 files), build passes

## F-17: Server-Level API Keys & Provider Availability Gating

**Status:** Complete  
**Date:** 2026-04-07

### T-077: Create TokenUsage Model
- Created `src/models/TokenUsage.ts` with unique compound index on `{ userId, provider }`
- Fields: userId, provider (enum), inputTokens, outputTokens, callCount, updatedAt
- Build passes

### T-078: Create Provider Availability Utility and API Route
- Created `src/lib/providers/availability.ts` with `getAvailableProviders()`, `isProviderAvailable()`, `getProviderApiKey()`
- Checks env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY); includes mock in dev
- Created `GET /api/providers` route (auth required)
- Added `/api/providers/:path*` and `/usage` to middleware matcher

### T-079: Update LLM Provider Interface and Implementations
- Removed `apiKey` parameter from `LLMProvider.sendMessage()` interface
- Each provider now reads its key from `process.env` internally
- Added `inputTokens`/`outputTokens` to `LLMResponse` (required fields)
- OpenAI: extracts from `response.usage.prompt_tokens`/`completion_tokens`
- Anthropic: extracts from `response.usage.input_tokens`/`output_tokens`
- Gemini: extracts from `response.usageMetadata.promptTokenCount`/`candidatesTokenCount`
- Mock: estimates tokens from content length (`ceil(length/4)`)

### T-080: Update LLM Chat Route Handler
- Removed encryption/ApiKey imports and decryption logic
- Added `isProviderAvailable()` check — returns 422 if provider env var not set
- Added token usage tracking via `TokenUsage.findOneAndUpdate` with `$inc` and `upsert`
- Token tracking wrapped in try/catch so failures don't break chat response

### T-081: Create Token Usage API Route and Usage Page
- Created `GET /api/token-usage` route returning per-provider usage for authenticated user
- Created `TokenUsageCard` component in `src/components/dashboard/` — displays cards per provider with input/output tokens and call count
- Created `/usage` page rendering TokenUsageCard
- Added `/api/token-usage/:path*` to middleware matcher

### T-082: Update ModelSelector for Provider Availability Gating
- Changed UIProvider to fetch from `/api/providers` instead of `/api/settings/api-keys`
- Preserved fetch-and-dispatch pattern to avoid stale-closure bugs
- Updated ModelSelector labels: "(no key)" → "(not available)"
- Updated toast message to remove Settings reference
- Exposed `availableProviders` from `useUI()` hook

### T-083: Update Import to Default to Available Provider
- Import route now checks if default provider (openai) is available
- Falls back to first available provider if not
- Uses `MODELS` constant to set matching default model

### T-084: Remove Dead Code
- Deleted: `ApiKey` model, `encryption.ts`, `ApiKeyForm`, `ApiKeyList`, settings page, settings API routes
- Deleted: `api-keys.test.ts`, `encryption.test.ts`
- Updated protected layout: Settings → Usage link
- Removed dashboard API keys check banner
- Cleaned ApiKey types from `api.ts` and `database.ts`
- Removed `/settings` and `/api/settings/:path*` from middleware matcher
- Updated `.env.example`: removed `ENCRYPTION_KEY`, added LLM API key placeholders

### T-085: Update LLM Chat Route Error Handling
- 422 error now shows "Provider X is not available" instead of "No API key found"
- Removed "Go to Settings" action from error toast
- Updated 502 invalid key message to say "Contact your administrator"
- Removed unused `useRouter` import

### T-086: Write Tests
- Created `providers-availability.test.ts` — 10 tests for availability utility
- Updated `llm-chat.test.ts` — removed encryption/ApiKey mocks, added provider availability mock, added token usage tracking tests
- Created `usage.test.ts` — 3 tests for token usage API
- Created `providers.test.ts` — 3 tests for providers API
- Updated `ModelSelector.test.tsx` — updated "(no key)" → "(not available)", added availability gating tests
- All 142 tests pass (16 files), build passes

## F-17: Server-Level API Keys — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-07

### Fixes Applied (3/3)

1. **ModelSelector: "No providers available" disabled state** — Added early return when `availableProviders.length === 0` that renders a disabled button with "No providers available" text instead of showing stale hardcoded values.

2. **UIProvider: Clear selected model when no providers available** — Added `else` branch in `refreshProviders` to dispatch `SET_SELECTED_MODEL` with empty strings (`provider: "", model: ""`) when `providers.length === 0`.

3. **ChatInput: Disable send when provider unavailable** — Added `isProviderUnavailable` check (empty provider or not in `availableProviders`). Applied to both `handleSend` guard and send button `disabled` prop.

### Verification
- `npm run build` passes
- No new concerns noticed

---

## F-17: Server-Level API Keys — Audit Cycle 2 Fix

**Status:** Complete
**Date:** 2026-04-07

### Fixes Applied (1/1)

1. **Token tracking guard logically incorrect** — Removed the `if (llmResponse.inputTokens || llmResponse.outputTokens)` guard so every successful LLM call is always tracked (including when both token counts are `0`). Changed `|| 0` to `?? 0` inside `$inc` to preserve legitimate `0` values while still defaulting `undefined`/`null`.

### Verification
- `npm run build` passes
- No new concerns noticed

---

## F-18: Auto-Title Conversations

**Status:** Complete  
**Date:** 2026-04-07

### T-087: Implement Auto-Title Logic in LLM Chat Route
- Added `generateTitle()` helper function in `src/app/api/llm/chat/route.ts`
- Uses same provider/model as the chat message to generate a concise title (max 6 words)
- Fire-and-forget pattern: title generation does not block the HTTP response
- Title truncated to 200 characters
- Token usage tracked for the title generation call
- On failure, error is silently caught — conversation keeps "New Conversation"
- Triggers when `conversation.title === "New Conversation"`

### T-088: Update Client to Reflect Auto-Generated Titles
- After first message response (detected by `state.activeNodeId === null`), re-fetches conversation list
- No `setTimeout` or polling — just a single fetch after the response
- If title generation hasn't completed server-side yet, title updates on next natural re-fetch

### T-089: Write Tests for Auto-Title
- Added 5 tests to `__tests__/api/llm-chat.test.ts`:
  - Title generation triggers when title is "New Conversation"
  - Title generation does NOT trigger for existing titles
  - Main response unaffected by title generation failure
  - Token usage tracked for title generation call
  - Title truncated to 200 characters
- All 23 tests pass

### Verification
- `npm run build` passes
- `npm test` — all tests pass

---

## F-19: File-Based Logging

**Status:** Complete  
**Date:** 2026-04-07

### T-090: Create Logger Module and Configure Log Directory
- Created `src/lib/logger.ts` with structured JSON logger
- Log levels: TRACE, DEBUG, INFO, WARN, ERROR (configurable via `LOG_LEVEL` env var)
- Writes JSON lines to `logs/app.log`, auto-creates `logs/` directory
- Added `logs/` to `.gitignore`
- `.env.example` already had `LOG_LEVEL=INFO`

### T-091: Add Logging to API Routes
- Instrumented all 10 API route files with entry/exit/error logging
- Each route generates a `requestId` via `crypto.randomUUID()` for correlation
- LLM chat route has detailed logging: LLM call started/completed with provider, model, token counts, duration
- All log entries include userId and requestId in context

### T-092: Add Logging to Auth, Database, and Auto-Title
- Auth: login attempt, success, and failure (with reason) logged in CredentialsProvider
- Database: connection attempt (with masked URI), success, and failure logged
- Auto-title: generation start, success (with title), and failure logged

### T-093: Write Tests for Logger Module
- Created `__tests__/lib/logger.test.ts` with 7 tests
- Tests: JSON line writing, context inclusion, extra fields, log level filtering, directory creation, field validation, all log levels
- Uses temp directories to avoid polluting real logs

### Verification
- `npm run build` passes
- `npm test` — all tests pass

---

## F-19: Logging — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-07

### Fixes Applied (3/3)

1. **Logger async I/O** (`src/lib/logger.ts`)
   - Replaced `fs.appendFileSync` with `fs.promises.appendFile`
   - Made `writeLog` async, `ensureLogDir` uses `fs.promises.mkdir` / `fs.promises.access`
   - Convenience methods (trace/debug/info/warn/error) call async `writeLog` fire-and-forget
   - Updated tests in `__tests__/lib/logger.test.ts` with `flush()` helper to await async writes

2. **Route entry log before auth check** (all 9 authenticated API routes)
   - Moved `logger.info('Route entered', ...)` to before `auth()` call (without `userId`)
   - Added `logger.warn('Unauthorized request', ...)` before 401 returns
   - Routes updated: conversations (GET/POST), conversations/[id] (PATCH/DELETE), conversations/[id]/nodes (GET), conversations/[id]/nodes/[nodeId] (DELETE), conversations/[id]/export (GET), llm/chat (POST), import (POST), providers (GET), token-usage (GET)

3. **Try/catch in providers route** (`src/app/api/providers/route.ts`)
   - Wrapped route body in try/catch with `logger.error` and 500 response

### New Concerns
- None observed

### Verification
- `npm run build` passes
- Logger tests (7/7) pass

## F-19 Logging — Audit Cycle 2 Fix

**Status:** Complete
**Date:** 2026-04-07

### Fixes Applied: 1/1

1. **Write queue for serialized log appends** (`src/lib/logger.ts`)
   - Added module-level `writeChain = Promise.resolve()` to serialize async writes
   - Each `writeLog` call chains onto the previous promise so writes complete in call order
   - Changed `writeLog` from `async` to synchronous (chains internally), preserving fire-and-forget at call sites
   - Test `supports all log levels` now passes without test changes — log lines appear in deterministic order

### New Concerns
- None observed

### Verification
- `npm run build` passes
- Logger tests (7/7) pass

---

## F-20: Streaming Responses

**Status:** Complete  
**Date:** 2026-04-09

### T-094: Add StreamChunk Type, streamMessage Interface, and SSE Stream Helpers
- Added `StreamChunk` type (token/done/error variants) and `LLMAttachment` interface to `types.ts`
- Added `streamMessage` method to `LLMProvider` interface
- Created `streamHelpers.ts` with `encodeSSEEvent` and `createSSEStream`
- Added stub `streamMessage` to all four providers

### T-095–T-098: Implement streamMessage in All Providers
- **Anthropic**: `client.messages.stream()`, `content_block_delta` events, `finalMessage()` for usage
- **OpenAI**: `stream: true` + `stream_options: { include_usage: true }`, maps `prompt_tokens`/`completion_tokens`
- **Gemini**: `ai.models.generateContentStream()`, `chunk.text` getter, `usageMetadata`. Required `await` on the call.
- **Mock**: Character-by-character with 10ms delays, estimated tokens

### T-099: Create SSE Test Helper
- `__tests__/helpers/sseHelper.ts` with `collectSSEEvents()` function

### T-100: Rewrite POST /api/llm/chat to Return SSE Stream
- JSON response → SSE streaming; `export const dynamic = 'force-dynamic'`
- Pre-stream validation returns JSON; stream sends token/done/error events
- Orphan cleanup: pre-content → delete user node; post-content → save partial
- Auto-title via `sendMessage` (non-streaming, fire-and-forget)

### T-101: Rewrite LLM Chat Tests for SSE
- 24 tests using `collectSSEEvents` helper, all passing

### T-102: Create useStreamingChat Hook
- Batched rendering at 50ms, AbortController cleanup, handles all error types

### T-103–T-104: Update ChatPanel and ChatInput for Streaming
- ChatPanel renders streaming message with pulsing cursor indicator
- ChatInput shows stop button during streaming, disables input

### T-105: Update Tests for Streaming
- 3 new streaming tests in ChatPanel.test.tsx

### Verification
- `npm run build` passes
- 158 tests across 17 files, all passing

## F-20: Streaming Responses — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-09

### Fix 1: Stale closure for `streamingError` in handleSend
- Changed `sendStreamingMessage` return type from `DoneEventData | null` to a discriminated union: `{ type: 'done', data } | { type: 'error', message } | { type: 'aborted' }`
- `handleSend` now reads error message from the return value directly instead of the stale `streamingError` closure
- Removed unused `streamingError` destructure from chat page

### Fix 2: Unused `createSSEStream` helper
- Removed dead `createSSEStream` function from `streamHelpers.ts`
- Kept `encodeSSEEvent` which is actively used by the route handler
- Confirmed no imports of `createSSEStream` existed elsewhere

### Verification
- `npm run build` passes
- 2/2 fixes applied successfully
- No new concerns

---

## F-21: Prompt Caching (Claude-only)

**Status:** Complete  
**Date:** 2026-04-09

### T-106: Add cache_control Breakpoints to Anthropic Provider
- Extracted `buildAnthropicMessages()` and `buildSystemParam()` helpers in `src/lib/providers/anthropic.ts`
- Added `cache_control: { type: "ephemeral" }` to system prompt content block (when present) and last message content block
- Applied to both `sendMessage` and `streamMessage` methods
- Exactly 2 breakpoints used per request (within Claude's max of 4)
- No cache_control persisted to database — added dynamically at request time
- `npm run build` passes

### T-107: Write Tests for Prompt Caching
- Created `__tests__/lib/providers/anthropic.test.ts` with 7 tests
- Mocked Anthropic SDK to capture request payloads
- Verified cache_control on system content block for both sendMessage and streamMessage
- Verified cache_control on last message content block for both methods
- Verified no system cache_control when system prompt is absent
- Verified exactly 2 breakpoints when system prompt is present
- All 7 tests pass, `npm run build` passes

## F-22: File Attachments

**Status:** Complete  
**Date:** 2026-04-09

### T-108: Add Attachment Schema to Node Model and Update Types
- Added `attachments` subdocument array to Node schema with `_id: false`
- Added `Attachment` interface to `Node.ts` and `DBAttachment` to `database.ts`
- Added `attachments?` to `LLMChatRequest`, `NodeResponse`, and `ExportedTree` types
- `npm run build` passes

### T-109: Create Attachment Formatter Utility
- Created `src/lib/providers/attachmentFormatter.ts`
- Anthropic: images as `image` source, PDFs as `document` source, text files inline
- OpenAI: images as `image_url`, PDFs as `file` with data URI, text files inline
- Gemini: images/PDFs as `inlineData`, text files inline
- Text files (text/plain, text/markdown, text/csv) decoded from base64 to UTF-8
- `npm run build` passes

### T-110: Update Context Builder to Include Attachments
- Modified `contextBuilder.ts` to map node attachments to `LLMMessage.attachments`
- Added attachment size to token estimation (`Math.ceil(size / 4)`)
- New optional `newAttachments` parameter for current message attachments
- `npm run build` passes

### T-111: Add Attachment Validation and Integration in Chat Route
- Added Content-Length check rejecting >20MB payloads (413)
- Added attachment validation: max 5 files, 5MB per file, 10MB total, allowed MIME types
- Attachments saved on user node, passed through context builder
- Updated Anthropic provider: attachments as content blocks, cache_control applied AFTER
- Updated OpenAI provider: multi-part content with attachment blocks
- Updated Gemini provider: attachments in parts array for both chat and stream
- `npm run build` passes

### T-112: Update Mock Provider to Acknowledge Attachments
- Mock now prepends "I see you've attached: [filenames]" to responses when attachments present
- Works for both `sendMessage` and `streamMessage`
- `npm run build` passes

### T-113: Create FileUploadArea Component and Integrate into ChatInput
- Created `FileUploadArea.tsx` with paperclip button, drag-and-drop, preview chips
- Client-side validation: 5 files, 5MB per file, 10MB total, allowed extensions
- Integrated into ChatInput with base64 encoding via `readAsDataURL`
- Updated `handleSend` in chat page to pass attachments through streaming request
- Updated `TreeNode` type and `nodeResponseToTreeNode` to include attachments
- Updated GET nodes route to serialize attachments
- `npm run build` passes

### T-114: Update ChatMessage to Display Attachment Previews
- Images: inline thumbnails clickable to open full size in new tab
- PDFs: clickable chips with FileText icon opening in new tab
- Text files: expandable chips showing decoded content on click
- `npm run build` passes

### T-115: Update Export and Import to Include Attachments
- Export route includes `attachments` field on nodes that have them
- Import route restores `attachments` onto nodes from imported JSON
- `npm run build` passes

### T-116: Write Tests for File Attachments
- Added 6 attachment validation tests in `llm-chat.test.ts` (save, count, size, total, MIME, body size)
- Added 2 export/import attachment tests in `import-export.test.ts`
- Created `attachmentFormatter.test.ts` with 13 tests (Anthropic, OpenAI, Gemini, mock, text decoding)
- All 186 tests pass across 19 files, `npm run build` passes

## F-22: File Attachments — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-09

### Fixes Applied (2/2)
1. Added missing `size: att.size` in `src/lib/contextBuilder.ts` attachment mapping — was causing `NaN` token counts and disabling context truncation for conversations with attachments
2. Added missing `size: a.size` in `src/app/api/llm/chat/route.ts` attachment mapping — same issue when building context from request attachments

### New Concerns
- None observed

## F-22: File Attachments — Audit Cycle 2 Fixes

**Status:** Complete  
**Date:** 2026-04-09

### Fixes Applied (2/2)
1. Fixed blob URL memory leak in `FileUploadArea.tsx` — replaced inline `URL.createObjectURL()` calls with a memoized `Map<File, string>` via `useMemo`, with `useEffect` cleanup that revokes all URLs when the files array changes
2. Added missing `size` field to all 6 `LLMAttachment` test fixtures in `attachmentFormatter.test.ts` — resolves TS2741 errors

### New Concerns
- None observed

---

## F-23: Per-Model Token Usage

**Status:** Complete  
**Date:** 2026-04-09

### T-117: Update TokenUsage Schema for Per-Model Tracking
- Added `model: string` field (required) to `TokenUsage` schema
- Changed unique compound index from `{ userId, provider }` to `{ userId, model }`
- Added non-unique index `{ userId, provider }` for aggregation queries
- Removed `extends Document` from `ITokenUsage` interface to avoid conflict with Mongoose's built-in `model` property on `Document`

### T-118: Update Token Recording Logic in Chat Route
- Changed stream `done` handler token recording to key by `{ userId, model }` with `$set: { provider }`
- Updated auto-title `generateTitle()` token recording to use the same per-model key pattern

### T-119: Update Token Usage API Route and Usage Page
- API response now includes `model` field per usage entry
- `TokenUsageCard` groups usage entries by provider with per-model breakdown (model name as sub-heading, indented stats)
- Empty state shows "No usage data" per provider card

### T-120: Write Tests for Per-Model Token Usage
- Updated `llm-chat.test.ts` token recording assertion to verify `{ userId, model }` filter and `$set: { provider }`
- Updated auto-title token tracking test to match new per-model key pattern
- Updated `usage.test.ts` to verify `model` and `provider` fields in API response
- All 186 tests pass, build passes

### Known Issues
- Existing `tokenusages` collection in MongoDB must be dropped manually (`db.tokenusages.drop()`) due to index change. This is informational-only data; loss is acceptable.

---

## F-24: Copy Markdown Button

**Status:** Complete  
**Date:** 2026-04-09

### T-121: Create CopyMarkdownButton Component and Add to ChatMessage
- Created `src/components/chat/CopyMarkdownButton.tsx` with `ClipboardCopy`/`Check` icon swap (2s timeout)
- Integrated into `ChatMessage.tsx` action area alongside delete button, visible on hover for all messages
- Not shown during streaming (streaming content renders separately in ChatPanel, not via ChatMessage)
- Verified react-markdown v10 `className` prop not used directly — wrapper `<div>` handles it, no fix needed
- Build passes

### T-122: Write Tests for CopyMarkdownButton
- Created `__tests__/components/chat/CopyMarkdownButton.test.tsx` with 4 tests
- Tests: renders clipboard icon, calls writeText with content, icon changes to check, reverts after 2s (fake timers)
- All 190 tests pass, build passes

## F-25: Models Config Update

**Status:** Complete  
**Date:** 2026-04-12

### T-123: Add Thinking Support Fields and New Models to models.ts
- Added `ModelConfig` interface with `supportsThinking: boolean` and `maxThinkingLevel: string | null` fields
- Updated all existing model entries with new fields (GPT-4o/4o-mini: false/null, Sonnet 4.6: true/"high", Opus 4.6: true/"max", Haiku 4.5: false/null, Gemini 3 Flash: false/null, Mock: false/null)
- Added three new models: `o3` (OpenAI, thinking: high), `o4-mini` (OpenAI, thinking: high), `gemini-3.1-pro-preview` (Gemini, thinking: high)
- Changed MODELS type from `as const` object to `Record<string, readonly ModelConfig[]>` for proper typing
- Updated CLAUDE.md with Feature Set 3 reference documents and models config documentation
- Build passes

## F-26: Provider Interface Extension

**Status:** Complete  
**Date:** 2026-04-12

### T-124: Extend Provider Types with LLMRequestOptions, Citation, and Updated StreamChunk/LLMResponse
- Added `LLMRequestOptions` interface (`webSearchEnabled`, `thinkingEnabled`, `thinkingLevel`) to `src/lib/providers/types.ts`
- Added `Citation` interface (`url`, `title`) to `src/lib/providers/types.ts`
- Extended `LLMResponse` with `thinkingContent`, `webSearchRequestCount`, `citations`
- Added `thinking` variant to `StreamChunk`, extended `done` variant with new fields
- Added `options?: LLMRequestOptions` to `LLMProvider.sendMessage` and `streamMessage`
- Updated `src/types/database.ts` (DBNode: `thinkingContent`, `citations`)
- Updated `src/types/api.ts` (LLMChatRequest: `webSearchEnabled`, `thinkingEnabled`)
- Updated `src/types/export.ts` (exported node: `thinkingContent`, `citations`)

### T-125: Update All Provider Method Signatures and Return Values
- Updated all four providers (openai, anthropic, gemini, mock) to accept `options?: LLMRequestOptions`
- Updated all `sendMessage` return values with `thinkingContent: null`, `webSearchRequestCount: 0`, `citations: []`
- Updated all `streamMessage` `done` chunks with the same defaults
- No behavioral changes — all providers work exactly as before
- Build passes, all 190 tests pass

---

## F-27: OpenAI Responses API Migration

**Status:** Complete  
**Date:** 2026-04-12

### T-126: Rewrite OpenAI Provider for Responses API
- Replaced `client.chat.completions.create()` with `client.responses.create()`
- System messages extracted into `instructions` parameter (concatenated with newlines)
- Non-system messages passed as `input` array (replaces `messages`)
- Response text read from `response.output_text` (replaces `response.choices[0].message.content`)
- Token usage read from `response.usage.input_tokens`/`output_tokens` (replaces `prompt_tokens`/`completion_tokens`)
- Added exported `isReasoningModel()` helper: returns true for o-series models (`/^o\d/`)
- Temperature omitted for o-series models, set to 1 for others
- Streaming uses `response.output_text.delta` events (replaces `choices[0].delta.content`)
- Streaming completion uses `response.completed` event (replaces usage-only chunk)
- Build passes

### T-127: Update Attachment Formatter for OpenAI Responses API
- Image attachments: `type: "input_image"` with flat `image_url` string (was `type: "image_url"` with nested object)
- File/PDF attachments: `type: "input_file"` with flat `file_data` and `filename` (was `type: "file"` with nested object)
- Text file format unchanged
- Anthropic and Gemini formats unchanged
- Build passes

### T-128: Update OpenAI Provider and Attachment Formatter Tests
- Created new `__tests__/lib/providers/openai.test.ts` with 14 tests covering:
  - `isReasoningModel()` helper (true for o3/o4-mini, false for gpt-4o/gpt-4o-mini)
  - `sendMessage` uses `client.responses.create()` with `instructions` and `input` fields
  - Response parsing from `output_text`, token usage from `input_tokens`/`output_tokens`
  - Temperature omitted for o-series, included for non-reasoning models
  - Multiple system messages concatenated into single `instructions` string
  - Streaming with `response.output_text.delta` and `response.completed` events
- Updated attachment formatter tests: `input_image` with flat string, `input_file` with flat structure
- Updated llm-chat test `successStreamGenerator` to include full `done` chunk fields
- All 207 tests pass, build passes

## F-28: Extended Thinking

**Status:** Complete  
**Date:** 2026-04-12

### T-129: Add thinkingContent to Node Schema
- Added `thinkingContent: { type: String, default: null }` to NodeSchema
- Added `thinkingContent?: string | null` to INode interface
- Backward-compatible: existing nodes have `undefined` which is functionally null

### T-130: Implement Extended Thinking in Anthropic Provider
- Added `buildThinkingParams()` helper that handles both "high" (budget_tokens: 10000) and "max" (adaptive) thinking levels
- Temperature locked to 1, max_tokens bumped to 16384 when thinking enabled
- `sendMessage`: parses thinking blocks from response content array
- `streamMessage`: yields `thinking` chunks from `thinking_delta` events, accumulates for done chunk
- Imported MODELS config for model-specific thinking level lookup

### T-131: Implement Extended Thinking in OpenAI Provider
- Added `reasoning: { effort, summary: "auto" }` param for o-series models when thinking enabled
- `sendMessage`: extracts reasoning summaries from response output items
- `streamMessage`: handles `response.reasoning_summary_text.delta` events as thinking chunks
- Non-reasoning models (gpt-4o, etc.) ignore thinkingEnabled silently

### T-132: Implement Extended Thinking in Gemini Provider
- Added `thinkingConfig: { thinkingLevel, includeThoughts: true }` to config when enabled
- `systemInstruction` preserved alongside `thinkingConfig` in config object
- `sendMessage`: extracts thought-flagged parts (`part.thought === true`) from response candidates
- `streamMessage`: yields thinking chunks for thought-flagged parts, regular tokens for normal parts

### T-133: Implement Extended Thinking in Mock Provider
- Added canned thinking content constant
- `sendMessage`: returns thinking content when enabled
- `streamMessage`: yields 3 thinking chunks before text tokens when enabled

### T-134: Add Thinking State to UIContext and UIProvider
- Added `thinkingEnabled: boolean` (default: false) to UIState
- Added `TOGGLE_THINKING` and `SET_THINKING_ENABLED` actions
- Auto-disables thinking via useEffect when switching to model without `supportsThinking`

### T-135: Create ThinkingToggle and ThinkingBlock Components
- ThinkingToggle: Brain icon button, opacity-50 when disabled, bg-primary/10 when active, icon-only on mobile
- ThinkingBlock: collapsible section (default collapsed), pulsing animation when streaming, plain text with muted styling

### T-136: Update useStreamingChat Hook for Thinking SSE Events
- Added `streamingThinkingContent` state with same buffered flush pattern as streamingContent
- Handles `event: thinking` SSE events, accumulates content
- `thinkingEnabled` and `webSearchEnabled` included in fetch request body
- Exposed `streamingThinkingContent` in hook return value

### T-137: Update ChatInput, ChatMessage, ChatPanel for Thinking UI
- ChatInput: renders ThinkingToggle in row alongside ModelSelector
- ChatMessage: renders ThinkingBlock above message content for completed messages with thinkingContent; renders streaming ThinkingBlock during active streaming
- ChatPanel: passes streamingThinkingContent to streaming message area with ThinkingBlock
- Chat page: wires up thinkingEnabled from UIContext, passes toggle/disabled props, sends thinkingEnabled in streaming request
- Added thinkingContent to TreeNode type and NodeResponse type

### T-138: Update Chat API Route and Export/Import for thinkingContent
- Chat route: extracts thinkingEnabled, builds LLMRequestOptions with model config, passes to streamMessage
- Handles `thinking` StreamChunk: emits `event: thinking` SSE events
- Saves thinkingContent on assistant node, includes in done SSE event
- Auto-title passes `{ thinkingEnabled: false, webSearchEnabled: false }` to avoid waste
- Export: includes thinkingContent in serialized nodes
- Import: restores thinkingContent from imported JSON
- Nodes GET route: includes thinkingContent in serialized response
- Build passes, no errors

## F-28 Extended Thinking — Audit Cycle 1 Fixes

**Status:** Complete  
**Date:** 2026-04-12

### Fixes Applied (2/2)
1. **Stale closure on `uiState.thinkingEnabled` in `handleSend`** — Added `uiState.thinkingEnabled` to the `useCallback` dependency array in `chat/[conversationId]/page.tsx:212`
2. **Mock model `supportsThinking: false` prevents testing thinking flow** — Changed mock-model config to `supportsThinking: true, maxThinkingLevel: 'high'` in `constants/models.ts:26`

### Fixes That Could Not Be Applied
None.

### New Concerns Noticed
None.

---

## F-29: Web Search & Citations

**Status:** Complete  
**Date:** 2026-04-12

### T-139: Add citations to Node schema and webSearchRequests to TokenUsage
- Added `citations` subdocument array (`{ url, title }`, `_id: false`) to Node schema and INode interface
- Added `webSearchRequests` (Number, default 0) to TokenUsage schema and ITokenUsage interface
- Added `citations` to DBNode type (already present), TreeNode, NodeResponse types

### T-140: Implement Web Search in Anthropic Provider
- Added `buildWebSearchTools()` helper — injects `web_search_20250305` tool when enabled
- Added `extractCitations()` — deduplicates citations from TextBlock.citations arrays
- Added `getWebSearchRequestCount()` — reads from `usage.server_tool_use.web_search_requests`
- Streaming ignores `server_tool_use` and `web_search_tool_result` delta events

### T-141: Implement Web Search in OpenAI Provider
- Added `web_search_preview` tool when enabled, coexists with reasoning params
- `extractCitationsFromOutput()` extracts from message content annotations
- `countWebSearchCalls()` counts `web_search_call` items in output array

### T-142: Implement Web Search in Gemini Provider
- Added `googleSearch` tool to config, coexists with thinkingConfig and systemInstruction
- `extractGeminiCitations()` reads from `groundingMetadata.groundingChunks`, maps `uri` → `url`
- webSearchRequestCount = 1 when groundingMetadata present

### T-143: Implement Web Search in Mock Provider and Update Auto-Title
- Mock returns 2 mock citations and webSearchRequestCount: 1 when search enabled
- Auto-title already passed `{ webSearchEnabled: false, thinkingEnabled: false }` (done in F-28)

### T-144: Add webSearchEnabled State, WebSearchToggle, CitationList
- Added `webSearchEnabled: boolean` (default: true) to UIContext and UIProvider
- Added `TOGGLE_WEB_SEARCH` action
- Created `WebSearchToggle` — Globe icon toggle, icon-only on mobile, icon+label on desktop
- Created `CitationList` — numbered footnote-style `<a>` links, renders nothing for empty array

### T-145: Update ChatInput and ChatMessage for Web Search UI
- ChatInput renders WebSearchToggle alongside ThinkingToggle with new props
- ChatMessage renders CitationList below markdown content for assistant messages with citations
- ChatPanel (chat page) wires up webSearchEnabled state and passes to ChatInput

### T-146: Update useStreamingChat and Chat API Route
- useStreamingChat already sends webSearchEnabled in request body (added in interface earlier)
- Chat route extracts webSearchEnabled, passes in LLMRequestOptions
- Citations saved on assistant node from done chunk
- TokenUsage $inc includes webSearchRequests
- serializeNode includes citations

### T-147: Update Token Usage API and TokenUsageCard
- `/api/token-usage` response includes `webSearchRequests` per model
- TokenUsageCard displays "Web searches: N" row per model

### T-148: Update Export/Import for Citations
- Export includes `citations` field on nodes that have them
- Import restores `citations`, filtering out invalid entries (missing url/title)

### T-149: Tests for Thinking and Web Search Features
- Anthropic tests: thinking params, web search tool, citations defaults
- OpenAI tests: reasoning params for o-series, web search tool, citations defaults
- LLM chat route tests: thinking SSE events, citations in done event, webSearchRequests tracking, auto-title disables web search
- Import/export tests: thinkingContent and citations roundtrip, invalid citation filtering
- Updated existing usage test for webSearchRequests field

### T-150: Component Tests for Thinking and Web Search UI
- ThinkingToggle: renders, toggles, disabled state, tooltip
- ThinkingBlock: collapsed default, expand/collapse, streaming pulse, empty content
- WebSearchToggle: renders Globe, toggles, active styling
- CitationList: numbered links, target="_blank", empty array renders nothing

### Summary
All 12 tasks (T-139 through T-150) completed. Build passes, all 241 tests pass (including 17 new tests). Web search implemented across all 4 providers with provider-specific tool types, citation formats, and usage tracking.

---

## F-30: Responsive Layout

**Status:** Complete  
**Date:** 2026-04-12

### T-151: Add Scroll-Snap CSS and PanelIndicator Component
- Added scroll-snap CSS classes to globals.css (`.panel-container`, `.panel-item`)
- Uses `100dvh` for dynamic viewport height on mobile
- Hidden scrollbar on panel container via vendor prefixes
- Created `PanelIndicator` component with dot indicators (active = `bg-primary`, inactive = `bg-muted`)
- PanelIndicator hidden on desktop via `md:hidden`

### T-152: Implement Mobile Swipeable Layout in Chat Page
- Added mobile three-panel scroll-snap layout (`md:hidden`) with ConversationList, ChatPanel, and TreeVisualization
- Desktop layout unchanged (`hidden md:flex`)
- Initial scroll position centers on chat panel (index 1) via `requestAnimationFrame` + `scrollTo`
- IntersectionObserver with `threshold: 0.5` tracks active panel for PanelIndicator
- Shared chatPanelElement and chatInputElement between mobile/desktop to avoid duplication

### T-153: Modify Protected Layout for Mobile Sidebar Extraction
- Changed sidebar `<aside>` from `flex` to `hidden md:flex` so it only renders on desktop
- ConversationList rendered in two places: layout (desktop) and chat page (mobile), Tailwind responsive classes ensure only one is visible

### T-154: Adjust ChatInput for Compact Mobile Toggle Layout
- Added `sticky bottom-0` to ChatInput container for mobile positioning
- Added `flex-wrap` to toggles row to prevent overflow on small screens
- ThinkingToggle and WebSearchToggle already had icon-only mobile mode (`hidden md:inline` on label text)

### Summary
All 4 tasks (T-151 through T-154) completed. Build passes. CSS scroll-snap swipeable three-panel mobile layout implemented with PanelIndicator dots, sidebar extracted to chat page on mobile, and ChatInput optimized for compact screens.
