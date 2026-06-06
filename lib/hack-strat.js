const WORKERS = {
  weaken: "worker/weaken.js",
  grow: "worker/grow.js",
  hack: "worker/hack.js",
};

const SECURITY_BUFFER = 5;
const MONEY_BUFFER = 0.75;
const DEFAULT_RANK_LIMIT = 10;
const ACTION_DELIMITER = ",";

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["target", ""],
    ["strategy", "current"],
    ["rank", false],
    ["top", DEFAULT_RANK_LIMIT],
    ["tail", false],
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const requestedTarget = String(options.target || firstPositionalArg(options._) || "");
  if (options.rank) {
    printRankings(ns, Number(options.top) || DEFAULT_RANK_LIMIT, normalizeStrategy(options.strategy));
    return;
  }

  const strategy = normalizeStrategy(options.strategy);
  let currentPlanKey = "";
  let currentTarget = "";
  let currentFleet = "";

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  while (true) {
    const target = requestedTarget || chooseTarget(ns, strategy);
    if (!target) {
      log(ns, "hack-strat: no rooted money target found yet. Run lib/root.js or gain access to more servers.", Boolean(options.terminal));
      await ns.sleep(30000);
      continue;
    }

    const plan = choosePlan(ns, target);
    const fleet = getFleetKey(ns);
    if (plan.key !== currentPlanKey || target !== currentTarget) {
      currentPlanKey = plan.key;
      currentTarget = target;
      currentFleet = fleet;
      await deploy(ns, plan, target, Boolean(options.terminal), true);
    } else if (fleet !== currentFleet) {
      currentFleet = fleet;
      await deploy(ns, plan, target, Boolean(options.terminal), false);
    }

    ns.print(statusLine(ns, plan, target));
    await ns.sleep(getPlanDelay(ns, plan, target));
  }
}

function chooseTarget(ns, strategy) {
  return getRankedTargets(ns, strategy)[0]?.host || "";
}

function scoreTarget(ns, host) {
  return analyzeTarget(ns, host).score;
}

function getRankedTargets(ns, strategy = "current") {
  const hackingLevel = ns.getHackingLevel();

  return discoverServers(ns)
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxMoney(host) > 0)
    .filter((host) => ns.getServerRequiredHackingLevel(host) <= hackingLevel)
    .map((host) => analyzeTarget(ns, host))
    .filter((target) => target.score > 0)
    .sort((a, b) => compareTargets(a, b, strategy));
}

function analyzeTarget(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  const currentMoney = ns.getServerMoneyAvailable(host);
  const minSecurity = ns.getServerMinSecurityLevel(host);
  const security = ns.getServerSecurityLevel(host);
  const securityDelta = Math.max(0, security - minSecurity);
  const moneyRatio = maxMoney > 0 ? currentMoney / maxMoney : 0;
  const hackFraction = Math.max(0, ns.hackAnalyze(host));
  const hackChance = Math.max(0, ns.hackAnalyzeChance(host));
  const expectedHackValue = maxMoney * hackFraction * hackChance;
  const hackTime = ns.getHackTime(host);
  const growTime = ns.getGrowTime(host);
  const weakenTime = ns.getWeakenTime(host);
  const cycleTime = Math.max(1, hackTime + growTime + weakenTime);
  const preparedValuePerSecond = expectedHackValue / (cycleTime / 1000);

  const prepPenalty = 1
    + securityDelta / 25
    + Math.max(0, 1 - moneyRatio);

  return {
    host,
    score: preparedValuePerSecond / prepPenalty,
    preparedValuePerSecond,
    maxMoney,
    moneyRatio,
    securityDelta,
    hackChance,
    hackFraction,
    expectedHackValue,
    cycleTime,
  };
}

function compareTargets(a, b, strategy) {
  if (strategy === "prep") {
    if (b.preparedValuePerSecond !== a.preparedValuePerSecond) {
      return b.preparedValuePerSecond - a.preparedValuePerSecond;
    }
  }

  if (b.score !== a.score) return b.score - a.score;
  return b.maxMoney - a.maxMoney;
}

function normalizeStrategy(value) {
  const strategy = String(value || "current").toLowerCase();
  if (strategy === "prep" || strategy === "prepared") return "prep";
  return "current";
}

