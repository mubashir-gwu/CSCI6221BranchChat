# Task Breakdown — BranchChat Feature Set 1

> Derived from the Architecture Delta Document - Feature Set 1 (Stage 2-A) and the existing Task Breakdown (T-001 through T-063, all complete).
> All file paths are relative to `branch-chat/`. The existing codebase is fully built and passing audits.

---

## Summary Table

| Feature | Tasks | Deliberations | Estimated Complexity |
|---------|-------|---------------|----------------------|
| F-13: CLAUDE.md Update | 1 | 0 | Low |
| F-14: UI Fixes & Polish | 6 | 0 | Low |
| F-15: Branch from Bubble & Minimap Toggle | 3 | 0 | Low–Medium |
| F-16: Theme Switching | 3 | 0 | Medium |
| F-17: Server-Level API Keys & Provider Gating | 10 | 0 | High |
| F-18: Auto-Title Conversations | 3 | 0 | Medium |
| F-19: File-Based Logging | 4 | 0 | Medium |
| **TOTAL** | **30** | **0** | — |

All design decisions were resolved in the Architecture Delta Document - Feature Set 1. No deliberations needed — tasks are execution-ready.

---

## Feature Dependency Graph

```
F-13: CLAUDE.md Update (T-064)
 │
 ├──► F-14: UI Fixes (T-065 – T-070)
 │
 ├──► F-15: Branch from Bubble + Minimap (T-071 – T-073)
 │
 ├──► F-16: Theme Switching (T-074 – T-076)
 │
 └──► F-17: Server-Level API Keys + Provider Gating (T-077 – T-086)
       │
       ├──► F-18: Auto-Title (T-087 – T-089)
       │
       └──► F-19: Logging (T-090 – T-093)
```

F-14, F-15, and F-16 can run in parallel after F-13, but are ordered sequentially for simplicity. F-17 must complete before F-18 and F-19.

---

## F-13: CLAUDE.md Update

**Description:** Update `CLAUDE.md` to reflect all changes from the Architecture Delta Document - Feature Set 1 so the builder agent has an accurate spec before implementing anything.

**Dependencies:** All original features (F-01 through F-12) complete.

---

### T-064: Update CLAUDE.md for Round 2 Changes

**Feature:** F-13
**Dependencies:** None (first task)
**Estimated Complexity:** Medium
**Execution Mode:** PLAN-THEN-AUTO
**Deliberation Required:** No

**Detailed Description:**

Rewrite `CLAUDE.md` (at the repo root, i.e., `branch-chat/../CLAUDE.md` or wherever it currently lives) to reflect all Round 2 changes. This is a complete replacement, not a diff. The updated file must incorporate:

1. **Remove all references to the BYO-Key model:**
   - Remove `ApiKey` from the Data Model section
   - Remove `encryption.ts` from the Folder Structure and Lib section
   - Remove `ENCRYPTION_KEY` from Environment Variables
   - Remove the Encryption section entirely
   - Remove `ApiKeyForm`, `ApiKeyList` from Components
   - Remove `/api/settings/api-keys/*` routes from API Contracts
   - Remove `settings/page.tsx` from Folder Structure (replaced by dashboard)

2. **Add TokenUsage collection:**
   ```typescript
   interface ITokenUsage {
     userId: Types.ObjectId;
     provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
     inputTokens: number;
     outputTokens: number;
     callCount: number;
     updatedAt: Date;
   }
   // Index: { userId: 1, provider: 1 } unique compound. Upsert on every LLM call with $inc: { inputTokens, outputTokens, callCount: 1 }.
   ```

3. **Update LLM Provider interface** — remove `apiKey` parameter:
   ```typescript
   interface LLMProvider {
     name: string;
     sendMessage(messages: LLMMessage[], model: string): Promise<LLMResponse>;
   }
   ```
   Each provider reads its key from the corresponding env var internally.

4. **Update LLMResponse** — add token fields:
   ```typescript
   interface LLMResponse {
     content: string;
     provider: string;
     model: string;
     inputTokens?: number;
     outputTokens?: number;
   }
   ```

5. **Add new environment variables:**
   ```bash
   OPENAI_API_KEY=sk-...          # Optional — provider unavailable if unset
   ANTHROPIC_API_KEY=sk-ant-...   # Optional
   GEMINI_API_KEY=AI...           # Optional
   ```
   Remove `ENCRYPTION_KEY`.

6. **Update Folder Structure:**
   - Remove `src/models/ApiKey.ts`
   - Remove `src/lib/encryption.ts`
   - Remove `src/components/settings/ApiKeyForm.tsx`, `ApiKeyList.tsx`
   - Remove `src/app/(protected)/settings/page.tsx`
   - Remove `src/app/api/settings/api-keys/` (all files)
   - Remove `__tests__/api/api-keys.test.ts`, `__tests__/lib/encryption.test.ts`
   - Add `src/models/TokenUsage.ts`
   - Add `src/lib/logger.ts`
   - Add `src/lib/providers/availability.ts` — `getAvailableProviders()`
   - Add `src/app/api/providers/route.ts` — GET: returns available providers
   - Add `src/app/api/usage/route.ts` — GET: returns token usage for current user
   - Add `src/app/(protected)/usage/page.tsx` — new page showing token usage per provider (replaces the old `/settings` page)
   - Add `src/components/usage/UsageDashboard.tsx`
   - Add `src/components/common/ThemeToggle.tsx`
   - Add `logs/` directory (gitignored)

7. **Update API Contracts:**
   - Remove all `/api/settings/api-keys/*` endpoints
   - Add `GET /api/providers` → `{ providers: string[] }` — returns available providers based on env vars
   - Add `GET /api/usage` → `{ usage: { provider, inputTokens, outputTokens }[] }`
   - Update `POST /api/llm/chat` — remove step 3 (decrypt API key); provider reads key from env var; after success, upsert TokenUsage; add async auto-title on first message
   - Error 422 changes meaning: "Provider [x] is not available" (env var not set) instead of "No API key found"

8. **Update State Management:**
   - UIContext adds: `isMinimapVisible: boolean`, `theme: 'light' | 'dark' | 'system'`, `availableProviders: string[]`
   - Remove any references to API key caching in UIContext

9. **Update Components table:**
   - TreeNode: remove connection handles
   - BranchMenu: add "New branch from here" option
   - TreeSidebar: add minimap toggle button
   - ModelSelector: receives `availableProviders`, greys out unavailable
   - ChatMessage: delete button only on user messages; muted red color
   - Add ThemeToggle component

