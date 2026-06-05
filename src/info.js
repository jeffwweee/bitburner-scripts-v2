/** @param {NS} ns */
export async function main(ns) {
  const target = String(ns.args[0] || "home");

  if (!ns.serverExists(target)) {
    ns.tprint(`No such server: ${target}`);
    return;
  }

  const moneyMax = ns.getServerMaxMoney(target);
  const moneyNow = ns.getServerMoneyAvailable(target);
  const minSec = ns.getServerMinSecurityLevel(target);
  const secNow = ns.getServerSecurityLevel(target);
  const ramMax = ns.getServerMaxRam(target);
  const ramUsed = ns.getServerUsedRam(target);
  const requiredPorts = ns.getServerNumPortsRequired(target);
  const requiredHack = ns.getServerRequiredHackingLevel(target);

  ns.tprint(`Server: ${target}`);
  ns.tprint(`Root: ${ns.hasRootAccess(target) ? "yes" : "no"} | Backdoor: ${ns.getServer(target).backdoorInstalled ? "yes" : "no"}`);
  ns.tprint(`Hack level: ${requiredHack} required | ${ns.getHackingLevel()} current`);
  ns.tprint(`Ports: ${requiredPorts} required`);
  ns.tprint(`Money: ${formatMoney(ns, moneyNow)} / ${formatMoney(ns, moneyMax)} (${formatPercent(moneyNow, moneyMax)})`);
  ns.tprint(`Security: ${secNow.toFixed(2)} / ${minSec.toFixed(2)} min (+${(secNow - minSec).toFixed(2)})`);
  ns.tprint(`Growth: ${ns.getServerGrowth(target)}`);
  ns.tprint(`RAM: ${ramUsed.toFixed(2)} / ${ramMax.toFixed(2)} GB`);
}

function formatMoney(ns, value) {
  return ns.formatNumber ? `$${ns.formatNumber(value)}` : `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value, max) {
  if (max <= 0) return "n/a";
  return `${((value / max) * 100).toFixed(1)}%`;
}
