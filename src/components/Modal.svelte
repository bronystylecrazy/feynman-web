<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  let {
    title,
    onclose,
    children,
    busy = false,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
    busy?: boolean;
  } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => {
    dialog.showModal();
  });
</script>

<dialog
  bind:this={dialog!}
  {onclose}
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
  aria-label={title}
>
  <header class="modal-header">
    <h2>{title}</h2>
    <button
      class="icon-button"
      disabled={busy}
      onclick={() => dialog.close()}
      aria-label="Close dialog"><X size={18} /></button
    >
  </header>
  <div class="modal-body">{@render children()}</div>
</dialog>
