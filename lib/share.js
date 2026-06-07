import { hasFlag, loadReserveConfig } from "/helper/config.js";

const WORKER = "worker/share.js";
const DEFAULT_FRACTION = 0.05;
const DEFAULT_HOME_RESERVE = 32;
const DEFAULT_INTERVAL = 60000;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["fraction", DEFAULT_FRACTION],
    ["home-reserve", DEFAULT_HOME_RESERVE],
    ["interval", DEFAULT_INTERVAL],
    ["once", false],
    ["tail", false],
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const reserveConfig = loadReserveConfig(ns);
  const fraction = hasFlag(ns.args, "--fraction") ? parseFraction(options.fraction, DEFAULT_FRACTION) : reserveConfig.shareFraction;
  const homeReserve = hasFlag(ns.args, "--home-reserve") ? Math.max(0, Number(options["home-reserve"]) || DEFAULT_HOME_RESERVE) : reserveConfig.homeRamReserve;
  const interval = Math.max(5000, Number(options.interval) || DEFAULT_INTERVAL);
  const terminal = Boolean(options.terminal);

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  do {
    await ensureShare(ns, fraction, homeReserve, terminal);

    if (options.once) return;
    await ns.sleep(interval);
  } while (true);
}

async function ensureShare(ns, fraction, homeReserve, terminal) {
  if (!ns.fileExists(WORKER, "home")) {
    log(ns, `share: missing ${WORKER}; run pull first.`, terminal);
    return;
  }

  const desiredThreads = getDesiredThreads(ns, fraction, homeReserve);
  const currentThreads = getCurrentThreads(ns);

  if (desiredThreads <= 0) {
    log(ns, getSizingMessage(ns, fraction, homeReserve, desiredThreads, currentThreads), terminal);
    return;
  }

  if (currentThreads === desiredThreads) {
    ns.print(`share: already running ${currentThreads} thread(s).`);
    return;
  }

  ns.scriptKill(WORKER, "home");
  const pid = ns.run(WORKER, desiredThreads);
  if (pid === 0) {
    log(ns, `share: failed to start ${WORKER} with ${desiredThreads} thread(s).`, terminal);
    return;
  }

  log(ns, `share: running ${desiredThreads} thread(s) on home (${Math.round(fraction * 100)}%, reserve ${homeReserve}GB).`, terminal);
}

function getDesiredThreads(ns, fraction, homeReserve) {
  const scriptRam = ns.getScriptRam(WORKER, "home");
  if (scriptRam <= 0) return 0;

  const targetRam = Math.max(0, ns.getServerMaxRam("home") - homeReserve) * fraction;
  return Math.floor(targetRam / scriptRam);
}

function getCurrentThreads(ns) {
  return ns.ps("home")
    .filter((process) => process.filename === WORKER)
    .reduce((threads, process) => threads + process.threads, 0);
}

function parseFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
}

function getSizingMessage(ns, fraction, homeReserve, desiredThreads, currentThreads) {
  const scriptRam = ns.getScriptRam(WORKER, "home");
  const targetRam = Math.max(0, ns.getServerMaxRam("home") - homeReserve) * fraction;
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

  return `share: not running. desired ${desiredThreads} thread(s), current ${currentThreads}, target ${targetRam.toFixed(2)}GB, script ${scriptRam.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB, reserve ${homeReserve}GB.`;
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
  ns.tprint("Usage: run lib/share.js [--fraction N] [--home-reserve GB] [--interval MS] [--once] [--tail] [--terminal]");
  ns.tprint("Keeps a small share worker running on home for faction reputation boost.");
  ns.tprint("Default fraction is 5% of home RAM available above the reserve.");
}
