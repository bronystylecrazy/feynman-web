# Model integration evidence

Research date: 2026-09-09. Objective: configure models for research sessions while retaining Feynman/Pi ownership of execution. Read-only source inspection; no credentials were read, no configuration was changed, and no inference request was sent.

## Runtime and configuration ownership

The installed launcher points to Feynman **0.3.48**, bundling Pi coding agent **0.84.2**. The sibling Feynman checkout declares 0.3.49. Installed package docs are pruned, so the matching tagged upstream docs were consulted alongside installed runtime source.

- Feynman resolves its home as `resolve(FEYNMAN_HOME ?? homedir(), '.feynman')`; its agent directory is `<home>/agent`. CLI model configuration uses `<agent>/auth.json`, `<agent>/settings.json`, and `<agent>/models.json`. The active organization scopes the workbench database, not these model files. Sources: sibling `src/config/paths.ts`, `src/cli.ts:983`, `src/model/registry.ts`, and matching installed `app/dist/config/paths.js` / `app/dist/cli.js`.
- `feynman model set <provider/model>` is noninteractive and writes the global default after availability validation. Custom-provider login/setup uses terminal prompts; no JSON custom-provider write command was found in the CLI dispatcher. Sources: sibling `src/cli.ts:267` and `src/model/commands.ts:970`; installed `app/dist/cli.js` dispatcher agrees.
- No machine-readable CLI configuration-path discovery was found. An explicit server-only `FEYNMAN_MODELS_PATH` is a reasonable integration boundary, especially when the backend is remote or uses a different home. Do not infer that writing local settings changes a remote Feynman process.

## Minimal custom-provider schema

This structure is supported by the installed Pi `dist/core/model-config.js` schema:

```json
{
  "providers": {
    "local-research": {
      "baseUrl": "http://localhost:1234/v1",
      "api": "openai-completions",
      "apiKey": "local",
      "authHeader": false,
      "models": [
        {
          "id": "my-model",
          "name": "My research model",
          "contextWindow": 32768,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

Only the model `id` is required per entry; optional fields include name, reasoning, contextWindow, maxTokens, input capabilities, cost, headers, and compatibility overrides. A placeholder credential keeps a keyless local provider available. Provider API options also include `openai-responses`, `anthropic-messages`, and `google-generative-ai`; the first web form can restrict itself to OpenAI Chat Completions compatibility. [Matching Pi custom-model documentation](https://raw.githubusercontent.com/earendil-works/pi/v0.84.2/packages/coding-agent/docs/models.md).

Recommended form validation: restricted provider identifier, nonempty model identifier, HTTP(S) endpoint, positive finite integer context/output limits with output no larger than context. Merge a new model into existing provider records without replacing other models or compatibility settings. Persist through a temporary file and atomic rename with mode 0600. Reject malformed existing configuration rather than replacing it. Pi accepts JSON with comments; a strict JSON writer should explicitly reject such files rather than silently discarding them.

The installed Pi resolver supports `$ENV_VAR`, `${ENV_VAR}`, leading `!command`, and literals. Feynman's interactive helper still describes a bare environment-variable name; do not reproduce that older helper assumption. A web form should distinguish a literal key from an explicit environment reference and reject shell resolvers. Literal `$` and leading `!` require Pi escaping if supported. Source: installed `dist/core/resolve-config-value.js`.

## Connection checks

For an OpenAI-compatible endpoint, request its `/models` route with an optional Bearer header, a bounded timeout, no redirects carrying credentials, and a response-size limit. Report endpoint reachability and whether the requested model appears. This does **not** establish inference, streaming, or tool-call compatibility. A missing model-list route is inconclusive. Feynman's own helper performs this same basic class of check; see sibling `src/model/commands.ts:474` and `:237`.

## Existing-session switching gap

**Source-verified limitation:** `/api/chat/config` persists session configuration, but the current workbench RPC client cache is keyed by runtime/workspace/session paths and the Pi session ID, not model configuration. `ensureStarted()` reuses the child. `session.config.model` is passed as an explicit model only when that child initially starts. No workbench `set_model` RPC call was found. Therefore a UI must not claim that saving a new model reliably changes the next turn of an already-started session. Sources: sibling `src/workbench/server.ts:672`, `src/workbench/chat-runtime.ts:353`, `:425`, `:516`, and installed `app/dist/workbench/chat-runtime.js`.

For the initial separate frontend, select the model before the session starts and lock the selection thereafter, or clearly offer a new session using the selected model. Live switching needs a Feynman backend capability or a controlled session-client restart and resume path.

Pi itself has `set_model` and `get_available_models` RPC commands, but installed `AgentSession.setModel()` also writes the global default and a session model-change entry. It is not a session-only setting operation. The RPC model-list operation reads the available snapshot without refreshing models.json, so saving a provider does not guarantee an already-cached child sees it. Sources: installed `dist/modes/rpc/rpc-mode.js:364`, `dist/core/agent-session.js:1327`, `dist/core/model-runtime.js:524`; [matching RPC documentation](https://raw.githubusercontent.com/earendil-works/pi/v0.84.2/packages/coding-agent/docs/rpc.md).

## Verification status

Verified by installed-version metadata and source inspection: configuration layout, model schema, CLI dispatcher behavior, RPC model-switch side effects, and workbench child reuse. Unverified by execution: saving a custom model, endpoint authorization, live model inference, and model selection in a real resumed session. No credentials or user model settings were accessed during this investigation.
