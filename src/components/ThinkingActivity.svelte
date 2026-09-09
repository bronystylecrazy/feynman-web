<script lang="ts">
  import {
    BrainCircuit,
    ChevronDown,
    Check,
    CirclePause,
    TriangleAlert,
  } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import type { RunStatus, ToolEvent } from '../lib/types';
  import { motion } from '../lib/motion';
  import ToolActivity from './ToolActivity.svelte';

  let {
    tools,
    status,
    hasAnswer,
  }: { tools: ToolEvent[]; status: RunStatus; hasAnswer: boolean } = $props();
  const panelId = $props.id();
  let expanded = $state(false);
  let running = $derived(status === 'running' || status === 'queued');
  let activeTools = $derived(
    running &&
      tools.some(
        (tool) => tool.status === 'running' || tool.status === 'queued',
      ),
  );
  let thinking = $derived(running && !hasAnswer);
  let animated = $derived(thinking || activeTools);
  let label = $derived(
    activeTools
      ? 'Researching…'
      : thinking
        ? 'Thinking…'
        : status === 'stopped'
          ? 'Research stopped'
          : status === 'error'
            ? 'Research interrupted'
            : 'Research activity',
  );

  $effect(() => {
    if (!running) expanded = false;
  });
</script>

{#if thinking || tools.length}
  <section
    class="thinking-section"
    class:animated
    aria-label="Thinking and research activity"
  >
    {#snippet symbol()}
      <span class="thought-symbol" aria-hidden="true">
        {#if animated}<BrainCircuit size={17} strokeWidth={1.6} /><span
            class="thought-orbit"><i></i><i></i></span
          >
        {:else if status === 'error'}<TriangleAlert size={15} />
        {:else if status === 'stopped'}<CirclePause size={15} />
        {:else}<Check size={15} />{/if}
      </span>
    {/snippet}
    {#if tools.length}
      <button
        class="thinking-toggle"
        aria-label={`${label} ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onclick={() => (expanded = !expanded)}
      >
        {@render symbol()}
        <span
          class:thinking-label={animated}
          role={animated ? 'status' : undefined}>{label}</span
        >
        <span class="thinking-count"
          >{tools.length} {tools.length === 1 ? 'tool' : 'tools'}</span
        >
        <ChevronDown
          size={13}
          class={expanded ? 'thinking-chevron expanded' : 'thinking-chevron'}
        />
      </button>
      {#if expanded}
        <div
          id={panelId}
          class="thinking-details"
          transition:slide={{ duration: motion(180) }}
        >
          <p>Steps in this research run</p>
          <ToolActivity {tools} />
        </div>
      {/if}
    {:else}
      <div class="thinking-wait">
        {@render symbol()}
        <span class="thinking-label" role="status">Thinking…</span>
        <span class="thinking-dots" aria-hidden="true"
          ><i></i><i></i><i></i></span
        >
      </div>
    {/if}
  </section>
{/if}

<style>
  .thinking-section {
    margin: 0 0 17px;
    color: var(--muted);
    font-size: 12px;
  }
  .thinking-wait,
  .thinking-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 37px;
  }
  .thinking-toggle {
    padding: 3px 8px 3px 0;
    border-radius: 6px;
    text-align: left;
  }
  .thinking-toggle:hover {
    color: var(--text);
  }
  .thought-symbol {
    position: relative;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: var(--faint);
  }
  .animated .thought-symbol {
    color: var(--accent);
  }
  .animated .thought-symbol :global(svg) {
    animation: thought-breathe 2.4s ease-in-out infinite;
  }
  .thought-orbit {
    position: absolute;
    inset: -3px;
    animation: thought-orbit 5s linear infinite;
  }
  .thought-orbit i {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--accent);
    top: 0;
    left: 50%;
    opacity: 0.75;
  }
  .thought-orbit i + i {
    top: auto;
    bottom: 0;
    opacity: 0.3;
  }
  .thinking-label {
    background: linear-gradient(
      100deg,
      var(--muted) 25%,
      var(--text) 50%,
      var(--muted) 75%
    );
    background-size: 230% 100%;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: thought-shimmer 2.8s linear infinite;
  }
  .thinking-count {
    color: var(--faint);
    font:
      9px 'IBM Plex Mono',
      monospace;
    border-left: 1px solid var(--line);
    padding-left: 10px;
    margin-left: 2px;
  }
  .thinking-toggle :global(.thinking-chevron) {
    color: var(--faint);
    transition: transform 0.18s ease;
  }
  .thinking-toggle :global(.thinking-chevron.expanded) {
    transform: rotate(180deg);
  }
  .thinking-dots {
    display: inline-flex;
    gap: 4px;
    margin-left: 2px;
  }
  .thinking-dots i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.25;
    animation: thought-dot 1.8s ease-in-out infinite;
  }
  .thinking-dots i:nth-child(2) {
    animation-delay: 0.2s;
  }
  .thinking-dots i:nth-child(3) {
    animation-delay: 0.4s;
  }
  .thinking-details {
    margin: 6px 0 0 11px;
    border-left: 1px solid var(--line);
    padding: 2px 0 1px 20px;
  }
  .thinking-details p {
    margin: 7px 0 12px;
    font-size: 10px;
    color: var(--faint);
  }
  .thinking-details :global(.tool-activity) {
    margin-bottom: 10px;
  }
  @keyframes thought-breathe {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(0.94);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }
  @keyframes thought-orbit {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes thought-dot {
    50% {
      opacity: 0.9;
      transform: translateY(-2px);
    }
  }
  @keyframes thought-shimmer {
    from {
      background-position: 160% 0;
    }
    to {
      background-position: -70% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .thought-orbit,
    .thinking-dots i,
    .thinking-label,
    .animated .thought-symbol :global(svg) {
      animation: none;
    }
    .thinking-label {
      background: none;
      -webkit-text-fill-color: currentColor;
    }
    .thinking-toggle :global(.thinking-chevron) {
      transition: none;
    }
  }
</style>
