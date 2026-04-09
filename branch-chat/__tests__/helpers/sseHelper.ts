export interface ParsedSSEEvent {
  event: string;
  data: any;
}

export async function collectSSEEvents(response: Response): Promise<ParsedSSEEvent[]> {
  const text = await response.text();
  const events: ParsedSSEEvent[] = [];

  const blocks = text.split('\n\n');

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Skip comment lines (starting with ':')
    const lines = trimmed.split('\n').filter((line) => !line.startsWith(':'));
    if (lines.length === 0) continue;

    let event = '';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (event && data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }

  return events;
}
