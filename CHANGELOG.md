# Changelog

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
