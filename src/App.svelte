<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { motion } from './lib/motion';
  import {
    Plus,
    Search,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRight,
    ArrowUp,
    Square,
    ChevronDown,
    Settings2,
    Command as CommandIcon,
    BookOpen,
    FlaskConical,
    ScanSearch,
    GitCompareArrows,
    ArrowUpRight,
    CircleHelp,
    RefreshCw,
    Folder,
    MessageSquare,
    Copy,
    Check,
    X,
    Terminal,
    LoaderCircle,
    Sun,
    Moon,
    Sparkles,
  } from '@lucide/svelte';
  import Markdown from './components/Markdown.svelte';
  import StreamingMarkdown from './components/StreamingMarkdown.svelte';
  import {
    answerText,
    researchTools,
    automaticTitle,
  } from './lib/presentation';
  import ThinkingActivity from './components/ThinkingActivity.svelte';
  import Modal from './components/Modal.svelte';
  import ModelPicker from './components/ModelPicker.svelte';
  import ChatOptions from './components/ChatOptions.svelte';
  import CommandSuggestions from './components/CommandSuggestions.svelte';
  import { commandText, matchCommands } from './lib/commands';
  import { commandIcon } from './lib/command-icons';
  import { chatAppearance, type ChatAppearance } from './lib/chat-options';
  import ArtifactPanel from './components/ArtifactPanel.svelte';
  import { api, reduceStream, sessionInput, streamMessage } from './lib/api';
  import { sampleResearch } from './lib/sample';
  import { researchViewport } from './lib/viewport';
  import type {
    Artifact,
    BridgeStatus,
    Command,
    Session,
    WorkbenchState,
  } from './lib/types';

  let workspace = $state<WorkbenchState>();
  let bridge = $state<BridgeStatus>({
    configured: false,
    customModelsEnabled: false,
  });
  let sessions = $state<Session[]>([]);
  let active = $state<Session>();
  let connected = $state(false);
  let connecting = $state(true);
  let busy = $state(false);
  let actionBusy = $state(false);
  let error = $state('');
  let draft = $state('');
  let sidebar = $state(
    typeof window === 'undefined' || window.innerWidth >= 900,
  );
  let rightPanel = $state(false);
  let selectedArtifact = $state<Artifact>();
  let example = $state(false);
  let search = $state('');
  let projectId = $state('');
  let modal = $state<
    'settings' | 'models' | 'commands' | 'project' | 'rename' | undefined
  >();
  let commands = $state<Command[]>([]);
  let commandQuery = $state('');
  let commandsLoading = $state(false);
  let loadedCommandSession = '';
  let slashIndex = $state(0);
  let slashDismissed = $state(false);
  let commandRevision = $state(0);
  let commandAttempt = $state('');
  let renameTitle = $state('');
  let appearance = $state<ChatAppearance>(chatAppearance(undefined));
  let appearanceReady = $state(false);
  let navigationReady = $state(false);
  let slashCommands = $derived(matchCommands(commands, draft).slice(0, 8));
  let projectName = $state('');
  let defaultModel = $state('');
  let copiedId = $state('');
  let revealMessageId = $state('');
  let activeAssistantId = $derived(
    active?.messages.findLast((message) => message.role === 'assistant')?.id,
  );
  let light = $state(false);
  let streamAbort: AbortController | undefined;
  let composer: HTMLTextAreaElement;
  let transcript: HTMLDivElement;
  let following = $state(true);
  let filteredSessions = $derived(
    sessions.filter(
      (s) =>
        (!projectId || s.projectId === projectId) &&
        automaticTitle(s).toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let currentModel = $derived(
    active
      ? active.config.model || workspace?.modelStatus?.current || ''
      : defaultModel || workspace?.modelStatus?.current || '',
  );
  let modelLabel = $derived(
    currentModel
      ? currentModel.slice(currentModel.indexOf('/') + 1)
      : 'Feynman default',
  );
  let filteredCommands = $derived(
    commands.filter((c) =>
      `${c.name} ${c.description}`
        .toLowerCase()
        .includes(commandQuery.toLowerCase()),
    ),
  );
  let artifacts = $derived(workspace?.artifacts ?? []);
  let working = $derived(
    busy || active?.status === 'running' || active?.status === 'queued',
  );
  let showSlash = $derived(
    !modal && !working && !slashDismissed && /^\/[^\s]*$/.test(draft),
  );
  $effect(() => {
    const attempt = `${active?.id ?? 'new'}:${commandRevision}`;
    if (
      showSlash &&
      connected &&
      !working &&
      !actionBusy &&
      !commandsLoading &&
      commandAttempt !== attempt
    ) {
      commandAttempt = attempt;
      void loadCommands();
    }
  });

  function savePreference(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Preferences are optional. */
    }
  }
  function readPreference(key: string) {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  }
  function upsert(session: Session) {
    sessions = [session, ...sessions.filter((s) => s.id !== session.id)].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  async function refresh() {
    connecting = true;
    error = '';
    try {
      bridge = await api<BridgeStatus>('/bridge/status');
      if (!bridge.configured) {
        connected = false;
        return;
      }
      const [snapshot, chats] = await Promise.all([
        api<WorkbenchState>('/api/state'),
        api<{ sessions: Session[] }>('/api/chat/sessions'),
      ]);
      if (
        !Array.isArray(snapshot.artifacts) ||
        !Array.isArray(snapshot.projects) ||
        !Array.isArray(chats.sessions)
      )
        throw new Error(
          'This Feynman version returned an unsupported workspace shape.',
        );
      workspace = snapshot;
      sessions = await Promise.all(
        chats.sessions.map(async (session) => {
          const title = automaticTitle(session);
          if (
            title === session.title ||
            ['running', 'queued'].includes(session.status)
          )
            return session;
          try {
            return (
              await api<{ session: Session }>('/api/chat/session', {
                ...sessionInput(session),
                title,
              })
            ).session;
          } catch {
            return session;
          }
        }),
      );
      connected = true;
      if (active && !busy)
        active = sessions.find((s) => s.id === active!.id) ?? active;
    } catch (e) {
      connected = false;
      error = e instanceof Error ? e.message : 'Connection failed.';
    } finally {
      connecting = false;
    }
  }
  onMount(() => {
    defaultModel = readPreference('feynman.default-model');
    light = readPreference('feynman.theme') === 'light';
    sidebar = window.innerWidth >= 900;
    try {
      appearance = chatAppearance(
        JSON.parse(readPreference('feynman.chat-appearance') || '{}'),
      );
    } catch {
      appearance = chatAppearance(undefined);
    }
    appearanceReady = true;
    void refresh().then(async () => {
      const id = new URL(window.location.href).searchParams.get('session');
      const session = sessions.find((item) => item.id === id);
      if (session) await openSession(session);
      navigationReady = true;
    });
    const outsideComposer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !composer?.closest('.composer-area')?.contains(event.target)
      )
        slashDismissed = true;
    };
    window.addEventListener('pointerdown', outsideComposer);
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (!working && !actionBusy && !modal) void showCommands();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('pointerdown', outsideComposer);
      streamAbort?.abort();
    };
  });
  $effect(() => {
    if (navigationReady) {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      if (active?.id) url.searchParams.set('session', active.id);
      else url.searchParams.delete('session');
      window.history.replaceState(null, '', url);
    }
  });
  $effect(() => {
    if (appearanceReady)
      savePreference('feynman.chat-appearance', JSON.stringify(appearance));
  });
  $effect(() => {
    const content = active?.messages.at(-1)?.content;
    if (content && following)
      void tick().then(() => {
        if (transcript) transcript.scrollTop = transcript.scrollHeight;
      });
  });
  $effect(() => {
    const sessionId = active?.id;
    const status = active?.status;
    if (
      busy ||
      !connected ||
      !sessionId ||
      !['running', 'queued'].includes(status ?? '')
    )
      return;
    let disposed = false;
    let pending = false;
    const timer = setInterval(async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        const result = await api<{ sessions: Session[] }>('/api/chat/sessions');
        if (disposed) return;
        const updated = result.sessions.find((item) => item.id === sessionId);
        if (updated) {
          upsert(updated);
          if (active?.id === sessionId) active = updated;
        }
      } catch {
        /* A temporary reconnect failure is retried without losing the saved session. */
      } finally {
        pending = false;
      }
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  });
  async function newSession(model = defaultModel) {
    if (!connected) {
      modal = 'settings';
      return undefined;
    }
    const result = await api<{ session: Session }>('/api/chat/session/new', {
      projectId: projectId || 'workspace',
      title: 'New research session',
    });
    let session = result.session;
    if (model)
      session = (
        await api<{ session: Session }>('/api/chat/config', {
          ...sessionInput(session),
          config: { model },
        })
      ).session;
    active = session;
    upsert(session);
    example = false;
    following = true;
    loadedCommandSession = '';
    return session;
  }
  async function startNew() {
    actionBusy = true;
    error = '';
    try {
      await newSession();
      draft = '';
      await tick();
      composer?.focus();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not start session.';
    } finally {
      actionBusy = false;
    }
  }
  async function openSession(session: Session) {
    revealMessageId = '';
    if (!['running', 'queued'].includes(session.status))
      session = { ...session, title: automaticTitle(session) };
    actionBusy = true;
    error = '';
    try {
      active = (
        await api<{ session: Session }>(
          '/api/chat/session',
          sessionInput(session),
        )
      ).session;
      upsert(active);
      example = false;
      loadedCommandSession = '';
      following = true;
      if (window.innerWidth < 900) sidebar = false;
      await tick();
      if (transcript) transcript.scrollTop = transcript.scrollHeight;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not open session.';
    } finally {
      actionBusy = false;
    }
  }
  async function send() {
    if (!draft.trim() || working || actionBusy) return;
    if (!connected) {
      modal = 'settings';
      return;
    }
    error = '';
    busy = true;
    example = false;
    following = true;
    const message = draft.trim();
    let accepted = false;
    try {
      let session = active ?? (await newSession());
      if (!session) return;
      session = { ...session, title: automaticTitle(session, message) };
      active = session;
      upsert(session);
      revealMessageId = '';
      draft = '';
      streamAbort = new AbortController();
      await streamMessage(
        {
          ...sessionInput(session),
          message,
          viewportContext: researchViewport(selectedArtifact?.path, rightPanel),
        },
        (event) => {
          if (event.type === 'session') {
            if (!accepted)
              revealMessageId =
                event.session.messages.findLast(
                  (item) => item.role === 'assistant',
                )?.id ?? '';
            accepted = true;
          }
          const updated = reduceStream(
            sessions.find((item) => item.id === session.id) ?? session,
            event,
          );
          if (updated) {
            upsert(updated);
            if (active?.id === session.id) active = updated;
          }
          if ('state' in event && event.state) workspace = event.state;
          if (event.type === 'error') error = event.message;
        },
        streamAbort.signal,
      );
    } catch (e) {
      if (!accepted) draft = message;
      error = e instanceof Error ? e.message : 'Message failed.';
    } finally {
      busy = false;
      streamAbort = undefined;
    }
  }
  async function stop() {
    if (!active) return;
    try {
      await api('/api/chat/abort', sessionInput(active));
      if (!busy) await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not stop the run.';
    }
  }
  async function chooseModel(model: string, useDefault: boolean) {
    if (working || actionBusy)
      throw new Error('Wait for the current action before changing models.');
    actionBusy = true;
    try {
      const session = await newSession(model);
      if (!session)
        throw new Error('Connect Feynman before selecting a model.');
      if (useDefault) {
        defaultModel = model;
        savePreference('feynman.default-model', model);
      }
    } finally {
      actionBusy = false;
    }
  }
  async function loadCommands() {
    if (
      !connected ||
      working ||
      actionBusy ||
      commandsLoading ||
      (active && loadedCommandSession === active.id)
    )
      return;
    commandsLoading = true;
    actionBusy = true;
    try {
      const session = active ?? (await newSession());
      if (!session) return;
      const result = await api<{ commands: Command[] }>(
        '/api/chat/commands',
        sessionInput(session),
      );
      if (active?.id === session.id) {
        commands = result.commands;
        loadedCommandSession = session.id;
        slashIndex = 0;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load commands.';
    } finally {
      commandsLoading = false;
      actionBusy = false;
    }
  }
  async function showCommands() {
    if (working || actionBusy || (modal && modal !== 'commands')) return;
    modal = 'commands';
    commandQuery = '';
    error = '';
    await loadCommands();
  }
  function insertCommand(command: Command) {
    draft = commandText(command) + ' ';
    modal = undefined;
    slashDismissed = true;
    void tick().then(() => {
      composer?.focus();
      composer?.setSelectionRange(draft.length, draft.length);
    });
  }
  function composerKey(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (showSlash) {
      if (event.key === 'Escape') {
        event.preventDefault();
        slashDismissed = true;
        return;
      }
      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        slashCommands.length
      ) {
        event.preventDefault();
        slashIndex =
          (slashIndex +
            (event.key === 'ArrowDown' ? 1 : -1) +
            slashCommands.length) %
          slashCommands.length;
        return;
      }
      if (
        (event.key === 'Enter' || event.key === 'Tab') &&
        !event.shiftKey &&
        slashCommands.length
      ) {
        event.preventDefault();
        insertCommand(slashCommands[slashIndex] ?? slashCommands[0]);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }
  async function renameSession() {
    if (!active || working || actionBusy || !renameTitle.trim()) return;
    actionBusy = true;
    error = '';
    try {
      active = (
        await api<{ session: Session }>('/api/chat/session', {
          ...sessionInput(active),
          title: renameTitle.trim(),
        })
      ).session;
      upsert(active);
      modal = undefined;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not rename chat.';
    } finally {
      actionBusy = false;
    }
  }
  async function createProject() {
    actionBusy = true;
    error = '';
    try {
      const result = await api<{
        session: Session;
        state: WorkbenchState;
        project: { id: string };
      }>('/api/project/new', { name: projectName.trim() });
      workspace = result.state;
      projectId = result.project.id;
      active = result.session;
      if (defaultModel)
        active = (
          await api<{ session: Session }>('/api/chat/config', {
            ...sessionInput(active),
            config: { model: defaultModel },
          })
        ).session;
      upsert(active);
      modal = undefined;
      projectName = '';
      example = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not create project.';
    } finally {
      actionBusy = false;
    }
  }
  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
    } catch {
      error = 'Could not copy. Select the message text to copy it.';
    }
  }
  function prompt(text: string) {
    draft = text;
    composer?.focus();
  }
  function showExample() {
    example = true;
    active = undefined;
    selectedArtifact = undefined;
    rightPanel = false;
  }
  const starters = [
    {
      title: 'Explore the literature',
      description: 'Find the papers that move a field forward.',
      icon: BookOpen,
      prompt: 'Help me explore the literature on ',
    },
    {
      title: 'Follow the evidence',
      description: 'Trace a claim back to its sources.',
      icon: ScanSearch,
      prompt: 'Help me verify the following research claim: ',
    },
    {
      title: 'Compare approaches',
      description: 'Understand methods and their trade-offs.',
      icon: GitCompareArrows,
      prompt: 'Compare the research methods used for ',
    },
    {
      title: 'Reproduce a result',
      description: 'Turn a paper into a testable experiment.',
      icon: FlaskConical,
      prompt: 'Help me plan a reproduction of ',
    },
  ];
