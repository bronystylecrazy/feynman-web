<script lang="ts">
  import { onMount } from 'svelte';
  import DOMPurify from 'dompurify';
  import { Code2, Workflow } from '@lucide/svelte';
  import CodeBlock from './CodeBlock.svelte';
  let { source, streaming = false }: { source: string; streaming?: boolean } =
    $props();
  let mounted = $state(false);
  let svg = $state('');
  let error = $state('');
  let showSource = $state(false);
  let ratio = $state(2);
  onMount(() => {
    mounted = true;
  });
  $effect(() => {
    const text = source;
    if (!mounted || streaming) return;
    let cancelled = false;
    svg = '';
    error = '';
    void (async () => {
      try {
        if (text.length > 40_000)
          throw new Error('Diagram is too large for inline preview.');
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          suppressErrorRendering: true,
          maxTextSize: 40_000,
          themeVariables: {
            primaryColor: '#3d493d',
            primaryTextColor: '#e2ddcc',
            primaryBorderColor: '#a7c080',
            lineColor: '#89998b',
            background: '#2d3538',
            fontFamily: 'ui-monospace, monospace',
          },
        });
        const result = await mermaid.render(
          `diagram-${crypto.randomUUID()}`,
          text,
        );
        if (!cancelled) {
          svg = DOMPurify.sanitize(result.svg, {
            USE_PROFILES: { svg: true, svgFilters: true, html: true },
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
          });
          const viewBox = new DOMParser()
            .parseFromString(svg, 'image/svg+xml')
            .documentElement.getAttribute('viewBox')
            ?.split(/\s+/)
            .map(Number);
          if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0)
            ratio = viewBox[2] / viewBox[3];
        }
      } catch {
        if (!cancelled)
          error =
            'Diagram could not be rendered. Its source is available below.';
      }
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="diagram-block">
  <div class="code-header">
    <span class="inline"><Workflow size={14} /> Mermaid</span><button
      onclick={() => (showSource = !showSource)}
      ><Code2 size={13} /> {showSource ? 'Preview' : 'Source'}</button
    >
  </div>
  {#if showSource || error || streaming}
    {#if error}<p class="muted">{error}</p>{/if}
    {#if streaming}<small class="muted"
        >Diagram will render when the response finishes.</small
      >{/if}
    <CodeBlock code={source} language="mermaid" />
  {:else if svg}<div class="diagram-canvas">
      <iframe
        title="Mermaid diagram"
        sandbox=""
        style:aspect-ratio={ratio}
        srcdoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{margin:0;background:#272d32;color:#dcd9ca}svg{display:block;max-width:100%;height:auto;margin:auto}</style></head><body>${svg}</body></html>`}
      ></iframe>
    </div>
  {:else}<p class="muted">Rendering diagram…</p>{/if}
</div>
