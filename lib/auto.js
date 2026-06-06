/** @param {NS} ns */
export async function main(ns) {
  const script = "lib/hack-strat.js";

  ns.tprint("lib/auto.js has moved to lib/hack-strat.js.");
  ns.tprint(`Starting: run ${script} ${ns.args.join(" ")}`.trim());

  if (!ns.fileExists(script, "home")) {
    ns.tprint("Missing lib/hack-strat.js. Run pull first.");
    return;
  }

  const ramNeeded = ns.getScriptRam(script, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ramNeeded > freeRam) {
    ns.tprint(`Not enough home RAM for ${script}; needs ${ramNeeded.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB.`);
    return;
  }

  const pid = ns.run(script, 1, ...ns.args);
  if (pid === 0) {
    ns.tprint(`Failed to start ${script}.`);
  }
}