10. **Add Logging section:**
    - Server-side only, JSON structured, written to `logs/` directory
    - Log levels: TRACE, DEBUG, INFO, WARN, ERROR
    - Key events: route entry/exit, LLM calls, auth events, DB operations, errors

11. **Add Theme section:**
    - `next-themes` for light/dark/system switching
    - ThemeToggle in root layout or protected layout header

**Files created/modified:**
- `CLAUDE.md` (complete rewrite)

**Acceptance Criteria:**
- `CLAUDE.md` contains no references to `ApiKey` model, `encryption.ts`, `ENCRYPTION_KEY`, `/api/settings/api-keys`, `ApiKeyForm`, `ApiKeyList`, or `settings/page.tsx`
- `CLAUDE.md` contains `TokenUsage` model, `logger.ts`, `availability.ts`, `ThemeToggle`, `/api/providers`, `/api/usage`, logging section, theme section
- `LLMProvider.sendMessage` signature has no `apiKey` parameter
- All env vars listed and correct
- `npm run build` still passes (no code changes in this task)

**Commit Message:** `docs: update CLAUDE.md for Round 2 architecture changes`

---

→ **AUDIT CHECKPOINT: Verify CLAUDE.md is complete and accurate before proceeding.**

---

## F-14: UI Fixes & Polish

**Description:** Pure UI/component tweaks — Changes 2, 3, 4, 5, 12 from the delta. No backend changes, no new dependencies.

**Dependencies:** F-13

---

### T-065: Make Only Assistant Nodes Clickable in Tree View

**Feature:** F-14
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/tree/TreeNode.tsx`:
- In the `TreeNode` custom node component, conditionally apply click handler and pointer cursor only when `data.role === 'assistant'`.
- User nodes (`data.role === 'user'`) should render visually (still visible, still colored) but have no `onClick`, `cursor: default`, and no hover effect suggesting interactivity.

Also modify `src/components/tree/TreeVisualization.tsx` if the `onNodeClick` callback is set at the `<ReactFlow>` level:
- In the `onNodeClick` handler, check the clicked node's `data.role`. If it's `'user'`, return early / do nothing.

**Files created/modified:**
- `src/components/tree/TreeNode.tsx`
- `src/components/tree/TreeVisualization.tsx` (if `onNodeClick` is at ReactFlow level)

**Acceptance Criteria:**
- Clicking an assistant node in the tree view navigates to it (existing behavior preserved).
- Clicking a user node in the tree view does nothing.
- User nodes are still visible in the tree with their existing styling.
- `npm run build` passes.

**Commit Message:** `fix(tree): restrict click navigation to assistant nodes only`

---

### T-066: Scope Delete Button to User Messages Only

**Feature:** F-14
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatMessage.tsx`:
- The delete button (trash icon / delete action) should only render when `node.role === 'user'`.
- No changes to backend deletion logic — cascading deletion of children (including assistant responses) still works the same way.

**Files created/modified:**
- `src/components/chat/ChatMessage.tsx`

**Acceptance Criteria:**
- User message bubbles show the delete button.
- Assistant message bubbles do NOT show a delete button.
- Deleting a user message still cascades to delete its children.
- `npm run build` passes.

**Commit Message:** `fix(chat): show delete button only on user messages`

---

### T-067: Change Delete Button to Muted Red

**Feature:** F-14
**Dependencies:** T-066
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ChatMessage.tsx`:
- Change the delete button's color from bright red (`text-red-500` / `text-destructive` or similar) to a muted/desaturated red.
- Use `text-red-400/70` or `text-muted-foreground hover:text-red-500` for a subtle appearance that becomes more visible on hover.

**Files created/modified:**
- `src/components/chat/ChatMessage.tsx`

**Acceptance Criteria:**
- Delete button appears in a muted/subtle red, not bright red.
- On hover, the button becomes slightly more prominent.
- `npm run build` passes.

**Commit Message:** `fix(chat): use muted red for delete button`

---

### T-068: Fix Error Toast Icon

**Feature:** F-14
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Find where error toasts are triggered (likely in `src/app/(protected)/chat/[conversationId]/page.tsx` and/or `src/components/common/ToastProvider.tsx` or direct `toast.error()` calls).

The issue: the default error icon in sonner looks like a close/X button. Replace it with `AlertTriangle` from `lucide-react`.

If sonner's `toast.error()` uses a default icon, override it:
```typescript
import { AlertTriangle } from 'lucide-react';

toast.error(message, {
  icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
  // ... other options
});
```

Alternatively, if there's a global toast configuration in `ToastProvider.tsx`, set the error icon there:
```tsx
<Toaster
  icons={{
    error: <AlertTriangle className="h-4 w-4" />,
  }}
/>
```

Search all files for `toast.error` calls to ensure consistency.

**Files created/modified:**
- `src/components/common/ToastProvider.tsx` (if global config approach)
- OR: all files containing `toast.error()` calls

**Acceptance Criteria:**
- Error toasts display an alert triangle icon, not an X/close icon.
- The icon does NOT look clickable/interactive.
- `npm run build` passes.

**Commit Message:** `fix(toast): replace error X icon with alert triangle`

---

### T-069: Remove ReactFlow Connection Handles from Tree Nodes

**Feature:** F-14
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/tree/TreeNode.tsx`:
- Remove all `<Handle>` imports and JSX from the TreeNode component. In @xyflow/react, custom nodes render `<Handle type="source" />` and `<Handle type="target" />` for connection points. Since BranchChat doesn't support drag-to-connect, these are unnecessary.
- If the component imports `Handle` from `@xyflow/react`, remove that import.
- Remove all `<Handle ... />` JSX elements.
- If no explicit `<Handle>` elements exist but dots still appear, the issue may be that @xyflow/react adds default handles to custom nodes. In that case, add CSS to hide them:
  ```css
  .react-flow__handle { display: none !important; }
  ```
  in `src/app/globals.css` or scoped within the TreeNode component.

**Files created/modified:**
- `src/components/tree/TreeNode.tsx`
- `src/app/globals.css` (if CSS approach needed)

**Acceptance Criteria:**
- No small dots (connection handles) appear on any tree node in the Tree View sidebar.
- Tree layout and edges still render correctly.
- `npm run build` passes.

**Commit Message:** `fix(tree): remove connection handle dots from tree nodes`

---

### T-070: Write/Update Tests for UI Fixes

