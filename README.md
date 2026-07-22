<div align="center">

# ccglance

**A fast, zero-dependency, multi-line status line for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)**

model · effort · context · cache · git · session — all at a glance

[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-3c873a)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [GitHub](https://github.com/CxMYu/CcGlanceLine)

![ccglance preview](./docs/assets/preview.png)

</div>

> **stdin-first · zero runtime dependencies · fixed emoji style** — renders the JSON Claude Code pipes to its status-line command; only the `status` segment reads a bounded transcript tail. Written in TypeScript, shipped as compiled JavaScript; runs on Node.js ≥ 22 or Bun.

**Docs:** [Overview](./docs/overview.md) · [Segments & icons](./docs/segments.md) · [Development](./docs/development.md)

## Terminal Font

Use a Nerd Font in your terminal so emoji, Nerd Font icons, arrows, and box-like
symbols keep consistent width. [Maple Mono NF](https://github.com/subframe7536/maple-font)
is a good default; use `Maple Mono NF CN` if you want better CJK coverage.

ccglance intentionally outputs standard Unicode emoji. A Nerd Font improves text
metrics and symbol coverage, but color emoji are still rendered by the operating
system's emoji font (for example Segoe UI Emoji on Windows, Apple Color Emoji on
macOS, and Noto Color Emoji on many Linux desktops), so their artwork can differ
across platforms.

## Install

### Option A — npm (global, recommended)

```bash
npm install -g @cxmyu/ccglance          # npm
yarn global add @cxmyu/ccglance         # or yarn
pnpm add -g @cxmyu/ccglance             # or pnpm
bun add -g @cxmyu/ccglance              # or bun
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
npm install             # installs devDeps; the `prepare` script then compiles src/ -> dist/
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

> **Windows tip:** if status-line startup latency matters, point `command`
> directly at the compiled file (`node D:\\absolute\\path\\to\\ccglance\\dist\\cli.js`)
> instead of the global `ccglance` command — it usually starts a bit faster.

## Contributing

Issues and pull requests are welcome. For code changes, run `npm run typecheck`,
`npm run build`, and `npm run preview` before opening a PR; keep the runtime at
**zero dependencies** and the style fixed (no config loader).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CxMYu/CcGlanceLine&type=Date)](https://star-history.com/#CxMYu/CcGlanceLine&Date)

## License

[MIT](./LICENSE) © 2026 CxMYu
