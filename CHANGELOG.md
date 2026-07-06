# Changelog

## 1.0.0 - 2026-07-02

- Package name and command are `ccglance`.
- Uses one fixed built-in emoji style; no user config file and no external style file.
- Reads Claude Code status-line JSON from stdin and renders model, effort, status, context, cache, rate limits, project/session state, cost, and version.
- Shows rate limits with moon-phase meters: `🌑` below 10%, `🌒` 10-29.9%, `🌓` 30-59.9%, `🌔` 60-89.9%, `🌕` 90% and above.
- Checks the latest Claude Code version through a 4h cache after stdout is written, so rendering is not blocked.
- Uses platform cache directories with optional `CCGLANCE_CACHE_DIR` override.
