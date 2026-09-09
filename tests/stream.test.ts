import { describe, expect, it } from 'vitest';
import { reduceStream, SseDecoder, streamMessage } from '../src/lib/api';
import type { Session, StreamEvent } from '../src/lib/types';

const session: Session = {
  id: 's1',
  projectId: 'workspace',
  title: 'Test',
  updatedAt: '',
  status: 'running',
  config: {
    delegation: true,
    autoReview: false,
    memory: true,
    specialist: '',
    compute: 'off',
  },
  messages: [
    {
      id: 'a1',
      role: 'assistant',
      content: '',
      status: 'running',
      createdAt: '',
      toolEvents: [],
    },
  ],
};
describe('Feynman stream contract', () => {
  it('decodes arbitrarily split frames, CRLF, comments and multiple frames', () => {
    const decoder = new SseDecoder();
    const received: StreamEvent[] = [];
    const data =
      ': heartbeat\r\n\r\ndata: {"type":"delta","content":"α"}\r\n\r\ndata: {"type":"delta","content":"αβ"}\n\n';
    for (const char of data)
      decoder.push(char, (event) => received.push(event));
    expect(received).toEqual([
      { type: 'delta', content: 'α' },
      { type: 'delta', content: 'αβ' },
    ]);
  });
  it('uses cumulative text and updates tool events without duplicating them', () => {
    let current = reduceStream(session, { type: 'delta', content: 'Hello' });
    current = reduceStream(current, { type: 'delta', content: 'Hello world' });
    current = reduceStream(current, {
      type: 'tool',
      toolEvent: { id: 't1', label: 'Research', status: 'running' },
    });
    current = reduceStream(current, {
      type: 'tool',
      toolEvent: {
        id: 't1',
        label: 'Research',
        status: 'complete',
        output: 'Done',
      },
    });
    expect(current?.messages[0].content).toBe('Hello world');
    expect(current?.messages[0].toolEvents).toHaveLength(1);
    expect(current?.messages[0].toolEvents[0].status).toBe('complete');
    expect(session.messages[0].content).toBe('');
  });
  it('does not swallow malformed data or callback errors', () => {
    expect(() => new SseDecoder().push('data: nope\n\n', () => {})).toThrow();
    expect(() =>
      new SseDecoder().push('data: {"type":"delta","content":"x"}\n\n', () => {
        throw new Error('handler failed');
      }),
    ).toThrow('handler failed');
  });
});
