<script lang="ts">
  import { tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import {
    CornerDownLeft,
    LoaderCircle,
    Command as CommandIcon,
  } from '@lucide/svelte';
  import { commandText } from '../lib/commands';
  import { commandIcon } from '../lib/command-icons';
  import { motion } from '../lib/motion';
  import type { Command } from '../lib/types';
  let {
    commands,
    selected,
    loading,
    connected,
    onselect,
  }: {
    commands: Command[];
    selected: number;
    loading: boolean;
    connected: boolean;
    onselect: (command: Command) => void;
  } = $props();
  let list: HTMLDivElement;
  $effect(() => {
    const index = selected;
    void tick().then(() =>
      list
        ?.querySelector(`[data-index="${index}"]`)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  });
</script>

<section
  class="command-suggestions"
  in:fly={{ y: 7, duration: motion(140) }}
  aria-label="Command suggestions"
>
  <header>
    <span><CommandIcon size={13} /> Research commands</span
    >{#if loading}<LoaderCircle
        size={13}
        class="spin"
        aria-label="Refreshing commands"
      />{:else}<kbd>esc</kbd>{/if}
  </header>
  <div
    class="suggestion-list"
    role="listbox"
    id="composer-command-menu"
    aria-label="Available research commands"
    bind:this={list!}
  >
    {#each commands as command, index}
      {@const Icon = commandIcon(command)}
      <button
        type="button"
        role="option"
        aria-selected={selected === index}
        id={`composer-command-${index}`}
        data-index={index}
        class:highlighted={selected === index}
        onclick={() => onselect(command)}
        tabindex="-1"
      >
        <span class="suggestion-icon"><Icon size={18} strokeWidth={1.6} /></span
        ><span class="suggestion-copy"
          ><strong>{commandText(command)}</strong><small
            >{command.description || 'Run this Feynman command'}</small
          ></span
        >{#if selected === index}<CornerDownLeft
            size={13}
            class="suggestion-enter"
          />{/if}
      </button>
    {/each}
  </div>
  {#if !commands.length}<p>
      {!connected
        ? 'Connect Feynman to load your commands.'
        : loading
          ? 'Loading commands from your runtime…'
          : 'No matching commands.'}
    </p>{/if}
  <footer>
    <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span
      ><kbd>tab</kbd> or <kbd>↵</kbd> insert</span
    >
  </footer>
</section>

<style>
  .command-suggestions {
    position: absolute;
    left: 30px;
    right: 30px;
    bottom: calc(100% - 10px);
    z-index: 30;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--sidebar);
    box-shadow: 0 14px 40px #0004;
    overflow: hidden;
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--faint);
    padding: 11px 14px;
    font-size: 10px;
  }
  header {
    border-bottom: 1px solid var(--line);
  }
  header span,
  footer span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  kbd {
    font:
      9px 'IBM Plex Mono',
      monospace;
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 1px 4px;
  }
  .suggestion-list {
    max-height: min(320px, 40dvh);
    overflow: auto;
    padding: 5px;
  }
  .suggestion-list:empty {
    padding: 0;
  }
  .suggestion-list button {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px;
    border-radius: 6px;
    width: 100%;
    text-align: left;
  }
  .suggestion-list button.highlighted,
  .suggestion-list button:hover {
    background: var(--surface);
  }
  .suggestion-icon {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    border: 1px solid var(--line);
    border-radius: 7px;
    color: var(--accent);
    background: var(--accent-soft);
    flex-shrink: 0;
  }
  .suggestion-copy {
    flex: 1;
    min-width: 0;
  }
  .suggestion-copy strong {
    font:
      12px 'IBM Plex Mono',
      monospace;
    color: var(--text);
  }
  .suggestion-copy small {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.suggestion-enter) {
    color: var(--faint);
  }
  p {
    padding: 12px 15px;
    color: var(--muted);
    font-size: 12px;
  }
  footer {
    border-top: 1px solid var(--line);
    padding-block: 8px;
  }
  @media (max-width: 560px) {
    .command-suggestions {
      left: 13px;
      right: 13px;
    }
  }
</style>
