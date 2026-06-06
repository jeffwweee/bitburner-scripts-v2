const SCRIPTS = {
  darkweb: "lib/darkweb.js",
  root: "lib/root.js",
  buyServer: "lib/buy-server.js",
  hackStrat: "lib/hack-strat.js",
  auto: "lib/auto.js",
};

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["interval", 60000],
    ["budget", 0.25],
    ["darkweb-budget", 0.35],
    ["min-ram", 8],
    ["home-reserve", 32],
    ["target", ""],
    ["strategy", "current"],
    ["once", false],
    ["restart-hack-strat", false],
    ["restart-auto", false],
    ["tail", false],
    ["terminal", false],
    ["no-hack-strat", false],
    ["no-auto", false],
    ["no-buy", false],
    ["no-darkweb", false],
    ["no-root", false],
    ["no-home", false],
    ["dry-run", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const interval = Math.max(5000, Number(options.interval) || 60000);
  const target = String(options.target || "");
  const strategy = normalizeStrategy(options.strategy);
  const terminal = Boolean(options.terminal);

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  do {
    log(ns, `orchestrator: cycle start, home money ${formatMoney(ns.getServerMoneyAvailable("home"))}.`, terminal);

    if (!options["no-darkweb"]) {
      await runChild(ns, SCRIPTS.darkweb, [
        "--budget",
        options["darkweb-budget"],
        options["dry-run"] ? "--dry-run" : "",
        terminal ? "" : "--quiet",
      ].filter(Boolean));
    }

    if (!options["no-root"]) {
      await runChild(ns, SCRIPTS.root, [terminal ? "" : "--quiet"].filter(Boolean));
    }

    if (!options["no-buy"]) {
      await runChild(ns, SCRIPTS.buyServer, [
        "--budget",
        options.budget,
        "--min-ram",
        options["min-ram"],
        terminal ? "" : "--quiet",
      ].filter(Boolean));
    }

    if (!options["no-hack-strat"] && !options["no-auto"]) {
      ensureHackStrat(
        ns,
        target,
        strategy,
        Boolean(options["restart-hack-strat"] || options["restart-auto"]),
        Boolean(options.tail),
        terminal,
      );
    }

    if (options.once) {
      log(ns, "orchestrator: one-shot cycle complete.", terminal);
      return;
    }

    log(ns, `orchestrator: sleeping ${Math.round(interval / 1000)}s.`, terminal);
    await ns.sleep(interval);
  } while (true);
}

async function runChild(ns, script, args) {
  if (!ns.fileExists(script, "home")) {
    ns.print(`orchestrator: missing ${script}; run pull first.`);
    return 0;
  }

  const ramNeeded = ns.getScriptRam(script, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ramNeeded > freeRam) {
    ns.print(`orchestrator: not enough home RAM for ${script}; needs ${ramNeeded.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB.`);
    return 0;
  }

  const pid = ns.run(script, 1, ...args);
  if (pid === 0) {
    ns.print(`orchestrator: failed to start ${script}.`);
    return 0;
  }

  await waitForPid(ns, pid);
  return pid;
}

function ensureHackStrat(ns, target, strategy, restart, tail, terminal) {
  const running = ns.ps("home").filter((process) =>
    process.filename === SCRIPTS.hackStrat || process.filename === SCRIPTS.auto
  );

  if (running.length > 0 && !restart) {
    log(ns, `orchestrator: hacking controller already running (${running[0].filename}).`, terminal);
    return;
  }

  for (const process of running) {
    ns.kill(process.pid);
  }

  const args = [
    ...(target ? ["--target", target] : []),
    "--strategy",
    strategy,
    "--home-reserve",
    options["home-reserve"],
    ...(options["no-home"] ? ["--no-home"] : []),
    ...(tail ? ["--tail"] : []),
    ...(terminal ? ["--terminal"] : []),
  ];
  const ramNeeded = ns.getScriptRam(SCRIPTS.hackStrat, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ramNeeded > freeRam) {
    log(ns, `orchestrator: not enough home RAM for ${SCRIPTS.hackStrat}; needs ${ramNeeded.toFixed(2)}GB, free ${freeRam.toFixed(2)}GB.`, terminal);
    return;
  }

  const pid = ns.run(SCRIPTS.hackStrat, 1, ...args);
  if (pid === 0) {
    log(ns, `orchestrator: failed to start ${SCRIPTS.hackStrat}.`, terminal);
    return;
  }

  log(ns, `orchestrator: started ${SCRIPTS.hackStrat}${target ? ` targeting ${target}` : ""} using ${strategy} strategy.`, terminal);
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

function log(ns, message, terminal) {
  ns.print(message);
  if (terminal) ns.tprint(message);
}

function maybeOpenTail(ns, shouldOpen) {
  if (!shouldOpen) return;
  if (ns.ui && typeof ns.ui.openTail === "function") {
    ns.ui.openTail();
  } else if (typeof ns.tail === "function") {
    ns.tail();
  }
}

function normalizeStrategy(value) {
  const strategy = String(value || "current").toLowerCase();
  if (strategy === "prep" || strategy === "prepared") return "prep";
  return "current";
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/orchestrator.js [options]");
  ns.tprint("Coordinates darkweb purchases, rooting, purchased-server buying, and the money loop.");
  ns.tprint("Options:");
  ns.tprint("  --interval MS          Cycle delay, default 60000");
  ns.tprint("  --budget N            Server-buying budget fraction/percent, default 0.25");
  ns.tprint("  --darkweb-budget N    Darkweb budget fraction/percent, default 0.35");
  ns.tprint("  --min-ram GB          Minimum purchased server RAM, default 8");
  ns.tprint("  --home-reserve GB     Home RAM reserved from workers, default 32");
  ns.tprint("  --target HOST         Force hack-strat target");
  ns.tprint("  --strategy current|prep  Target selection mode, default current");
  ns.tprint("  --restart-hack-strat  Explicitly restart hack-strat; normally avoid this");
  ns.tprint("  --restart-auto        Deprecated alias for --restart-hack-strat");
  ns.tprint("  --tail                Open log windows for orchestrator and hack-strat");
  ns.tprint("  --terminal            Also print orchestrator/hack-strat status to terminal");
  ns.tprint("  --once                Run one cycle and exit");
  ns.tprint("  --no-home             Do not let hack-strat run workers on home");
  ns.tprint("  --no-hack-strat|--no-buy|--no-darkweb|--no-root");
  ns.tprint("  --dry-run             Pass dry-run through to darkweb purchases");
}
