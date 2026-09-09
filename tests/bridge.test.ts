import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { createBridge } from '../server/bridge.mjs';

const servers: Server[] = [];
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No server port');
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});
describe('local bridge', () => {
  it('streams authenticated requests without exposing the backend token or cookies', async () => {
    let observedToken: unknown;
    let observedUrl: unknown;
    const upstream = await listen(
      createServer((req, res) => {
        observedToken = req.headers['x-feynman-token'];
        observedUrl = req.url;
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'set-cookie': 'secret=backend',
        });
        res.write('data: {"type":"delta","content":"one"}\n\n');
        res.end('data: {"type":"delta","content":"one two"}\n\n');
      }),
    );
    const bridge = createBridge({
      FEYNMAN_URL: `${upstream}/?token=test-secret`,
    });
    const origin = await listen(
      createServer((req, res) => bridge(req, res, () => res.end('fallback'))),
    );
    const status = await fetch(`${origin}/bridge/status`).then((r) => r.text());
    expect(status).not.toContain('test-secret');
    const response = await fetch(
      `${origin}/api/chat/message/stream?token=untrusted`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      },
    );
    expect(await response.text()).toContain('one two');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(observedToken).toBe('test-secret');
    expect(observedUrl).toBe('/api/chat/message/stream');
  });
  it('rejects cross-origin mutations and DNS rebinding hosts', async () => {
    const bridge = createBridge({});
    const origin = await listen(
      createServer((req, res) => bridge(req, res, () => res.end())),
    );
    expect(
      (
        await fetch(`${origin}/bridge/models/save`, {
          method: 'POST',
          headers: { origin: 'https://untrusted.example' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const reboundStatus = await new Promise<number | undefined>((resolve) => {
      request(
        `${origin}/bridge/status`,
        { headers: { host: 'untrusted.example' } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      ).end();
    });
    expect(reboundStatus).toBe(403);
    expect((await fetch(`${origin}/api/state`)).status).toBe(503);
  });
});
