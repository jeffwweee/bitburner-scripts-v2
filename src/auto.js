const WORKERS = {
  weaken: "src/weaken.js",
  grow: "src/grow.js",
  hack: "src/hack.js",
};

const SECURITY_BUFFER = 5;
const MONEY_BUFFER = 0.75;
const DEFAULT_RANK_LIMIT = 10;

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
  let currentAction = "";
  let currentTarget = "";

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  while (true) {
    const target = requestedTarget || chooseTarget(ns, strategy);
    if (!target) {
      log(ns, "auto: no rooted money target found yet. Run src/root.js or gain access to more servers.", Boolean(options.terminal));
      await ns.sleep(30000);
      continue;
    }

    const action = chooseAction(ns, target);
    if (action !== currentAction || target !== currentTarget) {
      currentAction = action;
      currentTarget = target;
      await deploy(ns, action, target, Boolean(options.terminal));
    }

    ns.print(statusLine(ns, action, target));
    await ns.sleep(getActionDelay(ns, action, target));
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
    ns.tprint("auto rank: no rooted, hackable money servers found.");
    return;
  }

  ns.tprint(`auto target rankings (${strategy} strategy):`);
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

function chooseAction(ns, target) {
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const security = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const money = ns.getServerMoneyAvailable(target);

  if (security > minSecurity + SECURITY_BUFFER) return "weaken";
  if (maxMoney > 0 && money < maxMoney * MONEY_BUFFER) return "grow";
  return "hack";
}

async function deploy(ns, action, target, terminal) {
  const script = WORKERS[action];
  const servers = discoverServers(ns)
    .filter((host) => host !== "home")
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxRam(host) > 0);

  let launched = 0;
  let totalThreads = 0;

  for (const host of servers) {
    ns.killall(host);
    await ns.scp(script, host, "home");

    const threads = getThreadCount(ns, host, script);
    if (threads <= 0) continue;

    const pid = ns.exec(script, host, threads, target);
    if (pid !== 0) {
      launched++;
      totalThreads += threads;
    }
  }

  log(ns, `auto: ${action} ${target} on ${launched}/${servers.length} server(s), ${totalThreads} thread(s).`, terminal);
}

function statusLine(ns, action, target) {
  const money = ns.getServerMoneyAvailable(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const security = ns.getServerSecurityLevel(target);
  const minSecurity = ns.getServerMinSecurityLevel(target);

  return `${action} ${target}: money ${formatPercent(money, maxMoney)}, security +${(security - minSecurity).toFixed(2)}`;
}

function getActionDelay(ns, action, target) {
  if (action === "weaken") return Math.max(5000, ns.getWeakenTime(target));
  if (action === "grow") return Math.max(5000, ns.getGrowTime(target));
  return Math.max(5000, ns.getHackTime(target));
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
  ns.tprint("Usage: run src/auto.js [TARGET] [--target HOST] [--strategy current|prep] [--rank] [--top N] [--tail] [--terminal]");
  ns.tprint("Chooses a rooted money target, deploys weaken/grow/hack workers, and keeps the loop moving.");
  ns.tprint("Use --rank to print the target optimizer table without starting workers.");
}