**Feature:** F-14
**Dependencies:** T-065, T-066, T-067, T-068, T-069
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Update or create tests to cover the UI changes:

1. **`__tests__/components/TreeVisualization.test.tsx`** (or `TreeNode.test.tsx`):
   - Test that user nodes do not have click handlers.
   - Test that assistant nodes do have click handlers.

2. **`__tests__/components/ChatMessage.test.tsx`** (create if not exists, or update `ChatPanel.test.tsx`):
   - Test that delete button renders for `role: 'user'` nodes.
   - Test that delete button does NOT render for `role: 'assistant'` nodes.

3. No test needed for delete button color (visual-only).
4. No test needed for toast icon (visual-only, hard to unit test).
5. No test needed for connection handles (visual-only).

**Files created/modified:**
- `__tests__/components/TreeVisualization.test.tsx` (update)
- `__tests__/components/ChatPanel.test.tsx` or `__tests__/components/ChatMessage.test.tsx` (update/create)

**Acceptance Criteria:**
- All new tests pass via `npm test`.
- Existing tests still pass.
- `npm run build` passes.

**Commit Message:** `test(ui): add tests for tree click targets and delete button scoping`

---

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-15: Branch from Bubble & Minimap Toggle

**Description:** Add "New branch from here" to BranchMenu (Change 6) and minimap toggle to TreeSidebar (Change 7).

**Dependencies:** F-13, F-14

---

### T-071: Add "New Branch from Here" to BranchMenu

**Feature:** F-15
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/BranchMenu.tsx`:
- Add a "New branch from here" option at the bottom of the dropdown, separated by a visual divider (shadcn `Separator` or `DropdownMenuSeparator`).
- When clicked, it calls `onSelect` with the `parentNodeId` (the assistant node this BranchMenu belongs to), which navigates the user to that node — equivalent to clicking the node in the tree view. This sets it as the `activeNodeId`.
- The user can then type a new message in ChatInput, which will create a new branch from that assistant response.

The `onSelect` callback already navigates to a node. The new option simply navigates to the current parent node (the node the BranchMenu is attached to), which effectively sets it as the active node for the next user message.

If the existing `onSelect` prop expects a child node ID (to navigate to a sibling), add a separate `onNavigateToNode?: (nodeId: string) => void` prop, or use the existing `onBranchClick` / navigation mechanism from the chat page. Check the existing implementation to determine the right approach.

**Files created/modified:**
- `src/components/chat/BranchMenu.tsx`
- `src/app/(protected)/chat/[conversationId]/page.tsx` (if a new callback prop is needed)

**Acceptance Criteria:**
- BranchMenu dropdown shows "New branch from here" as the last option.
- Clicking it navigates to the parent node (sets it as active).
- After clicking, the user can type a new message that creates a new branch.
- Existing branch navigation options still work.
- `npm run build` passes.

**Commit Message:** `feat(chat): add "New branch from here" option to BranchMenu`

---

### T-072: Add Minimap Toggle to Tree Sidebar

**Feature:** F-15
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/contexts/UIContext.ts`:**
   - Add `isMinimapVisible: boolean` to the UI state type (default: `true`).
   - Add a `TOGGLE_MINIMAP` action to the reducer.

2. **Modify `src/components/providers/UIProvider.tsx`:**
   - Add `isMinimapVisible` to initial state with default `true`.
   - Handle `TOGGLE_MINIMAP` action in the reducer.

3. **Modify `src/hooks/useUI.ts`:**
   - Expose `isMinimapVisible` and `toggleMinimap` from the hook.

4. **Modify `src/components/tree/TreeSidebar.tsx`:**
   - Add a toggle button in the header area (next to the collapse toggle) using an eye icon (`Eye` / `EyeOff` from `lucide-react`).
   - Wire it to `toggleMinimap` from `useUI()`.

5. **Modify `src/components/tree/TreeVisualization.tsx`:**
   - Import `useUI` and read `isMinimapVisible`.
   - Conditionally render `<MiniMap />` only when `isMinimapVisible` is `true`.

**Files created/modified:**
- `src/contexts/UIContext.ts`
- `src/components/providers/UIProvider.tsx`
- `src/hooks/useUI.ts`
- `src/components/tree/TreeSidebar.tsx`
- `src/components/tree/TreeVisualization.tsx`

**Acceptance Criteria:**
- A toggle button (eye icon) appears in the tree sidebar header.
- Clicking it toggles the ReactFlow minimap on/off.
- Default state: minimap visible.
- Preference is session-only (resets on page reload).
- `npm run build` passes.

**Commit Message:** `feat(tree): add minimap visibility toggle`

---

### T-073: Write Tests for Branch from Bubble and Minimap Toggle

**Feature:** F-15
**Dependencies:** T-071, T-072
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **`__tests__/components/BranchMenu.test.tsx`** (create or update):
   - Test that "New branch from here" option renders in the dropdown.
   - Test that clicking it calls the navigation callback with the correct node ID.

2. **`__tests__/components/TreeVisualization.test.tsx`** (update):
   - Test that MiniMap renders when `isMinimapVisible` is `true`.
   - Test that MiniMap does NOT render when `isMinimapVisible` is `false`.

**Files created/modified:**
- `__tests__/components/BranchMenu.test.tsx`
- `__tests__/components/TreeVisualization.test.tsx`

**Acceptance Criteria:**
- All tests pass via `npm test`.
- `npm run build` passes.

**Commit Message:** `test(ui): add tests for branch-from-bubble and minimap toggle`

---

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-16: Theme Switching

**Description:** Add light/dark/system theme support with `next-themes` (Change 9).

**Dependencies:** F-13

---

### T-074: Install next-themes and Configure ThemeProvider

**Feature:** F-16
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. Install `next-themes`:
   ```bash
   npm install next-themes
   ```

2. **Modify `src/app/layout.tsx`** (root layout):
   - Wrap children with `<ThemeProvider>` from `next-themes`.
   - Configuration: `attribute="class"`, `defaultTheme="system"`, `enableSystem={true}`, `disableTransitionOnChange`.
   - The ThemeProvider must wrap everything including AuthProvider and ToastProvider.

3. **Modify `src/app/globals.css`:**
   - Ensure the existing `@theme { }` block defines colors for the default (light) theme.
   - Add a `.dark` variant with dark theme colors. If shadcn/ui was initialized with dark mode support, this may already exist. If not, add dark mode color overrides:
     ```css
     .dark {
       --color-background: oklch(0.145 0 0);
       --color-foreground: oklch(0.985 0 0);
       /* ... all other color variables for dark mode */
     }
     ```

