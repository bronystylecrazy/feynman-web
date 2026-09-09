import type { Message, Session, ToolEvent } from './types';

export function researchTools(message: Message): ToolEvent[] {
  return (message.toolEvents ?? []).filter(
    (tool) => tool.toolName || tool.label !== 'Feynman Pi turn',
  );
}
export function answerText(message: Message): string {
  return message.content === 'Starting Feynman inside this workspace...' &&
    (message.toolEvents ?? []).some(
      (tool) => !tool.toolName && tool.label === 'Feynman Pi turn',
    )
    ? ''
    : message.content;
}
export function automaticTitle(session: Session, prompt?: string): string {
  if (
    !/^(new research session|new chat|untitled(?: session)?)$/i.test(
      session.title.trim(),
    )
  )
    return session.title;
  const question =
    session.messages.find((message) => message.role === 'user')?.content ??
    prompt;
  if (!question) return session.title;
  const cleaned = question
    .replace(/^\s*(?:can you\s+|could you\s+|please\s+|help me\s+)+/i, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`#*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return session.title;
  const words = cleaned.split(' ').slice(0, 10).join(' ');
  const points = Array.from(words);
  const title = points
    .slice(0, 64)
    .join('')
    .replace(/[\s.,?!:;]+$/, '');
  return (
    title.charAt(0).toUpperCase() +
    title.slice(1) +
    (points.length > 64 || words.length < cleaned.length ? '…' : '')
  );
}
