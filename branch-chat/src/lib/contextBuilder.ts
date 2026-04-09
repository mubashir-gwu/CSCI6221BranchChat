import { getPathToRoot } from './tree';
import type { LLMMessage, LLMAttachment } from './providers/types';

function estimateMessageTokens(msg: LLMMessage): number {
  let tokens = Math.ceil(msg.content.length / 4) + 4;
  if (msg.attachments) {
    for (const att of msg.attachments) {
      tokens += Math.ceil(att.size / 4);
    }
  }
  return tokens;
}

function estimateTotalTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

export function buildContext(
  parentNodeId: string | null,
  newUserMessage: string,
  nodesMap: Map<string, any>,
  modelContextLimit: number,
  newAttachments?: LLMAttachment[],
): LLMMessage[] {
  let pathNodes: any[] = [];
  if (parentNodeId !== null) {
    pathNodes = getPathToRoot(parentNodeId, nodesMap);
  }

  const messages: LLMMessage[] = pathNodes.map((n) => {
    const msg: LLMMessage = {
      role: n.role as LLMMessage['role'],
      content: n.content,
    };
    if (n.attachments && n.attachments.length > 0) {
      msg.attachments = n.attachments.map((att: { filename: string; mimeType: string; data: string; size: number }) => ({
        filename: att.filename,
        mimeType: att.mimeType,
        data: att.data,
        size: att.size,
      }));
    }
    return msg;
  });

  const newMsg: LLMMessage = { role: 'user', content: newUserMessage };
  if (newAttachments && newAttachments.length > 0) {
    newMsg.attachments = newAttachments;
  }
  messages.push(newMsg);

  const effectiveLimit = Math.floor(modelContextLimit * 0.8);
  let totalTokens = estimateTotalTokens(messages);

  while (totalTokens > effectiveLimit && messages.length > 1) {
    const removed = messages.shift()!;
    totalTokens -= estimateMessageTokens(removed);
  }

  return messages;
}
