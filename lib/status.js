const WORKERS = {
  weaken: "worker/weaken.js",
  grow: "worker/grow.js",
  hack: "worker/hack.js",
};

const SHARE_WORKER = "worker/share.js";

const CONTROLLERS = [
  "lib/bootstrap.js",
  "lib/share.js",
  "lib/stock-trader.js",
  "lib/hack-strat.js",
  "lib/auto.js",
  "lib/orchestrator.js",
];

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["target", ""],
    ["workers", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const target = String(options.target || firstPositionalArg(options._) || detectTarget(ns) || "");

  printPlayerStatus(ns);
  printControllerStatus(ns);

  if (target) {
    printTargetStatus(ns, target);
  } else {
    ns.tprint("Target: none detected. Pass one explicitly: run lib/status.js foodnstuff");
  }

  printWorkerSummary(ns, target);
  printShareSummary(ns);

  if (options.workers) {
    printWorkerDetails(ns);
  }
}

function printPlayerStatus(ns) {
  ns.tprint(`Player: hack level ${ns.getHackingLevel()}, home money ${formatMoney(ns.getServerMoneyAvailable("home"))}`);
  ns.tprint(`Home RAM: ${ns.getServerUsedRam("home").toFixed(2)} / ${ns.getServerMaxRam("home").toFixed(2)} GB used`);
}

function printControllerStatus(ns) {
  const homeProcesses = ns.ps("home");
  const running = CONTROLLERS
    .map((script) => {
      const processes = homeProcesses.filter((process) => process.filename === script);
      if (processes.length === 0) return "";
      return `${script} x${processes.length}`;
    })
    .filter(Boolean);

  ns.tprint(`Controllers: ${running.length > 0 ? running.join(", ") : "none on home"}`);
}

function printTargetStatus(ns, target) {
  if (!ns.serverExists(target)) {
    ns.tprint(`Target: ${target} does not exist.`);
    return;
  }

  const money = ns.getServerMoneyAvailable(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const security = ns.getServerSecurityLevel(target);
  const minSecurity = ns.getServerMinSecurityLevel(target);

  ns.tprint(`Target: ${target}`);
  ns.tprint(`  root ${ns.hasRootAccess(target) ? "yes" : "no"}, req hack ${ns.getServerRequiredHackingLevel(target)}, ports ${ns.getServerNumPortsRequired(target)}`);
  ns.tprint(`  money ${formatMoney(money)} / ${formatMoney(maxMoney)} (${formatPercent(money, maxMoney)})`);
  ns.tprint(`  security ${security.toFixed(2)} / ${minSecurity.toFixed(2)} min (+${(security - minSecurity).toFixed(2)})`);
  ns.tprint(`  times hack ${formatTime(ns.getHackTime(target))}, grow ${formatTime(ns.getGrowTime(target))}, weaken ${formatTime(ns.getWeakenTime(target))}`);
  ns.tprint(`  hack chance ${formatPercent(ns.hackAnalyzeChance(target), 1)}, hack/thread ${formatPercent(ns.hackAnalyze(target), 1)}`);
}

function printWorkerSummary(ns, target) {
  const summary = summarizeWorkers(ns, target);
  const totalThreads = summary.weaken.threads + summary.grow.threads + summary.hack.threads;

  ns.tprint(`Workers${target ? ` for ${target}` : ""}: ${totalThreads} thread(s)`);
  ns.tprint(`  weaken: ${summary.weaken.processes} process(es), ${summary.weaken.threads} thread(s)`);
  ns.tprint(`  grow:   ${summary.grow.processes} process(es), ${summary.grow.threads} thread(s)`);
  ns.tprint(`  hack:   ${summary.hack.processes} process(es), ${summary.hack.threads} thread(s)`);

  if (totalThreads === 0) {
    ns.tprint("  WARN: no matching worker threads found. Check RAM, target choice, or controller logs with --tail.");
  }
}

function printShareSummary(ns) {
  const summary = summarizeShare(ns);
  const controllerRunning = ns.ps("home").some((process) => process.filename === "lib/share.js");
  const power = typeof ns.getSharePower === "function" ? ns.getSharePower() : 1;

  ns.tprint(`Share: ${summary.processes} process(es), ${summary.threads} thread(s), ${summary.ram.toFixed(2)}GB RAM, power x${power.toFixed(3)}`);
  if (controllerRunning && summary.threads === 0) {
    ns.tprint("  WARN: lib/share.js is running but worker/share.js has 0 threads. Try run lib/share.js --once --terminal.");
  } else if (!controllerRunning && summary.threads === 0) {
    ns.tprint("  INFO: share is not running. Start with run lib/share.js --terminal or run orchestrator without --no-share.");
  }
}

function printWorkerDetails(ns) {
  ns.tprint("Worker details:");

  let found = false;
  for (const host of discoverServers(ns)) {
    for (const process of ns.ps(host)) {
      if (!Object.values(WORKERS).includes(process.filename) && process.filename !== SHARE_WORKER) continue;

      found = true;
      ns.tprint(`  ${host}: ${process.filename} ${process.args.join(" ")} x${process.threads}`);
    }
  }

  if (!found) {
    ns.tprint("  none");
  }
}

function summarizeShare(ns) {
  const summary = { processes: 0, threads: 0, ram: 0 };

  for (const process of ns.ps("home")) {
    if (process.filename !== SHARE_WORKER) continue;

    summary.processes++;
    summary.threads += process.threads;
    summary.ram += ns.getScriptRam(process.filename, "home") * process.threads;
  }

  return summary;
}

function summarizeWorkers(ns, target) {
  const summary = {
    weaken: { processes: 0, threads: 0 },
    grow: { processes: 0, threads: 0 },
    hack: { processes: 0, threads: 0 },
  };

  for (const host of discoverServers(ns)) {
    for (const process of ns.ps(host)) {
      for (const [action, script] of Object.entries(WORKERS)) {
        if (process.filename !== script) continue;
        if (target && String(process.args[0] || "") !== target) continue;

        summary[action].processes++;
        summary[action].threads += process.threads;
      }
    }
  }

  return summary;
}

function detectTarget(ns) {
  for (const host of discoverServers(ns)) {
    for (const process of ns.ps(host)) {
      if (!Object.values(WORKERS).includes(process.filename)) continue;
      if (process.args.length > 0) return String(process.args[0]);
    }
  }

  return "";
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

function firstPositionalArg(args) {
  return Array.isArray(args) && args.length > 0 ? args[0] : "";
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function formatPercent(value, max) {
  if (max <= 0) return "n/a";
  return `${((value / max) * 100).toFixed(1)}%`;
}

function formatTime(milliseconds) {
  const seconds = milliseconds / 1000;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  return `${seconds.toFixed(1)}s`;
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/status.js [TARGET] [--target HOST] [--workers]");
  ns.tprint("Prints current player, controller, target, and worker status for troubleshooting early automation.");
}
