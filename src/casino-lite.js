const CASINO = "Iker Molina Casino";
const DEFAULT_GOAL = 1e10;
const DEFAULT_MAX_BET = 1e8;

/** @param {NS} ns */
export async function main(ns) {
  const options = ns.flags([
    ["goal", DEFAULT_GOAL],
    ["max-bet", DEFAULT_MAX_BET],
    ["basic", false],
    ["no-reload", false],
    ["terminal", true],
    ["help", false],
  ]);

  if (options.help) {
    printHelp(ns);
    return;
  }

  ns.disableLog("ALL");

  const goal = Math.max(1, Number(options.goal) || DEFAULT_GOAL);
  const maxBet = Math.max(1, Number(options["max-bet"]) || DEFAULT_MAX_BET);
  const terminal = Boolean(options.terminal);

  const dom = getDom();
  if (!dom.document || !dom.window) {
    log(ns, "casino: could not access the game DOM. This script needs to run in the game UI.", terminal);
    return;
  }

  log(ns, `casino: opening ${CASINO} blackjack. Goal: ${formatMoney(goal)}.`, terminal);
  await openBlackjack(ns, dom.document);

  const saveButton = await findRequired(ns, dom.document, "//button[@aria-label = 'save game']", 80);

  await click(ns, saveButton);
  log(ns, "casino: saved before gambling. Wins will be saved; losses reload unless --no-reload is set.", terminal);

  let peakMoney = readOverviewMoney(dom.document);
  while (peakMoney < goal) {
    const money = readOverviewMoney(dom.document);
    if (money <= 0) {
      log(ns, "casino: could not read current money from the Overview panel. Make sure the Overview is visible, then rerun.", terminal);
      return;
    }

    const bet = Math.floor(Math.min(maxBet, money * 0.9));
    if (bet < 1) {
      await handleLoss(ns, dom.window, options);
      return;
    }

    const betInput = await findRequired(ns, dom.document, "//input[@type='number']", 40);
    const startButton = await findRequired(ns, dom.document, "//button[text() = 'Start']", 40);
    await setText(ns, betInput, String(bet));
    await click(ns, startButton);

    const outcome = await playHand(ns, dom.document, Boolean(options.basic));
    if (outcome === "win") {
      const newMoney = readOverviewMoney(dom.document);
      if (newMoney > peakMoney) {
        peakMoney = newMoney;
        await click(ns, saveButton);
        log(ns, `casino: won, saved at ${formatMoney(newMoney)}.`, terminal);
      }
    } else if (outcome === "lose") {
      log(ns, `casino: lost a hand at ${formatMoney(readOverviewMoney(dom.document))}.`, terminal);
      await handleLoss(ns, dom.window, options);
      return;
    } else if (outcome === "kicked") {
      log(ns, "casino: kicked out by the casino. That usually means the casino earnings cap has been reached.", terminal);
      return;
    }

    await ns.sleep(1);
  }

  log(ns, `casino: goal reached. Home money is ${formatMoney(readOverviewMoney(dom.document))}.`, terminal);
}

async function openBlackjack(ns, document) {
  if (await tryFind(ns, document, "//input[@type='number']", 3)) return;

  if (await tryFind(ns, document, "//h4[text()='Iker Molina Casino']", 3)) {
    const blackjackButton = await tryFind(ns, document, "//button[contains(translate(text(), 'BLACKJACK', 'blackjack'), 'blackjack')]", 20);
    if (blackjackButton) await click(ns, blackjackButton);
    return;
  }

  const cityButton = await findRequired(ns, document, "//div[@role = 'button' and contains(., 'City')]", 40);
  await click(ns, cityButton);

  const casinoButton = await findRequired(ns, document, "//span[@aria-label = 'Iker Molina Casino']", 40);
  await click(ns, casinoButton);

  const blackjackButton = await findRequired(ns, document, "//button[contains(translate(text(), 'BLACKJACK', 'blackjack'), 'blackjack')]", 40);
  await click(ns, blackjackButton);
}

async function playHand(ns, document, basicStrategy) {
  for (let i = 0; i < 30; i++) {
    const outcome = await getOutcome(ns, document);
    if (outcome) return outcome;

    const hitButton = await tryFind(ns, document, "//button[text() = 'Hit']", 2);
    const stayButton = await tryFind(ns, document, "//button[text() = 'Stay']", 2);
    if (hitButton && stayButton) {
      const shouldHit = basicStrategy
        ? await shouldHitBasic(ns, document)
        : await shouldHitAdvanced(ns, document);
      await click(ns, shouldHit ? hitButton : stayButton);
    }

    await ns.sleep(10);
  }

  throw new Error("casino: blackjack hand did not reach a detectable outcome.");
}

