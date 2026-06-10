import { DEFAULT_RESERVE_CONFIG, hasFlag, loadReserveConfig, saveReserveConfig, fraction, nonNegativeNumber, ram } from "/helper/config.js";

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["money", ""],
    ["home-ram", 0],
    ["share", 0],
    ["server-budget", 0],
    ["server-min-ram", 0],
    ["server-max-ram", 0],
    ["server-replace", 0],
    ["stock-budget", 0],
    ["stock-reserve", ""],
    ["stock-max-position", 0],
    ["darkweb-budget", 0],
    ["home-budget", 0],
    ["home-ram-upgrades", true],
    ["home-core-upgrades", true],
    ["reset", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const config = Boolean(options.reset) ? clone(DEFAULT_RESERVE_CONFIG) : loadReserveConfig(ns);
  let changed = Boolean(options.reset);

  if (hasFlag(ns.args, "--money")) {
    config.moneyReserve = parseMoney(options.money, config.moneyReserve);
    changed = true;
  }
  if (hasFlag(ns.args, "--home-ram")) {
    config.homeRamReserve = ram(options["home-ram"], config.homeRamReserve);
    changed = true;
  }
  if (hasFlag(ns.args, "--share")) {
    config.shareFraction = fraction(options.share, config.shareFraction);
    changed = true;
  }
  if (hasFlag(ns.args, "--server-budget")) {
    config.servers.budget = fraction(options["server-budget"], config.servers.budget);
    changed = true;
  }
  if (hasFlag(ns.args, "--server-min-ram")) {
    config.servers.minRam = ram(options["server-min-ram"], config.servers.minRam);
    changed = true;
  }
  if (hasFlag(ns.args, "--server-max-ram")) {
    config.servers.maxRam = ram(options["server-max-ram"], config.servers.maxRam);
    changed = true;
  }
  if (hasFlag(ns.args, "--server-replace")) {
    config.servers.replaceMultiplier = Math.max(1, Number(options["server-replace"]) || config.servers.replaceMultiplier);
    changed = true;
  }
  if (hasFlag(ns.args, "--stock-budget")) {
    config.stocks.budget = fraction(options["stock-budget"], config.stocks.budget);
    changed = true;
  }
  if (hasFlag(ns.args, "--stock-reserve")) {
    config.stocks.reserve = parseMoney(options["stock-reserve"], config.moneyReserve);
    changed = true;
  }
  if (hasFlag(ns.args, "--stock-max-position")) {
    config.stocks.maxPosition = fraction(options["stock-max-position"], config.stocks.maxPosition);
    changed = true;
  }
  if (hasFlag(ns.args, "--darkweb-budget")) {
    config.darkweb.budget = fraction(options["darkweb-budget"], config.darkweb.budget);
    changed = true;
  }
  if (hasFlag(ns.args, "--home-budget")) {
    config.home.budget = fraction(options["home-budget"], config.home.budget);
    changed = true;
  }
  if (hasFlag(ns.args, "--home-ram-upgrades")) {
    config.home.ram = Boolean(options["home-ram-upgrades"]);
    changed = true;
  }
  if (hasFlag(ns.args, "--home-core-upgrades")) {
    config.home.cores = Boolean(options["home-core-upgrades"]);
    changed = true;
  }

  if (changed) {
    saveReserveConfig(ns, config);
    ns.tprint("reserve: saved reserve.json.");
  }

  printConfig(ns, loadReserveConfig(ns));
}

function parseMoney(value, fallback) {
  if (typeof value === "number") return nonNegativeNumber(value, fallback);

  const text = String(value).trim().toLowerCase();
  const match = text.match(/^([0-9]*\.?[0-9]+)\s*([kmbtq]?)$/);
  if (!match) return nonNegativeNumber(value, fallback);

  const amount = Number(match[1]);
  const suffix = match[2];
  const multiplier = suffix === "q" ? 1e15
    : suffix === "t" ? 1e12
      : suffix === "b" ? 1e9
        : suffix === "m" ? 1e6
          : suffix === "k" ? 1e3
            : 1;

  return Math.max(0, amount * multiplier);
}

function printConfig(ns, config) {
  ns.tprint(`reserve: money ${formatMoney(config.moneyReserve)}, home RAM ${config.homeRamReserve}GB, share ${formatPercent(config.shareFraction)}.`);
  ns.tprint(`reserve: servers budget ${formatPercent(config.servers.budget)}, min ${config.servers.minRam}GB, max ${config.servers.maxRam}GB, replace ${config.servers.replaceMultiplier}x.`);
  ns.tprint(`reserve: stocks reserve ${formatMoney(config.stocks.reserve)}, budget ${formatPercent(config.stocks.budget)}, max position ${formatPercent(config.stocks.maxPosition)}.`);
  ns.tprint(`reserve: darkweb budget ${formatPercent(config.darkweb.budget)}.`);
  ns.tprint(`reserve: home budget ${formatPercent(config.home.budget)}, RAM ${config.home.ram ? "on" : "off"}, cores ${config.home.cores ? "on" : "off"}.`);
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/reserve.js [options]");
  ns.tprint("Shows or updates reserve.json. Examples:");
  ns.tprint("  run lib/reserve.js --money 500m --home-ram 128 --share 0.15");
  ns.tprint("  run lib/reserve.js --server-max-ram 1024 --server-budget 0.25");
  ns.tprint("  run lib/reserve.js --stock-reserve 500m --stock-budget 0.8");
  ns.tprint("  run lib/reserve.js --home-budget 0.35 --home-ram-upgrades true --home-core-upgrades true");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
