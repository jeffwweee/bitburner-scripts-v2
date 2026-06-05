const TOR_COST = 200000;

const PORT_PROGRAMS = [
  "BruteSSH.exe",
  "FTPCrack.exe",
  "relaySMTP.exe",
  "HTTPWorm.exe",
  "SQLInject.exe",
];

const EXTRA_PROGRAMS = [
  "AutoLink.exe",
  "DeepscanV1.exe",
  "DeepscanV2.exe",
  "ServerProfiler.exe",
  "Formulas.exe",
];

const FALLBACK_PROGRAM_COSTS = {
  "BruteSSH.exe": 500000,
  "FTPCrack.exe": 1500000,
  "relaySMTP.exe": 5000000,
  "HTTPWorm.exe": 30000000,
  "SQLInject.exe": 250000000,
  "DeepscanV1.exe": 500000,
  "AutoLink.exe": 1000000,
  "ServerProfiler.exe": 500000,
  "DeepscanV2.exe": 25000000,
  "Formulas.exe": 5000000000,
};

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["budget", 0.35],
    ["all", false],
    ["dry-run", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  if (!ns.singularity || typeof ns.singularity.purchaseTor !== "function") {
    ns.tprint("darkweb: Singularity API is unavailable. Buy TOR/programs manually until Source-File 4 or BitNode 4 access is available.");
    return;
  }

  const budgetFraction = parseBudgetFraction(options.budget, 0.35);
  const dryRun = Boolean(options["dry-run"]);
  const startingMoney = ns.getServerMoneyAvailable("home");
  const budget = startingMoney * budgetFraction;
  let spent = 0;

  if (!hasTor(ns)) {
    if (TOR_COST > budget) {
      ns.tprint(`darkweb: skipping TOR; ${formatMoney(TOR_COST)} exceeds budget ${formatMoney(budget)}.`);
      return;
    }

    if (dryRun) {
      ns.tprint(`DRY buy TOR router for ${formatMoney(TOR_COST)}`);
      spent += TOR_COST;
    } else if (ns.singularity.purchaseTor()) {
      ns.tprint(`darkweb: purchased TOR router for ${formatMoney(TOR_COST)}.`);
      spent += TOR_COST;
    } else {
      ns.tprint("darkweb: could not purchase TOR router yet.");
      return;
    }
  }

  if (!hasTor(ns) && !dryRun) {
    ns.tprint("darkweb: TOR router is still unavailable.");
    return;
  }

  const programs = Boolean(options.all) ? [...PORT_PROGRAMS, ...EXTRA_PROGRAMS] : PORT_PROGRAMS;
  for (const program of programs) {
    if (ns.fileExists(program, "home")) continue;

    const cost = getProgramCost(ns, program);
    if (spent + cost > budget) {
      ns.tprint(`darkweb: budget holds before ${program} (${formatMoney(cost)}).`);
      continue;
    }

    if (dryRun) {
      ns.tprint(`DRY buy ${program} for ${formatMoney(cost)}`);
      spent += cost;
      continue;
    }

    try {
      if (ns.singularity.purchaseProgram(program)) {
        ns.tprint(`darkweb: purchased ${program} for ${formatMoney(cost)}.`);
        spent += cost;
      }
    } catch (error) {
      ns.tprint(`darkweb: failed to buy ${program}: ${String(error)}`);
    }
  }

  ns.tprint(`darkweb: spent up to ${formatMoney(spent)} from budget ${formatMoney(budget)}.`);
}

function hasTor(ns) {
  return typeof ns.hasTorRouter === "function" && ns.hasTorRouter();
}

function getProgramCost(ns, program) {
  if (ns.singularity && typeof ns.singularity.getDarkwebProgramCost === "function") {
    try {
      const cost = ns.singularity.getDarkwebProgramCost(program);
      if (Number.isFinite(cost) && cost > 0) return cost;
    } catch (_) {
      // Fall back to the known early-game prices below.
    }
  }

  return FALLBACK_PROGRAM_COSTS[program] || Number.MAX_SAFE_INTEGER;
}

function parseBudgetFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function printHelp(ns) {
  ns.tprint("Usage: run src/darkweb.js [--budget FRACTION_OR_PERCENT] [--all] [--dry-run]");
  ns.tprint("Buys TOR and port opener programs when Singularity access is available.");
  ns.tprint("Default budget is 35% of current home money. Use --all to include utility programs and Formulas.exe.");
}
