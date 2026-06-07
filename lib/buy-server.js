import { hasFlag, loadReserveConfig, ram, spendableMoney } from "/helper/config.js";

const DEFAULT_BUDGET_FRACTION = 0.25;
const DEFAULT_MIN_RAM = 8;
const DEFAULT_REPLACE_MULTIPLIER = 2;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["budget", 0],
    ["min-ram", 0],
    ["max-ram", 0],
    ["reserve", -1],
    ["replace-multiplier", DEFAULT_REPLACE_MULTIPLIER],
    ["dry-run", false],
    ["quiet", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const positional = Array.isArray(options._) ? options._ : [];
  const reserveConfig = loadReserveConfig(ns);
  const budgetFraction = parseBudgetFraction(options.budget || positional[0], reserveConfig.servers.budget || DEFAULT_BUDGET_FRACTION);
  const minRam = ram(options["min-ram"] || positional[1] || reserveConfig.servers.minRam, DEFAULT_MIN_RAM);
  const maxConfiguredRam = ram(options["max-ram"] || reserveConfig.servers.maxRam, reserveConfig.servers.maxRam || ns.cloud.getRamLimit());
  const reserve = hasFlag(ns.args, "--reserve") ? Math.max(0, Number(options.reserve) || 0) : reserveConfig.moneyReserve;
  const replaceMultiplier = hasFlag(ns.args, "--replace-multiplier")
    ? Math.max(1, Number(options["replace-multiplier"]) || DEFAULT_REPLACE_MULTIPLIER)
    : reserveConfig.servers.replaceMultiplier;
  const dryRun = Boolean(options["dry-run"]);
  const quiet = Boolean(options.quiet);
  const budget = spendableMoney(ns, reserve) * budgetFraction;
  const maxRam = Math.min(ns.cloud.getRamLimit(), maxConfiguredRam);
  const purchased = ns.cloud.getServerNames()
    .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
    .sort((a, b) => a.ram - b.ram || a.host.localeCompare(b.host));
  const limit = ns.cloud.getServerLimit();
  const targetRam = chooseTargetRam(ns, budget, minRam, maxRam, purchased, limit, replaceMultiplier);

  if (targetRam <= 0) {
    log(ns, `buy-server: no useful purchase fits budget ${formatMoney(budget)} after reserve ${formatMoney(reserve)}.`, quiet);
    log(ns, `buy-server: ${minRam}GB costs ${formatMoney(ns.cloud.getServerCost(minRam))}.`, quiet);
    return;
  }

  const cost = ns.cloud.getServerCost(targetRam);

  if (purchased.length < limit) {
    const hostname = nextServerName(ns, targetRam);
    if (dryRun) {
      log(ns, `DRY buy-server: would purchase ${hostname} (${targetRam}GB) for ${formatMoney(cost)}.`, quiet);
      return;
    }

    const bought = ns.cloud.purchaseServer(hostname, targetRam);
    if (!bought) {
      log(ns, `buy-server: failed to purchase ${hostname} (${targetRam}GB).`, quiet);
      return;
    }

    log(ns, `buy-server: purchased ${bought} (${targetRam}GB) for ${formatMoney(cost)}.`, quiet);
    return;
  }

  const smallest = purchased[0];
  if (targetRam < smallest.ram * replaceMultiplier) {
    log(ns, `buy-server: fleet is full (${purchased.length}/${limit}).`, quiet);
    log(ns, `buy-server: holding until replacement is at least ${replaceMultiplier}x ${smallest.host} (${smallest.ram}GB).`, quiet);
    return;
  }

  if (dryRun) {
    log(ns, `DRY buy-server: would replace ${smallest.host} (${smallest.ram}GB) with ${targetRam}GB for ${formatMoney(cost)}.`, quiet);
    return;
  }

  ns.killall(smallest.host);
  if (!ns.cloud.deleteServer(smallest.host)) {
    log(ns, `buy-server: failed to delete ${smallest.host}; stop scripts there and try again.`, quiet);
    return;
  }

  const hostname = nextServerName(ns, targetRam);
  const bought = ns.cloud.purchaseServer(hostname, targetRam);
  if (!bought) {
    log(ns, `buy-server: deleted ${smallest.host}, but failed to purchase replacement.`, quiet);
    return;
  }

  log(ns, `buy-server: replaced ${smallest.host} (${smallest.ram}GB) with ${bought} (${targetRam}GB) for ${formatMoney(cost)}.`, quiet);
}

function chooseTargetRam(ns, budget, minRam, maxRam, purchased, limit, replaceMultiplier) {
  if (purchased.length < limit) {
    return largestAffordableRam(ns, budget, minRam, maxRam);
  }

  const smallestRam = purchased.length > 0 ? purchased[0].ram : minRam;
  const replacementMin = ram(smallestRam * replaceMultiplier, smallestRam * replaceMultiplier);
  return largestAffordableRam(ns, budget, Math.max(minRam, replacementMin), maxRam);
}

function parseBudgetFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
}

function largestAffordableRam(ns, budget, minRam, maxRam) {
  let best = 0;

  for (let ram = minRam; ram <= maxRam; ram *= 2) {
    if (ns.cloud.getServerCost(ram) <= budget) {
      best = ram;
    } else {
      break;
    }
  }

  return best;
}

function nextServerName(ns, ram) {
  const existing = new Set(ns.cloud.getServerNames());

  for (let index = 0; index < 1000; index++) {
    const name = `pserv-${ram}gb-${index}`;
    if (!existing.has(name)) return name;
  }

  return `pserv-${Date.now()}`;
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function log(ns, message, quiet) {
  ns.print(message);
  if (!quiet) ns.tprint(message);
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/buy-server.js [budget] [minRam] [--budget N] [--min-ram GB] [--max-ram GB] [--reserve MONEY] [--replace-multiplier N] [--dry-run] [--quiet]");
  ns.tprint("Buys the largest useful server inside budget, capped by reserve.json servers.maxRam unless overridden.");
}