4. Add `suppressHydrationWarning` to the `<html>` tag in `layout.tsx` (required by `next-themes` to avoid hydration mismatch on the `class` attribute).

**Files created/modified:**
- `package.json` (add `next-themes`)
- `src/app/layout.tsx`
- `src/app/globals.css` (dark mode colors if not already present)

**Acceptance Criteria:**
- App renders without hydration errors.
- `next-themes` provider is active (can be verified by checking `document.documentElement.classList` in browser devtools).
- `npm run build` passes.

**Commit Message:** `feat(theme): install next-themes and configure ThemeProvider`

---

### T-075: Create ThemeToggle Component

**Feature:** F-16
**Dependencies:** T-074
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/components/common/ThemeToggle.tsx`:
- A button that cycles through light → dark → system (or uses a dropdown with three options).
- Use `useTheme()` from `next-themes` to get/set the current theme.
- Icons: `Sun` (light), `Moon` (dark), `Monitor` (system) from `lucide-react`.
- Use a shadcn `DropdownMenu` with three options.

Place the ThemeToggle in the UI:
- **Modify `src/app/(protected)/layout.tsx`**: Add `<ThemeToggle />` in the header/toolbar area of the protected layout, alongside the sidebar toggle and any other controls.

**Files created/modified:**
- `src/components/common/ThemeToggle.tsx` (new)
- `src/app/(protected)/layout.tsx` (add ThemeToggle to header)

**Acceptance Criteria:**
- A theme toggle button is visible in the protected layout.
- Clicking it allows switching between Light, Dark, and System themes.
- System theme follows OS preference.
- Theme persists across page navigation (next-themes uses localStorage by default).
- `npm run build` passes.

**Commit Message:** `feat(theme): create ThemeToggle component with light/dark/system`

---

### T-076: Write Tests for Theme Switching

**Feature:** F-16
**Dependencies:** T-075
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `__tests__/components/ThemeToggle.test.tsx`:
- Test that the component renders without crashing.
- Test that it shows three theme options (light, dark, system).
- Mock `next-themes` `useTheme` hook. Test that selecting "dark" calls `setTheme('dark')`.

**Files created/modified:**
- `__tests__/components/ThemeToggle.test.tsx` (new)

**Acceptance Criteria:**
- All tests pass via `npm test`.
- `npm run build` passes.

**Commit Message:** `test(theme): add tests for ThemeToggle component`

---

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-17: Server-Level API Keys & Provider Availability Gating

**Description:** Major architectural shift — replace BYO-Key model with server-managed API keys (env vars), remove ApiKey collection and encryption, add TokenUsage tracking, gate providers by availability, add usage dashboard. Changes 8 and 10 from the delta.

**Dependencies:** F-13

---

### T-077: Create TokenUsage Model

**Feature:** F-17
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `src/models/TokenUsage.ts`:

```typescript
import { Schema, model, models, Document, Types } from 'mongoose';

export interface ITokenUsage extends Document {
  _id: string;
  userId: Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  updatedAt: Date;
}

const TokenUsageSchema = new Schema<ITokenUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['openai', 'anthropic', 'gemini', 'mock'], required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    callCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TokenUsageSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const TokenUsage = models.TokenUsage || model<ITokenUsage>('TokenUsage', TokenUsageSchema);
```

**Files created/modified:**
- `src/models/TokenUsage.ts` (new)

**Acceptance Criteria:**
- Model compiles and exports correctly.
- Unique compound index on `{ userId, provider }`.
- `npm run build` passes.

**Commit Message:** `feat(models): add TokenUsage model for per-user provider tracking`

---

### T-078: Create Provider Availability Utility and API Route

**Feature:** F-17
**Dependencies:** T-064
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. Create `src/lib/providers/availability.ts`:
   ```typescript
   const PROVIDER_ENV_MAP: Record<string, string> = {
     openai: 'OPENAI_API_KEY',
     anthropic: 'ANTHROPIC_API_KEY',
     gemini: 'GEMINI_API_KEY',
   };

   export function getAvailableProviders(): string[] {
     return Object.entries(PROVIDER_ENV_MAP)
       .filter(([_, envVar]) => !!process.env[envVar])
       .map(([provider]) => provider);
   }

   export function isProviderAvailable(provider: string): boolean {
     const envVar = PROVIDER_ENV_MAP[provider];
     if (!envVar) return provider === 'mock' && process.env.NODE_ENV === 'development';
     return !!process.env[envVar];
   }

   export function getProviderApiKey(provider: string): string | undefined {
     const envVar = PROVIDER_ENV_MAP[provider];
     return envVar ? process.env[envVar] : undefined;
   }
   ```

2. Create `src/app/api/providers/route.ts`:
   ```typescript
   // GET: returns list of available providers
   // Response: { providers: string[] }
   // Include 'mock' if NODE_ENV === 'development'
   ```
   Auth required. Call `getAvailableProviders()`, conditionally add `'mock'`.

**Files created/modified:**
- `src/lib/providers/availability.ts` (new)
- `src/app/api/providers/route.ts` (new)

**Acceptance Criteria:**
- `getAvailableProviders()` returns providers whose env vars are set.
- `GET /api/providers` returns `{ providers: [...] }` for authenticated users.
- Returns 401 for unauthenticated requests.
- `npm run build` passes.

**Commit Message:** `feat(providers): add availability utility and API route`

---

### T-079: Update LLM Provider Interface and Implementations

**Feature:** F-17
**Dependencies:** T-078
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **Modify `src/lib/providers/types.ts`:**
   - Remove `apiKey` from `sendMessage` signature:
     ```typescript
     interface LLMProvider {
       name: string;
       sendMessage(messages: LLMMessage[], model: string): Promise<LLMResponse>;
     }
     ```
   - Add optional token fields to `LLMResponse`:
     ```typescript
     interface LLMResponse {
       content: string;
       provider: string;
       model: string;
       inputTokens?: number;
       outputTokens?: number;
     }
     ```

2. **Modify `src/lib/providers/openai.ts`:**
   - Remove `apiKey` parameter from `sendMessage`.
   - Read key from `process.env.OPENAI_API_KEY` inside the method.
   - Extract `usage.prompt_tokens` and `usage.completion_tokens` from the response and return them as `inputTokens`/`outputTokens`.

3. **Modify `src/lib/providers/anthropic.ts`:**
   - Same pattern. Read `process.env.ANTHROPIC_API_KEY`.
   - Extract `usage.input_tokens` and `usage.output_tokens` from Anthropic response.

4. **Modify `src/lib/providers/gemini.ts`:**
   - Same pattern. Read `process.env.GEMINI_API_KEY`.
   - Extract token usage from Gemini response (`response.usageMetadata.promptTokenCount`, `response.usageMetadata.candidatesTokenCount`).

5. **Modify `src/lib/providers/mock.ts`:**
   - Remove `apiKey` parameter. Return mock token counts (e.g., `inputTokens: 10, outputTokens: 50`).

6. **Modify `src/lib/providers/index.ts`:**
   - Update `getProvider` if it passes `apiKey`. Ensure the registry doesn't reference `apiKey`.

**Files created/modified:**
- `src/lib/providers/types.ts`
- `src/lib/providers/openai.ts`
- `src/lib/providers/anthropic.ts`
- `src/lib/providers/gemini.ts`
- `src/lib/providers/mock.ts`
- `src/lib/providers/index.ts`

**Acceptance Criteria:**
- All providers compile without `apiKey` parameter.
- Each provider reads its key from the environment.
- `LLMResponse` includes token counts.
- `npm run build` passes.

**Commit Message:** `refactor(providers): remove apiKey param, read from env vars, add token tracking`

---

### T-080: Update LLM Chat Route Handler

**Feature:** F-17
**Dependencies:** T-077, T-079
**Estimated Complexity:** High
**Execution Mode:** PLAN-THEN-AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/llm/chat/route.ts`:

