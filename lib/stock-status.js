/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["top", 10],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const stock = getStockApi(ns);
  if (!stock) {
    ns.tprint("stock-status: ns.stock API is unavailable in this Bitburner version.");
    return;
  }

  const access = getAccess(stock);
  ns.tprint("Stock access:");
  ns.tprint(`  WSE account: ${formatBool(access.wse)}`);
  ns.tprint(`  TIX API:     ${formatBool(access.tix)}`);
  ns.tprint(`  4S data:     ${formatBool(access.fourSigmaData)}`);
  ns.tprint(`  4S TIX API:  ${formatBool(access.fourSigmaTix)}`);
  ns.tprint(`  cash:        ${formatMoney(ns.getServerMoneyAvailable("home"))}`);

  const symbols = safeCall(() => stock.getSymbols(), []);
  if (!Array.isArray(symbols) || symbols.length === 0) {
    ns.tprint("stock-status: no stock symbols visible. Buy WSE/TIX access first.");
    return;
  }

  const positions = symbols
    .map((symbol) => getPosition(stock, symbol))
    .filter((position) => position.longShares > 0 || position.shortShares > 0);

  if (positions.length === 0) {
    ns.tprint("Portfolio: no open positions.");
  } else {
    ns.tprint("Portfolio:");
    ns.tprint("sym    long       avg        value      pnl");
    for (const position of positions) {
      const price = getPrice(stock, position.symbol);
      const value = position.longShares * price;
      const cost = position.longShares * position.longAvgPrice;
      ns.tprint([
        pad(position.symbol, 6),
        pad(formatNumber(position.longShares), 10),
        pad(formatMoney(position.longAvgPrice), 10),
        pad(formatMoney(value), 10),
        formatMoney(value - cost),
      ].join(" "));
    }
  }

  const ranked = symbols
    .map((symbol) => getSymbolSummary(stock, symbol, access))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(options.top) || 10));

  ns.tprint("Market:");
  ns.tprint("sym    price      forecast  vol      maxShares");
  for (const item of ranked) {
    ns.tprint([
      pad(item.symbol, 6),
      pad(formatMoney(item.price), 10),
      pad(item.forecast === null ? "n/a" : formatPercent(item.forecast), 9),
      pad(item.volatility === null ? "n/a" : formatPercent(item.volatility), 8),
      formatNumber(item.maxShares),
    ].join(" "));
  }
}

function getStockApi(ns) {
  return ns.stock || null;
}

function getAccess(stock) {
  return {
    wse: safeCall(() => stock.hasWSEAccount(), false),
    tix: safeCall(() => stock.hasTIXAPIAccess(), false),
    fourSigmaData: safeCall(() => stock.has4SData(), false),
    fourSigmaTix: safeCall(() => stock.has4SDataTIXAPI(), false),
  };
}

function getSymbolSummary(stock, symbol, access) {
  const price = getPrice(stock, symbol);
  const forecast = access.fourSigmaTix ? safeCall(() => stock.getForecast(symbol), null) : null;
  const volatility = access.fourSigmaTix ? safeCall(() => stock.getVolatility(symbol), null) : null;
  const maxShares = safeCall(() => stock.getMaxShares(symbol), 0);
  const score = forecast === null ? price : forecast;

  return { symbol, price, forecast, volatility, maxShares, score };
}

function getPosition(stock, symbol) {
  const position = safeCall(() => stock.getPosition(symbol), [0, 0, 0, 0]);
  return {
    symbol,
    longShares: Number(position[0]) || 0,
    longAvgPrice: Number(position[1]) || 0,
    shortShares: Number(position[2]) || 0,
    shortAvgPrice: Number(position[3]) || 0,
  };
}

function getPrice(stock, symbol) {
  return safeCall(() => stock.getPrice(symbol), 0);
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (_) {
    return fallback;
  }
}

function formatBool(value) {
  return value ? "yes" : "no";
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
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

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/stock-status.js [--top N]");
  ns.tprint("Shows stock API access, current positions, and top symbols.");
}
