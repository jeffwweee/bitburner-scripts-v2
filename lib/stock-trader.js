const COMMISSION = 100000;
const DEFAULT_INTERVAL = 6000;
const DEFAULT_BUDGET = 0.5;
const DEFAULT_RESERVE = 1e9;
const DEFAULT_MAX_POSITION = 0.15;
const DEFAULT_BUY_FORECAST = 0.6;
const DEFAULT_SELL_FORECAST = 0.52;
const DEFAULT_BUY_TREND = 0.02;
const DEFAULT_SELL_TREND = 0;
const DEFAULT_STOP_LOSS = -0.08;
const HISTORY_WINDOW = 30;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["budget", DEFAULT_BUDGET],
    ["reserve", DEFAULT_RESERVE],
    ["max-position", DEFAULT_MAX_POSITION],
    ["buy-forecast", DEFAULT_BUY_FORECAST],
    ["sell-forecast", DEFAULT_SELL_FORECAST],
    ["buy-trend", DEFAULT_BUY_TREND],
    ["sell-trend", DEFAULT_SELL_TREND],
    ["stop-loss", DEFAULT_STOP_LOSS],
    ["interval", DEFAULT_INTERVAL],
    ["dry-run", false],
    ["tail", false],
    ["terminal", false],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  const stock = ns.stock;
  if (!stock) {
    ns.print("stock-trader: ns.stock API is unavailable.");
    return;
  }

  const symbols = safeCall(() => stock.getSymbols(), []);
  if (!Array.isArray(symbols) || symbols.length === 0) {
    ns.print("stock-trader: no stock symbols visible. Buy WSE/TIX access first.");
    return;
  }

  const config = {
    budget: parseFraction(options.budget, DEFAULT_BUDGET),
    reserve: Math.max(0, Number(options.reserve) || DEFAULT_RESERVE),
    maxPosition: parseFraction(options["max-position"], DEFAULT_MAX_POSITION),
    buyForecast: Number(options["buy-forecast"]) || DEFAULT_BUY_FORECAST,
    sellForecast: Number(options["sell-forecast"]) || DEFAULT_SELL_FORECAST,
    buyTrend: Number(options["buy-trend"]) || DEFAULT_BUY_TREND,
    sellTrend: Number(options["sell-trend"]) || DEFAULT_SELL_TREND,
    stopLoss: Number(options["stop-loss"]) || DEFAULT_STOP_LOSS,
    interval: Math.max(1000, Number(options.interval) || DEFAULT_INTERVAL),
    dryRun: Boolean(options["dry-run"]),
    terminal: Boolean(options.terminal),
  };
  const history = new Map();

  ns.disableLog("ALL");
  maybeOpenTail(ns, Boolean(options.tail));
  log(ns, `stock-trader: starting long-only trader. budget ${Math.round(config.budget * 100)}%, reserve ${formatMoney(config.reserve)}, dry-run ${config.dryRun}.`, config.terminal);

  while (true) {
    updateHistory(stock, symbols, history);
    trade(ns, stock, symbols, history, config);
    await ns.sleep(config.interval);
  }
}

function trade(ns, stock, symbols, history, config) {
  const access = getAccess(stock);
  const analyses = symbols
    .map((symbol) => analyzeSymbol(stock, symbol, history.get(symbol) || [], access))
    .sort((a, b) => b.score - a.score);

  for (const item of analyses) {
    const position = getPosition(stock, item.symbol);
    if (position.longShares <= 0) continue;

    const pnlRatio = getLongPnlRatio(item.price, position.longAvgPrice);
    if (shouldSell(item, pnlRatio, access, config)) {
      sellLong(ns, stock, item.symbol, position.longShares, item.reason, config);
    }
  }

  const cash = ns.getServerMoneyAvailable("home");
  const spendable = Math.max(0, (cash - config.reserve) * config.budget);
  if (spendable <= COMMISSION) {
    ns.print(`stock-trader: no spendable cash above reserve ${formatMoney(config.reserve)}.`);
    return;
  }

  const openPositionValue = getOpenLongValue(stock, symbols);
  const maxBookValue = spendable;
  if (openPositionValue >= maxBookValue) {
    ns.print(`stock-trader: book already at cap ${formatMoney(openPositionValue)} / ${formatMoney(maxBookValue)}.`);
    return;
  }

  for (const item of analyses) {
    if (!shouldBuy(item, access, config)) continue;

    const position = getPosition(stock, item.symbol);
    if (position.longShares > 0) continue;

    const remainingBook = Math.max(0, maxBookValue - getOpenLongValue(stock, symbols));
    const positionBudget = Math.min(remainingBook, maxBookValue * config.maxPosition);
    if (positionBudget <= COMMISSION) return;

    buyLong(ns, stock, item, positionBudget, config);
  }
}

