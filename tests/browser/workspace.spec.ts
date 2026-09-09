import { test, expect, type Page } from '@playwright/test';
import type { Session } from '../../src/lib/types';

const snapshot = {
  workspaceName: 'Integration fixture',
  version: '0.3.48',
  projects: [],
  artifacts: [
    {
      path: 'outputs/test.md',
      name: 'test.md',
      title: 'Evidence note',
      extension: '.md',
      category: 'output',
      contentType: 'text/markdown',
      sizeBytes: 50,
      updatedAt: '',
    },
  ],
  modelStatus: {
    current: 'test/model-a',
    availableModels: ['test/model-a', 'test/model-b'],
  },
};
function session(
  id = 'session-1',
  status: Session['status'] = 'complete',
): Session {
  return {
    id,
    projectId: 'workspace',
    title: 'Research test',
    status,
    updatedAt: new Date().toISOString(),
    config: {
      model: 'test/model-a',
      delegation: true,
      autoReview: false,
      memory: true,
      specialist: '',
      compute: 'off',
    },
    messages: [],
  };
}
async function fixture(page: Page, initial: Session[] = []) {
  const sessions = new Map(initial.map((item) => [item.id, item]));
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/bridge/status', (route) =>
    route.fulfill({
      json: {
        configured: true,
        backendOrigin: 'http://127.0.0.1:8741',
        customModelsEnabled: false,
      },
    }),
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() ?? {};
    calls.push({ path, body });
    if (path === '/api/state') return route.fulfill({ json: snapshot });
    if (path === '/api/chat/sessions')
      return route.fulfill({ json: { sessions: [...sessions.values()] } });
    if (path === '/api/chat/session/new') {
      const next = session(`session-${sessions.size + 1}`);
      next.title = 'New research session';
      next.messages = [];
      sessions.set(next.id, next);
      return route.fulfill({ json: { session: next } });
    }
    if (path === '/api/chat/session') {
      const current = sessions.get(body.sessionId)!;
      current.title = body.title;
      return route.fulfill({ json: { session: current } });
    }
    if (path === '/api/chat/config') {
      const next = sessions.get(body.sessionId)!;
      next.config = { ...next.config, ...body.config };
      return route.fulfill({ json: { session: next } });
    }
    if (path === '/api/chat/commands')
      return route.fulfill({
        json: {
          commands: [
            { name: 'lit', command: '/lit', description: 'Literature review' },
          ],
        },
      });
    if (path === '/api/file')
      return route.fulfill({
        json: {
          content: '# Evidence\n\nA result with $x^2$.',
          truncated: false,
          contentType: 'text/markdown',
        },
      });
    if (path === '/api/chat/message/stream') {
      const current = sessions.get(body.sessionId)!;
      current.title = body.title;
      current.status = 'running';
      current.messages = [
        {
          id: 'user',
          role: 'user',
          content: body.message,
          createdAt: '',
          status: 'complete',
          toolEvents: [],
        },
        {
          id: 'assistant',
          role: 'assistant',
          content: '',
          createdAt: '',
          status: 'running',
          toolEvents: [],
        },
      ];
      const start = JSON.stringify({ type: 'session', session: current });
      current.status = 'complete';
      current.messages[1].content =
        'Evidence [paper][1].\n\n[1]: https://example.com/paper';
      current.messages[1].status = 'complete';
      const end = JSON.stringify({
        type: 'done',
        session: current,
        state: snapshot,
      });
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `data: ${start}\n\ndata: ${end}\n\n`,
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: 'Unknown fixture route' },
    });
  });
  return { sessions, calls };
}

