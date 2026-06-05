const WORKERS = {
  weaken: "src/weaken.js",
  grow: "src/grow.js",
  hack: "src/hack.js",
};

const SECURITY_BUFFER = 5;
const MONEY_BUFFER = 0.75;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["target", ""],
    ["tail", false],
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const requestedTarget = String(options.target || firstPositionalArg(options._) || "");
  let currentAction = "";
  let currentTarget = "";

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  while (true) {
    const target = requestedTarget || chooseTarget(ns);
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

function chooseTarget(ns) {
  const hackingLevel = ns.getHackingLevel();

  return discoverServers(ns)
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxMoney(host) > 0)
    .filter((host) => ns.getServerRequiredHackingLevel(host) <= hackingLevel)
    .sort((a, b) => scoreTarget(ns, b) - scoreTarget(ns, a))[0] || "";
}

function scoreTarget(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  const currentMoney = ns.getServerMoneyAvailable(host);
  const minSecurity = ns.getServerMinSecurityLevel(host);
  const security = ns.getServerSecurityLevel(host);
  const securityPenalty = 1 + Math.max(0, security - minSecurity) / 10;
  const moneyReadiness = Math.max(0.1, currentMoney / Math.max(1, maxMoney));
  const hackFraction = Math.max(0, ns.hackAnalyze(host));
  const hackChance = Math.max(0, ns.hackAnalyzeChance(host));
  const expectedHackValue = maxMoney * hackFraction * hackChance;
  const cycleTime = Math.max(1, ns.getHackTime(host) + ns.getGrowTime(host) + ns.getWeakenTime(host));

  return (expectedHackValue * moneyReadiness) / cycleTime / securityPenalty;
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
  ns.tprint("Usage: run src/auto.js [TARGET] [--target HOST] [--tail] [--terminal]");
  ns.tprint("Chooses a rooted money target, deploys weaken/grow/hack workers, and keeps the loop moving.");
}
