import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveModel, validateModel } from '../server/models.mjs';

const dirs: string[] = [];
async function configPath() {
  const dir = await mkdtemp(join(tmpdir(), 'feynman-web-model-test-'));
  dirs.push(dir);
  return join(dir, 'models.json');
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const input = {
  provider: 'local-test',
  modelId: 'test-1',
  baseUrl: 'http://127.0.0.1:1234/v1',
  apiKey: 'literal-$key',
  contextWindow: 32768,
  maxTokens: 4096,
};
describe('custom model persistence', () => {
  it('merges records, preserves unrelated settings, and restricts file permissions', async () => {
    const path = await configPath();
    await writeFile(
      path,
      JSON.stringify({
        extra: 1,
        providers: {
          other: { baseUrl: 'http://localhost:1', models: [{ id: 'other' }] },
        },
      }),
    );
    await saveModel(path, input);
    await saveModel(path, { ...input, modelId: 'test-2', apiKey: '' });
    const config = JSON.parse(await readFile(path, 'utf8'));
    expect(config.extra).toBe(1);
    expect(config.providers.other.models[0].id).toBe('other');
    expect(
      config.providers['local-test'].models.map(
        (model: { id: string }) => model.id,
      ),
    ).toEqual(['test-1', 'test-2']);
    expect(config.providers['local-test'].apiKey).toBe('literal-$$key');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
  it('preserves malformed/commented configs and rejects endpoint replacement', async () => {
    const path = await configPath();
    await writeFile(path, '{ // preserve this comment\n}');
    await expect(saveModel(path, input)).rejects.toThrow('strict JSON');
    expect(await readFile(path, 'utf8')).toBe('{ // preserve this comment\n}');
    await writeFile(path, '{}');
    await saveModel(path, input);
    await expect(
      saveModel(path, { ...input, baseUrl: 'http://localhost:9999/v1' }),
    ).rejects.toThrow('different endpoint');
  });
  it('rejects shell keys, invalid limits, prototype IDs, and symlink writes', async () => {
    expect(() =>
      validateModel({ ...input, apiKey: '!touch /tmp/no' }),
    ).toThrow();
    expect(() => validateModel({ ...input, provider: '__proto__' })).toThrow();
    expect(() => validateModel({ ...input, maxTokens: 999999 })).toThrow();
    expect(() =>
      validateModel({
        ...input,
        baseUrl: 'https://user:secret@example.com/v1',
      }),
    ).toThrow();
    const path = await configPath();
    const target = `${path}.target`;
    await writeFile(target, '{}');
    await symlink(target, path);
    await expect(saveModel(path, input)).rejects.toThrow('regular file');
    expect(await readFile(target, 'utf8')).toBe('{}');
  });
});
