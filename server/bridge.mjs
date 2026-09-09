import http from 'node:http';
import https from 'node:https';
import { isAbsolute } from 'node:path';
import { saveModel, testModel } from './models.mjs';

export function json(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}
export function isLocalHost(host) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(host);
}
export function allowedRequest(request) {
  try {
    const local = new URL(`http://${request.headers.host}`);
    if (
      !isLocalHost(local.hostname) ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      return false;
    const origin = request.headers.origin;
    return !origin || origin === local.origin;
  } catch {
    return false;
  }
}
async function bodyJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_000) throw new Error('Request too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createBridge(env) {
  let target;
  if (env.FEYNMAN_URL) {
    target = new URL(env.FEYNMAN_URL);
    if (
      !['http:', 'https:'].includes(target.protocol) ||
      target.username ||
      target.password
    )
      throw new Error('FEYNMAN_URL must be an HTTP(S) workbench URL.');
  }
  const customModelsEnabled = Boolean(
    target &&
    isLocalHost(target.hostname) &&
    env.FEYNMAN_MODELS_PATH &&
    isAbsolute(env.FEYNMAN_MODELS_PATH),
  );
  return async (request, response, next) => {
    const url = new URL(request.url, 'http://localhost');
    if (
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/bridge/')
    )
      return next();
    if (!allowedRequest(request))
      return json(response, 403, {
        error: 'Only requests from this local app are accepted.',
      });
    try {
      if (url.pathname === '/bridge/status' && request.method === 'GET')
        return json(response, 200, {
          configured: Boolean(target),
          backendOrigin: target?.origin,
          customModelsEnabled,
        });
      if (url.pathname === '/bridge/models/test' && request.method === 'POST')
        return json(response, 200, await testModel(await bodyJson(request)));
      if (url.pathname === '/bridge/models/save' && request.method === 'POST') {
        if (!customModelsEnabled)
          return json(response, 409, {
            error:
              'Set FEYNMAN_MODELS_PATH to the connected local Feynman model configuration before saving providers.',
          });
        return json(
          response,
          200,
          await saveModel(env.FEYNMAN_MODELS_PATH, await bodyJson(request)),
        );
      }
      if (!url.pathname.startsWith('/api/'))
        return json(response, 404, { error: 'Unknown bridge endpoint.' });
      if (!target)
        return json(response, 503, {
          error:
            'Connect Feynman by setting FEYNMAN_URL in .env.local, then restart this app.',
        });
      // The backend is fixed by the server operator; the browser cannot override it.
      const upstreamUrl = new URL(url.pathname + url.search, target.origin);
      upstreamUrl.searchParams.delete('token');
      const headers = {
        accept: request.headers.accept ?? '*/*',
        'accept-encoding': 'identity',
      };
      if (request.headers['content-type'])
        headers['content-type'] = request.headers['content-type'];
      if (request.headers['content-length'])
        headers['content-length'] = request.headers['content-length'];
      const token = target.searchParams.get('token');
      if (token) headers['x-feynman-token'] = token;
      const upstream = (target.protocol === 'https:' ? https : http).request(
        upstreamUrl,
        { method: request.method, headers },
        (result) => {
          // Do not forward backend cookies, redirects, or token-bearing headers.
          const safeHeaders = {
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          };
          for (const name of ['content-type', 'content-disposition'])
            if (result.headers[name]) safeHeaders[name] = result.headers[name];
          response.writeHead(result.statusCode ?? 502, safeHeaders);
          result.pipe(response);
          result.on('error', () => response.destroy());
        },
      );
      upstream.on('error', () => {
        if (!response.headersSent)
          json(response, 502, {
            error:
              'Cannot reach Feynman. Check that feynman serve is running and FEYNMAN_URL matches its URL.',
          });
        else response.destroy();
      });
      upstream.setTimeout(15 * 60_000, () => upstream.destroy());
      response.on('close', () => upstream.destroy());
      request.on('error', () => upstream.destroy());
      request.pipe(upstream);
    } catch (error) {
      // Configuration parse errors may contain secrets: emit only owned validation messages.
      const message =
        error instanceof SyntaxError || error instanceof TypeError
          ? 'Invalid configuration or endpoint response. Check the supplied values.'
          : error.message;
      json(response, 400, { error: message });
    }
  };
}
