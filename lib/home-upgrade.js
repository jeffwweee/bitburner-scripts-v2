import { hasFlag, loadReserveConfig, spendableMoney } from "/helper/config.js";

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["budget", 0],
    ["reserve", -1],
    ["ram", true],
    ["cores", true],
    ["once", false],
    ["dry-run", false],
    ["quiet", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const singularity = ns.singularity;
  if (!singularity || typeof singularity.getUpgradeHomeRamCost !== "function") {
    log(ns, "home-upgrade: Singularity home upgrade APIs unavailable. Run this in BN4 or after SF4.", Boolean(options.quiet));
    return;
  }

  const reserveConfig = loadReserveConfig(ns);
  const reserve = hasFlag(ns.args, "--reserve") ? Math.max(0, Number(options.reserve) || 0) : reserveConfig.moneyReserve;
  const budgetFraction = hasFlag(ns.args, "--budget") ? parseFraction(options.budget, reserveConfig.home.budget) : reserveConfig.home.budget;
  const allowRam = hasFlag(ns.args, "--ram") ? Boolean(options.ram) : reserveConfig.home.ram;
  const allowCores = hasFlag(ns.args, "--cores") ? Boolean(options.cores) : reserveConfig.home.cores;
  const dryRun = Boolean(options["dry-run"]);
  const quiet = Boolean(options.quiet);
  let budget = spendableMoney(ns, reserve) * budgetFraction;
  let purchased = 0;

  while (budget > 0) {
    const next = chooseUpgrade(singularity, allowRam, allowCores, budget);
    if (!next) break;

    if (dryRun) {
      log(ns, `DRY home-upgrade: would buy ${next.name} for ${formatMoney(next.cost)}.`, quiet);
      purchased++;
      if (options.once) break;
      budget -= next.cost;
      continue;
    }

    const ok = next.buy();
    if (!ok) {
      log(ns, `home-upgrade: failed to buy ${next.name} for ${formatMoney(next.cost)}.`, quiet);
      break;
    }

    log(ns, `home-upgrade: bought ${next.name} for ${formatMoney(next.cost)}.`, quiet);
    purchased++;
    if (options.once) break;
    budget = spendableMoney(ns, reserve) * budgetFraction;
  }

  if (purchased === 0) {
    const ramCost = safeCall(() => singularity.getUpgradeHomeRamCost(), Number.POSITIVE_INFINITY);
    const coreCost = safeCall(() => singularity.getUpgradeHomeCoresCost(), Number.POSITIVE_INFINITY);
    log(ns, `home-upgrade: no upgrade fits budget ${formatMoney(budget)} after reserve ${formatMoney(reserve)}. RAM ${formatMoney(ramCost)}, core ${formatMoney(coreCost)}.`, quiet);
  }
}

function chooseUpgrade(singularity, allowRam, allowCores, budget) {
  const candidates = [];
  if (allowRam) {
    candidates.push({
      name: "home RAM",
      cost: safeCall(() => singularity.getUpgradeHomeRamCost(), Number.POSITIVE_INFINITY),
      buy: () => singularity.upgradeHomeRam(),
    });
  }
  if (allowCores) {
    candidates.push({
      name: "home core",
      cost: safeCall(() => singularity.getUpgradeHomeCoresCost(), Number.POSITIVE_INFINITY),
      buy: () => singularity.upgradeHomeCores(),
    });
  }

  return candidates
    .filter((candidate) => Number.isFinite(candidate.cost) && candidate.cost > 0 && candidate.cost <= budget)
    .sort((a, b) => a.cost - b.cost)[0] || null;
}

function parseFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (_) {
    return fallback;
  }
}

function log(ns, message, quiet) {
  ns.print(message);
  if (!quiet) ns.tprint(message);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/home-upgrade.js [--budget N] [--reserve MONEY] [--ram true|false] [--cores true|false] [--once] [--dry-run] [--quiet]");
  ns.tprint("Buys home RAM/CPU core upgrades using cash above reserve.json moneyReserve.");
}