1. **Remove API key decryption step** (step 3 in the original orchestration). No longer import or use `encryption.ts`.

2. **Add provider availability check**: Before calling the provider, check `isProviderAvailable(provider)`. If not available, return 422 with `"Provider [provider] is not available. No API key configured."`.

3. **Update the LLM call**: Call `provider.sendMessage(messages, model)` without `apiKey`.

4. **Add token usage tracking**: After a successful LLM response, upsert the `TokenUsage` collection:
   ```typescript
   import { TokenUsage } from '@/models/TokenUsage';
   
   // After successful LLM call:
   if (llmResponse.inputTokens || llmResponse.outputTokens) {
     await TokenUsage.findOneAndUpdate(
       { userId: session.user.id, provider },
       {
         $inc: {
           inputTokens: llmResponse.inputTokens || 0,
           outputTokens: llmResponse.outputTokens || 0,
           callCount: 1,
         },
       },
       { upsert: true }
     );
   }
   ```
   This must NOT block the response — use `await` but don't let a failure here prevent the response from being returned. Wrap in try/catch.

5. **Remove** any imports of `encryption.ts` or `ApiKey` model.

**Files created/modified:**
- `src/app/api/llm/chat/route.ts`

**Acceptance Criteria:**
- LLM chat works with env var keys (no more per-user key decryption).
- 422 returned if provider env var is not set.
- Token usage is recorded in `TokenUsage` collection after successful calls.
- Token tracking failure does not break the chat response.
- `npm run build` passes.

**Commit Message:** `refactor(llm): use env var keys, add token tracking, remove encryption`

---

### T-081: Create Token Usage API Route and Usage Page

**Feature:** F-17
**Dependencies:** T-077, T-080
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Per the Architecture Delta, the settings page (`/settings`) is replaced by a new `/usage` page — NOT by adding usage to the existing dashboard. The dashboard (`/dashboard`) remains conversation-list only.

1. Create `src/app/api/usage/route.ts`:
   ```typescript
   // GET: returns token usage for the authenticated user
   // Response: { usage: { provider: string, inputTokens: number, outputTokens: number, callCount: number }[] }
   ```
   Auth required. Query `TokenUsage.find({ userId })`.

2. Create `src/components/usage/UsageDashboard.tsx`:
   - Fetches from `GET /api/usage` and `GET /api/providers`.
   - Displays a card per provider showing input tokens, output tokens, and call count.
   - Providers with no usage show "0 tokens".
   - Providers not available show a "Not configured" badge.

3. Create `src/app/(protected)/usage/page.tsx`:
   - New page at `/usage` that renders `<UsageDashboard />`.
   - This replaces the old `/settings` page in navigation. Any sidebar/nav link that pointed to `/settings` should now point to `/usage`.

4. **Do NOT modify `src/app/(protected)/dashboard/page.tsx`** — it stays as the conversation list with create/import actions, unchanged.

5. **Update `middleware.ts`**: Ensure `/usage` is in the protected routes list (it should already be covered by the `(protected)` route group, but verify).

**Files created/modified:**
- `src/app/api/usage/route.ts` (new)
- `src/components/usage/UsageDashboard.tsx` (new)
- `src/app/(protected)/usage/page.tsx` (new)

**Acceptance Criteria:**
- `GET /api/usage` returns token usage per provider (including `callCount`) for the authenticated user.
- `/usage` page displays token usage per provider.
- `/dashboard` page is unchanged (conversation list only).
- `/settings` route does not exist (removed in T-084).
- `npm run build` passes.

**Commit Message:** `feat(usage): add token usage API route and standalone usage page`

---

### T-082: Update ModelSelector for Provider Availability Gating

**Feature:** F-17
**Dependencies:** T-078
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/components/chat/ModelSelector.tsx`:
- Fetch available providers from `GET /api/providers` (or receive them via props/context).
- Providers NOT in the available list should be rendered but greyed out / disabled — not selectable.
- Add a visual indicator: disabled providers show "(not available)" or a lock icon.
- If NO providers are available, show a disabled state with message "No providers available".

Modify `src/components/providers/UIProvider.tsx`:
- Add `availableProviders: string[]` to UI state.
- Fetch available providers on mount (`GET /api/providers`) and store in state.
- Expose via `useUI()`.
- **CRITICAL**: The existing UIProvider likely uses a `useEffect` + `dispatch` pattern for fetching data (e.g., the old `/api/settings/api-keys` call). When changing the fetch URL from `/api/settings/api-keys` to `/api/providers`, **preserve the existing fetch-and-dispatch pattern exactly** — do not replace it with a naive `useCallback` or inline fetch, as this risks stale-closure bugs where the dispatch references an old reducer. The Architecture Delta (Section 12) explicitly warns about this.

Modify `src/hooks/useUI.ts`:
- Expose `availableProviders` from the hook.

**Files created/modified:**
- `src/components/chat/ModelSelector.tsx`
- `src/components/providers/UIProvider.tsx`
- `src/hooks/useUI.ts`
- `src/contexts/UIContext.ts` (add `availableProviders` to state type)

**Acceptance Criteria:**
- Available providers are selectable in ModelSelector.
- Unavailable providers are greyed out and not selectable.
- If no providers available, ModelSelector shows disabled state.
- `npm run build` passes.

**Commit Message:** `feat(model-selector): gate providers by availability`

---

### T-083: Update Import to Default to Available Provider

**Feature:** F-17
**Dependencies:** T-078
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/import/route.ts`:
- After importing a conversation tree, check if the conversation's `defaultProvider` is available (using `isProviderAvailable`).
- If not available, set `defaultProvider` to the first available provider from `getAvailableProviders()`.
- If no providers are available, still import but leave the provider as-is (the ModelSelector will show the disabled state).

