const WORKERS = {
  weaken: "worker/weaken.js",
  grow: "worker/grow.js",
  hack: "worker/hack.js",
};

const TARGETS = [
  "n00dles",
  "foodnstuff",
  "sigma-cosmetics",
  "joesguns",
  "hong-fang-tea",
];

const SECURITY_BUFFER = 5;
const MONEY_BUFFER = 0.75;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["target", ""],
    ["interval", 5000],
    ["tail", false],
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  const requestedTarget = String(options.target || firstPositionalArg(options._) || "");
  const interval = Math.max(1000, Number(options.interval) || 5000);
  let currentAction = "";
  let currentTarget = "";

  while (true) {
    const target = requestedTarget || chooseTarget(ns);
    if (!target) {
      log(ns, "bootstrap: no early target is ready yet. Try n00dles after gaining a few hacking levels.", Boolean(options.terminal));
      await ns.sleep(interval);
      continue;
    }

    const action = chooseAction(ns, target);
    if (action !== currentAction || target !== currentTarget || !isWorkerRunning(ns, action, target)) {
      currentAction = action;
      currentTarget = target;
      launchHomeWorker(ns, action, target, Boolean(options.terminal));
    }

    ns.print(statusLine(ns, action, target));
    await ns.sleep(Math.max(interval, getActionDelay(ns, action, target)));
  }
}

function chooseTarget(ns) {
  const hackingLevel = ns.getHackingLevel();

  for (const host of TARGETS) {
    if (!ns.serverExists(host)) continue;
    if (ns.getServerRequiredHackingLevel(host) > hackingLevel) continue;
    if (ns.getServerMaxMoney(host) <= 0) continue;

    if (!ns.hasRootAccess(host)) {
      if (ns.getServerNumPortsRequired(host) > 0) continue;

      try {
        ns.nuke(host);
      } catch (_) {
        continue;
      }
    }

    if (ns.hasRootAccess(host)) return host;
  }

  return "";
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

function launchHomeWorker(ns, action, target, terminal) {
  const script = WORKERS[action];
  stopHomeWorkers(ns);

  const threads = getHomeThreadCount(ns, script);
  if (threads <= 0) {
    log(ns, `bootstrap: not enough free home RAM for ${script}.`, terminal);
    return;
  }

  const pid = ns.run(script, threads, target);
  if (pid === 0) {
    log(ns, `bootstrap: failed to start ${script}.`, terminal);
    return;
  }

  log(ns, `bootstrap: ${action} ${target} on home with ${threads} thread(s).`, terminal);
}

function stopHomeWorkers(ns) {
  for (const script of Object.values(WORKERS)) {
    ns.scriptKill(script, "home");
  }
}

function isWorkerRunning(ns, action, target) {
  const script = WORKERS[action];
  return ns.ps("home").some((process) =>
    process.filename === script
    && process.args.length > 0
    && String(process.args[0]) === target
  );
}

function getHomeThreadCount(ns, script) {
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  const scriptRam = ns.getScriptRam(script, "home");
  if (scriptRam <= 0) return 0;
  return Math.floor(freeRam / scriptRam);
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

function firstPositionalArg(args) {
  return Array.isArray(args) && args.length > 0 ? args[0] : "";
}

function formatPercent(value, max) {
  if (max <= 0) return "n/a";
  return `${((value / max) * 100).toFixed(1)}%`;
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
  ns.tprint("Usage: run lib/bootstrap.js [TARGET] [--target HOST] [--interval MS] [--tail] [--terminal]");
  ns.tprint("Tiny fresh-save home-only loop. Picks n00dles/foodnstuff/etc, nukes 0-port targets, and runs one worker on home.");
  ns.tprint("Use this before lib/hack-strat.js or lib/orchestrator.js fit comfortably in RAM.");
}