test('welcome, renderer, diagram isolation and responsive layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/bridge/status', (route) =>
    route.fulfill({ json: { configured: false, customModelsEnabled: false } }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Stay curious. Go deeper.' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/workspace-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', {
      name: 'See Markdown, equations & diagrams in action',
    })
    .click();
  await expect(page.locator('.katex-display')).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  const diagram = page.frameLocator('iframe[title="Mermaid diagram"]');
  await expect(diagram.locator('svg')).toBeVisible();
  await expect(diagram.locator('svg style')).toHaveCount(1);
  await expect(diagram.getByText('Question', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/workspace-rendering.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Toggle artifact panel' }).click();
  await page
    .getByLabel('Research artifacts')
    .locator('.preview-tabs')
    .getByRole('button', { name: 'Source', exact: true })
    .click();
  await expect(
    page.getByLabel('Research artifacts').locator('pre'),
  ).toContainText('From question to evidence');
  await page.getByRole('button', { name: 'Close artifacts' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Stay curious. Go deeper.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/workspace-mobile.png',
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .getByRole('button', { name: 'Connect Feynman', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('selects a model before execution, streams a response, and previews artifacts', async ({
  page,
}) => {
  const { calls } = await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Connected', exact: true }),
  ).toBeVisible();
  await page.locator('.model-trigger').click();
  await page.getByRole('button', { name: /model-b test/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.model-trigger')).toContainText('model-b');
  await page
    .getByRole('textbox', { name: 'Research message' })
    .fill('Find evidence.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'paper', exact: true }),
  ).toHaveAttribute('href', 'https://example.com/paper');
  expect(calls.findIndex((c) => c.path === '/api/chat/config')).toBeLessThan(
    calls.findIndex((c) => c.path === '/api/chat/message/stream'),
  );
  expect(calls.find((c) => c.path === '/api/chat/config')?.body.config).toEqual(
    { model: 'test/model-b' },
  );
  const sent = calls.find((c) => c.path === '/api/chat/message/stream')?.body;
  expect(sent?.message).toBe('Find evidence.');
  expect(sent?.title).toBe('Find evidence');
  expect(JSON.stringify(sent?.viewportContext)).toContain(
    'do not generate PNG/SVG',
  );
  expect(JSON.stringify(sent?.viewportContext)).toContain(
    'inline LaTeX ($...$)',
  );
  await page.getByRole('button', { name: 'Toggle artifact panel' }).click();
  await page.getByRole('button', { name: /Evidence note/ }).click();
  await expect(
    page
      .getByLabel('Research artifacts')
      .getByRole('heading', { name: 'Evidence' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(
    page.getByLabel('Research artifacts').locator('pre'),
  ).toContainText('# Evidence');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Find evidence', exact: true }),
  ).toBeVisible();
});

test('reopened running sessions recover their latest content and unlock the composer', async ({
  page,
}) => {
  const running = session('resumed', 'running');
  running.messages = [
    {
      id: 'a',
      role: 'assistant',
      content: 'Working',
      status: 'running',
      createdAt: '',
      toolEvents: [],
    },
  ];
  const { sessions } = await fixture(page, [running]);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Research test', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Research message' }),
  ).toBeDisabled();
  sessions.set('resumed', {
    ...running,
    status: 'complete',
    messages: [
      {
        ...running.messages[0],
        status: 'complete',
        content: 'Recovered result.',
      },
    ],
  });
  await expect(
    page.getByText('Recovered result.', { exact: true }),
  ).toBeVisible({ timeout: 8000 });
  await expect(
    page.getByRole('textbox', { name: 'Research message' }),
  ).toBeEnabled();
});

test('model selection cannot be dismissed while the configuration is being saved', async ({
  page,
}) => {
  await fixture(page);
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/chat/config', async (route) => {
    const body = route.request().postDataJSON();
    await pending;
    const next = session();
    next.config.model = body.config.model;
    await route.fulfill({ json: { session: next } });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Connected', exact: true }),
  ).toBeVisible();
  await page.locator('.model-trigger').click();
  await page.getByRole('button', { name: /model-b test/ }).click();
  await expect(
    page.getByRole('button', { name: 'Close dialog' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('math renders natively while a response is still running, without an image', async ({
  page,
}) => {
  const running = session('native-math', 'running');
  running.messages = [
    {
      id: 'equation',
      role: 'assistant',
      content:
        '$$\n\\operatorname{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V\n$$',
      status: 'running',
      createdAt: '',
      toolEvents: [],
    },
  ];
  await fixture(page, [running]);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Research test', exact: true })
    .click();
  await expect(page.locator('.katex-display')).toBeVisible();
  await expect(page.locator('.streaming-answer')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.locator('.message img')).toHaveCount(0);
  await expect(page.locator('.tool-activity')).toHaveCount(0);
});

test('startup has one quiet indicator and no duplicate runtime scaffolding', async ({
  page,
}) => {
  const running = session('startup', 'running');
  running.messages = [
    {
      id: 'startup-message',
      role: 'assistant',
      content: 'Starting Feynman inside this workspace...',
      status: 'running',
      createdAt: '',
      toolEvents: [{ id: 'turn', label: 'Feynman Pi turn', status: 'running' }],
    },
  ];
  await fixture(page, [running]);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Research test', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('Thinking…');
  await expect(page.getByText('Feynman Pi turn', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('Starting Feynman inside this workspace...', {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy message' })).toHaveCount(
    0,
  );
  await page.screenshot({ path: 'test-results/workspace-thinking.png' });
});

test('a burst response reveals smoothly and finishes without losing text', async ({
  page,
}) => {
  await fixture(page);
  const answer =
    'Research evidence should remain traceable. '.repeat(60) +
    'FINAL RESEARCH MARKER';
  await page.route('**/api/chat/message/stream', async (route) => {
    const current = session('session-1', 'running');
    current.messages = [
      {
        id: 'smooth-answer',
        role: 'assistant',
        content: '',
        status: 'running',
        createdAt: '',
        toolEvents: [],
      },
    ];
    const first = JSON.stringify({ type: 'session', session: current });
    current.status = 'complete';
    current.messages[0].status = 'complete';
    current.messages[0].content = answer;
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `data: ${first}\n\ndata: ${JSON.stringify({ type: 'done', session: current })}\n\n`,
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Connected', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Research message' })
    .fill('Explain the method');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.streaming-answer')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  const partial = await page.locator('.streaming-answer').textContent();
  expect(partial?.length).toBeLessThan(answer.length);
  await expect(page.locator('.streaming-answer')).toContainText(
    'FINAL RESEARCH MARKER',
  );
  await expect(page.locator('.streaming-answer')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('.streaming-answer .prose')).toHaveText(answer);
});

test('existing placeholder titles are generated and persisted on reconnect', async ({
  page,
}) => {
  const old = session('untitled');
  old.title = 'New research session';
  old.messages = [
    {
      id: 'q',
      role: 'user',
      content: 'Can you explain attention mechanisms?',
      status: 'complete',
      createdAt: '',
      toolEvents: [],
    },
  ];
  const { sessions } = await fixture(page, [old]);
  await page.goto('/');
  await expect(
    page.getByRole('button', {
      name: 'Explain attention mechanisms',
      exact: true,
    }),
  ).toBeVisible();
  expect(sessions.get('untitled')?.title).toBe('Explain attention mechanisms');
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: 'Explain attention mechanisms',
      exact: true,
    }),
  ).toBeVisible();
});
