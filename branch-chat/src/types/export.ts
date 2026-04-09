export interface ExportedTree {
  version: 1;
  exportedAt: string;
  title: string;
  nodes: {
    id: string;
    parentId: string | null;
    childrenIds: string[];
    role: 'user' | 'assistant' | 'system';
    content: string;
    provider: string | null;
    model: string | null;
    attachments?: { filename: string; mimeType: string; data: string; size: number }[];
    createdAt: string;
  }[];
}