</script>

<svelte:head
  ><title
    >{active?.title
      ? `${automaticTitle(active)} — Feynman`
      : 'Feynman — Research workspace'}</title
  ></svelte:head
>
<div
  class="app"
  data-chat-font={appearance.font}
  class:chat-small={appearance.small}
  class:chat-wide={appearance.wide}
  class:light
  class:has-panel={rightPanel}
>
  {#if sidebar}
    <aside
      transition:fly={{ x: -16, duration: motion(180) }}
      class="sidebar"
      aria-label="Workspace navigation"
    >
      <div class="brand-row">
        <a class="wordmark" href="/" aria-label="Feynman home"
          >feynman<span>_</span></a
        ><button
          class="icon-button"
          onclick={() => (sidebar = false)}
          aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button
        >
      </div>
      <button
        class="new-chat"
        onclick={startNew}
        disabled={working || actionBusy}
        ><Plus size={17} /> New research<span>↗</span></button
      >
      <label class="search-input sidebar-search"
        ><Search size={15} /><input
          bind:value={search}
          placeholder="Search sessions"
          aria-label="Search sessions"
        /></label
      >
      <div class="sidebar-section-label">
        <span>WORKSPACE</span><button
          class="icon-button"
          onclick={() => (modal = 'project')}
          disabled={!connected || working || actionBusy}
          aria-label="Create project"><Plus size={14} /></button
        >
      </div>
      <button
        class="nav-row"
        class:active={!projectId}
        onclick={() => (projectId = '')}
        ><Folder size={16} /> All research<span>{sessions.length}</span></button
      >
      {#each workspace?.projects.filter((p) => p.id !== 'workspace') ?? [] as project}<button
          class="nav-row"
          class:active={projectId === project.id}
          onclick={() => (projectId = project.id)}
          ><Folder size={15} /><span class="truncate">{project.name}</span
          ></button
        >{/each}
      <button
        class="nav-row"
        onclick={() => {
          rightPanel = !rightPanel;
          selectedArtifact = undefined;
        }}
        ><BookOpen size={16} /> Artifacts<span>{artifacts.length}</span></button
      >
      <div class="sidebar-section-label sessions-heading">
        <span>RESEARCH SESSIONS</span>
      </div>
      <nav class="sessions" aria-label="Research sessions">
        {#each filteredSessions as session}<button
            class:active={active?.id === session.id}
            onclick={() => openSession(session)}
            disabled={busy || actionBusy}
            ><MessageSquare size={14} /><span>{session.title}</span
            >{#if session.status === 'running'}<span class="status-dot"
              ></span>{/if}</button
          >{/each}
        {#if !filteredSessions.length}<p class="sidebar-empty">
            {search
              ? 'No matching sessions.'
              : 'A good question is a good place to start.'}
          </p>{/if}
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-row" onclick={() => (modal = 'settings')}
          ><Settings2 size={16} /> Connection & settings</button
        ><a
          class="nav-row"
          href="https://github.com/bronystylecrazy/feynman-web#readme"
          target="_blank"
          rel="noreferrer"
          ><CircleHelp size={16} /> Guide & documentation<ArrowUpRight
            size={13}
          /></a
        >
        <div class="workspace-footer">
          <span class="workspace-avatar">f</span>
          <div>
            <strong>{workspace?.workspaceName || 'Research workspace'}</strong
            ><small
              ><span class="status-dot" class:offline={!connected}
              ></span>{connected
                ? `Feynman ${workspace?.version || ''}`
                : 'Not connected'}</small
            >
          </div>
          <button
            class="icon-button"
            onclick={() => {
              light = !light;
              savePreference('feynman.theme', light ? 'light' : 'dark');
            }}
            aria-label={light ? 'Use dark theme' : 'Use light theme'}
            >{#if light}<Moon size={16} />{:else}<Sun size={16} />{/if}</button
          >
        </div>
      </div>
    </aside>
  {/if}
  <main>
    <header class="topbar">
      <div class="inline">
        {#if !sidebar}<button
            class="icon-button"
            onclick={() => (sidebar = true)}
            aria-label="Expand sidebar"><PanelLeftOpen size={18} /></button
          >{/if}<span class="breadcrumb">Workspace</span><span
          class="breadcrumb-divider">/</span
        ><span class="topbar-title"
          >{example
            ? 'Rendering example'
            : active
              ? automaticTitle(active)
              : 'New research'}</span
        >{#if example}<span class="badge">EXAMPLE</span>{/if}
      </div>
      <div class="inline">
        <button class="connection-pill" onclick={() => (modal = 'settings')}
          ><span class="status-dot" class:offline={!connected}
          ></span>{connecting
            ? 'Connecting'
            : connected
              ? 'Connected'
              : 'Connect Feynman'}</button
        ><span class="topbar-separator"></span><ChatOptions
          session={active}
          bind:appearance
          busy={working || actionBusy}
          onrename={() => {
            renameTitle = active ? automaticTitle(active) : '';
            modal = 'rename';
          }}
        /><button
          class="icon-button"
          class:active={rightPanel}
          onclick={() => {
            rightPanel = !rightPanel;
          }}
          aria-label="Toggle artifact panel"><PanelRight size={18} /></button
        >
      </div>
    </header>
    {#if error}<div
        transition:fade={{ duration: motion(140) }}
        class="error-banner"
        role="alert"
      >
        <span>{error}</span><button
          class="icon-button"
          onclick={() => (error = '')}
          aria-label="Dismiss error"><X size={15} /></button
        >
      </div>{/if}
    <div
      class="conversation"
      bind:this={transcript!}
      onscroll={() => {
        following =
          transcript.scrollHeight -
            transcript.scrollTop -
            transcript.clientHeight <
          100;
      }}
    >
      {#if example}
        <div class="transcript">
          <div class="example-notice">
            <Sparkles size={16} /><span
              >Rendering example. No model was called.</span
            ><button
              class="text-button"
              onclick={() => {
                example = false;
              }}>Back to research <ArrowUpRight size={13} /></button
            >
          </div>
          <article class="message assistant">
            <div class="assistant-avatar">f</div>
            <div class="message-body">
              <div class="message-label">
                feynman <span>RESEARCH PREVIEW</span>
              </div>
              <Markdown content={sampleResearch} />
            </div>
          </article>
        </div>
      {:else if !active?.messages.length}
        <section in:fly={{ y: 12, duration: motion(280) }} class="welcome">
          <div class="welcome-eyebrow">
            <span class="small-mark">f</span> THE RESEARCH WORKSPACE
          </div>
          <h1>Stay curious.<br /><span>Go deeper.</span></h1>
          <p class="welcome-description">
            From the first question to the reproducible result.<br />Your
            research, with the evidence in reach.
          </p>
          <div class="starter-grid">
            {#each starters as starter}<button
                onclick={() => prompt(starter.prompt)}
                ><starter.icon size={19} strokeWidth={1.6} /><strong
                  >{starter.title}</strong
                ><span>{starter.description}</span><ArrowUpRight
                  class="starter-arrow"
                  size={15}
                /></button
              >{/each}
          </div>
          <button
            class="example-link"
            onclick={showExample}
            disabled={working || actionBusy}
            ><Terminal size={14} /> See Markdown, equations & diagrams in action <ArrowUpRight
              size={13}
            /></button
          >
        </section>
      {:else}
        <div class="transcript">
          {#each active.messages as message (message.id)}<article
              in:fly={{ y: 7, duration: motion(170) }}
              class="message"
              class:assistant={message.role === 'assistant'}
              class:user={message.role === 'user'}
            >
              {#if message.role === 'assistant'}<div class="assistant-avatar">
                  f
                </div>{/if}
              <div class="message-body">
                {#if message.role === 'assistant'}
                  <div class="message-label">
                    feynman
                    {#if message.status === 'error' || message.status === 'stopped'}<span
                        >{message.status}</span
                      >{/if}
                  </div>
                  <ThinkingActivity
                    tools={researchTools(message)}
                    status={message.id === activeAssistantId &&
                    (active.status === 'running' || active.status === 'queued')
                      ? active.status
                      : message.status}
                    hasAnswer={Boolean(answerText(message))}
                  />
                {/if}
                {#if message.role === 'user'}
                  <div class="user-content">{message.content}</div>
                {:else if answerText(message)}
                  <StreamingMarkdown
                    content={answerText(message)}
                    workspacePath={workspace?.workspacePath}
                    animate={message.id === revealMessageId}
                    streaming={message.status === 'running' ||
                      message.status === 'queued'}
                    onreveal={() => {
                      if (following)
                        void tick().then(() => {
                          if (transcript)
                            transcript.scrollTop = transcript.scrollHeight;
                        });
                    }}
                  />
                {/if}
                {#if message.role === 'assistant' && answerText(message) && message.status !== 'running' && message.status !== 'queued'}
                  <div class="message-actions">
                    <button
                      class="icon-button"
                      onclick={() => copyMessage(message.id, message.content)}
                      aria-label="Copy message"
                    >
                      {#if copiedId === message.id}<Check
                          size={14}
                        />{:else}<Copy size={14} />{/if}
                    </button>
                  </div>
                {/if}
              </div>
            </article>{/each}
        </div>
      {/if}
    </div>
    <div class="composer-area">
      {#if showSlash}<CommandSuggestions
          commands={slashCommands}
          selected={slashIndex}
          loading={commandsLoading}
          {connected}
          onselect={insertCommand}
        />{/if}
      {#if !following && active?.messages.length}<button
          class="jump-button secondary"
          onclick={() => {
            following = true;
            transcript.scrollTop = transcript.scrollHeight;
          }}><ChevronDown size={14} /> Latest response</button
        >{/if}
      <form
        class="composer"
        onsubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          bind:this={composer!}
          bind:value={draft}
          placeholder={working
            ? 'A research run is in progress…'
            : 'Ask a question. Follow an idea. Find the evidence.'}
          aria-label="Research message"
          rows="2"
          disabled={working}
          aria-autocomplete="list"
          aria-controls={showSlash ? 'composer-command-menu' : undefined}
          aria-activedescendant={showSlash && slashCommands.length
            ? `composer-command-${slashIndex}`
            : undefined}
          oninput={(event) => {
            draft = event.currentTarget.value;
            slashDismissed = false;
            slashIndex = 0;
            if (/^\/[^\s]*$/.test(draft)) commandRevision++;
          }}
          onkeydown={composerKey}></textarea>
        <div class="composer-toolbar">
          <div class="inline">
            <button
              type="button"
              class="icon-button"
              onclick={showCommands}
              disabled={working || actionBusy}
              aria-label="Research commands"><CommandIcon size={17} /></button
            ><span class="toolbar-divider"></span><button
              type="button"
              class="model-trigger"
              onclick={() => (modal = 'models')}
              disabled={working || actionBusy}
              ><Sparkles size={14} class="model-spark" /><span
                >{modelLabel}</span
              ><ChevronDown size={13} /></button
            >
          </div>
          <div class="inline">
            <span class="enter-hint">↵ to send</span>{#if working}<button
                type="button"
                class="send-button stop"
                onclick={stop}
                aria-label="Stop research"
                ><Square size={14} fill="currentColor" /></button
              >{:else}<button
                type="submit"
                class="send-button"
                disabled={!draft.trim() || actionBusy}
                aria-label="Send message"><ArrowUp size={19} /></button
              >{/if}
          </div>
        </div>
      </form>
      <div class="composer-caption">
        <span>Powered by Pi. Grounded in your sources.</span><button
          onclick={() => (modal = 'settings')}
          >Local workspace <span class="status-dot" class:offline={!connected}
          ></span></button
        >
      </div>
    </div>
  </main>
  {#if rightPanel}<ArtifactPanel
      {artifacts}
      workspacePath={workspace?.workspacePath}
      bind:selected={selectedArtifact}
      sample={example}
      onclose={() => (rightPanel = false)}
    />{/if}
  {#if modal === 'models'}<ModelPicker
      models={workspace?.modelStatus?.availableModels ?? []}
      current={currentModel}
      customEnabled={bridge.customModelsEnabled}
      onselect={chooseModel}
      onclose={() => (modal = undefined)}
    />{/if}
  {#if modal === 'settings'}<Modal
      title="Connect your research workspace"
      onclose={() => (modal = undefined)}
    >
      <div class="settings-state">
        <span class="status-dot" class:offline={!connected}></span><strong
          >{connected
            ? 'Connected to Feynman'
            : 'Connect Feynman to begin'}</strong
        >{#if workspace?.version}<span class="badge">v{workspace.version}</span
          >{/if}
      </div>
      <p class="muted">
        Run Feynman in your research directory, then give this app its local
        workbench URL.
      </p>
      <ol class="setup-steps">
        <li>
          <strong>Start your research engine</strong><code
            >feynman serve --no-open</code
          >
        </li>
        <li>
          <strong>Set the URL in this app’s .env.local</strong><code
            >FEYNMAN_URL=http://127.0.0.1:PORT/?token=…</code
          ><span>Use the complete URL printed by Feynman.</span>
        </li>
        <li><strong>Restart Feynman Web</strong><code>npm run dev</code></li>
      </ol>
      {#if bridge.backendOrigin}<p class="muted small">
          Backend: {bridge.backendOrigin}
        </p>{/if}
      <button class="primary full" onclick={refresh} disabled={connecting}
        ><RefreshCw size={15} class={connecting ? 'spin' : ''} />
        {connecting ? 'Checking connection…' : 'Refresh connection'}</button
      >
      <details class="connection-details">
        <summary>Custom providers & compatibility</summary>
        <p>
          To enable provider saving, set <code>FEYNMAN_MODELS_PATH</code> to the
          absolute models.json path reported by <code>feynman doctor</code> for the
          connected local installation. Restart this app afterward.
        </p>
        <p>
          Changing models starts a new session. Browser extension dialogs, full
          LaTeX compilation, and complete workbench parity are not available in
          this release.
        </p>
      </details>
      {#if error}<p class="error-message" role="alert">{error}</p>{/if}
    </Modal>{/if}
  {#if modal === 'commands'}<Modal
      title="Research commands"
      onclose={() => (modal = undefined)}
    >
      <label class="search-input"
        ><Search size={16} /><input
          bind:value={commandQuery}
          placeholder="Search research commands…"
          aria-label="Search commands"
        /></label
      >
      {#if commandsLoading}<p class="muted inline">
          <LoaderCircle size={15} class="spin" /> Loading commands from Pi…
        </p>{:else if !connected}<p class="muted">
          Connect Feynman to discover the commands available in your
          installation.
        </p>{:else}<div class="command-list">
          {#each filteredCommands as command}
            {@const Icon = commandIcon(command)}
            <button
              class="command-modal-row"
              onclick={() => insertCommand(command)}
              ><span class="command-modal-icon"
                ><Icon size={19} strokeWidth={1.6} /></span
              ><span class="command-modal-copy"
                ><strong>{commandText(command)}</strong><span
                  >{command.description ||
                    command.source ||
                    'Feynman command'}</span
                ></span
              ></button
            >
          {/each}{#if !filteredCommands.length}<p class="muted">
              No matching commands were returned.
            </p>{/if}
        </div>{/if}
      {#if error}<p class="error-message" role="alert">{error}</p>{/if}
    </Modal>{/if}
  {#if modal === 'project'}<Modal
      title="New research project"
      onclose={() => (modal = undefined)}
      ><form
        onsubmit={(e) => {
          e.preventDefault();
          void createProject();
        }}
      >
        <p class="muted">Keep related sessions and research in one project.</p>
        <label
          >Project name<input
            bind:value={projectName}
            required
            maxlength="120"
            placeholder="e.g. Efficient language models"
          /></label
        ><button
          class="primary full"
          disabled={!projectName.trim() || actionBusy}>Create project</button
        >{#if error}<p class="error-message" role="alert">{error}</p>{/if}
      </form></Modal
    >{/if}
  {#if modal === 'rename'}<Modal
      title="Rename chat"
      busy={actionBusy}
      onclose={() => (modal = undefined)}
      ><form
        onsubmit={(event) => {
          event.preventDefault();
          void renameSession();
        }}
      >
        <label
          >Chat title<input
            required
            maxlength="120"
            bind:value={renameTitle}
          /></label
        ><button
          class="primary full"
          disabled={actionBusy || !renameTitle.trim()}>Save title</button
        >{#if error}<p class="error-message" role="alert">{error}</p>{/if}
      </form></Modal
    >{/if}
</div>
