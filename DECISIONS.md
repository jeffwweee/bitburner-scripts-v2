# Bitburner Scripts - Decisions

Record of key decisions made during the project. Updated by Kiana.

## Format

Each entry includes: date, decision, rationale, who decided.

---

## 2026-06-05 - Use manifest-driven in-game updates

Decision: Add `lib/repo-update.js` that fetches a root `manifest.json` from GitHub raw content and downloads every listed file with `ns.wget()`.

Rationale: Bitburner cannot run `git pull` in-game, but a manifest-driven updater gives a similar terminal workflow while keeping the list of in-game files explicit.

Decided by: Jef and Codex.

## 2026-06-06 - Use lib/worker/helper layout

Decision: Put player-facing runnable scripts in `lib/`, tiny hack/grow/weaken workers in `worker/`, and future shared modules in `helper/`.

Rationale: Jef wants to run scripts from `lib/`, while keeping low-RAM worker scripts easy to identify and giving shared helpers a dedicated location.

Decided by: Jef and Codex.
