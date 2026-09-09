// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { markdown, renderMarkdown, renderToken } from '../src/lib/markdown';
import { artifactUrl } from '../src/lib/artifact-links';

describe('research Markdown', () => {
  it('resolves document-relative figures and absolute paths only within the known workspace', () => {
    expect(
      artifactUrl('../figures/a.png', {
        sourcePath: 'outputs/drafts/report.md',
      }),
    ).toBe('/api/file/download?path=outputs%2Ffigures%2Fa.png');
    expect(
      artifactUrl('/research/outputs/a.png', { workspacePath: '/research' }),
    ).toBe('/api/file/download?path=outputs%2Fa.png');
    expect(
      artifactUrl('/other/outputs/a.png', { workspacePath: '/research' }),
    ).toBe('/other/outputs/a.png');
    expect(artifactUrl('https://example.com/a.png')).toBe(
      'https://example.com/a.png',
    );
    expect(() => artifactUrl('outputs/bad%.png')).not.toThrow();
  });
  it('loads generated workspace images through the authenticated file API', () => {
    const html = renderMarkdown(
      '![Attention equation](outputs/figures/attention_equation.png)',
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/api/file/download?path=outputs%2Ffigures%2Fattention_equation.png',
    );
  });
  it('preserves reference citations when rendering separate blocks', () => {
    const source =
      'See [evidence][paper].\n\n## Sources\n\n[paper]: https://example.com/paper';
    const html = markdown
      .lexer(source)
      .map((token) => renderToken(token))
      .join('');
    expect(html).toContain('href="https://example.com/paper"');
    expect(html).not.toContain('[paper]');
  });
  it('renders inline/display math, tables, and highlighted code', () => {
    const html = renderMarkdown(
      'Inline $x^2$.\n\n$$\n\\frac{a}{b}\n$$\n\n| Method | Score |\n|---|---|\n| A | 1 |\n\n```python\nprint("hello")\n```',
    );
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs-string');
    expect(html).toContain('style='); // KaTeX layout styles must survive sanitization.
  });
  it('escapes raw HTML and removes executable links', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n<style>body{display:none}</style>',
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('script,style,img,[onerror]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
  });
  it('handles incomplete streamed math and fenced code without throwing', () => {
    for (const text of [
      'A $x',
      '$$\n\\frac{',
      '```python\nprint(',
      '[source](',
    ])
      expect(() =>
        markdown.lexer(text).map((token) => renderToken(token)),
      ).not.toThrow();
  });
});
