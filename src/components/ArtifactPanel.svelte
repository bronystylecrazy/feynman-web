<script lang="ts">
  import { fly } from 'svelte/transition';
  import { motion } from '../lib/motion';
  import {
    FileText,
    X,
    Download,
    ArrowLeft,
    Search,
    BookOpen,
  } from '@lucide/svelte';
  import { api } from '../lib/api';
  import type { Artifact, FilePreview } from '../lib/types';
  import Markdown from './Markdown.svelte';
  import CodeBlock from './CodeBlock.svelte';
  import { sampleResearch } from '../lib/sample';
  let {
    artifacts,
    selected = $bindable<Artifact | undefined>(),
    sample = false,
    workspacePath,
    onclose,
  }: {
    artifacts: Artifact[];
    selected?: Artifact;
    sample?: boolean;
    workspacePath?: string;
    onclose: () => void;
  } = $props();
  let source = $state(false);
  let query = $state('');
  let content = $state('');
  let truncated = $state(false);
  let loading = $state(false);
  let error = $state('');
  let blobUrl = $state('');
  let filtered = $derived(
    artifacts.filter((a) =>
      `${a.title} ${a.path}`.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  let extension = $derived(selected?.extension?.toLowerCase() || '.md');
  let isImage = $derived(
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension),
  );
  let isPdf = $derived(extension === '.pdf');
  let isMarkdown = $derived(
    extension === '.md' || extension === '.markdown' || sample,
  );
  let notebook = $derived.by(() => {
    if (extension !== '.ipynb' || !content) return undefined;
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.cells)) return undefined;
      return parsed.cells.map(
        (cell: { cell_type?: string; source?: string | string[] }) => ({
          type: cell.cell_type ?? 'raw',
          source: Array.isArray(cell.source)
            ? cell.source.join('')
            : String(cell.source ?? ''),
        }),
      );
    } catch {
      return undefined;
    }
  });
  $effect(() => {
    const artifact = selected;
    const demo = sample;
    const abort = new AbortController();
    let disposed = false;
    let objectUrl = '';
    content = '';
    error = '';
    blobUrl = '';
    source = false;
    truncated = false;
    if (demo) {
      content = sampleResearch;
      loading = false;
      return;
    }
    if (!artifact) return;
    loading = true;
    void (async () => {
      try {
        const binary = /\.(pdf|png|jpe?g|webp|gif|svg)$/i.test(artifact.path);
        if (binary) {
          const response = await fetch(
            `/api/file/download?path=${encodeURIComponent(artifact.path)}`,
            { signal: abort.signal },
          );
          if (!response.ok)
            throw new Error(`Could not load artifact (${response.status}).`);
          const blob = await response.blob();
          if (!disposed) {
            objectUrl = URL.createObjectURL(blob);
            blobUrl = objectUrl;
          }
        } else {
          const preview = await api<FilePreview>(
            `/api/file?path=${encodeURIComponent(artifact.path)}`,
          );
          if (!disposed) {
            content = preview.content ?? '';
            truncated = preview.truncated;
          }
        }
      } catch (e) {
        if (!disposed)
          error = e instanceof Error ? e.message : 'Could not load artifact.';
      } finally {
        if (!disposed) loading = false;
      }
    })();
    return () => {
      disposed = true;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

<aside
  transition:fly={{ x: 20, duration: motion(200) }}
  class="artifact-panel"
  aria-label="Research artifacts"
>
  <header class="panel-header">
    <span class="inline"><BookOpen size={16} /> Research artifacts</span><button
      class="icon-button"
      onclick={onclose}
      aria-label="Close artifacts"><X size={17} /></button
    >
  </header>
  {#if selected || sample}
    <div class="artifact-title">
      <button
        class="icon-button"
        onclick={() => {
          if (sample) onclose();
          else selected = undefined;
        }}
        aria-label="Back to artifacts"><ArrowLeft size={16} /></button
      >
      <div>
        <strong>{sample ? 'research-example.md' : selected?.name}</strong><small
          >{sample
            ? 'Rendering example · not a live run'
            : selected?.category}</small
        >
      </div>
      {#if selected && !sample}<a
          class="icon-button"
          href={`/api/file/download?path=${encodeURIComponent(selected.path)}`}
          download
          aria-label="Download artifact"><Download size={16} /></a
        >{/if}
    </div>
    {#if !isImage && !isPdf}<div class="preview-tabs">
        <button class:active={!source} onclick={() => (source = false)}
          >Preview</button
        ><button class:active={source} onclick={() => (source = true)}
          >Source</button
        ><span>{sample ? 'EXAMPLE' : extension.slice(1).toUpperCase()}</span>
      </div>{/if}
    <div class="artifact-content">
      {#if loading}<p class="muted">Loading artifact…</p>{:else if error}<p
          class="error-message"
          role="alert"
        >
          {error}
        </p>
      {:else if isImage && blobUrl}<img
          class="artifact-image"
          src={blobUrl}
          alt={selected?.title || selected?.name || 'Research artifact'}
        />
      {:else if isPdf && blobUrl}<iframe
          title="PDF preview"
          src={blobUrl}
          class="pdf-preview"
        ></iframe>
      {:else if source}<CodeBlock
          code={content}
          language={isMarkdown ? 'markdown' : extension.slice(1)}
        />
      {:else if isMarkdown}<Markdown
          {content}
          sourcePath={selected?.path}
          {workspacePath}
        />
      {:else if notebook}{#each notebook as cell, i}<section
            class="notebook-cell"
          >
            <small>CELL {i + 1} · {cell.type}</small
            >{#if cell.type === 'markdown'}<Markdown
                content={cell.source}
                sourcePath={selected?.path}
                {workspacePath}
              />{:else}<CodeBlock code={cell.source} />{/if}
          </section>{/each}
      {:else if extension === '.tex' || extension === '.latex'}<p
          class="notice"
        >
          LaTeX source. Full paper compilation is not available yet.
        </p>
        <CodeBlock code={content} language="latex" />
      {:else}<CodeBlock code={content} language={extension.slice(1)} />{/if}
      {#if truncated}<p class="notice">
          Preview truncated by Feynman. Download the original for the full
          content.
        </p>{/if}
    </div>
  {:else}
    <label class="search-input artifact-search"
      ><Search size={15} /><input
        bind:value={query}
        placeholder="Find an artifact…"
        aria-label="Search artifacts"
      /></label
    >
    <div class="artifact-list">
      {#each filtered as artifact}<button onclick={() => (selected = artifact)}
          ><FileText size={18} /><span
            ><strong>{artifact.title || artifact.name}</strong><small
              >{artifact.path}</small
            ></span
          ><span class="file-type">{artifact.extension.slice(1)}</span></button
        >{/each}
      {#if !filtered.length}<div class="panel-empty">
          <FileText size={28} />
          <h3>
            {query ? 'No matching artifacts' : 'Your evidence lives here'}
          </h3>
          <p>
            Research outputs, papers, notes, and provenance files appear here
            when Feynman creates them.
          </p>
        </div>{/if}
    </div>
  {/if}
</aside>
