# OpenUI integration

Agentic Chat can show agent answers as generated UI (cards, tables, charts)
instead of Markdown. [OpenUI](https://www.openui.com) provides the language
(OpenUI Lang), the prompt generator and the streaming renderer.

## Who does what

| | Responsibility |
| --- | --- |
| **Nexum** | Decides whether an answer should be UI, injects the component spec into that run's prompt, **validates** the answer against the client's library, and labels the final answer's format. |
| **Agentic Chat** | Owns the component vocabulary, offers it to Nexum, and renders what comes back. |

Nexum never learns which components exist beyond the spec and schema it is sent,
and the chat never decides when UI is appropriate or whether an answer is UI.

## Presentation preference

The user picks how much generated UI they want, stored as `presentation`:

| Mode | Behavior |
| --- | --- |
| `auto` (default) | Nexum may answer in UI when the content fits, and in Markdown otherwise. |
| `markdown` | Always Markdown; no spec is sent. |
| `openui` | Ask for UI. A malformed answer is returned as Markdown. |

Older stored settings are migrated: `openuiEnabled: true` becomes `auto`, `false`
becomes `markdown`.

## Flow

1. `/api/agent` starts the Nexum run with `presentation: { mode, openui }`. The
   `openui` offer (`buildNexumOpenUIOffer()` in `src/lib/openui/prompt.ts`) is the
   prompt-ready component spec plus the library's JSON schema, tagged with the
   OpenUI language version (`OPENUI_SCHEMA_VERSION`). `markdown` mode sends no offer.
2. In `auto`, Nexum tells the model to use OpenUI Lang for structured data the
   components fit and Markdown otherwise; in `openui` it tells the model to answer
   in OpenUI Lang.
3. When the run completes, `output.format` says what the answer really is. Nexum
   reports `openui` only for an answer that starts with a program and parses against
   the schema with no errors. Anything else, including prose that contains a
   program, comes back unchanged as `markdown`, so no text is lost. There is no
   repair step.
4. The chat renders by `output.format` alone, with no keyword or text sniffing.
   `openui` answers go to `<Renderer>`; a render crash falls back to the Markdown
   renderer.

The `openui` mode is unavailable when the server's `/capabilities` does not list
an `openui` presentation. A server that supports a different OpenUI version refuses
the offer with `unsupported_presentation`, so bump `OPENUI_SCHEMA_VERSION` together
with `@openuidev/lang-core`.

## Components

Defined once in `src/lib/openui/spec.ts` (names, descriptions, prop schemas) and
implemented in `src/lib/openui/library.tsx`:

`Stack`, `Grid`, `Card`, `Text`, `Markdown`, `Metric`, `Table`, `List`,
`Badge`, `Alert`, `Progress`, `Chart` (bar/line), `CodeBlock`, `ActionButton`. There is
deliberately no component that runs arbitrary HTML or script: the library is a typed
contract, and new components are added when a real use case needs them.

Arguments are positional, and the key order of each `props` object in `spec.ts`
is the call signature: `Metric("Open issues", "12", "3 new", "warning")`.

To add a component, add its spec to `componentSpecs`, implement it in
`library.tsx`, and add it to the `createLibrary` list. The server-side prompt
picks it up automatically.

## Actions and tools

Generated UI can call tools (`Query(...)`, `@Run`) through
`src/lib/openui/tool-provider.ts` → `/api/tool` → Nexum's
`POST /sessions/:id/tools/:name`. Nexum runs only tools a rendered UI may call
directly and refuses everything else, so a state-changing action has to go
through the agent (`@ToAssistant`), where policy and approvals apply. The browser
holds no credentials.

## Playground

`/openui` renders hand-written OpenUI Lang with the same library, for trying
components without running an agent.
