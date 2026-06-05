/** @param {NS} ns */
export async function main(ns) {
  const servers = discoverServers(ns).filter((host) => host !== "home");
  const openers = getAvailableOpeners(ns);
  let rooted = 0;
  let skipped = 0;

  ns.tprint(`root: found ${servers.length} server(s), ${openers.length} port opener(s) available.`);

  for (const host of servers) {
    if (ns.hasRootAccess(host)) continue;

    const requiredPorts = ns.getServerNumPortsRequired(host);
    if (requiredPorts > openers.length) {
      skipped++;
      continue;
    }

    for (const opener of openers) {
      opener.run(host);
    }

    try {
      ns.nuke(host);
      rooted++;
      ns.tprint(`ROOT ${host}`);
    } catch (error) {
      ns.tprint(`FAIL ${host}: ${String(error)}`);
    }
  }

  ns.tprint(`root: rooted ${rooted} new server(s), skipped ${skipped} needing more port openers.`);
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

function getAvailableOpeners(ns) {
  const openers = [];

  if (ns.fileExists("BruteSSH.exe", "home")) {
    openers.push({ name: "BruteSSH.exe", run: (host) => ns.brutessh(host) });
  }

  if (ns.fileExists("FTPCrack.exe", "home")) {
    openers.push({ name: "FTPCrack.exe", run: (host) => ns.ftpcrack(host) });
  }

  if (ns.fileExists("relaySMTP.exe", "home")) {
    openers.push({ name: "relaySMTP.exe", run: (host) => ns.relaysmtp(host) });
  }

  if (ns.fileExists("HTTPWorm.exe", "home")) {
    openers.push({ name: "HTTPWorm.exe", run: (host) => ns.httpworm(host) });
  }

  if (ns.fileExists("SQLInject.exe", "home")) {
    openers.push({ name: "SQLInject.exe", run: (host) => ns.sqlinject(host) });
  }

  return openers;
}
