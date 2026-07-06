# Overview

What ccglance shows, its features, requirements, how it works, and where it caches.

[← Back to README](../README.md)

## Status line at a glance

Three logical rows; any row with no data disappears:

1. **Runtime** — 🤖 model · 🧠 effort · status · 🚀 fast · ⚡️ context · 💾 cache · 🎯 style
2. **Quota** *(subscription sessions only)* — 📊 Hour / Week rate-limit meters
3. **Project / session** — 📁 dir · 🌿 git · 🏷️ session name · ⏱️ session · 💰 cost · 💩 version

Full segment / icon / color reference: [segments.md](./segments.md).

## Features

- **Compact multi-line layout** — runtime, quota and project/session state are
  separate logical rows; empty rows disappear.
- **Zero runtime dependencies** — Node standard library only; TypeScript is a
  build-time tool, never shipped in the published package.
- **stdin-first** — core segments consume the JSON Claude Code provides; status
  reads a bounded transcript tail only when used.
- **Rich context block** — usage %, this-turn input/output tokens, tokens left.
- **Prompt-cache block** — cache hit rate, read/write tokens.
- **Git segment** — branch, clean/dirty/conflict glyph, ahead/behind counts,
  using one bounded `git status` call plus a short local cache.
- **Session segment** — elapsed time plus lines added/removed.
- **Claude Code version + update hint** — shows the `version` field from
  Claude Code stdin and appends `↑latest` when the 4h local cache reports a
  newer Claude Code release. Refresh runs after stdout and never blocks.
- **Additional session context** — 5h/7d rate-limit quota, USD cost and
  worktree name next to the git branch when Claude Code provides it.
- **Responsive multi-line layout** — probes the terminal width
  (`CCGLANCE_WIDTH` → `COLUMNS` → TTY → `tput`/`stty`) and wraps each row into
  as many lines as fit, down to a minimum of **one segment per line** so
  nothing gets hidden; display-width aware (CJK/emoji safe).
- **Fixed built-in style** — no user config file and no external style file;
  the status line uses ccglance's own emoji-first style.

## Requirements

- Node.js **>= 22**
- `git` on `PATH` (optional — only for the git segment)

Claude Code compatibility:

| Claude Code CLI | ccglance behavior |
|---|---|
| >= 1.0.71 | Basic status-line stdin support |
| >= 2.1.80 | Subscription quota row when official `rate_limits.five_hour` / `rate_limits.seven_day` fields are present |
| >= 2.1.153 | Preferred terminal-width sizing through `COLUMNS` / `LINES`; older versions fall back to TTY width or 80 columns |

The quota row is subscription-only. Claude.ai Pro/Max-style sessions can expose
`rate_limits`; API-key, Bedrock, Vertex, and other usage-based sessions usually
do not, so ccglance hides the quota row instead of inferring one.

## How it works

On every redraw Claude Code runs your status-line `command` and pipes a JSON
object to its **stdin** (model, effort, context window, cost, workspace,
version, …). `ccglance` reads that once via `fs.readFileSync(0)`, formats its
fixed rows, and **prints them first**. The `status` segment reads only a
bounded transcript tail. The version segment synchronously
reads only a tiny local cache; after stdout is written, ccglance refreshes the
Claude Code latest-version cache in a detached background process when it is
older than 4 hours. If the JSON can't be parsed it exits silently so it can never
break the CLI. Text from stdin, transcript, and git is sanitized before being
printed so terminal control sequences cannot escape the status line. The main
external calls are local `git` (single bounded status call with a short cache),
bounded transcript-tail reads, and the post-render detached npm registry check.

## Cache files

ccglance stores only disposable runtime caches: git status, transcript-derived
status, and the Claude Code latest-version check. They live under Claude Code's
own config directory on every platform, so they travel with your Claude setup
and are trivial to clear:

```text
~/.claude/ccglance/
├── git/          # git status snapshots (one per repo)
├── transcript/   # transcript-derived session status
└── version/      # Claude Code latest-version check
```

If you set `CLAUDE_CONFIG_DIR` to relocate Claude Code's config, ccglance places
its caches under that directory instead. Deleting the whole `ccglance/` folder is
safe — every file is regenerated on the next render.

Git cache behavior (cache key, `HEAD` fallback, 20-minute TTL, detached refresh,
atomic writes) is documented in [development.md](./development.md#git-cache-internals).
