const WORKERS = {
  weaken: "src/weaken.js",
  grow: "src/grow.js",
  hack: "src/hack.js",
};

const SECURITY_BUFFER = 5;
const MONEY_BUFFER = 0.75;

/** @param {NS} ns */
export async function main(ns) {
  const requestedTarget = String(ns.args[0] || "");
  let currentAction = "";

  ns.disableLog("ALL");

  while (true) {
    const target = requestedTarget || chooseTarget(ns);
    if (!target) {
      ns.tprint("auto: no rooted money target found yet. Run src/root.js or gain access to more servers.");
      await ns.sleep(30000);
      continue;
    }

    const action = chooseAction(ns, target);
    if (action !== currentAction) {
      currentAction = action;
      await deploy(ns, action, target);
    }

    ns.print(statusLine(ns, action, target));
    await ns.sleep(getActionDelay(ns, action, target));
  }
}

function chooseTarget(ns) {
  const hackingLevel = ns.getHackingLevel();

  return discoverServers(ns)
    .filter((host) => ns.hasRootAccess(host))
    .filter((host) => ns.getServerMaxMoney(host) > 0)
    .filter((host) => ns.getServerRequiredHackingLevel(host) <= hackingLevel)
    .sort((a, b) => scoreTarget(ns, b) - scoreTarget(ns, a))[0] || "";
}

function scoreTarget(ns, host) {
  const money = ns.getServerMaxMoney(host);
  const level = Math.max(1, ns.getServerRequiredHackingLevel(host));
  const growth = Math.max(1, ns.getServerGrowth(host));
  return (money * growth) / level;
}

function chooseAction(ns, target) {
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const security = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const money = ns.getServerMoneyAvailable(target);

  if (security > minSecurity + SECURITY_BUFFER) return "weaken";
  if (maxMoney > 0 && money < maxMoney * MONEY_BUFFER) return "grow";
  return "hack";
}

async function deploy(ns, action, target) {
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
    }
  }

  ns.tprint(`auto: ${action} ${target} on ${launched}/${servers.length} server(s), ${totalThreads} thread(s).`);
}

function statusLine(ns, action, target) {
  const money = ns.getServerMoneyAvailable(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const security = ns.getServerSecurityLevel(target);
  const minSecurity = ns.getServerMinSecurityLevel(target);

  return `${action} ${target}: money ${formatPercent(money, maxMoney)}, security +${(security - minSecurity).toFixed(2)}`;
}

function getActionDelay(ns, action, target) {
  if (action === "weaken") return Math.max(5000, ns.getWeakenTime(target));
  if (action === "grow") return Math.max(5000, ns.getGrowTime(target));
  return Math.max(5000, ns.getHackTime(target));
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

function formatPercent(value, max) {
  if (max <= 0) return "n/a";
  return `${((value / max) * 100).toFixed(1)}%`;
}
