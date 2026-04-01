export interface TreeNode {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
}

export type ChildrenMap = Map<string, string[]>;
