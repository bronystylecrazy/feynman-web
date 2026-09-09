# Feynman Web

A web research interface for [Feynman](https://github.com/bronystylecrazy/feynman), focused on reading and inspecting research outputs with Markdown, LaTeX equations, and Mermaid diagrams.

## Status

Project initialized. This repository currently contains the project scope and implementation roadmap. There is no runnable web application yet.

Feynman already provides a local workbench through `feynman serve`. Feynman Web is intended to provide a separate frontend using Feynman's existing workbench backend and Pi runtime.

## Research experience

- Render Markdown with tables, citations, and highlighted code blocks.
- Typeset inline and display LaTeX equations.
- Render Mermaid diagrams alongside their source.
- Share rendering across chat messages, artifact previews, and notebook Markdown cells.
- Preserve source/preview switching and handle incomplete content during streaming.

These features support reading paper content, inspecting generated research, and checking results against their original artifacts. Full LaTeX paper compilation to PDF is a later, separate capability.

## Integration approach

```text
Feynman Web
    |
    | Workbench HTTP API and streamed events
    v
Feynman workbench backend
    |
    | Shared Feynman runtime configuration and Pi RPC
    v
Pi sessions, research tools, skills, and subagents
```

Feynman remains responsible for research execution, model configuration, tools, skills, sessions, files, and provenance. The frontend should reuse those capabilities through a small integration layer.

Backend improvements become available when the connected Feynman installation is upgraded, subject to API compatibility. Complete feature parity is an ongoing integration requirement: new controls, extension dialogs, and terminal-specific interactions may require frontend changes. This project does not promise automatic compatibility with every future Feynman release.

The first implementation must validate Feynman's actual launch path and API behavior, including authentication and how the frontend is served or proxied. The current workbench API should be treated as an integration surface to verify, rather than an independently versioned public contract.

## Roadmap

- [ ] Establish and document a tested Feynman backend version and connection flow.
- [ ] Build a shared Markdown, math, and Mermaid renderer.
- [ ] Connect real streaming chat and artifact previews with source/preview switching.
- [ ] Render notebook Markdown cells using the same renderer.
- [ ] Support extension input dialogs where Pi RPC exposes them.
- [ ] Verify tools, subagents, cancellation, steering, and session resume against real sessions.
- [ ] Add compatibility checks for Feynman upgrades and document remaining parity gaps.

## Development

Application setup and run instructions will be added with the first implementation. To explore the existing Feynman workbench, run the following from a research workspace with Feynman installed:

```sh
feynman serve
```

That command launches Feynman's existing application; it does not run this repository.
