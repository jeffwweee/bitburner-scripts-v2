const WORKERS = {
  weaken: "src/weaken.js",
  grow: "src/grow.js",
  hack: "src/hack.js",
};

/** @param {NS} ns */
export async function main(ns) {
  const action = String(ns.args[0] || "").toLowerCase();
  const target = String(ns.args[1] || "");

  if (!WORKERS[action] || !target) {
    ns.tprint("Usage: run src/deploy.js weaken|grow|hack TARGET");
    return;
  }

  const script = WORKERS[action];
  const servers = discoverServers(ns)
    .filter((host) => host !== "home")
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxRam(host) > 0);

  let launched = 0;
  let totalThreads = 0;

  for (const host of servers) {
    ns.killall(host);
    await ns.scp(script, host, "home");

    const threads = getThreadCount(ns, host, script);
    if (threads <= 0) continue;

    const pid = ns.exec(script, host, threads, target);
    if (pid !== 0) {
      launched++;
      totalThreads += threads;
      ns.tprint(`RUN ${host}: ${script} ${target} x${threads}`);
    }
  }

  ns.tprint(`deploy: launched on ${launched}/${servers.length} server(s), ${totalThreads} total thread(s).`);
}

function discoverServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  for (let index = 0; index < queue.length; index++) {
    const host = queue[index];
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return [...seen];
}

function getThreadCount(ns, host, script) {
  const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  const scriptRam = ns.getScriptRam(script, host);
  if (scriptRam <= 0) return 0;
  return Math.floor(freeRam / scriptRam);
}
