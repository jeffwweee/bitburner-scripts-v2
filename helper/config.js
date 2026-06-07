export const RESERVE_CONFIG_PATH = "reserve.json";

export const DEFAULT_RESERVE_CONFIG = {
  moneyReserve: 500000000,
  homeRamReserve: 128,
  shareFraction: 0.15,
  servers: {
    budget: 0.25,
    minRam: 8,
    maxRam: 1024,
    replaceMultiplier: 2,
  },
  stocks: {
    budget: 0.8,
    reserve: 500000000,
    maxPosition: 0.15,
  },
  darkweb: {
    budget: 0.35,
  },
};

export function loadReserveConfig(ns, path = RESERVE_CONFIG_PATH) {
  if (!ns.fileExists(path, "home")) return clone(DEFAULT_RESERVE_CONFIG);

  try {
    const parsed = JSON.parse(ns.read(path));
    return normalizeReserveConfig(mergeDeep(DEFAULT_RESERVE_CONFIG, parsed));
  } catch (error) {
    ns.print(`config: failed to parse ${path}: ${String(error)}. Using defaults.`);
    return clone(DEFAULT_RESERVE_CONFIG);
  }
}

export function normalizeReserveConfig(config) {
  const normalized = clone(DEFAULT_RESERVE_CONFIG);
  const merged = mergeDeep(normalized, config || {});

  merged.moneyReserve = nonNegativeNumber(merged.moneyReserve, DEFAULT_RESERVE_CONFIG.moneyReserve);
  merged.homeRamReserve = nonNegativeNumber(merged.homeRamReserve, DEFAULT_RESERVE_CONFIG.homeRamReserve);
  merged.shareFraction = fraction(merged.shareFraction, DEFAULT_RESERVE_CONFIG.shareFraction);
  merged.servers.budget = fraction(merged.servers.budget, DEFAULT_RESERVE_CONFIG.servers.budget);
  merged.servers.minRam = ram(merged.servers.minRam, DEFAULT_RESERVE_CONFIG.servers.minRam);
  merged.servers.maxRam = ram(merged.servers.maxRam, DEFAULT_RESERVE_CONFIG.servers.maxRam);
  merged.servers.replaceMultiplier = Math.max(1, number(merged.servers.replaceMultiplier, DEFAULT_RESERVE_CONFIG.servers.replaceMultiplier));
  merged.stocks.budget = fraction(merged.stocks.budget, DEFAULT_RESERVE_CONFIG.stocks.budget);
  merged.stocks.reserve = nonNegativeNumber(merged.stocks.reserve, merged.moneyReserve);
  merged.stocks.maxPosition = fraction(merged.stocks.maxPosition, DEFAULT_RESERVE_CONFIG.stocks.maxPosition);
  merged.darkweb.budget = fraction(merged.darkweb.budget, DEFAULT_RESERVE_CONFIG.darkweb.budget);

  if (merged.servers.maxRam < merged.servers.minRam) {
    merged.servers.maxRam = merged.servers.minRam;
  }

  return merged;
}

export function saveReserveConfig(ns, config, path = RESERVE_CONFIG_PATH) {
  ns.write(path, JSON.stringify(normalizeReserveConfig(config), null, 2), "w");
}

export function spendableMoney(ns, reserve) {
  return Math.max(0, ns.getServerMoneyAvailable("home") - nonNegativeNumber(reserve, 0));
}

export function hasFlag(args, flag) {
  return args.some((arg) => String(arg) === flag);
}

export function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function nonNegativeNumber(value, fallback) {
  return Math.max(0, number(value, fallback));
}

export function fraction(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if (parsed > 1) return Math.min(1, parsed / 100);
  return parsed;
}

export function ram(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(2, Math.pow(2, Math.floor(Math.log2(parsed))));
}

function mergeDeep(base, override) {
  const result = clone(base);

  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeDeep(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
