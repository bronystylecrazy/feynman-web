# Installed-runtime smoke verification

Date: 2026-09-09. Runtime: installed native **Feynman 0.3.48**, bundled **Pi 0.84.2**. This verifies the backend protocol used by Feynman Web independently of browser presentation.

Run the reproducible test from this repository:

```sh
node scripts/live-smoke.mjs
```

`FEYNMAN_BIN` can select the installed executable. The script creates a temporary workspace and `FEYNMAN_HOME`, strips inherited provider credentials from its subprocess environment, configures one fake local model, and starts the actual `feynman serve --no-open --no-auth` command on loopback. A deterministic OpenAI-compatible HTTP fixture returns stream chunks and a read-tool request. No external model service or real provider credential is used. The script stops its process group and fixture normally; `--keep-alive` retains them for manual browser verification until interrupted.

## Verified

- `/api/state` starts through the installed CLI and recognizes `smoke-local/smoke-research` as available/current.
- `/api/chat/session/new` creates a session; `/api/chat/config` saves its model before Pi starts.
- `/api/chat/message/stream` reaches the real Pi RPC child, which sends streaming OpenAI-compatible requests to the local endpoint. The fixture sees the exact selected model ID and 30 exposed tools.
- Pi calls its actual `read` tool on the temporary `smoke-evidence.txt`; Feynman streams running/completed tool events and the expected file content.
- Feynman streams Markdown and a math expression from the fixture and emits a terminal completion event.
- `/api/chat/session` reopens saved conversation state; another prompt continues the same cached Pi runtime with increased message history.
- `/api/chat/abort` interrupts a deliberately held-open model stream. The stream closes and the saved assistant message has `status: "stopped"`.

The successful keep-alive run used four local model requests. Raw support files are in `/var/folders/88/yth2hbb1095_w92dbcqr3p880000gn/T/feynman-web-smoke-hqA7BM/`: `first-stream.sse`, `resumed-stream.sse`, `stopped-stream.sse`, and `result.json`. The runner prints fresh evidence paths on each execution and writes `backend.log` on cleanup. These temporary raw artifacts may be removed by the operating system; rerun the script to regenerate them.

## Limits and observed issues

This is deterministic transport/tool integration testing, not verification of model research quality, real provider authorization, internet research, or every Feynman extension. Full process-restart session resumption was not tested. The installed backend's `piSession` summary reported `missing` even though the cached Pi child streamed and continued successfully; the UI must not interpret that summary as evidence that the underlying process failed.

The first smoke attempt passed streaming, tools, reopening, and continuation, then failed in the test fixture's cancellation trigger: it assumed OpenAI message content was always a string. The fixture was corrected to recognize content arrays, and cancellation passed on the next run. Feynman source and installed runtime source were not edited.

Live model switching remains subject to the backend limitation documented in [model integration evidence](svelte-workbench-model-integration.md). This test sets the model before the child starts and does not claim to verify switching an active session.

## Frontend verification

The Svelte frontend passes 18 unit/integration tests and eight Chromium browser scenarios covering desktop/mobile layouts, reference citations, native equations during running responses, styled Mermaid output, source previews, model selection before execution, resumed-run polling, guarded model changes, single-indicator startup, smooth cumulative text reveal, and automatic title persistence.

Both the development and production Node servers connected successfully to the user-provided Feynman 0.3.48 backend, with 17 configured models exposed in the picker and no browser errors. No live-provider model prompt was sent by this verification. The provided access token is stored only in the ignored local environment file.

`npm run check`, `npm run lint`, `npm test`, `npm run test:browser`, and `npm run build` pass. Vite reports a non-blocking large-chunk advisory for renderer dependencies; Mermaid is loaded on demand. Full Feynman feature parity remains outside this release.
