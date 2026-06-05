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
wget https://raw.githubusercontent.com/jeffwweee/bitburner-scripts-v2/master/repo-update.js repo-update.js
run repo-update.js
```

Recommended alias after the first successful run:

```text
alias pull="run repo-update.js"
alias orch="run src/orchestrator.js"
alias orchtail="run src/orchestrator.js --tail"
alias orchonce="run src/orchestrator.js --once"
```

After that, run `pull` in the Bitburner terminal to download the latest `manifest.json` and all files listed in it. Add new scripts to `manifest.json` when they should be pulled into the game.

`repo-update.js` adds a timestamp query to downloads so GitHub raw cache should not delay manifest or script updates.

## Early Game Commands

```text
run src/scan.js money
run src/root.js
run src/info.js foodnstuff
run src/deploy.js weaken foodnstuff
run src/deploy.js grow foodnstuff
run src/deploy.js hack foodnstuff
run src/buy-server.js
run src/darkweb.js
run src/orchestrator.js
run src/auto.js
```

`src/auto.js` chooses a rooted money target automatically. You can also force a target:

```text
run src/auto.js foodnstuff
```

`src/buy-server.js` spends a conservative slice of current cash on the largest purchased server it can afford. By default it uses 25% of available money and starts at 8GB:

```text
run src/buy-server.js
run src/buy-server.js 50
run src/buy-server.js 0.5 16
```

`src/darkweb.js` buys TOR and port opener programs when the Singularity API is available:

```text
run src/darkweb.js
run src/darkweb.js --budget 50
run src/darkweb.js --all
```

`src/orchestrator.js` is the early-game conductor. It tries darkweb purchases, roots servers, buys purchased servers, and keeps `src/auto.js` running:

```text
run src/orchestrator.js
run src/orchestrator.js --target foodnstuff
run src/orchestrator.js --tail
run src/orchestrator.js --restart-auto
```

Run a one-shot cycle when you want to see what it would do without leaving it resident:

```text
run src/orchestrator.js --once
orchonce
```

By default the orchestrator writes status to its script log instead of spamming the terminal. Use `--tail` or the `orchtail` alias to open log windows. Use `--terminal` only when you want terminal output too.
