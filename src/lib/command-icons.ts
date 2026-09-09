import {
  BookOpen,
  ScanSearch,
  ShieldCheck,
  FlaskConical,
  GitCompareArrows,
  FilePenLine,
  Radar,
  Terminal,
  Network,
  Settings2,
} from '@lucide/svelte';
import type { Command } from './types';
import { commandText } from './commands';

export function commandIcon(command: Command) {
  const name = commandText(command).toLowerCase();
  if (/lit|paper|read/.test(name)) return BookOpen;
  if (/deepresearch|search|discover/.test(name)) return ScanSearch;
  if (/audit|review|verify/.test(name)) return ShieldCheck;
  if (/replic|experiment|autoresearch/.test(name)) return FlaskConical;
  if (/compare/.test(name)) return GitCompareArrows;
  if (/draft|write/.test(name)) return FilePenLine;
  if (/watch/.test(name)) return Radar;
  if (/delegate|agent/.test(name)) return Network;
  if (/model|settings|config/.test(name)) return Settings2;
  return Terminal;
}
