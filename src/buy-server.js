const DEFAULT_BUDGET_FRACTION = 0.25;
const DEFAULT_MIN_RAM = 8;

/** @param {NS} ns */
export async function main(ns) {
  const budgetFraction = parseBudgetFraction(ns.args[0], DEFAULT_BUDGET_FRACTION);
  const minRam = parseRam(ns.args[1], DEFAULT_MIN_RAM);
  const money = ns.getServerMoneyAvailable("home");
  const budget = money * budgetFraction;
  const maxRam = ns.cloud.getRamLimit();
  const targetRam = largestAffordableRam(ns, budget, minRam, maxRam);

  if (targetRam <= 0) {
    ns.tprint(`buy-server: no server >= ${minRam}GB fits budget ${formatMoney(budget)}.`);
    ns.tprint(`buy-server: ${minRam}GB costs ${formatMoney(ns.cloud.getServerCost(minRam))}.`);
    return;
  }

  const purchased = ns.cloud.getServerNames()
    .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
    .sort((a, b) => a.ram - b.ram || a.host.localeCompare(b.host));

  const limit = ns.cloud.getServerLimit();
  const cost = ns.cloud.getServerCost(targetRam);

  if (purchased.length < limit) {
    const hostname = nextServerName(ns, targetRam);
    const bought = ns.cloud.purchaseServer(hostname, targetRam);
    if (!bought) {
      ns.tprint(`buy-server: failed to purchase ${hostname} (${targetRam}GB).`);
      return;
    }

    ns.tprint(`buy-server: purchased ${bought} (${targetRam}GB) for ${formatMoney(cost)}.`);
    return;
  }

  const smallest = purchased[0];
  if (targetRam <= smallest.ram) {
    ns.tprint(`buy-server: fleet is full (${purchased.length}/${limit}).`);
    ns.tprint(`buy-server: budget fits ${targetRam}GB, but smallest server is already ${smallest.ram}GB.`);
    return;
  }

  ns.killall(smallest.host);
  if (!ns.cloud.deleteServer(smallest.host)) {
    ns.tprint(`buy-server: failed to delete ${smallest.host}; stop scripts there and try again.`);
    return;
  }

  const hostname = nextServerName(ns, targetRam);
  const bought = ns.cloud.purchaseServer(hostname, targetRam);
  if (!bought) {
    ns.tprint(`buy-server: deleted ${smallest.host}, but failed to purchase replacement.`);
    return;
  }

  ns.tprint(`buy-server: replaced ${smallest.host} (${smallest.ram}GB) with ${bought} (${targetRam}GB) for ${formatMoney(cost)}.`);
}

function parseBudgetFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
}

function parseRam(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(2, Math.pow(2, Math.floor(Math.log2(number))));
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
