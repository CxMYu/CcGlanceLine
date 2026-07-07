# Changelog

## 1.1.1 - 2026-07-06

- Faster status-line cold start: git and version refreshes are batched into a
  single short-lived background task that runs after the line is printed, instead
  of launching separate processes mid-render. When the cache is fresh, the common
  redraw does no background work at all.
- Windows: the background refresh no longer flashes a console window.
- Runtime caches now clean themselves up over time (stale git/version entries and
  leftover temporary files), and stay under `~/.claude/ccglance/` (honors
  `CLAUDE_CONFIG_DIR`).
- Tests and the latency benchmark no longer write into the real cache directory.
- Add `npm run preview`, and document how to develop locally without clashing
  with a global install.

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
