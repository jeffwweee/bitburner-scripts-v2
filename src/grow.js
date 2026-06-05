/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];

  if (!target) {
    ns.tprint("Usage: run src/grow.js TARGET");
    return;
  }

  ns.disableLog("ALL");
  ns.tprint(`growing ${target}`);

  while (true) {
    await ns.grow(target);
  }
}
