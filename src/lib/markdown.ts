import { Marked, type Token } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { artifactUrl, type ArtifactLinkContext } from './artifact-links';

export const markdown = new Marked({ gfm: true, breaks: false });
markdown.use(
  markedKatex({ throwOnError: false, trust: false, nonStandard: true }),
);
markdown.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''} target="_blank" rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`;
    },
    code({ text, lang }) {
      return `<pre><code class="hljs">${highlightCode(text, lang)}</code></pre>`;
    },
  },
});

export function highlightCode(text: string, lang = '') {
  const language = (lang || '').split(/\s/)[0];
  const highlighted =
    language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : escapeHtml(text);
  return DOMPurify.sanitize(highlighted);
}

export function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function resolveLinks(tokens: Token[], context: ArtifactLinkContext): Token[] {
  const resolved = structuredClone(tokens);
  markdown.walkTokens(resolved, (token) => {
    if (token.type === 'image' || token.type === 'link')
      token.href = artifactUrl(token.href, context);
  });
  return resolved;
}
export function renderMarkdown(
  source: string,
  context: ArtifactLinkContext = {},
): string {
  return sanitizeMarkdown(
    markdown.parser(resolveLinks(markdown.lexer(source), context)),
  );
}
export function renderToken(
  token: Token,
  context: ArtifactLinkContext = {},
): string {
  return sanitizeMarkdown(markdown.parser(resolveLinks([token], context)));
}
function sanitizeMarkdown(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      'style',
      'iframe',
      'form',
      'input',
      'button',
      'object',
      'embed',
    ],
    ADD_ATTR: ['target'],
  });
}
