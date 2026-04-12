export interface TreeNode {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string | null;
  model: string | null;
  thinkingContent?: string | null;
  attachments?: { filename: string; mimeType: string; data: string; size: number }[];
  createdAt: string;
}

export type ChildrenMap = Map<string, string[]>;
