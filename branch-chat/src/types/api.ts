// Auth
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
}

// Conversations
export interface CreateConversationRequest {
  title: string;
  defaultProvider: string;
  defaultModel: string;
}

export interface ConversationResponse {
  id: string;
  title: string;
  defaultProvider: string;
  defaultModel: string;
  rootNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  conversations: ConversationResponse[];
}

export interface RenameConversationRequest {
  title: string;
}

export interface RenameConversationResponse {
  id: string;
  title: string;
  updatedAt: string;
}

export interface DeleteConversationResponse {
  deleted: true;
}

// Nodes
export interface NodeResponse {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
}

export interface NodeListResponse {
  nodes: NodeResponse[];
}

export interface DeleteNodeResponse {
  deletedCount: number;
  newActiveNodeId: string | null;
}

// LLM Chat
export interface LLMChatRequest {
  conversationId: string;
  parentNodeId: string | null;
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  model: string;
}

export interface LLMChatResponse {
  userNode: NodeResponse;
  assistantNode: NodeResponse;
}

// Import
export interface ImportRequest {
  jsonData: import('./export').ExportedTree;
}

export interface ImportResponse {
  conversationId: string;
  title: string;
  nodeCount: number;
}
