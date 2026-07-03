import React, { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   agenticSearch — the portable core of this plugin.

   Takes a natural-language query, hands it to Claude with the
   web_search tool enabled, and lets the model run its own
   multi-step research loop (plan → search → read → refine →
   synthesize). Returns a structured trace + final synthesis so
   a host app can render it however it likes.

   No API key is passed here — the host environment injects it.
   Drop this function into any JS project; the UI below is just a
   reference shell around it.
   ───────────────────────────────────────────────────────────── */
export async function agenticSearch(query) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content:
            "Research this and answer it thoroughly using web search. " +
            "Search more than once if the first results are thin, and " +
            "cite the sources you relied on.\n\nQuery: " +
            query,
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!res.ok) {
    throw new Error("Search request failed (" + res.status + ").");
  }

  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];

  const searches = [];
  const sources = [];
  let answer = "";

  for (const b of blocks) {
    if (b.type === "server_tool_use" && b.name === "web_search") {
      if (b.input && b.input.query) searches.push(b.input.query);
    } else if (b.type === "web_search_tool_result") {
      const items = Array.isArray(b.content) ? b.content : [];
      for (const r of items) {
        if (r && r.type === "web_search_result") {
          sources.push({ title: r.title || r.url, url: r.url });
        }
      }
    } else if (b.type === "text") {
      answer += b.text;
    }
  }

  // de-dupe sources by url
  const seen = new Set();
  const uniqueSources = sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return { searches, sources: uniqueSources, answer: answer.trim() };
}

/* ── palette (inline styles; Tailwind core only for layout) ── */
const C = {
  paper: "#FAF9F5",
  panel: "#FFFFFF",
  ink: "#17233B",
  slate: "#5B657A",
  hair: "#E4E1D8",
  signal: "#E0872E", // amber — "live / reaching out"
  verified: "#0F766E", // teal — "found"
};

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const sans =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const h = (e) => setR(e.matches);
    m.addEventListener?.("change", h);
    return () => m.removeEventListener?.("change", h);
  }, []);
  return r;
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
};

export default function App() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState([]); // {t, kind, text}
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();
  const tapeRef = useRef(null);

  useEffect(() => {
    if (tapeRef.current) tapeRef.current.scrollTop = tapeRef.current.scrollHeight;
  }, [trace]);

  const push = (kind, text) =>
    setTrace((prev) => [...prev, { t: stamp(), kind, text }]);

  const wait = (ms) =>
    new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  async function run() {
    const q = query.trim();
    if (!q || running) return;
    setRunning(true);
    setError("");
    setAnswer("");
    setSources([]);
    setTrace([]);

    push("plan", "Agent engaged — planning research approach");
    await wait(400);

    try {
      const result = await agenticSearch(q);

      if (result.searches.length === 0) {
        push("plan", "Answered from working knowledge — no search needed");
      }
      for (const s of result.searches) {
        push("search", "search  →  " + s);
        await wait(450);
      }
      if (result.sources.length) {
        push("read", "read  →  " + result.sources.length + " sources retrieved");
        await wait(400);
      }
      push("done", "synthesizing findings");
      await wait(350);

      setSources(result.sources);
      setAnswer(
        result.answer ||
          "The agent returned no synthesis. Try rephrasing the query."
      );
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
      push("error", "run halted");
    } finally {
      setRunning(false);
    }
  }

  const railColor = {
    plan: C.slate,
    search: C.signal,
    read: C.verified,
    done: C.ink,
    error: "#B44",
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: sans }}>
      <div className="max-w-3xl mx-auto px-5 py-10">
        {/* header */}
        <div className="flex items-baseline justify-between mb-1">
          <h1
            style={{ color: C.ink, fontFamily: mono, letterSpacing: "-0.5px" }}
            className="text-2xl font-semibold"
          >
            agentic&#8202;·&#8202;search
          </h1>
          <span
            style={{ color: C.slate, fontFamily: mono }}
            className="text-xs"
          >
            v0.1 · plugin
          </span>
        </div>
        <p style={{ color: C.slate }} className="text-sm mb-7 leading-relaxed">
          One query in. The agent runs its own research loop on the live web and
          reports back. The tape below is its flight recorder.
        </p>

        {/* input */}
        <div
          style={{ background: C.panel, borderColor: C.hair }}
          className="border rounded-lg p-2 flex gap-2 items-center"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Ask anything that needs current, sourced answers…"
            style={{ color: C.ink, fontFamily: sans }}
            className="flex-1 px-3 py-2 bg-transparent outline-none text-sm"
          />
          <button
            onClick={run}
            disabled={running || !query.trim()}
            style={{
              background: running ? C.slate : C.ink,
              color: C.paper,
              fontFamily: mono,
              opacity: !query.trim() && !running ? 0.5 : 1,
            }}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {running ? "running…" : "run"}
          </button>
        </div>

        {error && (
          <div
            style={{ color: "#B44", fontFamily: mono }}
            className="text-xs mt-3"
          >
            {error}
          </div>
        )}

        {/* flight recorder */}
        {trace.length > 0 && (
          <div
            ref={tapeRef}
            style={{ background: C.panel, borderColor: C.hair }}
            className="border rounded-lg mt-6 p-4 max-h-64 overflow-y-auto"
          >
            {trace.map((row, i) => (
              <div key={i} className="flex items-start gap-3 py-1">
                <span
                  style={{ color: C.slate, fontFamily: mono }}
                  className="text-xs pt-0.5 tabular-nums"
                >
                  {row.t}
                </span>
                <span
                  style={{
                    background: railColor[row.kind] || C.slate,
                    marginTop: 6,
                  }}
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                />
                <span
                  style={{
                    color: row.kind === "search" ? C.signal : C.ink,
                    fontFamily: mono,
                  }}
                  className="text-xs leading-relaxed break-words"
                >
                  {row.text}
                </span>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 pt-2">
                <span
                  style={{ background: C.signal }}
                  className={
                    "w-2 h-2 rounded-full " + (reduce ? "" : "animate-pulse")
                  }
                />
                <span
                  style={{ color: C.slate, fontFamily: mono }}
                  className="text-xs"
                >
                  reaching out…
                </span>
              </div>
            )}
          </div>
        )}

        {/* synthesis */}
        {answer && (
          <div className="mt-6">
            <div
              style={{ color: C.slate, fontFamily: mono }}
              className="text-xs uppercase tracking-wider mb-2"
            >
              synthesis
            </div>
            <div
              style={{ background: C.panel, borderColor: C.hair, color: C.ink }}
              className="border rounded-lg p-5 text-sm leading-7 whitespace-pre-wrap"
            >
              {answer}
            </div>

            {sources.length > 0 && (
              <div className="mt-4">
                <div
                  style={{ color: C.slate, fontFamily: mono }}
                  className="text-xs uppercase tracking-wider mb-2"
                >
                  sources · {sources.length}
                </div>
                <div className="flex flex-col gap-1.5">
                  {sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: C.verified, fontFamily: mono }}
                      className="text-xs hover:underline break-all"
                    >
                      {String(i + 1).padStart(2, "0")} · {s.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
