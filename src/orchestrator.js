const SCRIPTS = {
  darkweb: "src/darkweb.js",
  root: "src/root.js",
  buyServer: "src/buy-server.js",
  auto: "src/auto.js",
};

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["interval", 60000],
    ["budget", 0.25],
    ["darkweb-budget", 0.35],
    ["min-ram", 8],
    ["target", ""],
    ["once", false],
    ["restart-auto", false],
    ["no-auto", false],
    ["no-buy", false],
    ["no-darkweb", false],
    ["no-root", false],
    ["dry-run", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const interval = Math.max(5000, Number(options.interval) || 60000);
  const target = String(options.target || "");

  ns.disableLog("sleep");
  ns.disableLog("getServerMoneyAvailable");

  do {
    ns.tprint(`orchestrator: cycle start, home money ${formatMoney(ns.getServerMoneyAvailable("home"))}.`);

    if (!options["no-darkweb"]) {
      await runChild(ns, SCRIPTS.darkweb, ["--budget", options["darkweb-budget"], options["dry-run"] ? "--dry-run" : ""].filter(Boolean));
    }

    if (!options["no-root"]) {
      await runChild(ns, SCRIPTS.root, []);
    }

    if (!options["no-buy"]) {
      await runChild(ns, SCRIPTS.buyServer, [options.budget, options["min-ram"]]);
    }

    if (!options["no-auto"]) {
      ensureAuto(ns, target, Boolean(options["restart-auto"]));
    }

    if (options.once) {
      ns.tprint("orchestrator: one-shot cycle complete.");
      return;
    }

    ns.tprint(`orchestrator: sleeping ${Math.round(interval / 1000)}s.`);
    await ns.sleep(interval);
  } while (true);
}

async function runChild(ns, script, args) {
  if (!ns.fileExists(script, "home")) {
    ns.tprint(`orchestrator: missing ${script}; run pull first.`);
    return 0;
  }

  const ramNeeded = ns.getScriptRam(script, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ramNeeded > freeRam) {
    ns.tprint(`orchestrator: not enough home RAM for ${script}; needs ${ramNeeded.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB.`);
    return 0;
  }

  const pid = ns.run(script, 1, ...args);
  if (pid === 0) {
    ns.tprint(`orchestrator: failed to start ${script}.`);
    return 0;
  }

  await waitForPid(ns, pid);
  return pid;
}

function ensureAuto(ns, target, restart) {
  const running = ns.ps("home").filter((process) => process.filename === SCRIPTS.auto);

  if (running.length > 0 && !restart) {
    ns.tprint(`orchestrator: ${SCRIPTS.auto} already running.`);
    return;
  }

  for (const process of running) {
    ns.kill(process.pid);
  }

  const args = target ? [target] : [];
  const ramNeeded = ns.getScriptRam(SCRIPTS.auto, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ramNeeded > freeRam) {
    ns.tprint(`orchestrator: not enough home RAM for ${SCRIPTS.auto}; needs ${ramNeeded.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB.`);
    return;
  }

  const pid = ns.run(SCRIPTS.auto, 1, ...args);
  if (pid === 0) {
    ns.tprint(`orchestrator: failed to start ${SCRIPTS.auto}.`);
    return;
  }

  ns.tprint(`orchestrator: started ${SCRIPTS.auto}${target ? ` targeting ${target}` : ""}.`);
}

async function waitForPid(ns, pid) {
  while (ns.ps("home").some((process) => process.pid === pid)) {
    await ns.sleep(250);
  }
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function printHelp(ns) {
  ns.tprint("Usage: run src/orchestrator.js [options]");
  ns.tprint("Coordinates darkweb purchases, rooting, purchased-server buying, and the money loop.");
  ns.tprint("Options:");
  ns.tprint("  --interval MS          Cycle delay, default 60000");
  ns.tprint("  --budget N            Server-buying budget fraction/percent, default 0.25");
  ns.tprint("  --darkweb-budget N    Darkweb budget fraction/percent, default 0.35");
  ns.tprint("  --min-ram GB          Minimum purchased server RAM, default 8");
  ns.tprint("  --target HOST         Force auto.js target");
  ns.tprint("  --restart-auto        Restart auto.js each cycle to redeploy across new RAM");
  ns.tprint("  --once                Run one cycle and exit");
  ns.tprint("  --no-auto|--no-buy|--no-darkweb|--no-root");
  ns.tprint("  --dry-run             Pass dry-run through to darkweb purchases");
}
