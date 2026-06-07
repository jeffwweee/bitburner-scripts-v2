const DEFAULT_INTERVAL = 6000;
const DEFAULT_WINDOW = 20;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["interval", DEFAULT_INTERVAL],
    ["window", DEFAULT_WINDOW],
    ["top", 10],
    ["once", false],
    ["tail", false],
    ["terminal", true],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const stock = ns.stock;
  if (!stock) {
    ns.tprint("stock-watch: ns.stock API is unavailable.");
    return;
  }

  const symbols = safeCall(() => stock.getSymbols(), []);
  if (!Array.isArray(symbols) || symbols.length === 0) {
    ns.tprint("stock-watch: no stock symbols visible. Buy WSE/TIX access first.");
    return;
  }

  const interval = Math.max(1000, Number(options.interval) || DEFAULT_INTERVAL);
  const windowSize = Math.max(2, Number(options.window) || DEFAULT_WINDOW);
  const terminal = Boolean(options.terminal);
  const history = new Map();

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));

  do {
    for (const symbol of symbols) {
      const price = getPrice(stock, symbol);
      const prices = history.get(symbol) || [];
      prices.push(price);
      while (prices.length > windowSize) prices.shift();
      history.set(symbol, prices);
    }

    printRankings(ns, stock, symbols, history, Number(options.top) || 10, terminal);

    if (options.once) return;
    await ns.sleep(interval);
  } while (true);
}

function printRankings(ns, stock, symbols, history, limit, terminal) {
  const ranked = symbols
    .map((symbol) => analyzeSymbol(stock, symbol, history.get(symbol) || []))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  log(ns, "stock-watch: sym price trend forecast vol", terminal);
  for (const item of ranked) {
    log(ns, [
      pad(item.symbol, 6),
      pad(formatMoney(item.price), 10),
      pad(formatPercent(item.trend), 8),
      pad(item.forecast === null ? "n/a" : formatPercent(item.forecast), 9),
      item.volatility === null ? "n/a" : formatPercent(item.volatility),
    ].join(" "), terminal);
  }
}

function analyzeSymbol(stock, symbol, prices) {
  const price = getPrice(stock, symbol);
  const first = prices[0] || price;
  const trend = first > 0 ? (price - first) / first : 0;
  const forecast = safeCall(() => stock.getForecast(symbol), null);
  const volatility = safeCall(() => stock.getVolatility(symbol), null);
  const score = forecast === null ? trend : forecast - 0.5;

  return { symbol, price, trend, forecast, volatility, score };
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

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/stock-watch.js [--interval MS] [--window N] [--top N] [--once] [--tail]");
  ns.tprint("Watches stock prices and prints forecast/volatility when 4S TIX is available, otherwise trend.");
}
