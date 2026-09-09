# Svelte workbench implementation

Objective: build the separate Feynman Web frontend in Svelte, matching the supplied charcoal/green Pi theme and using Prompt Kit, assistant-ui, and AI Elements as interaction references.

## Status

- Complete: Svelte/Vite shell and local production/dev bridge to Feynman's HTTP/SSE API.
- Complete: sessions/projects, streamed chat, cancellation, recovery polling, live model catalog, fresh-session model selection, and custom endpoint test/save boundary.
- Complete: shared Markdown/KaTeX/Mermaid rendering, reference citations, source switching, artifact previews, and notebook Markdown cells.
- Verified: typecheck; 18 unit/integration tests; eight desktop/mobile browser scenarios; actual installed Feynman/Pi smoke with offline model and real tool execution.
- Verified: read-only connection to the user's running Feynman 0.3.48 server and model catalog. No live-provider prompt was sent.
- Complete: README setup and explicit parity boundaries.
- Verified: final formatting, typecheck, build, and review reconciliation. Production server connected to the real local backend with no browser errors.
- Complete: implementation and verification. Git history records the delivered source revisions.

## Research scope

The research job is reading and inspecting auditable research outputs. Use existing chat and artifact surfaces. No separate research engine, fabricated live results, or implied complete Pi feature parity. No Feynman source was changed.

## Review reconciliation

- Fixed: document reference links were lost when Markdown blocks were independently reparsed. Render original lexer tokens instead.
- Fixed: Mermaid generated CSS was discarded. Preserve sanitized styles inside a script-disabled sandbox and use SVG text labels.
- Fixed: reopened running sessions stayed frozen. Poll their persisted state until terminal completion while no local stream is attached.
- Fixed: pending model changes could race with new chat submission. Guard session mutations centrally, keep pending dialogs open, and bind streamed updates to the originating session.
- Fixed during tests: literal dollar characters in provider keys must be escaped using a replacement callback for Pi's resolver.
- Verified: animations respect reduced motion; mobile sidebar does not flash on initial render; all typography is served locally.

## Explicit deferrals

Extension dialogs, full paper compilation, notebook execution, uploads/edits/annotations, dedicated provenance controls, steering/branching, reasoning controls, and process-restart resume are outside this first slice. Reopening/continuing on a running backend is verified. See README and model/runtime evidence for the backend limits.

## References

- https://www.prompt-kit.com/docs/introduction (direct fetch returned 403; first-party GitHub source consulted)
- https://github.com/ibelick/prompt-kit
- https://www.assistant-ui.com/docs/guides
- https://elements.ai-sdk.dev/components
- https://svelte.dev/docs/svelte/overview
- Sibling Feynman source: `src/workbench/server.ts`, `chat.ts`, `chat-runtime.ts`, `types.ts`, and `src/model/catalog.ts`.

## User feedback incorporated

- Native math: pass explicit native LaTeX/Mermaid capabilities through existing preview metadata; ordinary equations do not need image tools. Browser tests show equations while the response is still running.
- Figures: resolve workspace images through the backend file API; a regression reproduced and fixed the broken relative PNG reference. Existing generated figures are retained.
- Startup: replace the generic runtime row, startup prose, repeated running label, and bottom loading indicator with one quiet thinking state.
- Streaming: adaptively reveal cumulative bursts with requestAnimationFrame, preserve complete math expressions, honor reduced motion, and display history immediately.
- Titles: derive first-question titles without another model request; persist via the existing session API and backfill completed generic sessions.
