export function estimateTokens(
  messages: { role: string; content: string }[]
): number {
  let total = 0;
  for (const msg of messages) {
    total += Math.ceil(msg.content.length / 4) + 4;
  }
  return total;
}

export function estimateTokensForMessage(
  msg: { role: string; content: string }
): number {
  return Math.ceil(msg.content.length / 4) + 4;
}
