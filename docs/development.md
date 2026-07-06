# Development

Build, test, benchmark, source layout, contribution practices, and cache
internals for ccglance.

[← Back to README](../README.md)

## Source Build

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install              # installs devDeps and runs prepare -> build

npm run build            # compile src/ → dist/
npm run typecheck        # tsc --noEmit (strict)
npm test                 # build + node:test fixtures/snapshots/smoke
npm run benchmark        # build + latency benchmark
ccglance preview         # preview the linked/global command

# smoke-test with a sample stdin payload:
printf '%s' '{"model":{"display_name":"Claude Opus 4.8 (1M context)","id":"claude-opus-4-8[1m]"}}' | node dist/cli.js
```

For local dogfooding, use `npm link` after building and configure Claude Code
with `"command": "ccglance"`. Without a global link, point Claude Code directly
at `node /absolute/path/to/ccglance/dist/cli.js`.

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
  `ccglance preview`.
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
