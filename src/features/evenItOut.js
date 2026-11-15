/*
Even-it-out suggestions for the send / counter page: when a trade is outside the fair range, look for one or two items
that would bring it back close to even.
  You are losing  -> items from their inventory you could ask for
  You are winning -> items from your inventory you could add
Only items with a Rolimons value (or RAP) count, items already in the trade are skipped, and the search is limited to
the 60 most valuable candidates so it stays instant.
*/
import * as utilities from "../utilities";
import { percentDiff, FAIR_PERCENT, formatPercent } from "../tradeMath";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

async function candidates(userId, inTrade) {
    if (!userId) return [];
    const inventory = await utilities.getUserInventoryCached(userId, 120000);
    if (!Array.isArray(inventory)) return [];
    const used = new Map();
    inTrade.forEach((id) => used.set(id, (used.get(id) ?? 0) + 1));
    const list = [];
    for (const entry of inventory) {
        const id = Number(entry.assetId);
        if (used.get(id) > 0) { used.set(id, used.get(id) - 1); continue; } //this copy is already in the trade
        const info = utilities.getItemInfo(id, 1);
        if (!info || !(info.value > 0)) continue;
        list.push({ id, name: info.name, value: info.value, serial: entry.serialNumber ?? null });
    }
    return list.sort((a, b) => b.value - a.value).slice(0, 60);
}

function bestCombos(pool, give, get, addToGet) {
    const results = [];
    const score = (extra) => {
        const newGive = give + (addToGet ? 0 : extra);
        const newGet = get + (addToGet ? extra : 0);
        return { percent: percentDiff(newGive, newGet) };
    };
    for (let i = 0; i < pool.length; i++) {
        results.push({ items: [pool[i]], ...score(pool[i].value) });
        for (let j = i + 1; j < pool.length; j++) {
            results.push({ items: [pool[i], pool[j]], ...score(pool[i].value + pool[j].value) });
        }
    }
    //prefer landing inside the fair range, then the closest to even, then fewer items
    results.sort((a, b) => Math.abs(a.percent) - Math.abs(b.percent) || a.items.length - b.items.length);
    const seen = new Set();
    return results.filter((combo) => {
        const key = combo.items.map((item) => item.id).sort().join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 3);
}

//Swap ideas: replace one item already in the trade with a different item from the same inventory.
function bestSwaps(pool, sideItems, give, get, onGet) {
    const results = [];
    const seenOut = new Set();
    for (const out of sideItems) {
        if (!(out.value > 0) || seenOut.has(out.id)) continue;
        seenOut.add(out.id);
        for (const candidate of pool) {
            if (candidate.id === out.id) continue;
            const change = candidate.value - out.value;
            const percent = percentDiff(give + (onGet ? 0 : change), get + (onGet ? change : 0));
            results.push({ out, items: [candidate], percent });
        }
    }
    results.sort((a, b) => Math.abs(a.percent) - Math.abs(b.percent));
    const seen = new Set();
    return results.filter((r) => {
        const key = r.out.id + ">" + r.items[0].id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 3);
}

function renderCombos(body, combos, emptyText) {
    body.replaceChildren();
    if (!combos.length) {
        body.textContent = emptyText;
        return;
    }
    combos.forEach((combo) => {
        const row = el("div", "rv-even-row");
        const names = el("span", "rv-even-items");
        if (combo.out) {
            names.appendChild(el("b", "", combo.out.name));
            names.appendChild(el("span", "rv-muted", " → "));
        }
        combo.items.forEach((item, index) => {
            if (index) names.appendChild(document.createTextNode(" + "));
            names.appendChild(el("b", "", item.name));
            names.appendChild(el("span", "rv-muted", ` (${utilities.commafyFull(item.value)})`));
        });
        const result = el("span", `rv-even-result ${Math.abs(combo.percent) <= FAIR_PERCENT ? "rv-pos" : ""}`, `→ ${formatPercent(combo.percent)}`);
        row.append(names, result);
        body.appendChild(row);
    });
}

function section(title) {
    const wrap = el("div", "rv-even-col");
    wrap.appendChild(el("div", "rv-even-sub", title));
    const body = el("div", "rv-even-body", "Looking through inventory...");
    wrap.appendChild(body);
    return [wrap, body];
}

/*
give / get: sides from tradeTools.js. Returns an element (filled in when inventories arrive) or null when the trade
is already fair or this is not the send / counter page.
Two columns: ideas from your inventory and ideas from theirs.
  You are winning: you could add items, or they could swap one of their items for a cheaper one
  You are losing:  they could add items, or you could swap one of your items for a cheaper one
*/
export function buildEvenSection(give, get) {
    if (utilities.getPageType() !== "sendOrCounter") return null;
    const percent = percentDiff(give.total, get.total);
    if (Math.abs(percent) <= FAIR_PERCENT || give.total + get.total === 0) return null;
    const losing = percent < 0;
    const wrap = el("div", "rv-even");
    wrap.appendChild(el("div", "rv-section-title", "Even it out"));
    const grid = el("div", "rv-even-grid");
    wrap.appendChild(grid);

    const [mineCol, mineBody] = section(losing ? "You could swap" : "You could add");
    const [theirCol, theirBody] = section(losing ? "They could add" : "They could swap");
    grid.append(mineCol, theirCol);

    const myId = utilities.getMyUserId();
    const theirId = utilities.getPartnerId();
    candidates(myId, give.items.map((item) => item.id)).then((pool) => {
        if (!pool.length) return renderCombos(mineBody, [], "Couldn't read your inventory right now.");
        const combos = losing ? bestSwaps(pool, give.items, give.total, get.total, false) : bestCombos(pool, give.total, get.total, false);
        renderCombos(mineBody, combos, "Nothing in your inventory gets close.");
    });
    candidates(theirId, get.items.map((item) => item.id)).then((pool) => {
        if (!pool.length) return renderCombos(theirBody, [], "Couldn't read their inventory (it may be private).");
        const combos = losing ? bestCombos(pool, give.total, get.total, true) : bestSwaps(pool, get.items, give.total, get.total, true);
        renderCombos(theirBody, combos, "Nothing in their inventory gets close.");
    });
    return wrap;
}
