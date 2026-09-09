import { describe, expect, it } from 'vitest';
import {
  automaticTitle,
  answerText,
  researchTools,
} from '../src/lib/presentation';
import { StreamReveal } from '../src/lib/stream-reveal';
import type { Session, Message } from '../src/lib/types';

const startup: Message = {
  id: 'm',
  role: 'assistant',
  createdAt: '',
  status: 'running',
  content: 'Starting Feynman inside this workspace...',
  toolEvents: [{ id: 't', label: 'Feynman Pi turn', status: 'running' }],
};
const session: Session = {
  id: 's',
  title: 'New research session',
  projectId: 'workspace',
  status: 'complete',
  updatedAt: '',
  config: {
    delegation: true,
    autoReview: false,
    memory: false,
    specialist: '',
    compute: 'off',
  },
  messages: [],
};
describe('chat presentation', () => {
  it('suppresses startup scaffolding while retaining genuine tool execution', () => {
    expect(answerText(startup)).toBe('');
    expect(researchTools(startup)).toEqual([]);
    expect(
      researchTools({
        ...startup,
        toolEvents: [
          ...startup.toolEvents,
          {
            id: 'read',
            toolName: 'read',
            label: 'Read paper',
            status: 'running',
          },
        ],
      }),
    ).toHaveLength(1);
  });
  it('creates stable first-question titles and preserves intentional titles', () => {
    expect(
      automaticTitle(session, 'Can you explain scaled dot-product attention?'),
    ).toBe('Explain scaled dot-product attention');
    expect(
      automaticTitle({ ...session, title: 'My study' }, 'New question'),
    ).toBe('My study');
    expect(
      automaticTitle(
        {
          ...session,
          messages: [
            {
              ...startup,
              role: 'user',
              content: 'Compare LoRA and full fine-tuning',
            },
          ],
        },
        'Different question',
      ),
    ).toBe('Compare LoRA and full fine-tuning');
    expect(automaticTitle(session, '研究 '.repeat(80)).length).toBeLessThan(68);
  });
  it('smooths bursty text, catches up, and never duplicates a cumulative update', () => {
    const reveal = new StreamReveal();
    reveal.setTarget('A research answer. '.repeat(30), true);
    expect(reveal.value).toBe('');
    reveal.advance(16);
    expect(reveal.value.length).toBeGreaterThan(0);
    expect(reveal.pending).toBe(true);
    reveal.setTarget('A research answer. '.repeat(30) + 'Done.', true);
    for (let i = 0; i < 120; i++) reveal.advance(16);
    expect(reveal.value).toBe('A research answer. '.repeat(30) + 'Done.');
    expect(reveal.pending).toBe(false);
  });
  it('reveals math atomically and bypasses animation for history/reduced motion', () => {
    const reveal = new StreamReveal();
    reveal.setTarget('$$\\frac{a}{b}$$ explanation', true);
    expect(reveal.advance(16)).toBe('$$\\frac{a}{b}$$');
    reveal.setTarget('Restored history 🧪', false);
    expect(reveal.value).toBe('Restored history 🧪');
    reveal.setTarget('Corrected response', true);
    expect(reveal.value).toBe('Corrected response');
  });
});
