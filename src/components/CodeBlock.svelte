<script lang="ts">
  import { Copy, Check } from '@lucide/svelte';
  import { highlightCode } from '../lib/markdown';
  let { code, language = '' }: { code: string; language?: string } = $props();
  let copied = $state(false);
  let error = $state('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      error = 'Could not copy. Select the source text to copy it.';
    }
  }
  let html = $derived(highlightCode(code, language));
</script>

<div class="code-block">
  <div class="code-header">
    <span>{language || 'source'}</span><button
      onclick={copy}
      aria-label="Copy code"
      >{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy{/if}</button
    >
  </div>
  <pre><code class="hljs">{@html html}</code></pre>
  {#if error}<small role="status">{error}</small>{/if}
</div>
