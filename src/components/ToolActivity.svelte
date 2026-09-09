<script lang="ts">
  import {
    Check,
    LoaderCircle,
    TriangleAlert,
    Terminal,
    ChevronRight,
  } from '@lucide/svelte';
  import type { ToolEvent } from '../lib/types';
  let { tools }: { tools: ToolEvent[] } = $props();
</script>

{#if tools.length}
  <div class="tool-activity">
    {#each tools as tool (tool.id)}
      <details class:error={tool.isError || tool.status === 'error'}>
        <summary
          ><ChevronRight size={13} class="disclosure" />
          {#if tool.status === 'running'}<LoaderCircle
              size={14}
              class="spin"
            />{:else if tool.isError || tool.status === 'error'}<TriangleAlert
              size={14}
            />{:else if tool.status === 'complete'}<Check
              size={14}
            />{:else}<Terminal size={14} />{/if}
          <span>{tool.label || tool.toolName || 'Tool'}</span><small
            >{tool.status}</small
          >
        </summary>
        {#if tool.input}<div class="tool-detail">
            <span>Input</span>
            <pre>{tool.input}</pre>
          </div>{/if}
        {#if tool.output || tool.details}<div class="tool-detail">
            <span>Result</span>
            <pre>{tool.output || tool.details}</pre>
          </div>{/if}
      </details>
    {/each}
  </div>
{/if}
