# Bitburner References

Last reviewed: 2026-06-06

## Purpose

This file is the durable context note for Jef's Bitburner save and this repo. Before recommending new automation, check this file, `README.md`, `plans/early-game.md`, `STATE.json`, and the current scripts under `lib/`, `worker/`, and `helper/`.

## Primary Sources

- Official source repo: https://github.com/bitburner-official/bitburner-src
- Stable NS API docs: https://github.com/bitburner-official/bitburner-src/blob/stable/markdown/bitburner.ns.md
- Full generated API package index: https://github.com/bitburner-official/bitburner-src/blob/stable/markdown/bitburner.md
- In-game documentation index source: https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/en/index.md
- Authoritative type definitions: https://github.com/bitburner-official/bitburner-src/blob/stable/src/ScriptEditor/NetscriptDefinitions.d.ts
- Stable release page: https://github.com/bitburner-official/bitburner-src/releases
- Inspiration repo: https://github.com/alainbryden/bitburner-scripts

## API Notes

- Netscript scripts are async modules with `export async function main(ns)`.
- `ns` is the main API object. Core early-game APIs in use here include `scan`, `scp`, `exec`, `run`, `ps`, `kill`, `killall`, `hack`, `grow`, `weaken`, `nuke`, `brutessh`, `ftpcrack`, `relaysmtp`, `httpworm`, `sqlinject`, `getServer*`, `getHackTime`, `getGrowTime`, `getWeakenTime`, `hackAnalyze`, and `hackAnalyzeChance`.
- Most functions that return promises must be awaited, especially `hack`, `grow`, `weaken`, `sleep`, `scp`, and `wget`.
- Purchased-server APIs are currently under `ns.cloud`, not the older root-level purchased-server names. This repo already uses `ns.cloud.getRamLimit`, `ns.cloud.getServerNames`, `ns.cloud.getServerLimit`, `ns.cloud.getServerCost`, `ns.cloud.purchaseServer`, and `ns.cloud.deleteServer`.
- Singularity APIs are spoiler/high-level automation APIs. `lib/darkweb.js` checks for `ns.singularity.purchaseTor` before trying automatic TOR/program purchases because early saves may not have Singularity access.
- RAM cost matters. Splitting tiny worker scripts (`weaken.js`, `grow.js`, `hack.js`) from orchestration keeps remote workers cheap.
- Generated API docs are built from TypeScript definitions, so when behavior is unclear, prefer `NetscriptDefinitions.d.ts` and the stable markdown docs over community wiki pages.

## Current Repo Model

- `repo-update.js` and `lib/repo-update.js`: in-game updater that downloads `manifest.json` and every listed file from GitHub raw with cache busting. The root copy is a compatibility shim for fresh bootstrap and old aliases.
- `manifest.json`: explicit list of files pulled into Bitburner.
- `worker/weaken.js`, `worker/grow.js`, `worker/hack.js`: tiny infinite-loop worker scripts.
- `worker/share.js`: tiny infinite-loop share worker for faction reputation boost.
- `lib/bootstrap.js`: tiny fresh-save/NG+ home-only loop used before `lib/hack-strat.js` or `lib/orchestrator.js` fit in RAM.
- `lib/info.js`: single-server inspection.
- `lib/status.js`: one-shot troubleshooting view for controller processes, target stats, worker threads, and action timings.
- `lib/share.js`: keeps a small share worker running on home; orchestrator starts it before `hack-strat` by default.
- `lib/scan.js`: recursive server discovery and sorted table output.
- `lib/root.js`: opens available ports and nukes eligible servers.
- `lib/deploy.js`: copies one worker script to rooted servers and fills available RAM.
- `lib/hack-strat.js`: chooses a rooted money target, decides conservative weaken/grow/harvest worker mixes, deploys workers, adds workers on newly available servers without restarting, and can use spare home RAM above a reserve.
- `lib/auto.js`: compatibility launcher for `lib/hack-strat.js`.
- `lib/buy-server.js`: conservative purchased-server buying/replacement using `ns.cloud`.
- `lib/darkweb.js`: TOR and program purchase helper when Singularity is available.
- `lib/orchestrator.js`: one-command early-game conductor for darkweb, rooting, purchased servers, and starting `lib/hack-strat.js` if needed.
- `lib/casino.js`, `lib/casino-lite.js`: experimental manual-first Aevum blackjack helpers using game DOM access.

## Early-Save Strategy

- Default assumption: Jef is still very early. Optimize for reliable income, hacking XP, low RAM cost, and understandable scripts.
- Current save note as of 2026-06-06: Jef switched PCs without moving saves, so treat the save as a fresh start.
- Current active low-RAM loop: `run lib/bootstrap.js`, with manual/character contribution from mugging for early money.
- Immediate player plan: buy TOR manually, continue orchestrator and mugging, and let hacking progress until the `CSEC` invite path becomes available.
- First loop: `pull`, run `lib/bootstrap.js`, run `lib/root.js` as port openers unlock, then move to `lib/orchestrator.js` as home RAM allows.
- Good early targets are usually low required-hacking money servers: `n00dles`, `foodnstuff`, `sigma-cosmetics`, `joesguns`, and `hong-fang-tea`; let `lib/hack-strat.js --rank` verify with live state.
- Target readiness rule: weaken until security is near minimum, grow until money is near max, then harvest. Current `hack-strat.js` thresholds are security above min + 5 and money below 75% max; grow phase uses 80% grow / 20% weaken, harvest phase uses 15% hack / 60% grow / 25% weaken.
- Spend priorities: home RAM when script RAM constrains orchestration, TOR and port openers as affordable, then purchased servers once income is stable.
- Faction reputation: use `lib/share.js` or orchestrator `--share-fraction` to reserve a small home RAM slice for `ns.share()` once faction work matters.
- Post-augmentation note: remote servers may not have worker files yet. `hack-strat.js` copies workers before RAM checks and can use home RAM above `--home-reserve` so fresh resets do not stall.
- CSEC readiness: once hacking level and route allow it, connect/backdoor `CSEC`; until backdoor automation is available, this is likely a manual terminal action.
- Avoid advanced batch timing, stocks, gangs, sleeves, corporations, Bladeburner, or BitNode-specific automation until the save state says those systems are unlocked or relevant.

## Useful In-Game Commands

```text
run lib/repo-update.js
alias pull="run lib/repo-update.js"
alias orch="run lib/orchestrator.js"
alias orchtail="run lib/orchestrator.js --tail"
alias orchonce="run lib/orchestrator.js --once"

run lib/bootstrap.js
run lib/scan.js money
run lib/root.js
run lib/status.js
run lib/share.js
run lib/hack-strat.js --rank
run lib/orchestrator.js --tail
run lib/orchestrator.js --once
```

## Copilot Operating Rules

- Ask Jef for current save facts before making strategic recommendations that depend on state: hacking level, money, home RAM, port programs owned, rooted servers, purchased servers, factions, augmentations, and Source-Files.
- Prefer incremental automation that compounds early progress before building a large framework.
- Keep player-facing scripts in `lib/`, worker scripts in `worker/`, reusable modules in `helper/`, and add runnable in-game files to `manifest.json`.
- Update `LOG.md` after meaningful repo or strategy changes.
- When API details are uncertain, check the official stable docs first.
