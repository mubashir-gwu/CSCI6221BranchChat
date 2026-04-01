# T-018 Deliberation: ConversationContext & UIContext

## PROPOSER

I propose implementing the two-context pattern exactly as specified in the Architecture Document §6 and CLAUDE.md:

### ConversationContext
- **State**: `conversations: ConversationResponse[]`, `activeConversationId: string | null`, `nodes: Map<string, TreeNode>`, `activeNodeId: string | null`
- **Actions via useReducer**: `SET_CONVERSATIONS`, `ADD_CONVERSATION`, `UPDATE_CONVERSATION`, `REMOVE_CONVERSATION`, `SET_NODES`, `ADD_NODES`, `REMOVE_NODES`, `SET_ACTIVE_CONVERSATION`, `SET_ACTIVE_NODE`
- **Provider** fetches conversations on mount via `GET /api/conversations`
- Context value provides both `state` and `dispatch`

### UIContext
- **State**: `isLoading: boolean`, `isSidebarOpen: boolean`, `isTreeOpen: boolean`, `selectedProvider: string`, `selectedModel: string`
- **Actions**: `SET_LOADING`, `TOGGLE_SIDEBAR`, `TOGGLE_TREE`, `SET_SELECTED_MODEL`
- Defaults: `isSidebarOpen: true`, `isTreeOpen: false`, `isLoading: false`, `selectedProvider: 'openai'`, `selectedModel: 'gpt-4o'`

### Hooks
- `useConversation()` — `useContext(ConversationContext)` with null check throwing descriptive error
- `useUI()` — `useContext(UIContext)` with null check throwing descriptive error

### Files
- `src/contexts/ConversationContext.ts` — createContext with typed state/dispatch
- `src/contexts/UIContext.ts` — createContext with typed state/dispatch
- `src/components/providers/ConversationProvider.tsx` — useReducer + fetch on mount
- `src/components/providers/UIProvider.tsx` — useReducer with defaults
- `src/hooks/useConversation.ts`
- `src/hooks/useUI.ts`

## CRITIC

1. **Re-render concern**: The Architecture Document §11 (Tradeoff #5) acknowledges Context + useReducer causes re-renders on any state change. The two-context split mitigates this (UI state changes don't re-render data consumers and vice versa). This is acceptable for the project scope.

2. **React 19 compatibility**: `createContext`, `useContext`, `useReducer` are all stable React 19 APIs. No compatibility issues. `forwardRef` removal doesn't affect this pattern.

3. **Map serialization**: Using `Map<string, TreeNode>` for nodes is fine since this is client-side only and never serialized to JSON directly. The API returns arrays which the reducer converts to a Map.

4. **Context value stability**: The Proposer should use `useMemo` to memoize the context value object `{ state, dispatch }` to prevent unnecessary re-renders when the provider's parent re-renders. `dispatch` from `useReducer` is stable, but the `state` reference changes on every dispatch — that's intentional. The value object itself should be memoized so it only changes when state changes.

5. **Fetch on mount**: The ConversationProvider fetching conversations in a `useEffect` is standard. Should handle errors (toast) and set loading state.

6. **SET_SELECTED_MODEL action**: Should set both `selectedProvider` and `selectedModel` together, since they're coupled (a model belongs to a provider).

## MEDIATOR

### FINAL IMPLEMENTATION PLAN

1. **Two separate contexts** — as specified. No merging.

2. **ConversationContext** (`src/contexts/ConversationContext.ts`):
   - Define `ConversationState` and `ConversationAction` types
   - `createContext<{ state: ConversationState; dispatch: Dispatch<ConversationAction> } | null>(null)`

3. **UIContext** (`src/contexts/UIContext.ts`):
   - Define `UIState` and `UIAction` types
   - `createContext<{ state: UIState; dispatch: Dispatch<UIAction> } | null>(null)`

4. **ConversationProvider** (`src/components/providers/ConversationProvider.tsx`):
   - `useReducer` with conversation reducer
   - `useEffect` to fetch conversations on mount
   - `useMemo` to memoize context value
   - Handle fetch errors gracefully

5. **UIProvider** (`src/components/providers/UIProvider.tsx`):
   - `useReducer` with UI reducer
   - `useMemo` to memoize context value
   - Defaults: `isSidebarOpen: true`, `isTreeOpen: false`, `isLoading: false`, `selectedProvider: 'openai'`, `selectedModel: 'gpt-4o'`

6. **SET_SELECTED_MODEL** action should accept `{ provider, model }` to keep them coupled.

7. **Hooks** with null-check throwing `"useConversation must be used within ConversationProvider"` / `"useUI must be used within UIProvider"`.
