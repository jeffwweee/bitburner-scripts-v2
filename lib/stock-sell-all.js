/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["dry-run", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const stock = ns.stock;
  if (!stock) {
    ns.tprint("stock-sell-all: ns.stock API is unavailable.");
    return;
  }

  const symbols = safeCall(() => stock.getSymbols(), []);
  if (!Array.isArray(symbols) || symbols.length === 0) {
    ns.tprint("stock-sell-all: no stock symbols visible.");
    return;
  }

  const dryRun = Boolean(options["dry-run"]);
  let soldPositions = 0;
  let estimatedValue = 0;

  for (const symbol of symbols) {
    const position = getPosition(stock, symbol);

    if (position.longShares > 0) {
      const bid = getBidPrice(stock, symbol);
      estimatedValue += bid * position.longShares;
      soldPositions++;

      if (dryRun) {
        ns.tprint(`DRY sell long ${symbol} x${formatNumber(position.longShares)} at ~${formatMoney(bid)}`);
      } else {
        const price = safeCall(() => stock.sellStock(symbol, position.longShares), 0);
        ns.tprint(`SELL long ${symbol} x${formatNumber(position.longShares)} at ${formatMoney(price)}`);
      }
    }

    if (position.shortShares > 0) {
      const ask = getAskPrice(stock, symbol);
      estimatedValue += ask * position.shortShares;
      soldPositions++;

      if (dryRun) {
        ns.tprint(`DRY sell short ${symbol} x${formatNumber(position.shortShares)} at ~${formatMoney(ask)}`);
      } else if (typeof stock.sellShort === "function") {
        const price = safeCall(() => stock.sellShort(symbol, position.shortShares), 0);
        ns.tprint(`SELL short ${symbol} x${formatNumber(position.shortShares)} at ${formatMoney(price)}`);
      } else {
        ns.tprint(`WARN cannot sell short ${symbol}; sellShort API unavailable.`);
      }
    }
  }

  if (soldPositions === 0) {
    ns.tprint("stock-sell-all: no open stock positions.");
    return;
  }

  ns.tprint(`${dryRun ? "DRY " : ""}stock-sell-all: processed ${soldPositions} position(s), estimated value ${formatMoney(estimatedValue)}.`);
}

function getPosition(stock, symbol) {
  const position = safeCall(() => stock.getPosition(symbol), [0, 0, 0, 0]);
  return {
    longShares: Number(position[0]) || 0,
    longAvgPrice: Number(position[1]) || 0,
    shortShares: Number(position[2]) || 0,
    shortAvgPrice: Number(position[3]) || 0,
  };
}

function getBidPrice(stock, symbol) {
  return safeCall(() => stock.getBidPrice(symbol), safeCall(() => stock.getPrice(symbol), 0));
}

function getAskPrice(stock, symbol) {
  return safeCall(() => stock.getAskPrice(symbol), safeCall(() => stock.getPrice(symbol), 0));
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (_) {
    return fallback;
  }
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function formatNumber(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return String(Math.floor(value));
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/stock-sell-all.js [--dry-run]");
  ns.tprint("Sells all long stock positions and closes short positions when the short API is available.");
  ns.tprint("Use before installing augmentations so stock value is converted back to cash.");
}
