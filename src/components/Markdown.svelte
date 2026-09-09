<script lang="ts">
  import { markdown, renderToken } from '../lib/markdown';
  import CodeBlock from './CodeBlock.svelte';
  import Diagram from './Diagram.svelte';
  let {
    content,
    streaming = false,
    sourcePath,
    workspacePath,
  }: {
    content: string;
    streaming?: boolean;
    sourcePath?: string;
    workspacePath?: string;
  } = $props();
  let tokens = $derived(markdown.lexer(content));
</script>

<div class="prose">
  {#each tokens as token}
    {#if token.type === 'code' && token.lang === 'mermaid'}
      <Diagram source={token.text} {streaming} />
    {:else if token.type === 'code'}
      <CodeBlock code={token.text} language={token.lang} />
    {:else}
      {@html renderToken(token, { sourcePath, workspacePath })}
    {/if}
  {/each}
</div>
