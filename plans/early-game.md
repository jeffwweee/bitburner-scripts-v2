# Early Game Plan

## Assumptions

- Save is fresh or near-fresh.
- Home RAM is limited, so scripts should be tiny and composable.
- The first priority is reliable money and hacking XP, not perfect optimization.
- We want enough automation that Jef can run one command, watch progress, and make only occasional purchase decisions.

## Phase 0 - Bootstrap

Goal: make the repo easy to pull into Bitburner.

Already started:

- `lib/repo-update.js` downloads every file listed in `manifest.json`.
- `manifest.json` is the explicit list of in-game files.

Next actions:

- Keep player-facing Bitburner scripts under `lib/`, worker scripts under `worker/`, and reusable modules under `helper/`.
- Add new runnable scripts to `manifest.json`.
- In Bitburner, run:

```text
wget https://raw.githubusercontent.com/jeffwweee/bitburner-scripts-v2/master/lib/repo-update.js lib/repo-update.js
run lib/repo-update.js
alias pull="run lib/repo-update.js"
```

Exit criteria:

- Running `pull` in the Bitburner terminal refreshes the local scripts.

## Phase 1 - Tiny Manual Toolkit

Goal: get a few simple scripts that are easy to understand and useful immediately.

Build:

- `worker/weaken.js`: loop `weaken(target)`.
- `worker/grow.js`: loop `grow(target)`.
- `worker/hack.js`: loop `hack(target)`.
- `lib/bootstrap.js`: tiny home-only fresh-save loop for when `hack-strat.js` and `orchestrator.js` do not fit yet.
- `worker/share.js`: optional loop for faction work later.
- `lib/info.js`: print useful facts for a target, including money, security, required hacking level, growth, and available RAM.

How to use:

- Start with low-level targets such as `n00dles`, `foodnstuff`, `sigma-cosmetics`, `joesguns`, and `hong-fang-tea`.
- Prefer targets where required hacking level is comfortably below Jef's current level.
- If security is high, weaken first.
- If money is low, grow next.
- Hack only when money is near max and security is near minimum.

Exit criteria:

- Jef can manually run weaken/grow/hack loops against a target.
- Jef can run `lib/bootstrap.js` on a fresh save or NG+ until enough RAM exists for `lib/hack-strat.js`.
- Jef can inspect a server before choosing what to run.

## Phase 2 - Network Discovery

Goal: stop manually remembering where servers are.

Build:

- `lib/scan.js`: recursively scan the network and print a sorted table.
- Include hostname, required hacking level, money max, min security, current security, required ports, RAM, and whether root access exists.
- Optionally support arguments:
  - `run scan.js`
  - `run scan.js money`
  - `run scan.js hackable`

Player actions:

- Buy TOR as soon as it is affordable without stalling home RAM too badly.
- Buy port openers in roughly this order:
  - `BruteSSH.exe`
  - `FTPCrack.exe`
  - `relaySMTP.exe`
  - `HTTPWorm.exe`
  - `SQLInject.exe`

Exit criteria:

- Jef can see the best available servers and what tool unlocks are needed next.

## Phase 3 - Root Access Automation

Goal: automatically open ports and nuke servers as tools unlock.

Build:

- `lib/root.js`: scan all servers, run available port openers, call `nuke()`, and report newly rooted servers.
- It should be safe to run repeatedly.

Player actions:

- Run `root.js` after buying each port opener.
- Keep an eye on the newly unlocked targets from `scan.js`.

Exit criteria:

- Most reachable servers with enough port openers are rooted automatically.

## Phase 4 - Basic Remote Deployer

Goal: use rooted server RAM without manually copying scripts everywhere.

Build:

- `lib/deploy.js`: copy worker scripts to rooted servers and fill their RAM with one chosen action against one chosen target.
- First version can be simple:
  - kill existing scripts on rooted purchased/non-home servers
  - copy `weaken.js`, `grow.js`, `hack.js`
  - calculate max threads
  - run the requested worker

Example:

```text
run deploy.js weaken foodnstuff
run deploy.js grow foodnstuff
run deploy.js hack foodnstuff
```

Exit criteria:

- Jef can point the entire rooted network at one action and target.

## Phase 5 - First Coordinator

Goal: replace manual weaken/grow/hack decisions with a simple loop.

Build:

- `lib/hack-strat.js`: choose a target and dispatch workers in a conservative mixed cycle:
  - weaken if security is above minimum by a threshold
  - grow plus some weaken if money is below a threshold
  - hack/grow/weaken mix if money and security are healthy
- Keep it intentionally simple at first. One target, one global mode, no fancy timing.

Suggested thresholds:

- Weaken when `security > minSecurity + 5`.
- Grow phase when `money < maxMoney * 0.75`: 80% grow, 20% weaken.
- Harvest phase when `money >= maxMoney * 0.75` and security is acceptable: 15% hack, 60% grow, 25% weaken.

Exit criteria:

- Jef can run one script and earn money/XP continuously.

## Phase 6 - Purchases And Progression

Goal: turn early income into compounding power.

Priorities:

- Upgrade home RAM when scripts are constrained.
- Buy TOR and port openers when affordable.
- Buy purchased servers once income is stable.
- Start with modest purchased servers, then replace them later.
- Begin faction/company goals once the money loop is stable.

Build later:

- `lib/buy-server.js`: buy the largest affordable server within a budget.
- `lib/upgrade-home.js`: print recommended home RAM/core purchase when affordable.
- `lib/next.js`: summarize recommended next actions from current game state.
- `lib/darkweb.js`: purchase TOR and hacking programs when Singularity access is available.
- `lib/orchestrator.js`: coordinate darkweb purchases, rooting, server buying, and the money loop.

## First Build Slice

Implement these first, in order:

1. `worker/weaken.js`
2. `worker/grow.js`
3. `worker/hack.js`
4. `lib/info.js`
5. `lib/scan.js`
6. `lib/root.js`
7. update `manifest.json`

This gives us a useful toolkit before we build smarter automation.

## Definition Of Done For Early Game Foundation

- `pull` updates every script in Bitburner.
- `scan.js` shows useful targets.
- `root.js` gains root where possible.
- worker scripts run locally and remotely.
- `deploy.js` can use rooted RAM.
- `hack-strat.js` can keep money and XP flowing with minimal attention.
- `orchestrator.js` can keep early-game infrastructure progressing with one command.
