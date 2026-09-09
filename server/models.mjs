import {
  readFile,
  writeFile,
  rename,
  mkdir,
  lstat,
  unlink,
} from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

export function validateModel(input) {
  if (!input || typeof input !== 'object')
    throw new Error('Missing model configuration.');
  const {
    provider,
    modelId,
    baseUrl,
    apiKey = '',
    contextWindow = 32768,
    maxTokens = 4096,
  } = input;
  if (
    typeof provider !== 'string' ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(provider) ||
    ['constructor', 'prototype', '__proto__'].includes(provider)
  )
    throw new Error(
      'Use a provider ID with lowercase letters, numbers, and hyphens.',
    );
  if (
    typeof modelId !== 'string' ||
    !modelId.trim() ||
    modelId.length > 256 ||
    /[\x00-\x1f]/.test(modelId)
  )
    throw new Error('Enter a valid model ID.');
  const url = new URL(baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use an HTTP(S) base URL without credentials, query parameters, or fragments.',
    );
  if (
    typeof apiKey !== 'string' ||
    apiKey.length > 4096 ||
    apiKey.trimStart().startsWith('!') ||
    /[\r\n]/.test(apiKey)
  )
    throw new Error('Enter a literal API key, not a command.');
  if (
    ![contextWindow, maxTokens].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 10_000_000,
    ) ||
    maxTokens > contextWindow
  )
    throw new Error(
      'Token limits must be positive integers, with output tokens no larger than the context window.',
    );
  return {
    provider,
    modelId: modelId.trim(),
    baseUrl: url.href.replace(/\/$/, ''),
    apiKey,
    contextWindow,
    maxTokens,
  };
}

export async function testModel(input) {
  const model = validateModel(input);
  const response = await fetch(`${model.baseUrl}/models`, {
    headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(
      `The model endpoint returned HTTP ${response.status}. Check the URL and key.`,
    );
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) throw new Error('The model list is too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (
    !Array.isArray(data.data) ||
    !data.data.some((item) => item.id === model.modelId)
  )
    throw new Error(
      'Endpoint reached, but the selected model ID was not listed.',
    );
  return {
    message:
      'Endpoint reached and model ID found. Inference and tool support have not been tested.',
  };
}

let saveQueue = Promise.resolve();
export function saveModel(path, input) {
  const run = saveQueue.then(() => writeModel(path, input));
  saveQueue = run.catch(() => {});
  return run;
}
async function writeModel(path, input) {
  if (!path || !isAbsolute(path))
    throw new Error(
      'Set an absolute FEYNMAN_MODELS_PATH on the local server to enable saving.',
    );
  const model = validateModel(input);
  let previous = '';
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('Model configuration must be a regular file.');
    previous = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let config;
  try {
    config = previous ? JSON.parse(previous) : {};
  } catch {
    throw new Error(
      'Existing model configuration is not strict JSON. It was left unchanged; edit it using Feynman setup.',
    );
  }
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new Error(
      'Existing model configuration is invalid; it was left unchanged.',
    );
  config.providers ??= {};
  if (typeof config.providers !== 'object' || Array.isArray(config.providers))
    throw new Error('Existing provider configuration is invalid.');
  const existing = Object.hasOwn(config.providers, model.provider)
    ? config.providers[model.provider]
    : undefined;
  if (
    existing &&
    (existing.baseUrl?.replace(/\/$/, '') !== model.baseUrl ||
      existing.api !== 'openai-completions')
  )
    throw new Error(
      'That provider ID uses a different endpoint or API. Choose a new provider ID.',
    );
  if (existing?.models !== undefined && !Array.isArray(existing.models))
    throw new Error('Existing model list is invalid.');
  const models = existing?.models ?? [];
  const old = models.find((item) => item.id === model.modelId) ?? {};
  const nextModel = {
    ...old,
    id: model.modelId,
    name: model.modelId,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  };
  config.providers[model.provider] = {
    ...existing,
    baseUrl: model.baseUrl,
    api: 'openai-completions',
    // Pi expands $ENV references. This field accepts literal secrets only.
    apiKey: model.apiKey
      ? model.apiKey.replaceAll('$', () => '$$')
      : (existing?.apiKey ?? 'local'),
    authHeader: model.apiKey ? true : (existing?.authHeader ?? false),
    models: models.some((item) => item.id === model.modelId)
      ? models.map((item) => (item.id === model.modelId ? nextModel : item))
      : [...models, nextModel],
  };
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    const current = await readFile(path, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    if (current !== previous)
      throw new Error(
        'Configuration changed while saving. Retry to preserve the other changes.',
      );
    await rename(temp, path);
  } finally {
    await unlink(temp).catch(() => {});
  }
  return {
    model: `${model.provider}/${model.modelId}`,
    message: 'Saved to Feynman. Start a new session to load this provider.',
  };
}
