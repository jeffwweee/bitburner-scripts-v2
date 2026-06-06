/** @param {NS} ns */
export async function main(ns) {
  const mode = String(ns.args[0] || "all").toLowerCase();
  const servers = discoverServers(ns)
    .map((host) => getServerSummary(ns, host))
    .filter((server) => includeServer(server, mode))
    .sort(sortServers);

  if (servers.length === 0) {
    ns.tprint(`No servers matched mode: ${mode}`);
    return;
  }

  ns.tprint(`Servers (${mode}):`);
  ns.tprint("host                 root  lvl   ports  money         sec        ram");

  for (const server of servers) {
    ns.tprint([
      pad(server.host, 20),
      pad(server.root ? "yes" : "no", 5),
      pad(String(server.requiredHack), 5),
      pad(String(server.requiredPorts), 6),
      pad(formatCompact(server.moneyMax), 13),
      pad(`${server.security.toFixed(1)}/${server.minSecurity.toFixed(1)}`, 10),
      `${server.ramMax.toFixed(0)}GB`,
    ].join(" "));
  }
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

function getServerSummary(ns, host) {
  return {
    host,
    root: ns.hasRootAccess(host),
    requiredHack: ns.getServerRequiredHackingLevel(host),
    requiredPorts: ns.getServerNumPortsRequired(host),
    moneyMax: ns.getServerMaxMoney(host),
    moneyNow: ns.getServerMoneyAvailable(host),
    minSecurity: ns.getServerMinSecurityLevel(host),
    security: ns.getServerSecurityLevel(host),
    ramMax: ns.getServerMaxRam(host),
  };
}

function includeServer(server, mode) {
  if (mode === "hackable") {
    return server.root && server.moneyMax > 0;
  }

  if (mode === "money") {
    return server.moneyMax > 0;
  }

  if (mode === "locked") {
    return !server.root;
  }

  return true;
}

function sortServers(a, b) {
  if (b.moneyMax !== a.moneyMax) return b.moneyMax - a.moneyMax;
  if (a.requiredHack !== b.requiredHack) return a.requiredHack - b.requiredHack;
  return a.host.localeCompare(b.host);
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function formatCompact(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return String(Math.floor(value));
}
