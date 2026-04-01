import { describe, it, expect } from 'vitest';
import { buildContext } from '@/lib/contextBuilder';
import type { TreeNode } from '@/types/tree';

function makeNode(
  id: string,
  parentId: string | null,
  role: 'user' | 'assistant' | 'system' = 'user',
  content?: string,
): TreeNode {
  return {
    id,
    parentId,
    role,
    content: content ?? `content-${id}`,
    provider: null,
    model: null,
    createdAt: new Date().toISOString(),
  };
}

describe('buildContext', () => {
  it('returns just the user message when parentNodeId is null', () => {
    const nodesMap = new Map<string, TreeNode>();
    const result = buildContext(null, 'Hello', nodesMap, 16000);

    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('builds correct path from root to parent plus new message', () => {
    const nodesMap = new Map<string, TreeNode>();
    nodesMap.set('root', makeNode('root', null, 'user'));
    nodesMap.set('a', makeNode('a', 'root', 'assistant'));
    nodesMap.set('b', makeNode('b', 'a', 'user'));

    const result = buildContext('b', 'New question', nodesMap, 16000);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: 'user', content: 'content-root' });
    expect(result[1]).toEqual({ role: 'assistant', content: 'content-a' });
    expect(result[2]).toEqual({ role: 'user', content: 'content-b' });
    expect(result[3]).toEqual({ role: 'user', content: 'New question' });
  });

  it('truncates oldest messages when exceeding 80% of context limit', () => {
    const nodesMap = new Map<string, TreeNode>();
    // Each message with 400 chars of content: ceil(400/4) + 4 = 104 tokens
    const longContent = 'x'.repeat(400);
    nodesMap.set('root', makeNode('root', null, 'user', longContent));
    nodesMap.set('a', makeNode('a', 'root', 'assistant', longContent));
    nodesMap.set('b', makeNode('b', 'a', 'user', longContent));

    // 4 messages (3 path + 1 new) * 104 tokens = 416 tokens
    // Context limit = 500, 80% = 400
    // 416 > 400, so oldest should be dropped
    // After dropping root: 3 * 104 = 312 <= 400
    const result = buildContext('b', longContent, nodesMap, 500);

    expect(result).toHaveLength(3);
    // Root message should be dropped
    expect(result[0]).toEqual({ role: 'assistant', content: longContent });
    expect(result[1]).toEqual({ role: 'user', content: longContent });
    expect(result[2]).toEqual({ role: 'user', content: longContent });
  });

  it('applies 80% safety margin correctly', () => {
    const nodesMap = new Map<string, TreeNode>();
    // 100 chars: ceil(100/4) + 4 = 29 tokens per message
    const content = 'a'.repeat(100);
    nodesMap.set('root', makeNode('root', null, 'user', content));

    // 2 messages * 29 = 58 tokens
    // Limit = 72, 80% = 57 -> 58 > 57 -> should truncate
    const result = buildContext('root', content, nodesMap, 72);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content });
  });

  it('never drops the last remaining message', () => {
    const nodesMap = new Map<string, TreeNode>();
    // Very long message that exceeds limit on its own
    const hugeContent = 'z'.repeat(10000);

    // Single new message: ceil(10000/4) + 4 = 2504 tokens
    // Limit = 100, 80% = 80 -> way over, but only 1 message left
    const result = buildContext(null, hugeContent, nodesMap, 100);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: hugeContent });
  });

  it('does not truncate when within limit', () => {
    const nodesMap = new Map<string, TreeNode>();
    nodesMap.set('root', makeNode('root', null, 'user', 'Hi'));
    nodesMap.set('a', makeNode('a', 'root', 'assistant', 'Hello'));

    // 3 messages, very short content, large limit
    const result = buildContext('a', 'Thanks', nodesMap, 16000);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: 'user', content: 'Hi' });
    expect(result[1]).toEqual({ role: 'assistant', content: 'Hello' });
    expect(result[2]).toEqual({ role: 'user', content: 'Thanks' });
  });
});
