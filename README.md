# agentic · search

A tiny **agentic web search** plugin. You hand it one natural-language query;
it hands the query to Claude with the `web_search` tool enabled and lets the
model run its own multi-step research loop — **plan → search → read → refine →
synthesize** — then reports back a cited synthesis plus a trace of what it did.

The UI is deliberately thin: a single input, a "flight recorder" tape that
shows each search the agent fired, and a synthesis panel with its sources. The
real substance is one portable function.

## The core

Everything that matters lives in `agenticSearch(query)` in
[`src/App.jsx`](src/App.jsx). It:

1. POSTs the query to the Anthropic Messages API with the
   `web_search_20250305` tool attached.
2. Lets Claude decide how many searches to run and which results to read.
3. Walks the response content blocks and pulls out:
   - `searches` — every query the agent issued (`server_tool_use` blocks),
   - `sources` — de-duped `{ title, url }` results it retrieved,
   - `answer` — the model's final synthesized text.

```js
import { agenticSearch } from "./src/App.jsx";

const { searches, sources, answer } = await agenticSearch(
  "What changed in the latest EU AI Act guidance?"
);
```

It's dependency-free and framework-agnostic — drop it into any JS project and
render the result however you like. The React component in the same file is just
a reference shell around it.

## Running the reference UI

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

Then open the printed local URL.

## Auth

`agenticSearch` intentionally does **not** embed an API key — the host
environment is expected to inject credentials (for example via a proxy that
adds the `x-api-key` / `anthropic-version` headers, or by pointing the fetch at
a backend you control). Calling `api.anthropic.com` directly from the browser
with a raw key would expose that key to anyone who opens the page, so front the
call with a small server or gateway before shipping it anywhere public.

## Layout

```
index.html            # Vite entry
src/main.jsx          # React mount
src/App.jsx           # agenticSearch() core + reference UI
src/index.css         # Tailwind directives
tailwind.config.js
postcss.config.js
vite.config.js
```

## License

MIT

## Plans

This project is free, and its license stays as is. Support it through [GitHub Sponsors](https://github.com/sponsors/fitzyracing1):

- **Free**: use the code, community support.
- **Pro ($49/month)**: priority issues and support.
- **Team ($199/month)**: priority support for your team plus early access.
