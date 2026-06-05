/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];

  if (!target) {
    ns.tprint("Usage: run src/weaken.js TARGET");
    return;
  }

  ns.disableLog("ALL");
  ns.tprint(`weakening ${target}`);

  while (true) {
    await ns.weaken(target);
  }
}
