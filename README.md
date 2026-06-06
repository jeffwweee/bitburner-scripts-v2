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
run lib/info.js foodnstuff
run lib/status.js foodnstuff
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

`lib/hack-strat.js` deploys workers to rooted non-home servers. It kills existing worker scripts when the selected action or target changes, but only adds workers when new servers become available. It does not run money workers on `home`; `home` is reserved for controllers.

`lib/buy-server.js` spends a conservative slice of current cash on the largest purchased server it can afford. By default it uses 25% of available money and starts at 8GB:

```text
run lib/buy-server.js
run lib/buy-server.js 50
run lib/buy-server.js 0.5 16
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
run lib/orchestrator.js --tail
run lib/orchestrator.js --restart-hack-strat
```

Run a one-shot cycle when you want to see what it would do without leaving it resident:

```text
run lib/orchestrator.js --once
orchonce
```

By default the orchestrator writes status to its script log instead of spamming the terminal. Use `--tail` or the `orchtail` alias to open log windows. Use `--terminal` only when you want terminal output too.
