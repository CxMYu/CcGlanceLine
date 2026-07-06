# Development

Build, test, benchmark, source layout, contribution practices, and cache
internals for ccglance.

[← Back to README](../README.md)

## Source Build

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install              # installs devDeps and runs prepare -> build

npm run build            # compile src/ -> dist/
npm run typecheck        # tsc --noEmit (strict)
npm test                 # build + node:test fixtures/snapshots/smoke
npm run benchmark        # build + latency benchmark
npm run preview          # render this repo's dist/ (never the global install)

# smoke-test with a sample stdin payload (temp CLAUDE_CONFIG_DIR keeps the real cache clean):
CLAUDE_CONFIG_DIR=$(mktemp -d) sh -c \
  'printf "%s" "{\"model\":{\"display_name\":\"Claude Opus 4.8 (1M context)\",\"id\":\"claude-opus-4-8[1m]\"}}" | node dist/cli.js'
```

## Isolation from the global install

Local development and a published global install
(`npm install -g @cxmyu/ccglance`) easily interfere with each other. Follow
these rules:

- **Verify local changes with `npm run preview` / `node dist/cli.js`**, never
  with a bare `ccglance` — that resolves to the global install on PATH, not the
  code you just built.
- **Avoid `npm link` for day-to-day dogfooding**: it overwrites the globally
  installed `ccglance` command with a symlink, and the next `npm update -g`
  swaps it back, so the command silently flips between the two. To run the
  development build in Claude Code, point settings.json at the repo output
  instead: `"command": "node /absolute/path/to/ccglance/dist/cli.js"`, and
  switch back to `"ccglance"` when done.
- **Tests and benchmarks never touch the real cache**: `test/*.test.js` and
  `bench/latency.js` point `CLAUDE_CONFIG_DIR` at a temp directory, so runs
  leave nothing behind in `~/.claude/ccglance/`. Do the same for manual piped
  smoke tests (as in the example above), otherwise git caches for throwaway
  repos land in the real cache directory as dead entries.

### When You Need a Global Link

If you intentionally want the bare terminal command `ccglance` to resolve to
this source checkout, run this from the repository root:

```bash
npm link
```

`npm link` points the global package entry at this repository. After that, every
`npm run build` updates `dist/`, and the global `ccglance` command immediately
uses the new build; you do not need to link again. Verify the link:

```bash
npm ls -g @cxmyu/ccglance     # linked state should show -> D:\Pyprojects\ccglance
ccglance --version            # should print the version from local package.json
```

Restore the published global install when done:

```bash
npm unlink -g @cxmyu/ccglance
npm install -g @cxmyu/ccglance
```

While linked, the global `ccglance` command is the development build. Running
`npm update -g` can swap it back to the published install, so day-to-day checks
should still prefer `npm run preview` or a Claude Code command that points
directly at `node <repo>/dist/cli.js`.

## Validation

- `test/fixtures/` contains stdin payloads for subscription, API-style,
  missing-field, and high-context scenarios.
- `test/snapshots/` locks the ANSI-colored rendered output so icon, spacing,
  color, and row changes are intentional.
- `test/*.test.js` uses Node's built-in `node:test`; no test runner dependency
  is added to the runtime package.
- `bench/latency.js` measures cold process startup against an empty Node
  baseline, plus no-git, subscription+transcript, git warm-cache, and git
  cold-fallback paths. On Windows, the empty Node baseline is usually the
  dominant part of the number; compare ccglance cases to that baseline.

## Agent Build Practices

- Treat `src/` as the source of truth. Do not hand-edit `dist/`; regenerate it
  with `npm run build`.
- Keep the status line fixed-style: no user config loader, no external style
  file, and no runtime style discovery.
- Keep runtime dependencies at zero. New dependencies must be development-only
  and justified by the build pipeline.
- After code changes, run `npm run typecheck`, `npm run build`, and
  `npm run preview` (not the global `ccglance`, which is the published install).
- When changing icon or spacing behavior, test the plain ANSI-stripped preview
  and at least one synthetic stdin payload that exercises the edited segment.

## Source layout

```text
src/
  cli.ts              # command entry: preview / statusLine stdin
  defaults/           # fixed built-in style and segment order
  readers/            # stdin, transcript tail reads, terminal width
  render/             # colors, icons, layout, final rendering
  segments/           # per-segment rendering logic
  runtime/            # git and Claude Code version-cache helpers
  types/              # Claude Code stdin and renderer types
  utils/              # formatting and display-width helpers
test/
  fixtures/           # representative Claude Code stdin and transcript data
  snapshots/          # fixed rendered-output baselines
bench/
  latency.js          # startup and cache-path benchmark
```

Only the compiled `dist/` is published to npm. `npm run build` cleans `dist`
before compiling so old flat artifacts cannot leak into the package.

## Git cache internals

- Cache key is the Git worktree root, so multiple Claude Code terminals in the
  same repo share one git cache.
- The branch name prefers Claude Code stdin when `worktree.branch` is present;
  otherwise ccglance checks `.git/HEAD` on every render, so normal branch
  switches still show up immediately.
- Dirty/conflict and ahead/behind details use a cache. A cache newer than 20
  minutes is returned when it still belongs to the current branch.
- Local state (`✓` / `●` / `⚠`) and upstream state (`↑ahead` / `↓behind`) come
  from the same cached `git status --porcelain=v2 --branch` snapshot, so they
  share the same TTL. If both local and upstream changes exist, ccglance shows
  them together, for example `main ● ↑1 ↓1`.
- A stale cache, missing cache, or branch change still renders immediately;
  ccglance shows a fast branch-only `HEAD` fallback, then refreshes `git status`
  in a detached process.
- Refresh uses an exclusive `.refresh` marker and atomic temp-file rename, so
  concurrent terminals do not corrupt the cache.
- There is no heartbeat or resident watcher. Refresh is lazy: Claude Code
  redraws the status line, ccglance checks the cache age, and only then starts
  the detached refresh process if the cache is stale.

## Background refresh and first-paint latency

- During rendering, git and version refreshes only *queue* work (after claiming
  their `.refresh` markers). After stdout is written, `flushRefreshTasks()`
  writes the task list to `~/.claude/ccglance/tasks/task-*.json`, then spawns a
  **single** detached helper (`dist/runtime/bg.js`). The helper receives the
  task-file path through argv. A cold start where both git and version caches
  are stale pays for one child process, not two.
- On Windows, synchronously initiating a node.exe child is expensive
  (CreateProcess plus antivirus scanning, measured at ~80-110ms). The helper is
  therefore launched through a `cmd start /b` trampoline (~17ms to initiate);
  the real node startup cost is paid by the trampoline after the status-line
  process has already exited. The task payload is in a file, so cmd only
  forwards three path arguments: node, helper, and task file.
- Claude Code waits for the status-line process to exit before rendering its
  output, so work done "after stdout" still delays the first paint. Keep any
  post-render logic spawn-free or route it through this merged channel.
- The helper finishes with a throttled prune pass (at most once per day): cache
  json untouched for 30 days is deleted, as are `.refresh`, `.tmp`, and
  `tasks/task-*.json` leftovers older than 1 hour.
