import { answerText, automaticTitle } from './presentation';
import type { Session } from './types';
export interface ChatAppearance {
  font: 'default' | 'serif' | 'mono';
  small: boolean;
  wide: boolean;
}
export function chatAppearance(value: unknown): ChatAppearance {
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    font:
      record.font === 'serif' || record.font === 'mono'
        ? record.font
        : 'default',
    small: record.small === true,
    wide: record.wide === true,
  };
}
export function conversationMarkdown(session: Session): string {
  return `# ${automaticTitle(session)}\n\n${session.messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const content =
        message.role === 'assistant' ? answerText(message) : message.content;
      return content
        ? `## ${message.role === 'user' ? 'You' : 'Feynman'}\n\n${content}`
        : '';
    })
    .filter(Boolean)
    .join('\n\n')}\n`;
}
export function exportFilename(session: Session, extension: string) {
  return (
    (automaticTitle(session)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'research-session') + `.${extension}`
  );
}
