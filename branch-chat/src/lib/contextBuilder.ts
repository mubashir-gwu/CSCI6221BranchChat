import { getPathToRoot } from './tree';
import { estimateTokens, estimateTokensForMessage } from './tokenEstimator';
import type { LLMMessage } from './providers/types';

export function buildContext(
  parentNodeId: string | null,
  newUserMessage: string,
  nodesMap: Map<string, any>,
  modelContextLimit: number,
): LLMMessage[] {
  let pathNodes: any[] = [];
  if (parentNodeId !== null) {
    pathNodes = getPathToRoot(parentNodeId, nodesMap);
  }

  const messages: LLMMessage[] = pathNodes.map((n) => ({
    role: n.role as LLMMessage['role'],
    content: n.content,
  }));
  messages.push({ role: 'user', content: newUserMessage });

  const effectiveLimit = Math.floor(modelContextLimit * 0.8);
  let totalTokens = estimateTokens(messages);

  while (totalTokens > effectiveLimit && messages.length > 1) {
    const removed = messages.shift()!;
    totalTokens -= estimateTokensForMessage(removed);
  }

  return messages;
}
