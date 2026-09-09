import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createBridge, allowedRequest, json } from './bridge.mjs';

let fileEnv = {};
for (const file of ['.env', '.env.local']) {
  try {
    fileEnv = { ...fileEnv, ...parseEnv(await readFile(file, 'utf8')) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const env = { ...fileEnv, ...process.env };
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const bridge = createBridge(env);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};
const server = createServer((request, response) => {
  if (!allowedRequest(request))
    return json(response, 403, { error: 'Use the local app URL.' });
  bridge(request, response, async () => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      const file = resolve(
        root,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      );
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep))
        return json(response, 403, { error: 'Invalid path.' });
      const content = await readFile(file);
      response.writeHead(200, {
        'content-type': mime[extname(file)] ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
      });
      response.end(content);
    } catch {
      json(response, 404, {
        error: 'Not found. Run npm run build before starting the app.',
      });
    }
  });
});
server.listen(Number(env.PORT ?? 5173), '127.0.0.1', () =>
  console.log(`Feynman Web: http://127.0.0.1:${server.address().port}`),
);
