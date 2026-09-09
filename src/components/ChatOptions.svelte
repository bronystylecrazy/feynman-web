<script lang="ts">
  import {
    Ellipsis,
    Search,
    Link,
    Clipboard,
    FilePenLine,
    Download,
    FileJson,
    ALargeSmall,
    MoveHorizontal,
    Check,
  } from '@lucide/svelte';
  import type { Session } from '../lib/types';
  import {
    conversationMarkdown,
    exportFilename,
    type ChatAppearance,
  } from '../lib/chat-options';
  let {
    session,
    appearance = $bindable(),
    busy,
    onrename,
  }: {
    session?: Session;
    appearance: ChatAppearance;
    busy: boolean;
    onrename: () => void;
  } = $props();
  const panelId = $props.id();
  let panel: HTMLDivElement;
  let query = $state('');
  let feedback = $state('');
  let open = $state(false);
  const visible = (label: string) =>
    label.toLowerCase().includes(query.toLowerCase());
  function download(extension: 'md' | 'json') {
    if (!session) return;
    const body =
      extension === 'md'
        ? conversationMarkdown(session)
        : JSON.stringify(session, null, 2);
    const url = URL.createObjectURL(
      new Blob([body], {
        type:
          extension === 'md'
            ? 'text/markdown;charset=utf-8'
            : 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(session, extension);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback = 'Export downloaded';
  }
  async function copy(kind: 'link' | 'conversation') {
    if (!session) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.set('session', session.id);
      await navigator.clipboard.writeText(
        kind === 'link' ? url.href : conversationMarkdown(session),
      );
      feedback =
        kind === 'link' ? 'Session link copied' : 'Conversation copied';
    } catch {
      feedback = 'Copy failed. Your browser may require clipboard access.';
    }
  }
</script>

<button
  class="icon-button"
  aria-label="Chat options"
  aria-haspopup="dialog"
  aria-expanded={open}
  popovertarget={panelId}><Ellipsis size={19} /></button
>
<div
  class="chat-options-panel"
  id={panelId}
  popover="auto"
  bind:this={panel!}
  role="dialog"
  aria-label="Chat options"
  ontoggle={(event) => {
    open = event.newState === 'open';
    if (!open) {
      query = '';
      feedback = '';
    }
  }}
>
  <label class="options-search"
    ><Search size={15} /><input
      bind:value={query}
      placeholder="Search actions…"
      aria-label="Search chat actions"
    /></label
  >
  {#if !query || visible('Default Serif Mono font appearance')}
    <fieldset class="font-options">
      <legend>Chat font</legend>
      {#each ['default', 'serif', 'mono'] as font}<label
          class:chosen={appearance.font === font}
          ><input
            type="radio"
            name={`${panelId}-font`}
            value={font}
            aria-label={font === 'default'
              ? 'Default'
              : font === 'serif'
                ? 'Serif'
                : 'Mono'}
            checked={appearance.font === font}
            onchange={() => {
              appearance = {
                ...appearance,
                font: font as ChatAppearance['font'],
              };
            }}
          /><span class={`font-sample ${font}`}>Ag</span><small
            >{font === 'default'
              ? 'Default'
              : font === 'serif'
                ? 'Serif'
                : 'Mono'}</small
          ></label
        >{/each}
    </fieldset>
  {/if}
  <div class="options-actions">
    {#if visible('Copy link')}<button
        disabled={!session}
        onclick={() => copy('link')}
        ><Link size={17} /><span>Copy link</span></button
      >{/if}
    {#if visible('Copy conversation')}<button
        disabled={!session?.messages.length}
        onclick={() => copy('conversation')}
        ><Clipboard size={17} /><span>Copy conversation</span></button
      >{/if}
    {#if visible('Rename chat')}<button
        disabled={!session || busy}
        onclick={() => {
          panel.hidePopover();
          onrename();
        }}><FilePenLine size={17} /><span>Rename chat</span></button
      >{/if}
  </div>
  {#if !query || visible('Small text') || visible('Full width')}<div
      class="appearance-options"
    >
      {#if visible('Small text')}<label class="option-switch"
          ><ALargeSmall size={18} /><span>Small text</span><input
            type="checkbox"
            role="switch"
            aria-label="Small text"
            checked={appearance.small}
            onchange={(event) =>
              (appearance = {
                ...appearance,
                small: event.currentTarget.checked,
              })}
          /></label
        >{/if}
      {#if visible('Full width')}<label class="option-switch"
          ><MoveHorizontal size={18} /><span>Full width</span><input
            type="checkbox"
            role="switch"
            aria-label="Full width"
            checked={appearance.wide}
            onchange={(event) =>
              (appearance = {
                ...appearance,
                wide: event.currentTarget.checked,
              })}
          /></label
        >{/if}
    </div>{/if}
  <div class="options-actions export-options">
    {#if visible('Export Markdown')}<button
        disabled={!session?.messages.length}
        onclick={() => download('md')}
        ><Download size={17} /><span>Export Markdown</span><small>.md</small
        ></button
      >{/if}
    {#if visible('Export JSON')}<button
        disabled={!session?.messages.length}
        onclick={() => download('json')}
        ><FileJson size={17} /><span>Export JSON</span><small>.json</small
        ></button
      >{/if}
  </div>
  {#if query && !['Default Serif Mono font appearance', 'Copy link', 'Copy conversation', 'Rename chat', 'Small text', 'Full width', 'Export Markdown', 'Export JSON'].some(visible)}<p
      class="options-empty"
    >
      No matching actions.
    </p>{/if}
  {#if feedback}<p class="options-feedback" role="status">
      <Check size={12} />
      {feedback}
    </p>{/if}
  <p class="options-note">Appearance is saved in this browser.</p>
</div>

<style>
  .chat-options-panel {
    position: fixed;
    inset: 60px 18px auto auto;
    width: 292px;
    max-height: calc(100dvh - 82px);
    overflow: auto;
    margin: 0;
    padding: 9px;
    color: var(--text);
    background: var(--sidebar);
    border: 1px solid var(--line);
    border-radius: 11px;
    box-shadow: 0 12px 45px #0005;
  }
  .chat-options-panel:popover-open {
    animation: options-in 140ms ease-out;
  }
  .chat-options-panel .options-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    margin: 2px 2px 12px;
    color: var(--faint);
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }
  .options-search:focus-within {
    border-color: var(--accent);
  }
  .options-search input {
    border: 0;
    background: none;
    padding: 0;
    margin: 0;
    width: 100%;
    font-size: 12px;
    outline: none;
  }
  .font-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 0;
    padding: 0 4px 13px;
    margin: 0;
    gap: 5px;
  }
  legend {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .chat-options-panel .font-options label {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    gap: 7px;
    border-radius: 6px;
    position: relative;
    padding: 8px;
    margin: 0;
  }
  .font-options label:hover {
    background: var(--surface);
  }
  .font-options label:focus-within {
    outline: 1px solid var(--accent);
  }
  .font-options input {
    opacity: 0;
    position: absolute;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
  .font-sample {
    font-size: 28px;
    line-height: 1.2;
  }
  .font-sample.serif {
    font-family: Georgia, serif;
  }
  .font-sample.mono {
    font-family: 'IBM Plex Mono', monospace;
  }
  .font-options small {
    color: var(--muted);
    font-size: 11px;
  }
  .font-options .chosen .font-sample,
  .font-options .chosen small {
    color: var(--accent);
  }
  .options-actions button,
  .chat-options-panel .option-switch {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 11px;
    border-radius: 6px;
    width: 100%;
    font-size: 12px;
    text-align: left;
  }
  .options-actions button:hover,
  .option-switch:hover {
    background: var(--surface);
  }
  .options-actions button :global(svg),
  .option-switch :global(svg) {
    color: var(--muted);
  }
  .options-actions button small {
    margin-left: auto;
    color: var(--faint);
    font:
      9px 'IBM Plex Mono',
      monospace;
  }
  .appearance-options,
  .export-options {
    border-top: 1px solid var(--line);
    margin-top: 7px;
    padding-top: 7px;
  }
  .export-options:empty,
  .options-actions:empty {
    display: none;
  }
  .chat-options-panel .option-switch {
    cursor: pointer;
    margin: 0;
  }
  .option-switch input {
    appearance: none;
    width: 30px;
    height: 17px;
    margin: 0 0 0 auto;
    border-radius: 20px;
    background: var(--surface-hover);
    position: relative;
    cursor: pointer;
    transition: background 0.15s;
  }
  .option-switch input::after {
    content: '';
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--muted);
    position: absolute;
    top: 3px;
    left: 3px;
    transition: transform 0.15s;
  }
  .option-switch input:checked {
    background: var(--accent);
  }
  .option-switch input:checked::after {
    background: var(--sidebar);
    transform: translateX(13px);
  }
  .option-switch input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .options-note {
    color: var(--faint);
    font-size: 9px;
    text-align: center;
    margin: 13px 0 4px;
  }
  .options-feedback {
    color: var(--accent);
    font-size: 10px;
    padding: 7px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .options-empty {
    color: var(--muted);
    font-size: 12px;
    padding: 10px;
  }
  @keyframes options-in {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chat-options-panel:popover-open {
      animation: none;
    }
    .option-switch input,
    .option-switch input::after {
      transition: none;
    }
  }
  @media (max-width: 560px) {
    .chat-options-panel {
      top: 52px;
      right: 10px;
      width: min(292px, calc(100vw - 20px));
    }
  }
</style>