**Files created/modified:**
- `src/app/api/import/route.ts`

**Acceptance Criteria:**
- Importing a conversation with an unavailable provider defaults to the first available provider.
- Importing with an available provider preserves the original provider.
- `npm run build` passes.

**Commit Message:** `feat(import): default to available provider on import`

---

### T-084: Remove Dead Code (ApiKey Model, Encryption, Settings Page, Routes)

**Feature:** F-17
**Dependencies:** T-080, T-081, T-082
**Estimated Complexity:** Medium
**Execution Mode:** PLAN-THEN-AUTO
**Deliberation Required:** No

**Detailed Description:**

Remove all dead code from the BYO-Key system. **Before deleting**, search the codebase for all imports/references to ensure nothing still depends on them.

**Files to DELETE:**
- `src/models/ApiKey.ts`
- `src/lib/encryption.ts`
- `src/components/settings/ApiKeyForm.tsx`
- `src/components/settings/ApiKeyList.tsx`
- `src/app/(protected)/settings/page.tsx`
- `src/app/api/settings/api-keys/route.ts`
- `src/app/api/settings/api-keys/[provider]/route.ts`
- `src/app/api/settings/` directory (entire directory if empty after above)

**Files to DELETE (tests):**
- `__tests__/api/api-keys.test.ts`
- `__tests__/lib/encryption.test.ts`

**Files to MODIFY (remove references):**
- `src/app/api/llm/chat/route.ts` — verify no remaining imports of `ApiKey` or `encryption` (should already be clean from T-080)
- `middleware.ts` — if it has special handling for `/settings`, remove it. No redirect needed — `/settings` should simply 404.
- `src/app/(protected)/layout.tsx` — replace any "Settings" link that points to `/settings` with a "Usage" link pointing to `/usage`
- `src/components/sidebar/ConversationList.tsx` or equivalent — replace "Settings" nav link with "Usage" link pointing to `/usage` if present
- Any other file that imports from deleted files (search for `ApiKey`, `encryption`, `ApiKeyForm`, `ApiKeyList`, `api-keys`)

**Update `.env.example`:**
- Remove `ENCRYPTION_KEY`
- Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` with placeholder comments

**Files created/modified:**
- All files listed above (deletions and modifications)
- `.env.example`

**Acceptance Criteria:**
- No file in the project imports from any deleted file.
- `grep -r "ApiKey\|encryption\|api-keys\|ApiKeyForm\|ApiKeyList\|ENCRYPTION_KEY" src/` returns no hits (except possibly type comments or this commit).
- `/settings` route no longer exists.
- `.env.example` reflects the new env var structure.
- `npm run build` passes.
- `npm test` passes (no tests reference deleted modules).

**Commit Message:** `refactor: remove BYO-Key system (ApiKey model, encryption, settings page, routes)`

---

### T-085: Update LLM Chat Route Error Handling for New Key Model

**Feature:** F-17
**Dependencies:** T-080
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/(protected)/chat/[conversationId]/page.tsx` (the client-side error handling):
- Update error message mapping for 422 status: change from "No API key found for [provider]. Add one in Settings." to "Provider [provider] is not available. Contact your administrator." (or simply "Provider not available").
- Remove any link to `/settings` in error messages.
- Keep all other error handling (429, 502, 504, network errors) unchanged.

**Files created/modified:**
- `src/app/(protected)/chat/[conversationId]/page.tsx`

**Acceptance Criteria:**
- 422 error shows "Provider not available" message, not "Add key in Settings".
- No UI references to the removed Settings page.
- `npm run build` passes.

**Commit Message:** `fix(chat): update error messages for server-level API key model`

---

### T-086: Write Tests for Server-Level API Keys and Provider Gating

**Feature:** F-17
**Dependencies:** T-080, T-081, T-082, T-083, T-084
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **`__tests__/lib/providers-availability.test.ts`** (new):
   - Test `getAvailableProviders()` with various env var combinations.
   - Test `isProviderAvailable()` for each provider.
   - Test `getProviderApiKey()` returns the key or undefined.

2. **`__tests__/api/llm-chat.test.ts`** (update existing):
   - Remove tests that reference API key decryption.
   - Add test: calling with an unavailable provider returns 422.
   - Add test: successful call records token usage in `TokenUsage` collection.

3. **`__tests__/api/usage.test.ts`** (new):
   - Test `GET /api/usage` returns correct token counts.
   - Test returns empty array for user with no usage.

4. **`__tests__/api/providers.test.ts`** (new):
   - Test `GET /api/providers` returns available providers.
   - Test returns 401 for unauthenticated requests.

5. **`__tests__/components/ModelSelector.test.tsx`** (update existing):
   - Test that unavailable providers are disabled.
   - Test that available providers are selectable.

**Files created/modified:**
- `__tests__/lib/providers-availability.test.ts` (new)
- `__tests__/api/llm-chat.test.ts` (update)
- `__tests__/api/usage.test.ts` (new)
- `__tests__/api/providers.test.ts` (new)
- `__tests__/components/ModelSelector.test.tsx` (update)

**Acceptance Criteria:**
- All new and updated tests pass via `npm test`.
- No test references `ApiKey`, `encryption`, or `/api/settings/api-keys`.
- `npm run build` passes.

**Commit Message:** `test: add tests for server-level API keys, provider gating, and token usage`

---

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-18: Auto-Title Conversations

**Description:** Automatically generate a conversation title via LLM after the first message exchange (Change 1).

**Dependencies:** F-17 (requires stable LLM chat route with env var keys)

---

### T-087: Implement Auto-Title Logic in LLM Chat Route

**Feature:** F-18
**Dependencies:** T-080
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Modify `src/app/api/llm/chat/route.ts`:

