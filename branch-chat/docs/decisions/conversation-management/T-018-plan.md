# T-018 Implementation Plan

## ConversationContext (`src/contexts/ConversationContext.ts`)
- State: `conversations`, `activeConversationId`, `nodes` (Map), `activeNodeId`
- Actions: SET_CONVERSATIONS, ADD_CONVERSATION, UPDATE_CONVERSATION, REMOVE_CONVERSATION, SET_NODES, ADD_NODES, REMOVE_NODES, SET_ACTIVE_CONVERSATION, SET_ACTIVE_NODE
- Context type: `{ state: ConversationState; dispatch: Dispatch<ConversationAction> } | null`

## UIContext (`src/contexts/UIContext.ts`)
- State: `isLoading`, `isSidebarOpen`, `isTreeOpen`, `selectedProvider`, `selectedModel`
- Actions: SET_LOADING, TOGGLE_SIDEBAR, TOGGLE_TREE, SET_SELECTED_MODEL (takes { provider, model })
- Defaults: sidebar open, tree closed, not loading, openai/gpt-4o

## ConversationProvider (`src/components/providers/ConversationProvider.tsx`)
- useReducer with conversationReducer
- useEffect fetches conversations on mount
- useMemo for context value stability
- Error handling on fetch

## UIProvider (`src/components/providers/UIProvider.tsx`)
- useReducer with uiReducer
- useMemo for context value stability

## Hooks
- `useConversation()` — useContext + null-check error
- `useUI()` — useContext + null-check error
