/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    ns.tprint("Usage: run src/weaken.js TARGET [--terminal]");
    return;
  }

  const target = firstPositionalArg(options._);

  if (!target) {
    ns.tprint("Usage: run src/weaken.js TARGET");
    return;
  }

  ns.disableLog("ALL");
  log(ns, `weakening ${target}`, Boolean(options.terminal));

  while (true) {
    await ns.weaken(target);
  }
}

function firstPositionalArg(args) {
  return Array.isArray(args) && args.length > 0 ? args[0] : "";
}

function log(ns, message, terminal) {
  ns.print(message);
  if (terminal) ns.tprint(message);
}
