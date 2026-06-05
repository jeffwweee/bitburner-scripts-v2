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
