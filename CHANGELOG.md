# Changelog

## 1.1.0 - 2026-07-06

- Cut cold-start first-paint latency: git and version background refreshes now
  queue during rendering and are flushed after stdout as a **single** detached
  helper process (`dist/runtime/bg.js`, tasks passed through
  `~/.claude/ccglance/tasks/task-*.json`), instead of spawning one `node -e`
  child each.
- Windows: launch the background helper through a `cmd start /b` trampoline
  (~17ms to initiate vs ~80-110ms for node.exe), so the status-line process
  exits without paying node's process-creation cost. The old code spawned the
  git refresh *before* stdout was written, delaying the visible line itself;
  measured cold start (git + version both stale) improved on both time-to-first
  -byte (~360ms -> ~235ms p50) and the process-exit lower bound
  (~475ms -> ~290ms p50).
- README: document that pointing `command` directly at `dist/cli.js` avoids the
  npm `.cmd` shim overhead on Windows (tens to hundreds of ms per redraw
  depending on antivirus/cache state).
- Tests and the latency benchmark now isolate `CLAUDE_CONFIG_DIR` to a temp
  directory, so runs against throwaway repos no longer leave dead git/transcript
  cache entries in the real `~/.claude/ccglance/`.
- The background helper opportunistically prunes the cache (at most once per
  day): cache json untouched for 30 days and `.refresh`/`.tmp`/task-file
  leftovers older than 1 hour are deleted.
- Add `npm run preview` and document the local-development isolation rules
  (never verify with the global `ccglance`; avoid `npm link`; point Claude Code
  at `node <repo>/dist/cli.js` for dogfooding).

## 1.0.3 - 2026-07-06

- README: trim the homepage to install + configure; move features, requirements, at-a-glance, how-it-works and cache notes into `docs/overview.md`; center the header and preview.
- Document Bun as a supported install method and runtime (Node.js >= 22 or Bun).

## 1.0.2 - 2026-07-06

- README: add a Documentation index linking `docs/segments.md` and `docs/development.md`; remove the Related Projects section.
- First release published through the GitHub Actions workflow.

## 1.0.1 - 2026-07-06

- Publish under the scoped npm name `@cxmyu/ccglance`; the installed command stays `ccglance`.
- Store caches under Claude Code's config dir `~/.claude/ccglance/{git,transcript,version}` (honors `CLAUDE_CONFIG_DIR`) instead of the OS cache dir.
- Add `ccglance --help` / `--version`; running `ccglance` in a plain terminal (no piped JSON) now prints help instead of blocking on stdin.
- Fix session `status` detection so a completed text reply shows idle instead of permanent thinking (Claude Code records finished replies with `stop_reason: null`).
- Slim the README; move the full segment/icon/color reference to `docs/segments.md` and build/dev details to `docs/development.md`.

## 1.0.0 - 2026-07-02

- Package name and command are `ccglance`.
- Uses one fixed built-in emoji style; no user config file and no external style file.
- Reads Claude Code status-line JSON from stdin and renders model, effort, status, context, cache, rate limits, project/session state, cost, and version.
- Shows rate limits with moon-phase meters: `🌑` below 10%, `🌒` 10-29.9%, `🌓` 30-59.9%, `🌔` 60-89.9%, `🌕` 90% and above.
- Checks the latest Claude Code version through a 4h cache after stdout is written, so rendering is not blocked.
- Uses platform cache directories with optional `CCGLANCE_CACHE_DIR` override.