After successfully saving both the user node and assistant node, check if this is the first message in the conversation (i.e., `parentNodeId === null` or the conversation title is still "New Conversation"):

```typescript
// After returning the response to the client (fire-and-forget):
if (conversation.title === 'New Conversation') {
  // Don't await — fire and forget
  generateTitle(conversation._id, content, provider, model).catch((err) => {
    // Log error but don't propagate
    console.error('Auto-title generation failed:', err);
  });
}
```

Create a helper function (can be in the same file or a new utility `src/lib/autoTitle.ts`):

```typescript
async function generateTitle(
  conversationId: string,
  firstUserMessage: string,
  provider: string,
  model: string
): Promise<void> {
  const llmProvider = getProvider(provider);
  const titleMessages: LLMMessage[] = [
    {
      role: 'system',
      content: 'Generate a concise title (max 6 words) for a conversation that starts with this message. Reply with only the title, no quotes or punctuation.',
    },
    { role: 'user', content: firstUserMessage },
  ];
  const response = await llmProvider.sendMessage(titleMessages, model);
  const title = response.content.trim().slice(0, 200); // Enforce max length
  
  await Conversation.findByIdAndUpdate(conversationId, { title });
  
  // Also track token usage for the title generation call
  if (response.inputTokens || response.outputTokens) {
    await TokenUsage.findOneAndUpdate(
      { userId, provider },
      { $inc: { inputTokens: response.inputTokens || 0, outputTokens: response.outputTokens || 0, callCount: 1 } },
      { upsert: true }
    );
  }
}
```

**Important**: The title generation must NOT block the response. The HTTP response with `{ userNode, assistantNode }` must be sent before or independently of the title call. Since Next.js route handlers are synchronous request-response, the fire-and-forget pattern (calling without await, catching errors) is the approach. The title update will be reflected when the client next fetches the conversation list or navigates.

**Files created/modified:**
- `src/app/api/llm/chat/route.ts` (add auto-title logic)
- OR `src/lib/autoTitle.ts` (new, if extracted)

**Acceptance Criteria:**
- After the first message in a new conversation, the title is automatically updated from "New Conversation" to an LLM-generated title.
- The response to the user is NOT delayed by the title generation.
- Title is max 200 characters (truncated if longer).
- If title generation fails, the conversation keeps "New Conversation" and no error is shown to the user.
- Token usage for the title call is tracked.
- `npm run build` passes.

**Commit Message:** `feat(chat): auto-generate conversation title after first message`

---

### T-088: Update Client to Reflect Auto-Generated Titles

**Feature:** F-18
**Dependencies:** T-087
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

The auto-title is generated server-side asynchronously (fire-and-forget). The client needs to pick up the new title without a fragile hardcoded timeout.

**Approach**: After the first message response is received, trigger a re-fetch of the conversation list. The ConversationProvider already has a `fetchConversations` (or equivalent) that populates the sidebar. Calling it after the first LLM response will naturally pick up the updated title once it's ready. If the title generation hasn't completed yet, the title will update on the next natural re-fetch (e.g., navigating between conversations, creating a new conversation, or the next message send).

1. **Modify `src/app/(protected)/chat/[conversationId]/page.tsx`:**
   - After receiving the LLM response for the first message (detected by `parentNodeId === null` or `conversation.title === 'New Conversation'`), call the conversation list refresh action from ConversationContext.
   - No `setTimeout` — just trigger the re-fetch. If the title hasn't been generated yet on the server, the stale title is harmless and will be picked up on the next re-fetch.

2. **Modify `src/components/providers/ConversationProvider.tsx`** (if needed):
   - Ensure the `fetchConversations` / `refreshConversations` action is exposed and callable from the chat page.
   - If only a `REFRESH_CONVERSATION` action for a single conversation exists, that's also fine — use `PATCH /api/conversations/[id]` or `GET /api/conversations` to get the latest title.
   - Add an `UPDATE_CONVERSATION_TITLE` action to the reducer if one doesn't exist, so the title can be updated in-place without re-fetching the entire list.

3. **Modify `src/contexts/ConversationContext.ts`** (if new action type needed):
   - Add `UPDATE_CONVERSATION_TITLE` action type: `{ type: 'UPDATE_CONVERSATION_TITLE', payload: { id: string, title: string } }`.

**Files created/modified:**
- `src/app/(protected)/chat/[conversationId]/page.tsx`
- `src/components/providers/ConversationProvider.tsx` (if new action needed)
- `src/contexts/ConversationContext.ts` (if new action type needed)

**Acceptance Criteria:**
- After sending the first message, the conversation title in the sidebar updates to the auto-generated title upon the next conversation list re-fetch.
- No hardcoded `setTimeout` or polling interval in the codebase for title refresh.
- If the title generation is slow, "New Conversation" persists until the next natural re-fetch — this is acceptable.
- `npm run build` passes.

**Commit Message:** `feat(chat): refresh conversation title after auto-generation`

---

### T-089: Write Tests for Auto-Title

**Feature:** F-18
**Dependencies:** T-087, T-088
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **`__tests__/api/llm-chat.test.ts`** (update):
   - Add test: first message in a conversation triggers title generation (mock the LLM call for title).
   - Add test: second message does NOT trigger title generation.
   - Add test: title generation failure doesn't affect the main response.

2. **`__tests__/lib/autoTitle.test.ts`** (new, if `autoTitle.ts` was extracted):
   - Test title is truncated to 200 chars.
   - Test token usage is recorded.

**Files created/modified:**
- `__tests__/api/llm-chat.test.ts` (update)
- `__tests__/lib/autoTitle.test.ts` (new, optional)

**Acceptance Criteria:**
- All tests pass via `npm test`.
- `npm run build` passes.

**Commit Message:** `test(chat): add tests for auto-title generation`

---

→ **AUDIT CHECKPOINT: Run full audit before proceeding to next feature.**

---

## F-19: File-Based Logging

**Description:** Add comprehensive server-side file-based logging across the application (Change 11). This is the last feature so it can instrument all code changed by prior features.

**Dependencies:** F-17, F-18 (so logging can instrument the final state of all routes)

---

### T-090: Create Logger Module and Configure Log Directory

