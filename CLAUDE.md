# CLAUDE.md

Guidance for working in this repo. See `docs/development.md` (and its zh-CN
counterpart) for deeper build/test/cache internals.

## What this is

`@cxmyu/ccglance` — a Claude Code status-line renderer. Claude Code pipes JSON on
stdin per redraw; `dist/cli.js` renders one line to stdout. Zero runtime
dependencies; the CLI is spawned fresh on every redraw, so cold-start latency
matters.

## Core rules

- `src/` is the only source of truth. **Never hand-edit `dist/`** — it is
  gitignored and rebuilt by `npm run build` (and by `npm ci` via `prepare`).
- Keep the style fixed and built-in: no user config loader, no external style
  file, no runtime style discovery.
- Keep runtime dependencies at zero. New deps must be build-time only.
- Verify local changes with `npm run preview` / `node dist/cli.js`, never a bare
  `ccglance` (that is the published global install on PATH).

## Build / test

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run build       # clean + compile src/ -> dist/
npm test            # build + node:test (fixtures / snapshots / smoke)
npm run preview     # render this repo's dist/
```

Tests and benchmarks isolate `CLAUDE_CONFIG_DIR` to a temp dir; they never touch
the real `~/.claude/ccglance/` cache.

## Background refresh (Windows footgun)

Git/version refreshes queue during render and flush after stdout as a **single**
detached helper (`dist/runtime/bg.js`). On Windows the helper MUST be spawned as
`spawn(node, [...], { detached: true, windowsHide: true })` — spawning Node
directly, **never** through a `cmd`/`start` trampoline. `detached` maps to
`DETACHED_PROCESS` (no console allocated → no black window flash); a `cmd start`
trampoline flashes a window on every cold refresh (the 1.1.0 regression fixed in
1.1.1). Dropping `detached` makes the helper die when the parent exits, so the
cache never gets written. See `src/runtime/refresh.ts`.

## Release process (publish a new version)

Publishing is done through a **GitHub Release**, which triggers
`.github/workflows/publish.yml` (`release: published`). CI runs `npm ci` →
`npm run typecheck` → `npm test` → `npm publish --provenance --access public`
(OIDC provenance; `NPM_TOKEN` secret must bypass 2FA). Do **not** `npm publish`
locally.

Steps, from a clean `main` with the change already committed or staged:

1. **Verify green locally:** `npm run typecheck && npm run build && npm test`.
2. **Bump version** (no tag yet — keeps it in the same commit):
   ```bash
   npm version <major|minor|patch> --no-git-tag-version
   ```
   Updates `package.json` + `package-lock.json`. Pick `patch` for fixes,
   `minor` for features, `major` for breaking changes.
3. **Add a CHANGELOG entry** at the top of `CHANGELOG.md`:
   `## X.Y.Z - YYYY-MM-DD` followed by bullet points.
4. **One commit** for the whole release (source + version bump + CHANGELOG):
   ```bash
   git add -A
   git commit -m "Release vX.Y.Z: <short summary>"
   ```
5. **Tag and push** (push the branch AND the tag explicitly — `--follow-tags`
   does not push a lightweight tag):
   ```bash
   git tag vX.Y.Z
   git push origin main
   git push origin vX.Y.Z
   ```
6. **Create the GitHub Release** on tag `vX.Y.Z` (this is what triggers publish):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "<changelog section>"
   ```
   (Or create it in the GitHub UI.)
7. **Verify:** watch the Actions run succeed, then confirm
   `npm view @cxmyu/ccglance version` shows `X.Y.Z`.

Notes:
- The commit and the tag must point at the same state; publish builds from the
  tagged commit, and CI compiles `dist/` from `src/` — so whatever is in `src/`
  at the tag is what ships (never rely on a locally-built `dist/`).
- `dist/`, `node_modules/`, `.claude/`, `.idea/` are gitignored and must not be
  committed. `~/.claude/settings.json` and tokens live outside the repo — never
  commit them.