function printRankings(ns, limit, strategy) {
  const ranked = getRankedTargets(ns, strategy).slice(0, Math.max(1, limit));
  if (ranked.length === 0) {
    ns.tprint("hack-strat rank: no rooted, hackable money servers found.");
    return;
  }

  ns.tprint(`hack-strat target rankings (${strategy} strategy):`);
  ns.tprint("host                 score/s    prepped/s  maxMoney      money   sec+   chance  hack%");

  for (const target of ranked) {
    ns.tprint([
      pad(target.host, 20),
      pad(formatNumber(target.score), 10),
      pad(formatMoneyPerSecond(target.preparedValuePerSecond), 10),
      pad(formatMoney(target.maxMoney), 13),
      pad(formatPercent(target.moneyRatio, 1), 7),
      pad(target.securityDelta.toFixed(1), 6),
      pad(formatPercent(target.hackChance, 1), 7),
      formatPercent(target.hackFraction, 1),
    ].join(" "));
  }
}

function choosePlan(ns, target) {
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const security = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const money = ns.getServerMoneyAvailable(target);
  const securityDelta = security - minSecurity;

  if (securityDelta > SECURITY_BUFFER) {
    return makePlan("weaken", { weaken: 1, grow: 0, hack: 0 });
  }

  if (maxMoney > 0 && money < maxMoney * MONEY_BUFFER) {
    return makePlan("grow", { weaken: 0.2, grow: 0.8, hack: 0 });
  }

  return makePlan("harvest", { weaken: 0.25, grow: 0.6, hack: 0.15 });
}

function makePlan(name, weights) {
  return {
    name,
    weights,
    key: `${name}:${weights.weaken}:${weights.grow}:${weights.hack}`,
  };
}

async function deploy(ns, plan, target, terminal, fullRedeploy) {
  const servers = discoverServers(ns)
    .filter((host) => host !== "home")
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxRam(host) > 0);

  const totals = { weaken: 0, grow: 0, hack: 0 };
  let touched = 0;
  let alreadyRunning = 0;
  let noRam = 0;

  for (const host of servers) {
    const allocations = getThreadAllocations(ns, host, plan);
    if (getTotalAllocatedThreads(allocations) <= 0) {
      noRam++;
      continue;
    }

    if (!fullRedeploy && hasMatchingPlan(ns, host, allocations, target)) {
      alreadyRunning++;
      continue;
    }

    killWorkerScripts(ns, host);

    await ns.scp(Object.values(WORKERS), host, "home");

    let launchedOnHost = false;
    for (const [action, threads] of Object.entries(allocations)) {
      if (threads <= 0) continue;

      const pid = ns.exec(WORKERS[action], host, threads, target);
      if (pid !== 0) {
        launchedOnHost = true;
        totals[action] += threads;
      }
    }

    if (launchedOnHost) touched++;
  }

  const mode = fullRedeploy ? "deployed" : "added";
  log(ns, `hack-strat: ${mode} ${plan.name} ${target} on ${touched}/${servers.length} server(s): ${formatPlanTotals(totals)}. already running ${alreadyRunning}, no RAM ${noRam}.`, terminal);
}

function getThreadAllocations(ns, host, plan) {
  const growScriptRam = ns.getScriptRam(WORKERS.grow, host);
  const availableRam = getAvailableRamAfterClearingWorkers(ns, host);

  if (growScriptRam <= 0 || availableRam <= 0) {
    return { weaken: 0, grow: 0, hack: 0 };
  }

  const totalThreads = Math.floor(availableRam / growScriptRam);
  if (totalThreads <= 0) {
    return { weaken: 0, grow: 0, hack: 0 };
  }

  return allocateThreads(totalThreads, plan.weights);
}

function getAvailableRamAfterClearingWorkers(ns, host) {
  return ns.getServerMaxRam(host) - ns.getServerUsedRam(host) + getWorkerRamUsed(ns, host);
}

function getWorkerRamUsed(ns, host) {
  let ram = 0;

  for (const process of ns.ps(host)) {
    if (!Object.values(WORKERS).includes(process.filename)) continue;
    ram += ns.getScriptRam(process.filename, host) * process.threads;
  }

  return ram;
}

