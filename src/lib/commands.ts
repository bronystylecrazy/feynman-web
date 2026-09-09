import type { Command } from './types';

export function commandText(command: Command) {
  return command.command || `/${command.name}`;
}
export function matchCommands(commands: Command[], query: string) {
  const term = query.replace(/^\//, '').toLowerCase();
  return commands
    .filter((command) =>
      `${commandText(command)} ${command.description ?? ''}`
        .toLowerCase()
        .includes(term),
    )
    .sort(
      (a, b) =>
        Number(!commandText(a).slice(1).toLowerCase().startsWith(term)) -
          Number(!commandText(b).slice(1).toLowerCase().startsWith(term)) ||
        commandText(a).localeCompare(commandText(b)),
    );
}
