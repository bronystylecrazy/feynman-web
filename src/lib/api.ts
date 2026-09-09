import type { Session, StreamEvent } from './types';

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}

async function responseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : `Request failed (${response.status}).`;
  } catch {
    return text.slice(0, 300) || `Request failed (${response.status}).`;
  }
}

// Feynman's delta payload is the cumulative assistant text, not a token suffix.
export function reduceStream(
  session: Session | undefined,
  event: StreamEvent,
): Session | undefined {
  if ('session' in event && event.session) return event.session;
  if (!session || (event.type !== 'delta' && event.type !== 'tool'))
    return session;
  const index = session.messages.findLastIndex(
    (message) => message.role === 'assistant',
  );
  if (index < 0) return session;
  const messages = [...session.messages];
  const message = { ...messages[index] };
  if (event.type === 'delta') message.content = event.content;
  else {
    const events = message.toolEvents ?? [];
    message.toolEvents = events.some((tool) => tool.id === event.toolEvent.id)
      ? events.map((tool) =>
          tool.id === event.toolEvent.id
            ? { ...tool, ...event.toolEvent }
            : tool,
        )
      : [...events, event.toolEvent];
  }
  messages[index] = message;
  return { ...session, messages };
}

export class SseDecoder {
  private buffer = '';
  push(chunk: string, onEvent: (event: StreamEvent) => void) {
    this.buffer += chunk;
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
      const frame = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (!data || data === '[DONE]') continue;
      const value: unknown = JSON.parse(data);
      if (!value || typeof value !== 'object' || !('type' in value))
        throw new Error('Invalid Feynman stream event.');
      onEvent(value as StreamEvent);
    }
    if (this.buffer.length > 4_000_000)
      throw new Error('Feynman stream frame exceeded the size limit.');
  }
}

export async function streamMessage(
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
) {
  const response = await fetch('/api/chat/message/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  if (
    !response.body ||
    !response.headers.get('content-type')?.includes('text/event-stream')
  )
    throw new Error('The backend did not return a Feynman event stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseDecoder();
  let terminal = false;
  const receive = (event: StreamEvent) => {
    if (event.type === 'done' || event.type === 'error') terminal = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }), receive);
    }
    parser.push(decoder.decode(), receive);
    if (!terminal)
      throw new Error(
        'Connection interrupted. Reopen the session to recover its saved state.',
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function sessionInput(session: Session) {
  return {
    sessionId: session.id,
    projectId: session.projectId,
    title: session.title,
  };
}
