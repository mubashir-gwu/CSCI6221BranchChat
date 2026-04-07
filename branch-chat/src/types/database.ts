export interface DBUser {
  _id: string;
  email: string;
  hashedPassword: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBConversation {
  _id: string;
  userId: string;
  title: string;
  defaultProvider: 'openai' | 'anthropic' | 'gemini' | 'mock';
  defaultModel: string;
  rootNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DBNode {
  _id: string;
  conversationId: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'mock' | null;
  model: string | null;
  createdAt: string;
}