function allocateThreads(totalThreads, weights) {
  const allocations = { weaken: 0, grow: 0, hack: 0 };
  const weightedActions = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);

  if (weightedActions.length === 0) return allocations;
  if (totalThreads < weightedActions.length) {
    allocations[weightedActions[0][0]] = totalThreads;
    return allocations;
  }

  let remaining = totalThreads;
  for (const [action, weight] of weightedActions) {
    const threads = Math.max(1, Math.floor(totalThreads * weight));
    allocations[action] = threads;
    remaining -= threads;
  }

  while (remaining > 0) {
    allocations[weightedActions[0][0]]++;
    remaining--;
  }

  while (remaining < 0) {
    for (let index = weightedActions.length - 1; index >= 0 && remaining < 0; index--) {
      const action = weightedActions[index][0];
      if (allocations[action] > 1) {
        allocations[action]--;
        remaining++;
      }
    }
  }

  return allocations;
}

function getTotalAllocatedThreads(allocations) {
  return allocations.weaken + allocations.grow + allocations.hack;
}

function hasMatchingPlan(ns, host, allocations, target) {
  return workerPlanSignature(ns, host) === planSignature(allocations, target);
}

function killWorkerScripts(ns, host) {
  for (const script of Object.values(WORKERS)) {
    ns.scriptKill(script, host);
  }
}

function statusLine(ns, plan, target) {
  const money = ns.getServerMoneyAvailable(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const security = ns.getServerSecurityLevel(target);
  const minSecurity = ns.getServerMinSecurityLevel(target);

  return `${plan.name} ${target} [${formatWeights(plan.weights)}]: money ${formatPercent(money, maxMoney)}, security +${(security - minSecurity).toFixed(2)}`;
}

function getPlanDelay(ns, plan, target) {
  let delay = 5000;
  if (plan.weights.weaken > 0) delay = Math.max(delay, ns.getWeakenTime(target));
  if (plan.weights.grow > 0) delay = Math.max(delay, ns.getGrowTime(target));
  if (plan.weights.hack > 0) delay = Math.max(delay, ns.getHackTime(target));
  return delay;
}

function discoverServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  for (let index = 0; index < queue.length; index++) {
    const host = queue[index];
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return [...seen];
}

function getThreadCount(ns, host, script) {
  const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  const scriptRam = ns.getScriptRam(script, host);
  if (scriptRam <= 0) return 0;
  return Math.floor(freeRam / scriptRam);
}

function workerPlanSignature(ns, host) {
  const allocations = { weaken: 0, grow: 0, hack: 0 };
  let target = "";

  for (const process of ns.ps(host)) {
    for (const [action, script] of Object.entries(WORKERS)) {
      if (process.filename !== script) continue;

      const processTarget = String(process.args[0] || "");
      if (!target) target = processTarget;
      if (target !== processTarget) return "mixed-target";

      allocations[action] += process.threads;
    }
  }

  return planSignature(allocations, target);
}

function planSignature(allocations, target) {
  return [
    target,
    allocations.weaken,
    allocations.grow,
    allocations.hack,
  ].join(ACTION_DELIMITER);
}

function getFleetKey(ns) {
  return discoverServers(ns)
    .filter((host) => host !== "home")
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxRam(host) > 0)
    .map((host) => `${host}:${ns.getServerMaxRam(host)}`)
    .sort()
    .join("|");
}

function formatPercent(value, max) {
  if (max <= 0) return "n/a";
  return `${((value / max) * 100).toFixed(1)}%`;
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function formatMoneyPerSecond(value) {
  return `${formatMoney(value)}/s`;
}

function formatNumber(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(2);
}

function formatWeights(weights) {
  return Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .map(([action, weight]) => `${action}:${Math.round(weight * 100)}%`)
    .join(" ");
}

function formatPlanTotals(totals) {
  return `weaken ${totals.weaken}, grow ${totals.grow}, hack ${totals.hack} thread(s)`;
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function firstPositionalArg(args) {
  return Array.isArray(args) && args.length > 0 ? args[0] : "";
}

function log(ns, message, terminal) {
  ns.print(message);
  if (terminal) ns.tprint(message);
}

function maybeOpenTail(ns, shouldOpen) {
  if (!shouldOpen) return;
  if (ns.ui && typeof ns.ui.openTail === "function") {
    ns.ui.openTail();
  } else if (typeof ns.tail === "function") {
    ns.tail();
  }
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/hack-strat.js [TARGET] [--target HOST] [--strategy current|prep] [--rank] [--top N] [--tail] [--terminal]");
  ns.tprint("Chooses a rooted money target, deploys weaken/grow/hack workers, and keeps the loop moving.");
  ns.tprint("Use --rank to print the target optimizer table without starting workers.");
}
