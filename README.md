# Bitburner Scripts

## Purpose

This repository contains Jef's version of scripts for the game Bitburner.

It exists to support steady game progression with practical automation, reusable scripts, and clear explanations of what the scripts are doing.

## Desired Outcome

The project should help Jef progress through Bitburner as autonomously as possible while staying understandable. Success means:

- Early game scripts are available quickly.
- Recommendations evolve as the save progresses.
- Automation choices are explained clearly enough for Jef to trust and adjust them.
- Scripts remain organized, maintainable, and easy to expand.

## Scope

- Early game money-making and hacking scripts.
- Progression recommendations based on the current game state.
- Documentation for how scripts work and when to use them.
- Iterative improvements as new Bitburner systems unlock.

## Layout

- `lib/`: player-facing scripts. Run these from the Bitburner terminal.
- `worker/`: tiny worker scripts launched by `lib/` controllers.
- `helper/`: shared helper modules when reuse is worth the RAM/import tradeoff.

## Non-Goals

- Perfect endgame automation from day one.
- Blindly copying another player's full framework without understanding it.
- Optimizing for advanced mechanics before the early game foundation is stable.

## Key Context

- Codex is Jef's wingman for this repo: help progress the game as autonomously as possible, provide scripts, recommend next steps, and explain what is going on.
- Primary documentation source: https://github.com/bitburner-official/bitburner-src
- Main inspiration source: https://github.com/alainbryden/bitburner-scripts
- Prefer practical, incremental scripts that work for the current stage of progression.

## Repo / Channel

- Repo: bitburner-scripts
- Discord channel:

## Current Status

Project scaffold is initialized. The current focus is building an early game script foundation and learning loop for Bitburner progression.

## In-Game Updates

Bootstrap the updater from the Bitburner terminal:

```text
wget https://raw.githubusercontent.com/jeffwweee/bitburner-scripts-v2/master/repo-update.js?t=202606060940 repo-update.js
run repo-update.js
```

The root updater is kept as a compatibility shim. After the first successful pull, prefer the `lib/` updater:

```text
wget https://raw.githubusercontent.com/jeffwweee/bitburner-scripts-v2/master/lib/repo-update.js lib/repo-update.js
run lib/repo-update.js
```

Recommended alias after the first successful run:

```text
alias pull="run lib/repo-update.js"
alias orch="run lib/orchestrator.js"
alias orchtail="run lib/orchestrator.js --tail"
alias orchonce="run lib/orchestrator.js --once"
alias start-all="run lib/orchestrator.js --start-all"
alias start-all-tail="run lib/orchestrator.js --start-all --tail"
```

After that, run `pull` in the Bitburner terminal to download the latest `manifest.json`, `README.md`, and all files listed in it. Add new scripts to `manifest.json` when they should be pulled into the game.

`lib/repo-update.js` adds a timestamp query to downloads so GitHub raw cache should not delay manifest or script updates.

After pulling, run this in the Bitburner terminal for quick usage guidance:

```text
cat README.md
```

## Early Game Commands

```text
run lib/scan.js money
run lib/root.js
run lib/bootstrap.js
run lib/share.js
run lib/info.js foodnstuff
run lib/status.js foodnstuff
run lib/stock-status.js
run lib/stock-watch.js
run lib/stock-trader.js --dry-run
run lib/reserve.js
run lib/deploy.js weaken foodnstuff
run lib/deploy.js grow foodnstuff
run lib/deploy.js hack foodnstuff
run lib/buy-server.js
run lib/darkweb.js
run lib/casino.js
run lib/orchestrator.js
run lib/hack-strat.js
run lib/auto.js
```

`lib/bootstrap.js` is the super-early fresh-save/NG+ script for when `lib/hack-strat.js` or `lib/orchestrator.js` do not fit comfortably in home RAM yet. It only uses `home`, chooses from fixed low-level targets, nukes 0-port servers, and runs one worker mode at a time:

```text
run lib/bootstrap.js
run lib/bootstrap.js n00dles
run lib/bootstrap.js --target foodnstuff --tail
```

Use `lib/bootstrap.js` first, then move to `lib/orchestrator.js` once there is enough room for orchestration plus the money loop. Orchestrator starts `lib/hack-strat.js` if it is not already running.

`lib/hack-strat.js` chooses a rooted money target automatically. You can also force a target:

```text
run lib/hack-strat.js foodnstuff
run lib/hack-strat.js --rank
run lib/hack-strat.js --rank --strategy prep
run lib/hack-strat.js --rank --top 20
```

`lib/auto.js` remains as a compatibility launcher for `lib/hack-strat.js`.

If progress looks stuck, inspect live workers and timings:

```text
run lib/status.js
run lib/status.js foodnstuff --workers
```

`lib/hack-strat.js` deploys workers to rooted servers and spare home RAM. It kills existing worker scripts when the selected phase or target changes, but only adds workers when new servers become available.

After augmentation or once home RAM is large, `lib/hack-strat.js` can also use spare home RAM while reserving 32GB by default for controllers. Control this through orchestrator:

```text
run lib/orchestrator.js --home-reserve 64
run lib/orchestrator.js --no-home
```

Current `lib/hack-strat.js` phases are intentionally conservative:

- `weaken`: 100% weaken when security is high.
- `grow`: 80% grow and 20% weaken when money is low.
- `harvest`: 15% hack, 60% grow, and 25% weaken when money/security are healthy.

