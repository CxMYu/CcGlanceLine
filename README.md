<div align="center">

# ccglance

**A fast, zero-dependency, multi-line status line for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)**

model · effort · context · cache · git · session — all at a glance

[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-3c873a)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [GitHub](https://github.com/CxMYu/CcGlanceLine)

</div>

![ccglance preview](./docs/assets/preview.png)

> **stdin-first · zero runtime dependencies · fixed emoji style** — renders the JSON Claude Code pipes to its status-line command; only the `status` segment reads a bounded transcript tail. Written in TypeScript, shipped as compiled JavaScript.

**Docs:** [Segments & icons](./docs/segments.md) · [Development](./docs/development.md)

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

## Install

### Option A — npm (global, recommended)

```bash
npm install -g @cxmyu/ccglance          # npm
yarn global add @cxmyu/ccglance         # or yarn
pnpm add -g @cxmyu/ccglance             # or pnpm
```

Behind a slow registry? Use a mirror:

```bash
npm install -g @cxmyu/ccglance --registry https://registry.npmmirror.com
```

npm downloads the prebuilt `dist/` — no compiler runs on your machine — and puts
a `ccglance` command on your `PATH`. Requires Node.js **>= 22**.

After installation:

- ✅ The `ccglance` command is available everywhere.
- ⚙️ **Installing alone does not activate the status line** — add the `statusLine`
  block to `~/.claude/settings.json` (see [Configure](#configure)), then restart
  Claude Code.
- 🔎 Verify with `ccglance preview` (sample render) or `ccglance --help` (usage +
  the exact `settings.json` setup). Running `ccglance` in a plain terminal just
  prints this help.

Update or remove later with `npm update -g @cxmyu/ccglance` / `npm uninstall -g @cxmyu/ccglance`.

### Option B — build from source

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install             # installs devDeps; the `prepare` script then compiles src/ → dist/
npm link                # optional: expose `ccglance` on your PATH
```

`npm install` already builds `dist/` for you via the `prepare` lifecycle script —
there is no separate build step to run. The compiled entry point is
`dist/cli.js`; the `ccglance` bin command and `node dist/cli.js` are the same
file. Verify:

```bash
node dist/cli.js preview
```

## Configure

Add a `statusLine` block to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccglance",
    "padding": 0
  }
}
```

If you didn't install globally, point Node at the compiled file directly:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/ccglance/dist/cli.js"
  }
}
```

On Windows use a full path, e.g. `node D:\\path\\to\\ccglance\\dist\\cli.js`.

> **Cross-platform paths:** Claude Code v2.1.47+ expands a leading `~` in the
> command on every platform, so `node ~/path/to/dist/cli.js` works too. Prefer
> `~` over `%USERPROFILE%` (unreliable in recent versions); the global `ccglance`
> command needs no path at all. `"padding": 0` drops Claude Code's default leading
> indent so the row starts at the left edge.

## Status line at a glance

Three logical rows; any row with no data disappears:

1. **Runtime** — 🤖 model · 🧠 effort · status · 🚀 fast · ⚡️ context · 💾 cache · 🎯 style
2. **Quota** *(subscription sessions only)* — 📊 Hour / Week rate-limit meters
3. **Project / session** — 📁 dir · 🌿 git · 🏷️ session name · ⏱️ session · 💰 cost · 💩 version

**Full reference** — every segment's stdin source, all icon meanings, rate-limit
moon-phase levels, session-status icons and color semantics — lives in
**[docs/segments.md](./docs/segments.md)**.

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

## Development

Source build, tests, benchmark, source layout, contribution practices and git
cache internals live in **[docs/development.md](./docs/development.md)**. Quick start:

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install        # devDeps + prepare build
npm test           # build + node:test
```

## Cache Files

ccglance stores only disposable runtime caches: git status, transcript-derived
status, and the Claude Code latest-version check. Files are grouped under
`git/`, `transcript/`, and `version/`.

Caches live under Claude Code's own config directory on every platform, so they
travel with your Claude setup and are trivial to clear:

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
atomic writes) is documented in
[docs/development.md](./docs/development.md#git-cache-internals).

## Contributing

Issues and pull requests are welcome. For code changes, run `npm run typecheck`,
`npm run build`, and `ccglance preview` before opening a PR; keep the runtime at
**zero dependencies** and the style fixed (no config loader).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CxMYu/CcGlanceLine&type=Date)](https://star-history.com/#CxMYu/CcGlanceLine&Date)

## License

[MIT](./LICENSE) © 2026 CxMYu
