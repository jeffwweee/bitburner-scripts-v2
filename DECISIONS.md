# Bitburner Scripts - Decisions

Record of key decisions made during the project. Updated by Kiana.

## Format

Each entry includes: date, decision, rationale, who decided.

---

## 2026-06-05 - Use manifest-driven in-game updates

Decision: Add a root `repo-update.js` that fetches a root `manifest.json` from GitHub raw content and downloads every listed file with `ns.wget()`.

Rationale: Bitburner cannot run `git pull` in-game, but a manifest-driven updater gives a similar terminal workflow while keeping the list of in-game files explicit.

Decided by: Jef and Codex.
