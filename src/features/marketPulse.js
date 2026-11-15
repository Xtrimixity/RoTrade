/*
Market pulse: is each item in the trade rising or falling, judged by what it actually sells for on Roblox.
  Card badges   a small arrow with the 7-day price change on every item in the two offers
  Panel section a Market table (best price, RAP, RAP after the next sale at the best price, 7 / 30 day change,
                a 60-day price line, sales per day) plus warnings and "RAP after next sale" totals per side
Data comes from market.js (Roblox resale data and current listings). Only items in the open trade are looked up.
*/
import * as utilities from "../utilities";
import { getMarket, analyze, sparkline, salesUrl, directionFor } from "../market";

const OPTION = "Market Pulse";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function pct(number, digits = 0) {
    if (number === null || number === undefined || !Number.isFinite(number)) return "–";
    const rounded = Number(number.toFixed(digits));
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

const ARROWS = { up: "▲", down: "▼" };

export async function marketFor(item) {
    const raw = await getMarket(item.id, item.type);
    return analyze(raw, utilities.getItemInfo(item.id, item.type));
}

function offerCards() {
    const pageType = utilities.getPageType();
    if (pageType === "details") return [...document.querySelectorAll(".trade-list-detail-offer .item-card-container")];
    if (pageType === "sendOrCounter") return [...document.querySelectorAll(".trade-request-window-offer .trade-request-item")];
    return [];
}

//Arrow badges on the item cards in both offers.
export async function updateMarketBadges() {
    const enabled = await utilities.getOption(OPTION);
    if (!enabled) {
        document.querySelectorAll(".rv-mkt-badge").forEach((badge) => badge.remove());
        return;
    }
    for (const card of offerCards()) {
        const item = utilities.readCardItem(card);
        if (!item) continue;
        const key = String(item.id);
        if (card.dataset.rvMkt === key && card.querySelector(".rv-mkt-badge")) continue;
        card.dataset.rvMkt = key;
        card.querySelector(".rv-mkt-badge")?.remove();
        const anchor = card.querySelector(".item-card-thumb-container") || card;
        if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative";
        (item.type === 2 ? Promise.resolve(null) : marketFor(item)).then((loaded) => {
            const market = loaded && !loaded.failed ? loaded : null;
            if (card.dataset.rvMkt !== key) return;
            card.querySelector(".rv-mkt-badge")?.remove();
            const move = directionFor(market, utilities.getItemInfo(item.id, item.type));
            const badge = el("span", `rv-mkt-badge rv-${move.dir}${move.weak ? " rv-weak" : ""}`, `${ARROWS[move.dir]}${move.pct === null ? "" : ` ${pct(move.pct, Math.abs(move.pct) < 10 ? 1 : 0)}`}`);
            const lines = [
                `${move.dir === "up" ? "Going up" : "Going down"} (${move.basis}${move.pct === null ? "" : ` ${pct(move.pct, 1)}`})`,
                market?.change7 !== null && market?.change7 !== undefined && move.basis !== "sale prices this week" ? `Sale prices ${pct(market.change7, 1)} over the last week` : null,
                market ? (market.best ? `Best price: ${utilities.commafyFull(market.best)}` : "No copies for sale right now") : null,
                market?.rapAfter ? `RAP ${utilities.commafyFull(market.rap)} → ${utilities.commafyFull(market.rapAfter)} if the cheapest copy sells` : null
            ].filter(Boolean);
            badge.title = lines.join("\n");
            anchor.appendChild(badge);
        });
    }
}

/*
The Market section of the trade breakdown panel. give / get are the sides from tradeTools.js
({ items: [{ id, type, name, rap, value, ... }], robux }). Returns an element that fills itself in when the data arrives.
*/
export function buildMarketSection(give, get) {
    const wrap = el("div", "rv-market");
    const title = el("div", "rv-section-title", "Market (Roblox sales)");
    const body = el("div", "rv-market-body");
    body.appendChild(el("div", "rv-market-loading", "Checking recent sales and listings..."));
    wrap.append(title, body);

    const sides = [["You give", give], ["You get", get]];
    const jobs = sides.map(([, side]) => Promise.all(side.items.map((item) => (item.type === 2 ? Promise.resolve(null) : marketFor(item)))));
    Promise.all(jobs).then((results) => {
        body.replaceChildren();
        const table = el("div", "rv-market-table");
        const head = el("div", "rv-market-row rv-market-head");
        ["Item", "Best price", "RAP → after sale", "7d", "30d", "60 days", "Sold/day"].forEach((text) => head.appendChild(el("span", "", text)));
        table.appendChild(head);
        const notes = [];
        const sideTotals = [];

        sides.forEach(([label, side], sideIndex) => {
            if (!side.items.length) return;
            const group = el("div", "rv-market-group", label);
            table.appendChild(group);
            let rapNow = 0;
            let rapNext = 0;
            side.items.forEach((item, index) => {
                const loaded = results[sideIndex][index];
                const market = loaded && !loaded.failed ? loaded : null;
                const row = el("div", "rv-market-row");
                const nameCell = el("span", "rv-market-name");
                const link = el("a", "", item.name);
                link.href = salesUrl(item.id);
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.title = "See every sale on Rolimons";
                nameCell.appendChild(link);
                if (!market) {
                    const move = directionFor(null, utilities.getItemInfo(item.id, item.type));
                    const arrow = el("span", `rv-dir rv-${move.dir}`, ARROWS[move.dir]);
                    arrow.title = `${move.dir === "up" ? "Going up" : "Going down"}: ${move.basis}`;
                    nameCell.prepend(arrow);
                    const reason = el("span", "rv-muted", item.type === 2 ? "bundle" : "couldn't load");
                    if (loaded?.errors?.length) reason.title = `Roblox didn't answer: ${loaded.errors.join(", ")}`;
                    row.append(nameCell, reason, el("span"), el("span"), el("span"), el("span"), el("span"));
                    table.appendChild(row);
                    rapNow += item.rap;
                    rapNext += item.rap;
                    return;
                }
                rapNow += market.rap;
                rapNext += market.rapAfter ?? market.rap;
                const move = directionFor(market, utilities.getItemInfo(item.id, item.type));
                const arrow = el("span", `rv-dir rv-${move.dir}`, ARROWS[move.dir]);
                arrow.title = `${move.dir === "up" ? "Going up" : "Going down"}: ${move.basis}`;
                nameCell.prepend(arrow);
                const bestCell = el("span", "", market.best ? utilities.commafyFull(market.best) : "none listed");
                if (market.bestVsRap !== null) {
                    const sub = el("small", market.bestVsRap < -10 ? "rv-neg" : market.bestVsRap > 10 ? "rv-pos" : "rv-muted", ` ${pct(market.bestVsRap)} vs RAP`);
                    bestCell.appendChild(sub);
                }
                const rapCell = el("span", "", utilities.commafyFull(market.rap));
                if (market.rapAfter && market.rapAfter !== market.rap) {
                    rapCell.appendChild(el("small", market.rapAfter < market.rap ? "rv-neg" : "rv-pos", ` → ${utilities.commafyFull(market.rapAfter)}`));
                }
                const change = (value) => el("span", value === null ? "rv-muted" : value > 5 ? "rv-pos" : value < -5 ? "rv-neg" : "", pct(value));
                const sparkCell = el("span", "rv-market-spark");
                sparkCell.appendChild(sparkline(market.spark, 88, 22, market.direction === "down" ? "var(--rv-bad)" : market.direction === "up" ? "var(--rv-good)" : "currentColor"));
                row.append(nameCell, bestCell, rapCell, change(market.change7), change(market.change30), sparkCell, el("span", "", market.salesPerDay >= 10 ? Math.round(market.salesPerDay).toString() : market.salesPerDay.toFixed(1)));
                table.appendChild(row);

                const receiving = sideIndex === 1;
                if (market.possiblyProjected && !item.projected) notes.push(["bad", `${item.name} might be projected: RAP is ${Math.round((market.rap / market.typical - 1) * 100)}% above its recent sales`]);
                if (market.bestVsRap !== null && market.bestVsRap <= -20) notes.push([receiving ? "warn" : "info", `${item.name}: cheapest copy is ${Math.round(-market.bestVsRap)}% under RAP, so its RAP is likely to drop`]);
                if (market.change7 !== null && market.change7 <= -15) notes.push([receiving ? "bad" : "good", `${item.name} is falling: down ${Math.round(-market.change7)}% this week`]);
                if (market.change7 !== null && market.change7 >= 15) notes.push([receiving ? "good" : "warn", `${item.name} is rising: up ${Math.round(market.change7)}% this week`]);
                if (market.salesPerDay < 0.2 && market.spark.length) notes.push(["info", `${item.name} rarely sells (about ${Math.max(1, Math.round(market.salesPerDay * 30))} a month)`]);
            });
            sideTotals.push([label, rapNow, rapNext]);
        });

        body.appendChild(table);
        if (sideTotals.length) {
            const totals = el("div", "rv-market-totals");
            totals.appendChild(el("span", "rv-muted", "RAP if the cheapest copies sell next: "));
            sideTotals.forEach(([label, now, next], index) => {
                if (index) totals.appendChild(document.createTextNode(" · "));
                const diff = next - now;
                totals.appendChild(el("b", "", `${label.toLowerCase()} ${utilities.commafyFull(now)} → ${utilities.commafyFull(next)}`));
                if (diff) totals.appendChild(el("span", diff < 0 ? "rv-neg" : "rv-pos", ` (${diff > 0 ? "+" : ""}${utilities.commafyFull(diff)})`));
            });
            body.appendChild(totals);
        }
        if (notes.length) {
            const chips = el("div", "rv-alerts");
            notes.forEach(([tone, text]) => chips.appendChild(el("span", `rv-alert rv-${tone}`, text)));
            body.appendChild(chips);
        }
        body.appendChild(el("div", "rv-market-foot", "Daily averages from Roblox. Item names open their full sale list on Rolimons."));
    });
    return wrap;
}

export const MARKET_OPTION = OPTION;
