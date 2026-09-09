import { expect, it } from 'vitest';
import { matchCommands } from '../src/lib/commands';
import { chatAppearance, conversationMarkdown } from '../src/lib/chat-options';
import type { Session } from '../src/lib/types';

it('ranks command prefixes ahead of descriptions and filters without case sensitivity', () => {
  const commands = [
    {
      name: 'compare',
      command: '/compare',
      description: 'Compare literature methods',
    },
    { name: 'lit', command: '/lit', description: 'Review literature' },
    { name: 'audit', command: '/audit', description: 'Verify a claim' },
  ];
  expect(matchCommands(commands, '/LI').map((command) => command.name)).toEqual(
    ['lit', 'compare'],
  );
  expect(matchCommands(commands, '/unknown')).toEqual([]);
  expect(matchCommands(commands, '/')).toHaveLength(3);
});

it('restores only valid reading preferences', () => {
  expect(
    chatAppearance({ font: 'unsupported', small: 'true', wide: true }),
  ).toEqual({ font: 'default', small: false, wide: true });
  expect(chatAppearance(null)).toEqual({
    font: 'default',
    small: false,
    wide: false,
  });
});

it('exports conversation content without startup scaffolding or system messages', () => {
  const session: Session = {
    id: 's',
    projectId: 'workspace',
    title: 'Research',
    status: 'complete',
    updatedAt: '',
    config: {
      model: 'test/model',
      delegation: true,
      autoReview: false,
      memory: false,
      specialist: '',
      compute: 'off',
    },
    messages: [
      {
        id: 'system',
        role: 'system',
        content: 'Internal context',
        status: 'complete',
        createdAt: '',
        toolEvents: [],
      },
      {
        id: 'user',
        role: 'user',
        content: 'Explain $x^2$',
        status: 'complete',
        createdAt: '',
        toolEvents: [],
      },
      {
        id: 'assistant',
        role: 'assistant',
        content: 'Starting Feynman inside this workspace...',
        status: 'running',
        createdAt: '',
        toolEvents: [
          { id: 'turn', label: 'Feynman Pi turn', status: 'running' },
        ],
      },
    ],
  };
  expect(conversationMarkdown(session)).toBe(
    '# Research\n\n## You\n\nExplain $x^2$\n',
  );
});
