/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    ns.tprint("Usage: run worker/share.js [--terminal]");
    return;
  }

  ns.disableLog("ALL");
  log(ns, "sharing RAM for faction reputation", Boolean(options.terminal));

  while (true) {
    await ns.share();
  }
}

function log(ns, message, terminal) {
  ns.print(message);
  if (terminal) ns.tprint(message);
}
