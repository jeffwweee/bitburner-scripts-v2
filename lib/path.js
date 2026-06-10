/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["target", ""],
    ["go", false],
    ["backdoor", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const target = String(options.target || firstPositionalArg(options._) || "w0r1d_d43m0n");
  const start = getRouteStart(ns, Boolean(options.go || options.backdoor));
  const route = findRoute(ns, start, target);
  if (route.length === 0) {
    ns.tprint(`path: could not find ${target} from ${start}.`);
    return;
  }

  const commands = route.slice(1).map((host) => `connect ${host}`);
  ns.tprint(`path: ${route.join(" -> ")}`);
  ns.tprint(commands.join("; "));
  if (options.backdoor) {
    ns.tprint(`${commands.join("; ")}; backdoor`);
  }

  if (options.go || options.backdoor) {
    await followRoute(ns, route, Boolean(options.backdoor));
  }
}

function findRoute(ns, start, target) {
  const queue = [start];
  const parent = new Map([[start, null]]);

  for (let index = 0; index < queue.length; index++) {
    const host = queue[index];
    if (host === target) return buildRoute(parent, target);

    for (const next of ns.scan(host)) {
      if (parent.has(next)) continue;
      parent.set(next, host);
      queue.push(next);
    }
  }

  return [];
}

function buildRoute(parent, target) {
  const route = [];
  for (let host = target; host !== null; host = parent.get(host)) {
    route.push(host);
  }
  return route.reverse();
}

function getRouteStart(ns, useCurrentServer) {
  if (useCurrentServer && ns.singularity && typeof ns.singularity.getCurrentServer === "function") {
    return ns.singularity.getCurrentServer();
  }

  return "home";
}

async function followRoute(ns, route, installBackdoor) {
  const singularity = ns.singularity;
  if (!singularity || typeof singularity.connect !== "function") {
    ns.tprint("path: Singularity connect API unavailable; use the printed terminal commands manually.");
    return;
  }

  for (const host of route.slice(1)) {
    if (!singularity.connect(host)) {
      ns.tprint(`path: failed to connect ${host}.`);
      return;
    }
  }

  ns.tprint(`path: connected to ${route[route.length - 1]}.`);
  if (!installBackdoor) return;

  if (typeof singularity.installBackdoor !== "function") {
    ns.tprint("path: Singularity backdoor API unavailable; run `backdoor` manually.");
    return;
  }

  ns.tprint("path: installing backdoor...");
  await singularity.installBackdoor();
  ns.tprint("path: backdoor complete.");
}

function firstPositionalArg(values) {
  return Array.isArray(values) && values.length > 0 ? values[0] : "";
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/path.js [HOST] [--target HOST] [--go] [--backdoor]");
  ns.tprint("Prints a terminal connect path. With Singularity, --go connects and --backdoor installs a backdoor.");
}
