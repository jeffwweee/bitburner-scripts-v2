# Bitburner Scripts - Event Log

Chronological record of project events. Whoever acts, writes.

## Format

Each entry: `- **YYYY-MM-DD HH:MM** - [agent] description`

---

- **2026-06-05 23:10** - [Codex] Initialized project context for Jef's Bitburner scripts repo, including purpose, goals, non-goals, current focus, and source references.
- **2026-06-05 23:22** - [Codex] Added in-game repo update infrastructure using `repo-update.js`, a root manifest, and README bootstrap instructions.
- **2026-06-05 23:23** - [Codex] Added an early game progression plan covering bootstrap, tiny worker scripts, scanning, rooting, deployment, and the first coordinator.
- **2026-06-05 23:23** - [Codex] Implemented the first early-game script slice: weaken, grow, hack, info, scan, root, manifest entries, and explicit updater cache-busting notes.
- **2026-06-05 23:23** - [Codex] Added a basic remote deployer and first-pass auto coordinator for early money and hacking XP loops.
- **2026-06-05 23:49** - [Codex] Added darkweb purchase automation and an early-game orchestrator for buying servers, rooting hosts, purchasing hacking tools, and keeping the money loop running.
- **2026-06-05 23:54** - [Codex] Added recommended Bitburner terminal aliases for pulling updates and running the orchestrator.
- **2026-06-06 00:19** - [Codex] Made the orchestrator quieter by default, added tail-window options, improved hack target scoring, and made purchased-server replacement more conservative.
- **2026-06-06 00:28** - [Codex] Made weaken, grow, and hack worker scripts log to script logs instead of terminal by default.
- **2026-06-06 00:37** - [Codex] Added auto target ranking output and adjusted target scoring to prefer stronger prepared targets while still penalizing prep work.
- **2026-06-06 00:42** - [Codex] Fixed auto target ranking units so per-second values account for Bitburner millisecond timings.
- **2026-06-06 00:47** - [Codex] Added current and prep target-selection strategies to auto.js and threaded strategy selection through orchestrator.js.
- **2026-06-06 08:10** - [Codex] Added an experimental casino blackjack helper with manual-first Aevum travel, save-on-win, and reload-on-loss behavior.
- **2026-06-06 08:26** - [Codex] Reduced casino helper RAM by removing Netscript city and money checks from the manual-first flow.
- **2026-06-06 08:31** - [Codex] Added `lib/casino-lite.js` as a fresh-path copy of the reduced-RAM casino helper to sidestep stale raw-file caching.
- **2026-06-06 09:00** - [Codex] Reviewed repo context and official Bitburner stable API references, then added `references/bitburner.md` as durable copilot context.
- **2026-06-06 09:10** - [Jef/Codex] Recorded fresh-start save status: orchestrator running with prep/restart-auto, mugging for early money, planning TOR purchase and CSEC progression.
- **2026-06-06 09:20** - [Codex] Added `lib/bootstrap.js`, a tiny home-only fresh-save/NG+ loop for low-RAM starts before `auto.js` or `orchestrator.js` fit.
- **2026-06-06 09:30** - [Codex] Refactored script layout into `lib/` for player-facing scripts including the updater, `worker/` for tiny workers, and `helper/` for shared modules.
- **2026-06-06 09:40** - [Codex] Restored root `repo-update.js` as a compatibility shim after Bitburner raw GitHub bootstrap hit a 404 on the new `lib/` path.
- **2026-06-06 09:50** - [Codex] Added `README.md` to the in-game manifest and made the updater recommend `cat README.md` after pulls.
- **2026-06-06 10:00** - [Codex] Added `lib/status.js` for troubleshooting stuck early automation by reporting controllers, targets, worker threads, and action timings.
- **2026-06-06 10:10** - [Codex] Introduced `lib/hack-strat.js`, made orchestrator start it as the hacking controller, and kept `lib/auto.js` as a compatibility launcher.
- **2026-06-06 10:20** - [Codex] Changed `lib/hack-strat.js` from all-one-action deployment to conservative mixed worker phases for grow and harvest.
- **2026-06-06 10:30** - [Codex] Made orchestrator show root logs by default and fixed hack-strat deployment coverage when servers had stale worker scripts.
- **2026-06-06 10:40** - [Codex] Fixed post-augmentation hack-strat stalls by copying worker files before RAM checks and allowing home worker deployment above a configurable reserve.
- **2026-06-06 10:45** - [Codex] Reverted orchestrator root logging to quiet-by-default after confirming the observed issue was worker deployment, not root visibility.
- **2026-06-06 10:55** - [Codex] Made casino helpers stop cleanly on goal/casino-cap UI states instead of throwing when the final blackjack hand has no detectable outcome.
- **2026-06-06 11:05** - [Codex] Added home-based `lib/share.js` and `worker/share.js` for a small faction reputation RAM boost, started by orchestrator before `hack-strat`.
- **2026-06-07 09:20** - [Codex] Added stock market toolkit: `lib/stock-status.js`, `lib/stock-watch.js`, and conservative long-only `lib/stock-trader.js`.
- **2026-06-07 09:30** - [Codex] Added opt-in orchestrator support for `lib/stock-trader.js`, defaulting to dry-run unless `--stock-live` is passed.
- **2026-06-07 09:35** - [Codex] Made stock trader/watch logs quiet by default, with `--tail` or `--terminal` for visible output.
- **2026-06-07 09:45** - [Codex] Added orchestrator `--start-all` preset and recommended aliases for starting hacking, share, infrastructure, and live stock automation with safer reserves.
- **2026-06-07 09:50** - [Codex] Updated `--start-all` defaults to 128GB home reserve, `$500m` stock reserve, and 80% stock budget.
- **2026-06-07 09:55** - [Codex] Added `lib/stock-sell-all.js` for liquidating stock positions before installing augmentations.
- **2026-06-07 10:05** - [Codex] Increased `--start-all` share RAM to 15% and made orchestrator restart `lib/share.js` when share settings change.
- **2026-06-07 10:25** - [Codex] Added preserved `reserve.json`, `lib/reserve.js`, and shared config wiring for money reserve, share/home RAM, stocks, darkweb, and purchased-server RAM caps.
- **2026-06-09 00:05** - [Codex] Added explicit WSE/TIX guards to `lib/stock-trader.js` and startup logging for 4S forecast versus trend fallback mode.
- **2026-06-09 00:20** - [Codex] Made stock-trader startup blockers print to terminal and made orchestrator report when stock-trader exits immediately.
- **2026-06-09 00:30** - [Codex] Fixed Bitburner v3 stock access detection by supporting `hasWseAccount`, `hasTixApiAccess`, and `has4SDataTixApi` method casing.
- **2026-06-10 00:10** - [Codex] Added BN4 helpers for connect/backdoor paths, faction invitations/work, and home RAM/core upgrades; wired faction joining and home upgrades into orchestrator.
