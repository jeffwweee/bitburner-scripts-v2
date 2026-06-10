const DEFAULT_PRIORITY = [
  "CyberSec",
  "NiteSec",
  "The Black Hand",
  "BitRunners",
  "Daedalus",
];

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["join", true],
    ["work", ""],
    ["type", "hacking"],
    ["focus", false],
    ["status", false],
    ["quiet", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const singularity = ns.singularity;
  if (!singularity || typeof singularity.checkFactionInvitations !== "function") {
    log(ns, "factions: Singularity API unavailable. Run this in BN4 or after SF4.", Boolean(options.quiet));
    return;
  }

  const joined = new Set(ns.getPlayer().factions || []);

  if (options.join) {
    joinInvitations(ns, singularity, joined, Boolean(options.quiet));
  }

  if (options.status) {
    printStatus(ns, singularity);
  }

  const target = String(options.work || firstPositionalArg(options._) || "");
  if (target) {
    startFactionWork(ns, singularity, target, String(options.type || "hacking"), Boolean(options.focus));
  }
}

function joinInvitations(ns, singularity, joined, quiet) {
  const invites = safeCall(() => singularity.checkFactionInvitations(), []);
  if (!Array.isArray(invites) || invites.length === 0) {
    log(ns, "factions: no pending invitations.", quiet);
    return;
  }

  const ordered = [...invites].sort((a, b) => priorityIndex(a) - priorityIndex(b) || a.localeCompare(b));
  for (const faction of ordered) {
    if (joined.has(faction)) continue;
    const joinedNow = safeCall(() => singularity.joinFaction(faction), false);
    log(ns, `${joinedNow ? "JOIN" : "SKIP"} ${faction}`, quiet);
    if (joinedNow) joined.add(faction);
  }
}

function printStatus(ns, singularity) {
  const factions = ns.getPlayer().factions || [];
  if (factions.length === 0) {
    ns.tprint("factions: none joined.");
    return;
  }

  ns.tprint("Faction status:");
  for (const faction of factions.sort((a, b) => priorityIndex(a) - priorityIndex(b) || a.localeCompare(b))) {
    const rep = safeCall(() => singularity.getFactionRep(faction), 0);
    const favor = safeCall(() => singularity.getFactionFavor(faction), 0);
    const gain = safeCall(() => singularity.getFactionFavorGain(faction), 0);
    const types = safeCall(() => singularity.getFactionWorkTypes(faction), []);
    ns.tprint(`${faction}: rep ${formatNumber(rep)}, favor ${favor.toFixed(3)} (+${gain.toFixed(3)}), work ${types.join("/") || "none"}`);
  }
}

function startFactionWork(ns, singularity, faction, type, focus) {
  const types = safeCall(() => singularity.getFactionWorkTypes(faction), []);
  const workType = chooseWorkType(types, type);
  if (!workType) {
    ns.tprint(`factions: ${faction} does not support ${type} work. Available: ${types.join(", ") || "none"}.`);
    return;
  }

  const ok = safeCall(() => singularity.workForFaction(faction, workType, focus), false);
  ns.tprint(`${ok ? "WORK" : "FAIL"} ${faction} ${workType}${focus ? " focused" : " unfocused"}`);
}

function chooseWorkType(types, preferred) {
  if (types.includes(preferred)) return preferred;
  if (preferred === "hacking" && types.includes("field")) return "field";
  if (types.includes("hacking")) return "hacking";
  return types[0] || "";
}

function priorityIndex(faction) {
  const index = DEFAULT_PRIORITY.indexOf(faction);
  return index < 0 ? DEFAULT_PRIORITY.length : index;
}

function firstPositionalArg(values) {
  return Array.isArray(values) && values.length > 0 ? values[0] : "";
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (_) {
    return fallback;
  }
}

function log(ns, message, quiet) {
  ns.print(message);
  if (!quiet) ns.tprint(message);
}

function formatNumber(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(3);
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/factions.js [--join] [--status] [--work FACTION] [--type hacking|field|security] [--focus] [--quiet]");
  ns.tprint("Joins pending faction invitations and can start faction work with Singularity.");
}
