# Feynman Web

A Svelte research workspace for [Feynman](https://github.com/bronystylecrazy/feynman). Read responses, equations, diagrams, and research artifacts while Feynman and Pi handle the research execution.

The interface follows Feynman's charcoal and muted-green theme, with Lucide icons, a pixel wordmark, self-hosted fonts, responsive panels, and reduced-motion-aware transitions.

## Run locally

Requires Node.js 22.22+ and a separately installed Feynman. The backend integration has been exercised against **Feynman 0.3.48 / Pi 0.84.2**.

Start Feynman from your research directory:

```sh
feynman serve --no-open
```

Then, in this repository:

```sh
npm ci
cp .env.example .env.local
```

Set `FEYNMAN_URL` in `.env.local` to the complete URL printed by Feynman, including its token:

```dotenv
FEYNMAN_URL=http://127.0.0.1:6174/?token=YOUR_LOCAL_TOKEN
```

Start the frontend:

```sh
npm run dev
```

Open **http://127.0.0.1:5173/**. Use **Connection & settings → Refresh connection** to check the backend. Restart the frontend if you change its environment configuration. A restarted Feynman server can issue a new token; update the URL accordingly.

Without a backend, the app displays setup instructions and an explicitly labeled rendering example. It does not simulate research responses.

For a production build served locally:

```sh
npm run build
npm start
```

Both servers bind to loopback. This is a local companion application; hosted or multi-user access is outside the current scope. `PORT` changes the production server port; use `npm run dev -- --port 5174` to change the development port.

## Available now

- Project creation, automatic first-question session titles, navigation/search, saved conversations, and recovery polling for reopened running sessions.
- Real Feynman responses with buffered text reveal, one quiet thinking indicator, expandable actual tool inputs/results, and cancellation.
- Shared Markdown rendering with tables, reference-style citations, syntax highlighting, inline/display KaTeX equations, and Mermaid diagrams. Math typesets during streaming; no image-generation step is needed.
- Side-by-side artifact browsing with source/preview switching, downloads, images, PDFs, text/code, and notebook Markdown cells.
- Live model catalog, searchable selection, and an optional default for new chats in this browser.
- Custom OpenAI-compatible provider configuration and endpoint/model-list checks.
- Keyboard-friendly dialogs, Enter to send, Shift+Enter for a newline, and Cmd/Ctrl+K for commands exposed by Pi.
- Dark/light themes, Lucide Svelte icons, panel/message/dialog transitions, and reduced-motion support.

## Model selection and custom endpoints

Open the model selector next to the composer. The catalog comes from the connected Feynman installation, including available custom models. Selecting a model **starts a new session**: the tested Feynman backend caches its Pi child and does not reliably apply model changes to an already-started session. The app disables model changes during a run.

“Use for new chats in this browser” stores only the selected model ID locally. It does not change Feynman's global CLI default.

To enable **Add custom model → Save & start session**, set an additional server-only variable:

```dotenv
FEYNMAN_MODELS_PATH=/absolute/path/to/.feynman/agent/models.json
```

Use the `models.json` path reported by `feynman doctor` for the **same local installation** that serves the backend. Saving is disabled unless this path is explicitly configured and the backend URL uses a loopback hostname. You can alternatively configure providers using `feynman model login` and refresh the app.

The first custom-provider form supports OpenAI Chat Completions-compatible endpoints, a literal API key (optional for keyless local endpoints), provider/model IDs, and context/output token limits. Existing unrelated configuration is preserved. Malformed/commented configuration is left untouched; use Feynman's own setup/editor for those files. Existing provider IDs with a different endpoint/API must be configured under a new ID.

**Test endpoint** checks the endpoint's `/models` response and the requested model ID. It does not send an inference request or establish tool-call compatibility. Endpoints without a model-list route can still be configured, but cannot pass this particular check.

## How it connects

```text
Svelte frontend
  → same-origin local Node bridge
    → Feynman workbench HTTP / SSE API
      → Feynman's shared Pi runtime, sessions, tools, skills, and subagents
```

The bridge uses a fixed server-configured backend and forwards its token server-side. `.env.local` is ignored by Git; never put credentials into `VITE_*` variables. Provider keys are sent only to the local bridge and selected endpoint, and model configuration files are written atomically with user-only permissions. Browser storage contains only theme and model-ID preferences.

Each ordinary chat request describes the native Markdown/math/Mermaid renderer through Feynman’s existing preview metadata and asks it to avoid generating images just to display equations. The original user message stays unchanged. Feynman bypasses preview context for raw slash commands. Intentional workspace image references are resolved through its authenticated file API, including document-relative references.

Session titles are derived locally from the first user question and saved through Feynman’s existing session API. This does not make an additional model request. Existing placeholder titles are backfilled when completed sessions reconnect; intentional names are preserved.

Generated HTML is sanitized. Mermaid's presentation styles are isolated in a script-disabled sandbox. External citation links open separately so the research session stays open. Fonts and renderer dependencies are bundled locally.

Feynman remains the owner of research execution and artifacts. Upgrade that installation normally; frontend compatibility depends on its workbench API. No Feynman source fork or duplicated agent loop is embedded here.

## Current boundaries

This is the first functional frontend slice, not complete Feynman workbench parity. The following remain unimplemented or unverified:

- Browser extension input dialogs and arbitrary terminal widgets.
- Full `.tex` paper compilation; `.tex` artifacts currently show source.
- Notebook execution controls and rich notebook output rendering.
- File uploads, editing, annotations, and dedicated provenance/verification dashboards. Existing provenance and verification files can be read as artifacts.
- Steering, branching, and full process-restart session resumption. Reopening and continuing sessions on a running backend are exercised.
- Dedicated thinking/reasoning controls and custom provider API formats beyond OpenAI Chat Completions.

Tool and subagent details are shown when exposed through Feynman's tool events. The UI does not claim every Pi interaction is browser-compatible.

## Validation

```sh
npm run check         # Svelte and TypeScript
npm run lint          # Formatting check
npm test              # Renderer, stream, bridge, and model-config tests
npm run build
npx playwright install chromium
npm run test:browser  # Desktop/mobile and interaction tests with HTTP fixtures
node scripts/live-smoke.mjs  # Optional: actual installed Feynman + offline test model
```

The live smoke script creates an isolated temporary research workspace and configuration, strips inherited provider credentials, and exercises the actual installed CLI/Pi path with a deterministic local model endpoint. It verifies streaming, a real read-tool call, conversation reopening/continuation, and cancellation without calling an external model service. Evidence and remaining runtime limits are recorded in [the verification report](docs/svelte-workbench-live-verification.md).

## Design references

Interaction ideas are drawn from [Prompt Kit](https://www.prompt-kit.com/docs/introduction), [assistant-ui](https://www.assistant-ui.com/docs/guides), and [AI Elements](https://elements.ai-sdk.dev/components). The implementation uses native Svelte components and Feynman's existing backend, without introducing a React runtime or another agent backend.
