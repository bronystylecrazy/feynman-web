// Real installed Feynman + Pi, with a deterministic local model endpoint only.
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const sandbox = await mkdtemp(join(tmpdir(), 'feynman-web-smoke-'));
const workspace = join(sandbox, 'workspace');
const agent = join(sandbox, '.feynman', 'agent');
await mkdir(workspace, { recursive: true });
await mkdir(agent, { recursive: true });
await writeFile(
  join(workspace, 'smoke-evidence.txt'),
  'Deterministic local research fixture.\n',
);
let endpointRequests = 0;
let hanging = false;
const modelRequests = [];
const fixture = createServer(async (req, res) => {
  if (req.url === '/v1/models') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ data: [{ id: 'smoke-research' }] }));
  }
  if (req.url !== '/v1/chat/completions') {
    res.writeHead(404);
    return res.end();
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  endpointRequests++;
  modelRequests.push({
    model: body.model,
    stream: body.stream,
    messages: body.messages?.length,
    tools: body.tools?.length,
  });
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  });
  const send = (delta, finish = null) =>
    res.write(
      `data: ${JSON.stringify({ id: 'smoke-completion', object: 'chat.completion.chunk', created: 1, model: 'smoke-research', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
    );
  send({ role: 'assistant', content: '' });
  if (
    body.messages.some((message) =>
      JSON.stringify(message.content).includes('SMOKE_STOP'),
    )
  ) {
    hanging = true;
    send({ content: 'Waiting for cancellation.' });
    const timer = setInterval(() => res.write(': fixture heartbeat\n\n'), 1000);
    res.on('close', () => clearInterval(timer));
    return;
  }
  const toolResult = body.messages.some((message) => message.role === 'tool');
  const readTool = body.tools?.find((tool) => tool.function?.name === 'read');
  if (!toolResult && readTool) {
    send({
      tool_calls: [
        {
          index: 0,
          id: 'smoke-read',
          type: 'function',
          function: {
            name: 'read',
            arguments: JSON.stringify({
              path: join(workspace, 'smoke-evidence.txt'),
            }),
          },
        },
      ],
    });
    send({}, 'tool_calls');
  } else {
    send({ content: '# Local smoke response\n\n' });
    send({ content: 'Fixture evidence received. Equation: $E=mc^2$.\n' });
    send({}, 'stop');
  }
  res.end('data: [DONE]\n\n');
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
const fixturePort = fixture.address().port;
await writeFile(
  join(agent, 'models.json'),
  JSON.stringify({
    providers: {
      'smoke-local': {
        baseUrl: `http://127.0.0.1:${fixturePort}/v1`,
        api: 'openai-completions',
        apiKey: 'local',
        authHeader: false,
        models: [
          {
            id: 'smoke-research',
            name: 'Offline smoke fixture',
            contextWindow: 128000,
            maxTokens: 4096,
          },
        ],
      },
    },
  }),
  { mode: 0o600 },
);
await writeFile(
  join(agent, 'settings.json'),
  JSON.stringify({
    defaultProvider: 'smoke-local',
    defaultModel: 'smoke-research',
    defaultThinkingLevel: 'off',
  }),
  { mode: 0o600 },
);
// The free port is reserved only while selecting it; startup below retries readiness.
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const backendPort = portProbe.address().port;
await new Promise((done) => portProbe.close(done));
const backendUrl = `http://127.0.0.1:${backendPort}`;
const env = Object.fromEntries(
  ['PATH', 'TMPDIR', 'SHELL', 'LANG', 'TERM']
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
Object.assign(env, {
  FEYNMAN_HOME: sandbox,
  FEYNMAN_WORKBENCH_TIMEOUT_MS: '90000',
  FEYNMAN_WORKBENCH_RPC_COMMAND_TIMEOUT_MS: '30000',
  PI_OFFLINE: '1',
  NO_COLOR: '1',
});
const command = process.env.FEYNMAN_BIN ?? 'feynman';
const child = spawn(
  command,
  [
    'serve',
    '--no-open',
    '--no-auth',
    '--host',
    '127.0.0.1',
    '--port',
    String(backendPort),
    '--cwd',
    workspace,
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
);
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk;
});
child.stderr.on('data', (chunk) => {
  logs += chunk;
});
const metadata = {
  sandbox,
  workspace,
  backendUrl,
  fixtureUrl: `http://127.0.0.1:${fixturePort}/v1`,
  model: 'smoke-local/smoke-research',
  modelsPath: join(agent, 'models.json'),
};
console.log(JSON.stringify(metadata, null, 2));
async function cleanup() {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  fixture.closeAllConnections();
  fixture.close();
  await writeFile(join(sandbox, 'backend.log'), logs);
}
process.once('SIGINT', () => cleanup().then(() => process.exit(130)));
process.once('SIGTERM', () => cleanup().then(() => process.exit(143)));
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function request(path, body) {
  const response = await fetch(backendUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', origin: backendUrl },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(95000),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${path} ${response.status}: ${text.slice(0, 600)}`);
  if (path.endsWith('/stream')) return text;
  return JSON.parse(text);
}
const checks = [];
try {
  const deadline = Date.now() + 60000;
  while (true) {
    if (child.exitCode !== null)
      throw new Error(`Feynman exited ${child.exitCode}: ${logs.slice(-2500)}`);
    try {
      await request('/api/state');
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await delay(500);
    }
  }
  checks.push('actual feynman serve ready');
  const { session } = await request('/api/chat/session/new', {
    title: 'Offline runtime smoke',
  });
  const input = {
    sessionId: session.id,
    projectId: session.projectId,
    title: session.title,
  };
  assert.ok(session.id);
  checks.push('session created');
  const configured = await request('/api/chat/config', {
    ...input,
    config: { model: metadata.model },
  });
  assert.equal(configured.session.config.model, metadata.model);
  checks.push('model configured before start');
  const stream = await request('/api/chat/message/stream', {
    ...input,
    message:
      'Read smoke-evidence.txt and report the local fixture. This is an offline test.',
  });
  await writeFile(join(sandbox, 'first-stream.sse'), stream);
  const events = stream
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  assert.ok(
    events.some((event) => event.type === 'done'),
    `No done event: ${stream.slice(-2000)}`,
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === 'delta' &&
        event.content?.includes('Fixture evidence received'),
    ),
    'Missing streamed fixture content',
  );
  checks.push('real Pi RPC streamed deterministic model response');
  const hasTool = events.some(
    (event) =>
      event.type === 'tool' &&
      /\bread\b/i.test(JSON.stringify(event.toolEvent)),
  );
  if (hasTool) {
    assert.ok(
      events.some(
        (event) =>
          event.type === 'tool' &&
          event.toolEvent?.toolName === 'read' &&
          event.toolEvent?.output?.includes(
            'Deterministic local research fixture.',
          ),
      ),
    );
    checks.push('real Pi read tool activity and fixture content surfaced');
  }
  assert.ok(
    modelRequests.length &&
      modelRequests.every((entry) => entry.model === 'smoke-research'),
  );
  const reopened = await request('/api/chat/session', input);
  assert.ok(
    reopened.session.messages.some((message) =>
      message.content?.includes('Fixture evidence received'),
    ),
  );
  checks.push('saved session reopened');
  const resumed = await request('/api/chat/message/stream', {
    ...input,
    message: 'Continue this offline session briefly.',
  });
  await writeFile(join(sandbox, 'resumed-stream.sse'), resumed);
  assert.ok(resumed.includes('Fixture evidence received'));
  checks.push('continued same Pi session');
  const stopStreamPromise = request('/api/chat/message/stream', {
    ...input,
    message: 'SMOKE_STOP',
  });
  const stopDeadline = Date.now() + 30000;
  while (!hanging && Date.now() < stopDeadline) await delay(100);
  assert.ok(hanging, 'Stop fixture never began');
  await request('/api/chat/abort', input);
  const stopped = await stopStreamPromise;
  await writeFile(join(sandbox, 'stopped-stream.sse'), stopped);
  const afterStop = await request('/api/chat/session', input);
  assert.equal(afterStop.session.messages.at(-1).status, 'stopped');
  checks.push('abort returned and stream closed');
  const result = {
    ...metadata,
    checks,
    endpointRequests,
    modelRequests,
    lastMessage: afterStop.session.messages.at(-1),
  };
  await writeFile(
    join(sandbox, 'result.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify(
      { checks, endpointRequests, evidence: join(sandbox, 'result.json') },
      null,
      2,
    ),
  );
  if (process.argv.includes('--keep-alive')) {
    console.log(
      'Keeping isolated backend and fixture alive; interrupt to stop.',
    );
    await new Promise(() => {});
  }
} catch (error) {
  await writeFile(
    join(sandbox, 'failure.json'),
    JSON.stringify({ checks, error: String(error), modelRequests }, null, 2),
  );
  console.error(error);
  console.error(logs.slice(-3000));
  process.exitCode = 1;
} finally {
  await cleanup();
}
