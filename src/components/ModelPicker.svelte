<script lang="ts">
  import {
    Search,
    Plus,
    ArrowLeft,
    Check,
    Server,
    LoaderCircle,
  } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import { api } from '../lib/api';
  let {
    models,
    current,
    customEnabled,
    onselect,
    onclose,
  }: {
    models: string[];
    current: string;
    customEnabled: boolean;
    onselect: (model: string, useDefault: boolean) => Promise<void>;
    onclose: () => void;
  } = $props();
  let query = $state('');
  let custom = $state(false);
  let useDefault = $state(false);
  let busy = $state(false);
  let error = $state('');
  let result = $state('');
  let provider = $state('local-research');
  let baseUrl = $state('http://localhost:1234/v1');
  let modelId = $state('');
  let apiKey = $state('');
  let contextWindow = $state(32768);
  let maxTokens = $state(4096);
  let filtered = $derived(
    [...new Set([current, ...models].filter(Boolean))].filter((model) =>
      model.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  async function select(model: string) {
    busy = true;
    error = '';
    try {
      await onselect(model, useDefault);
      onclose();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not select model.';
    } finally {
      busy = false;
    }
  }
  async function customAction(action: 'test' | 'save') {
    busy = true;
    error = '';
    result = '';
    try {
      const response = await api<{ message: string; model?: string }>(
        `/bridge/models/${action}`,
        { provider, baseUrl, modelId, apiKey, contextWindow, maxTokens },
      );
      result = response.message;
      if (action === 'save' && response.model) {
        apiKey = '';
        await onselect(response.model, useDefault);
        onclose();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not configure endpoint.';
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  title={custom ? 'Connect a custom model' : 'Choose your model'}
  {onclose}
  {busy}
>
  {#if custom}
    <button
      class="text-button"
      onclick={() => {
        custom = false;
        error = '';
        result = '';
      }}
      disabled={busy}><ArrowLeft size={14} /> All models</button
    >
    <p class="muted">
      Connect an OpenAI-compatible endpoint. Model configuration stays with your
      local Feynman installation.
    </p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void customAction('save');
      }}
      oninput={() => {
        result = '';
        error = '';
      }}
    >
      <fieldset disabled={busy}>
        <label
          >Provider ID<input
            required
            bind:value={provider}
            placeholder="local-research"
            pattern="[a-z][a-z0-9-]+"
          /></label
        >
        <label
          >Base URL<input
            required
            type="url"
            bind:value={baseUrl}
            placeholder="http://localhost:1234/v1"
          /></label
        >
        <label
          >Model ID<input
            required
            bind:value={modelId}
            placeholder="Exact model ID from your server"
          /></label
        >
        <label
          >API key <span class="muted">optional for local models</span><input
            type="password"
            bind:value={apiKey}
            autocomplete="off"
            placeholder="Stored by the local server"
          /></label
        >
        <details>
          <summary>Model limits</summary>
          <p class="muted small">
            Set these to the limits supported by your model.
          </p>
          <div class="form-row">
            <label
              >Context window<input
                type="number"
                min="1"
                max="10000000"
                required
                bind:value={contextWindow}
              /></label
            ><label
              >Max output tokens<input
                type="number"
                min="1"
                max={contextWindow}
                required
                bind:value={maxTokens}
              /></label
            >
          </div>
        </details>
        <label class="checkbox-label"
          ><input type="checkbox" bind:checked={useDefault} /> Use for new chats in
          this browser</label
        >
        {#if !customEnabled}<div class="notice">
            Provider saving needs <code>FEYNMAN_MODELS_PATH</code> configured on
            the local server. You can also configure providers with
            <code>feynman model login</code>, then refresh this app.
          </div>{/if}
        <div class="modal-actions">
          <button
            type="button"
            class="secondary"
            onclick={() => customAction('test')}>Test endpoint</button
          ><button type="submit" class="primary" disabled={!customEnabled}
            >Save & start session</button
          >
        </div>
      </fieldset>
    </form>
  {:else}
    <p class="muted">
      Models available through Feynman. Changing models starts a fresh research
      session.
    </p>
    <label class="search-input"
      ><Search size={16} /><input
        bind:value={query}
        placeholder="Search models…"
        aria-label="Search models"
      /></label
    >
    <div class="model-list">
      <button class="model-option" disabled={busy} onclick={() => select('')}
        ><Server size={18} /><span
          ><strong>Feynman default</strong><small
            >Use your runtime’s configured model</small
          ></span
        >{#if !current}<Check size={16} />{/if}</button
      >
      {#each filtered as model}
        <button
          class="model-option"
          disabled={busy}
          onclick={() => select(model)}
          ><span class="provider-icon">{model[0]?.toUpperCase()}</span><span
            ><strong>{model.slice(model.indexOf('/') + 1)}</strong><small
              >{model.includes('/')
                ? model.slice(0, model.indexOf('/'))
                : 'Feynman'}</small
            ></span
          >{#if model === current}<Check size={16} />{/if}</button
        >
      {/each}
      {#if !filtered.length}<p class="empty-hint">
          No matching configured models. Add a provider or refresh your Feynman
          connection.
        </p>{/if}
    </div>
    <label class="checkbox-label"
      ><input type="checkbox" bind:checked={useDefault} /> Use for new chats in this
      browser</label
    >
    <button
      class="secondary full"
      disabled={busy}
      onclick={() => (custom = true)}
      ><Plus size={15} /> Add custom model</button
    >
  {/if}
  {#if busy}<p class="inline muted" role="status">
      <LoaderCircle size={14} class="spin" /> Connecting…
    </p>{/if}
  {#if error}<p class="error-message" role="alert">{error}</p>{/if}
  {#if result}<p class="notice" role="status">{result}</p>{/if}
</Modal>