`lib/share.js` keeps a small `worker/share.js` process running on `home` for faction reputation boost. Orchestrator starts it before `lib/hack-strat.js` so it claims a small RAM slice first:

```text
run lib/share.js --fraction 0.05
run lib/orchestrator.js --share-fraction 0.05
run lib/orchestrator.js --share-fraction 0.15
run lib/orchestrator.js --no-share
```

Bare orchestrator keeps the conservative 5% share default. `--start-all` uses 15% share RAM by default because it is meant for active faction grinding after your home RAM is large enough.

## Reserve Config

`reserve.json` is your in-game tuning file. `pull` downloads the starter file only when it does not already exist, so your local settings are preserved:

```text
cat reserve.json
run lib/reserve.js
run lib/reserve.js --money 500m --home-ram 128 --share 0.15
run lib/reserve.js --server-min-ram 8 --server-max-ram 1024 --server-budget 0.25
run lib/reserve.js --stock-reserve 500m --stock-budget 0.8
```

Current automation reads these defaults:

- `moneyReserve`: cash all spending scripts should leave untouched.
- `homeRamReserve`: home RAM kept away from hacking/share worker allocation.
- `shareFraction`: home RAM fraction assigned to `worker/share.js`.
- `servers.maxRam`: hard cap for purchased-server buys/upgrades.
- `stocks.reserve`: cash reserve for stock trading; keep this aligned with `moneyReserve` unless you want stocks to be stricter.

## Stock Market

Stock automation does not require Source-File 4. It requires WSE/TIX access, and works best after buying 4S Market Data plus 4S Market Data TIX API:

```text
run lib/stock-status.js
run lib/stock-watch.js --tail
run lib/stock-trader.js --dry-run
run lib/stock-trader.js
run lib/stock-sell-all.js --dry-run
run lib/stock-sell-all.js
run lib/orchestrator.js --stock
run lib/orchestrator.js --stock --stock-live
```

`lib/stock-trader.js` is conservative and long-only. It refuses to run unless WSE and TIX are available. It uses 4S forecast when available, otherwise it falls back to observed price trend. Defaults come from `reserve.json`:

```text
run lib/stock-trader.js --reserve 5000000000 --budget 0.4
run lib/stock-trader.js --buy-forecast 0.62 --sell-forecast 0.53
```

Orchestrator does not start stock trading unless `--stock` is passed. `--stock` starts in dry-run mode; add `--stock-live` only after checking `stock-status` and dry-run output:

```text
run lib/orchestrator.js --stock --stock-reserve 5000000000 --tail
run lib/orchestrator.js --stock --stock-live --stock-budget 0.4
```

If `--start-all` does not leave `lib/stock-trader.js` running, check terminal output first. Startup blockers such as missing WSE/TIX access are printed to terminal even when stock logs are otherwise quiet.

Stock trader/watch logs go to script logs by default. Use `--tail` or `--terminal` when you want visible output.

Before installing augmentations, stop the trader and liquidate positions:

```text
kill lib/stock-trader.js
run lib/stock-sell-all.js
```

Use `start-all` after your core APIs are purchased and you want one command to start infrastructure, share, hacking, and live stock automation:

```text
start-all
start-all-tail
```

`--start-all` uses stronger automation defaults than bare orchestrator: 128GB home reserve, 15% share RAM, live stock trading with `$500m` cash reserve, 80% stock budget above reserve, and 15% max stock position.

`lib/buy-server.js` spends a conservative slice of cash above `moneyReserve` on the largest purchased server it can afford, capped by `servers.maxRam`:

```text
run lib/buy-server.js
run lib/buy-server.js 50
run lib/buy-server.js 0.5 16
run lib/buy-server.js --max-ram 2048
```

`lib/darkweb.js` buys TOR and port opener programs when the Singularity API is available:

```text
run lib/darkweb.js
run lib/darkweb.js --budget 50
run lib/darkweb.js --all
```

`lib/casino.js` is an experimental blackjack helper inspired by Alain Bryden's casino flow. For the first manual pass, save up `$200k`, manually travel to `Aevum`, then run:

```text
run lib/casino.js
run lib/casino-lite.js
```

By default it will open the Aevum casino, play blackjack toward `$10b`, save after wins, and reload after a loss. Use `--no-reload` if you want a safer dry experiment that stops after the first losing hand:

```text
run lib/casino-lite.js --no-reload
```

`lib/orchestrator.js` is the early-game conductor. It tries darkweb purchases, roots servers, buys purchased servers, and starts `lib/hack-strat.js` if needed:

```text
run lib/orchestrator.js
run lib/orchestrator.js --target foodnstuff
run lib/orchestrator.js --strategy prep
run lib/orchestrator.js --home-reserve 64
run lib/orchestrator.js --share-fraction 0.1
run lib/orchestrator.js --stock
run lib/orchestrator.js --start-all
run lib/orchestrator.js --tail
run lib/orchestrator.js --restart-hack-strat
```

Run a one-shot cycle when you want to see what it would do without leaving it resident:

```text
run lib/orchestrator.js --once
orchonce
```

By default the orchestrator writes status to its script log instead of spamming the terminal. Use `--tail` or the `orchtail` alias to open log windows. Use `--terminal` only when you want terminal output too.
