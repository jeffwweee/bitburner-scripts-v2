/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];

  if (!target) {
    ns.tprint("Usage: run src/hack.js TARGET");
    return;
  }

  ns.disableLog("ALL");
  ns.tprint(`hacking ${target}`);

  while (true) {
    await ns.hack(target);
  }
}