**Feature:** F-19
**Dependencies:** T-064
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. Create `src/lib/logger.ts`:
   - Implement a structured JSON logger that writes to files.
   - Log levels: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` (configurable via env var `LOG_LEVEL`, default `INFO`).
   - Each log entry is a JSON line:
     ```json
     {"timestamp":"2026-04-07T12:00:00.000Z","level":"INFO","message":"Route entered","context":{"route":"/api/llm/chat","userId":"abc","requestId":"xyz"}}
     ```
   - Writes to `logs/app.log` (relative to `branch-chat/`).
   - Simple append-to-file using `fs.appendFileSync` or async `fs.promises.appendFile`.
   - Auto-create `logs/` directory if it doesn't exist.
   - Export convenience methods: `logger.trace()`, `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`.
   - Each method accepts `(message: string, context?: Record<string, unknown>)`.

2. **Add `logs/` to `.gitignore`.**

3. **Add `LOG_LEVEL` to `.env.example`:**
   ```
   LOG_LEVEL=INFO    # TRACE | DEBUG | INFO | WARN | ERROR
   ```

**Files created/modified:**
- `src/lib/logger.ts` (new)
- `.gitignore` (add `logs/`)
- `.env.example` (add `LOG_LEVEL`)

**Acceptance Criteria:**
- Importing and calling `logger.info('test')` writes a JSON line to `logs/app.log`.
- Log levels are respected (e.g., `LOG_LEVEL=WARN` suppresses INFO and DEBUG).
- `logs/` directory is gitignored.
- `npm run build` passes.

**Commit Message:** `feat(logging): create structured file-based logger module`

---

### T-091: Add Logging to API Routes

**Feature:** F-19
**Dependencies:** T-090
**Estimated Complexity:** Medium
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Add log statements to all server-side API route handlers. For each route, log:
- **Entry**: `logger.info('Route entered', { route, method, userId, requestId })` at the start.
- **Exit**: `logger.info('Route completed', { route, method, userId, status, durationMs })` before returning.
- **Errors**: `logger.error('Route error', { route, method, userId, error: err.message, stack: err.stack })` in catch blocks.

Generate a `requestId` using `crypto.randomUUID()` at route entry for correlation.

**Routes to instrument:**
- `src/app/api/auth/register/route.ts` — log registration attempts (success/failure, email)
- `src/app/api/conversations/route.ts` — log list/create
- `src/app/api/conversations/[id]/route.ts` — log rename/delete
- `src/app/api/conversations/[id]/nodes/route.ts` — log node fetch
- `src/app/api/conversations/[id]/nodes/[nodeId]/route.ts` — log node delete
- `src/app/api/conversations/[id]/export/route.ts` — log export
- `src/app/api/llm/chat/route.ts` — log LLM call details: provider, model, token count, duration
- `src/app/api/import/route.ts` — log import (node count, provider)
- `src/app/api/providers/route.ts` — log provider query
- `src/app/api/usage/route.ts` — log usage query

For the LLM chat route specifically, add detailed logging:
```typescript
logger.info('LLM call started', { provider, model, conversationId, messageCount: messages.length });
// ... after LLM response:
logger.info('LLM call completed', { provider, model, inputTokens, outputTokens, durationMs });
```

**Files created/modified:**
- All API route files listed above (add log statements)

**Acceptance Criteria:**
- Every API route logs entry, exit, and errors.
- LLM chat route logs provider, model, token count, and duration.
- Log entries include `requestId` for correlation.
- Logs appear in `logs/app.log` as JSON lines.
- `npm run build` passes.

**Commit Message:** `feat(logging): instrument all API routes with structured logging`

---

### T-092: Add Logging to Auth and Database Operations

**Feature:** F-19
**Dependencies:** T-090
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

1. **`src/lib/auth.ts`**: Add logging for auth events:
   - `logger.info('Auth: login attempt', { email })` in the CredentialsProvider authorize function.
   - `logger.info('Auth: login success', { userId })` or `logger.warn('Auth: login failed', { email })`.

2. **`src/lib/db.ts`**: Add logging for database connection:
   - `logger.info('Database: connecting', { uri: MONGODB_URI.replace(/\/\/.*@/, '//***@') })` (mask credentials).
   - `logger.info('Database: connected')` after successful connection.
   - `logger.error('Database: connection failed', { error })` on failure.

3. **`src/lib/autoTitle.ts`** (or inline in `llm/chat/route.ts`):
   - `logger.info('Auto-title: generating', { conversationId })`.
   - `logger.info('Auto-title: success', { conversationId, title })`.
   - `logger.error('Auto-title: failed', { conversationId, error })`.

**Files created/modified:**
- `src/lib/auth.ts`
- `src/lib/db.ts`
- `src/app/api/llm/chat/route.ts` or `src/lib/autoTitle.ts`

**Acceptance Criteria:**
- Auth login attempts and outcomes are logged.
- Database connection events are logged (with credentials masked).
- Auto-title generation is logged.
- `npm run build` passes.

**Commit Message:** `feat(logging): add logging to auth, database, and auto-title`

---

### T-093: Write Tests for Logger Module

**Feature:** F-19
**Dependencies:** T-090
**Estimated Complexity:** Low
**Execution Mode:** AUTO
**Deliberation Required:** No

**Detailed Description:**

Create `__tests__/lib/logger.test.ts`:
- Test that `logger.info()` writes a JSON line to the log file.
- Test that log level filtering works (e.g., `LOG_LEVEL=ERROR` suppresses INFO).
- Test that the log entry contains `timestamp`, `level`, `message`, and `context`.
- Test that the logger creates the `logs/` directory if it doesn't exist.
- Use a temp directory for test log files to avoid polluting the real `logs/` directory.

**Files created/modified:**
- `__tests__/lib/logger.test.ts` (new)

**Acceptance Criteria:**
- All tests pass via `npm test`.
- `npm run build` passes.

**Commit Message:** `test(logging): add tests for logger module`

---

→ **AUDIT CHECKPOINT: Run full audit. Round 2 feature changes complete.**

---

## Risk Flags

| Task | Risk | Reason |
|------|------|--------|
| T-079 | **Medium** | Three SDK-specific token extraction patterns. Gemini's `usageMetadata` API may differ from documented version. Verify exact response shapes. |
| T-080 | **High** | Most complex route in the app, now being modified significantly (remove encryption, add token tracking, prepare for auto-title). Test thoroughly. |
| T-084 | **High** | Mass deletion of files and imports. One missed import reference will break the build. Agent must grep the entire codebase before deleting. |
| T-087 | **Medium** | Fire-and-forget async in Next.js route handlers — the function continues running after the response is sent. Ensure it doesn't crash the process or leak connections. |
| T-091 | **Medium** | Touching every API route file. High surface area for introducing typos or breaking existing logic. Each route should be build-checked individually if possible. |