function updateHistory(stock, symbols, history) {
  for (const symbol of symbols) {
    const prices = history.get(symbol) || [];
    prices.push(getPrice(stock, symbol));
    while (prices.length > HISTORY_WINDOW) prices.shift();
    history.set(symbol, prices);
  }
}

function analyzeSymbol(stock, symbol, prices, access) {
  const price = getAskPrice(stock, symbol);
  const bid = getBidPrice(stock, symbol);
  const first = prices[0] || price;
  const trend = first > 0 ? (price - first) / first : 0;
  const forecast = access.fourSigmaTix ? safeCall(() => stock.getForecast(symbol), null) : null;
  const volatility = access.fourSigmaTix ? safeCall(() => stock.getVolatility(symbol), null) : null;
  const score = forecast === null ? trend : forecast - 0.5;
  const reason = forecast === null ? `trend ${formatPercent(trend)}` : `forecast ${formatPercent(forecast)}`;

  return { symbol, price, bid, trend, forecast, volatility, score, reason };
}

function shouldBuy(item, access, config) {
  if (access.fourSigmaTix && item.forecast !== null) {
    return item.forecast >= config.buyForecast;
  }

  return item.trend >= config.buyTrend;
}

function shouldSell(item, pnlRatio, access, config) {
  if (pnlRatio <= config.stopLoss) return true;

  if (access.fourSigmaTix && item.forecast !== null) {
    return item.forecast <= config.sellForecast;
  }

  return item.trend <= config.sellTrend;
}

function buyLong(ns, stock, item, budget, config) {
  const maxShares = safeCall(() => stock.getMaxShares(item.symbol), 0);
  const position = getPosition(stock, item.symbol);
  const availableShares = Math.max(0, maxShares - position.longShares - position.shortShares);
  const shares = Math.floor(Math.min(availableShares, (budget - COMMISSION) / item.price));
  if (shares <= 0) return;

  if (config.dryRun) {
    log(ns, `DRY buy ${item.symbol} x${formatNumber(shares)} at ${formatMoney(item.price)} (${item.reason})`, config.terminal);
    return;
  }

  const boughtPrice = safeCall(() => stock.buyStock(item.symbol, shares), 0);
  if (boughtPrice > 0) {
    log(ns, `BUY ${item.symbol} x${formatNumber(shares)} at ${formatMoney(boughtPrice)} (${item.reason})`, config.terminal);
  }
}

function sellLong(ns, stock, symbol, shares, reason, config) {
  if (shares <= 0) return;

  if (config.dryRun) {
    log(ns, `DRY sell ${symbol} x${formatNumber(shares)} (${reason})`, config.terminal);
    return;
  }

  const soldPrice = safeCall(() => stock.sellStock(symbol, shares), 0);
  if (soldPrice > 0) {
    log(ns, `SELL ${symbol} x${formatNumber(shares)} at ${formatMoney(soldPrice)} (${reason})`, config.terminal);
  }
}

function getOpenLongValue(stock, symbols) {
  return symbols.reduce((total, symbol) => {
    const position = getPosition(stock, symbol);
    return total + position.longShares * getBidPrice(stock, symbol);
  }, 0);
}

function getLongPnlRatio(price, avgPrice) {
  if (avgPrice <= 0) return 0;
  return (price - avgPrice) / avgPrice;
}

function getAccess(stock) {
  return {
    fourSigmaTix: safeCall(() => stock.has4SDataTIXAPI(), false),
  };
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

function getPrice(stock, symbol) {
  return safeCall(() => stock.getPrice(symbol), 0);
}

function getAskPrice(stock, symbol) {
  return safeCall(() => stock.getAskPrice(symbol), getPrice(stock, symbol));
}

function getBidPrice(stock, symbol) {
  return safeCall(() => stock.getBidPrice(symbol), getPrice(stock, symbol));
}

function parseFraction(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  if (number > 1) return Math.min(1, number / 100);
  return number;
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

function formatNumber(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return String(Math.floor(value));
}

function printHelp(ns) {
  ns.tprint("Usage: run lib/stock-trader.js [options]");
  ns.tprint("Conservative long-only stock trader. Uses 4S forecast when available, otherwise price trend.");
  ns.tprint("Options:");
  ns.tprint("  --budget N           Fraction/percent of cash above reserve to allocate, default 0.5");
  ns.tprint("  --reserve MONEY      Cash reserve, default $1b");
  ns.tprint("  --max-position N     Max fraction/percent of stock book in one symbol, default 0.15");
  ns.tprint("  --buy-forecast N     4S buy threshold, default 0.6");
  ns.tprint("  --sell-forecast N    4S sell threshold, default 0.52");
  ns.tprint("  --buy-trend N        Fallback trend buy threshold, default 0.02");
  ns.tprint("  --sell-trend N       Fallback trend sell threshold, default 0");
  ns.tprint("  --stop-loss N        Sell below this P/L ratio, default -0.08");
  ns.tprint("  --dry-run            Print trades without placing orders");
  ns.tprint("  --terminal           Also print trade logs to terminal");
}