async function getOutcome(ns, document) {
  if (await tryFind(ns, document, "//span[contains(text(), 'Alright cheater get out of here')]", 1)) return "kicked";
  if (await tryFind(ns, document, "//p[contains(text(), 'lost')]", 1)) return "lose";
  if (await tryFind(ns, document, "//p/text()[contains(.,'won') or contains(.,'Won')]", 1)) return "win";
  if (await tryFind(ns, document, "//p[contains(text(), 'Tie')]", 1)) return "tie";
  return null;
}

async function shouldHitBasic(ns, document) {
  const count = await getPlayerCount(ns, document);
  return count.high < 17;
}

async function shouldHitAdvanced(ns, document) {
  const count = await getPlayerCount(ns, document);
  const dealer = await getDealerShownValue(ns, document);

  if (count.soft) {
    if (count.low >= 9) return false;
    if (count.low === 8 && dealer <= 8) return false;
    return true;
  }

  if (count.high >= 17) return false;
  if (count.high >= 13 && dealer <= 6) return false;
  if (count.high === 12 && dealer >= 4 && dealer <= 6) return false;
  return true;
}

async function getPlayerCount(ns, document) {
  const elem = await findRequired(ns, document, "//p[contains(text(), 'Count:')]", 20);
  const values = elem.textContent.match(/\d+/g)?.map(Number) || [0];
  return {
    low: values[0],
    high: values[values.length - 1],
    soft: values.length > 1,
  };
}

async function getDealerShownValue(ns, document) {
  const elem = await findRequired(ns, document, "//p[contains(text(), 'Dealer')]/..", 20);
  const text = elem.innerText.replace(/\s+/g, " ");
  const card = text.match(/Dealer.*?([2-9]|10|A|J|Q|K)/i)?.[1] || "10";
  if (card.toUpperCase() === "A") return 11;
  if (["J", "Q", "K"].includes(card.toUpperCase())) return 10;
  return Number(card) || 10;
}

async function handleLoss(ns, window, options) {
  if (options["no-reload"]) {
    log(ns, "casino: --no-reload is set, stopping after loss.", Boolean(options.terminal));
    return;
  }

  log(ns, "casino: reloading without saving to recover the last saved state.", Boolean(options.terminal));
  window.onbeforeunload = null;
  await ns.sleep(10);
  window.location.reload();
  await ns.sleep(10000);
}

async function findRequired(ns, document, xpath, retries) {
  const elem = await tryFind(ns, document, xpath, retries);
  if (elem) return elem;
  throw new Error(`casino: could not find expected UI element for xpath: ${xpath}`);
}

async function tryFind(ns, document, xpath, retries = 5) {
  for (let i = 0; i <= retries; i++) {
    const xpathResult = document.defaultView.XPathResult;
    const elem = document.evaluate(xpath, document, null, xpathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (elem) return elem;
    await ns.sleep(Math.min(200, 5 * (i + 1)));
  }
  return null;
}

async function click(ns, elem) {
  const props = getReactProps(elem);
  if (props && typeof props.onClick === "function") {
    props.onClick({ isTrusted: true });
  } else {
    elem.click();
  }
  await ns.sleep(5);
}

async function setText(ns, elem, value) {
  const props = getReactProps(elem);
  if (props && typeof props.onChange === "function") {
    props.onChange({ isTrusted: true, target: { value } });
  } else {
    elem.value = value;
    elem.dispatchEvent(new elem.ownerDocument.defaultView.Event("input", { bubbles: true }));
  }
  await ns.sleep(5);
}

function getReactProps(elem) {
  const key = Object.keys(elem).find((name) => name.startsWith("__reactProps$") || name.startsWith("__reactEventHandlers$"));
  return key ? elem[key] : null;
}

function getDom() {
  return {
    document: eval("document"),
    window: eval("window"),
  };
}

function readOverviewMoney(document) {
  const text = document.body.innerText;
  const match = text.match(/Money:\s*\$([\d.,]+)\s*([kmbtq]?)/i)
    || text.match(/\$([\d.,]+)\s*([kmbtq]?)/i);
  if (!match) return 0;

  const value = Number(match[1].replace(/,/g, ""));
  const suffix = match[2].toLowerCase();
  const multipliers = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 };
  return value * (multipliers[suffix] || 1);
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}

function log(ns, message, terminal) {
  ns.print(message);
  if (terminal) ns.tprint(message);
}

function printHelp(ns) {
  ns.tprint("Usage: run src/casino.js [options]");
  ns.tprint("Manual-first casino experiment: travel to Aevum after $200k, then run this to automate blackjack.");
  ns.tprint("Options:");
  ns.tprint("  --goal N        Stop after reaching this much money, default $10b");
  ns.tprint("  --max-bet N     Maximum blackjack bet, default $100m");
  ns.tprint("  --basic         Use simple stay-on-17 strategy instead of dealer-aware strategy");
  ns.tprint("  --no-reload     Stop on loss instead of reloading the last save");
}
