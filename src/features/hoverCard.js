/*
Hover card: rest the mouse on any link to a limited anywhere on www.roblox.com (catalog, inventories, trades, profiles)
and a small card shows its Rolimons value, RAP, demand and trend, any flags (projected, rare, hyped), and after a
moment the Roblox market: best price, RAP after the next sale, the 7-day change and a 60-day price line.
The star button adds it to (or removes it from) your wishlist. Items Rolimons does not track get no card.
*/
import * as utilities from "../utilities";
import { getMarket, analyze, sparkline, salesUrl, directionFor } from "../market";
import { getWishlist, isWished, toggleWish } from "../store";

const CARD_ID = "rovalkHoverCard";
const OPTION = "Item Hover Cards";
const LINK_SELECTOR = 'a[href*="/catalog/"], a[href*="/bundles/"], a[href*="/bundle/"]';
let enabled = false;
let showTimer = null;
let hideTimer = null;
let marketTimer = null;
let currentKey = null;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function itemFromLink(link) {
    const path = utilities.removeTwoLetterPath(link.pathname || "");
    const id = utilities.getItemIdFromPath(path);
    if (!(id > 0)) return null;
    return { id, type: utilities.getItemTypeFromPath(path) };
}

function hide() {
    clearTimeout(showTimer);
    clearTimeout(marketTimer);
    currentKey = null;
    document.getElementById(CARD_ID)?.remove();
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 220);
}

function place(card, rect) {
    const margin = 10;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = rect.right + margin;
    if (left + width > window.innerWidth - 8) left = rect.left - width - margin;
    if (left < 8) left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    let top = rect.top;
    if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(Math.max(8, top))}px`;
}

function stat(grid, label, value, className) {
    const cell = el("div");
    cell.append(el("div", "rv-hc-k", label), el("div", `rv-hc-v ${className ?? ""}`, value));
    grid.appendChild(cell);
    return cell;
}

//Fills the RAP after sale and best price cells once market data is in.
function fillStats(card, data, info) {
    const afterCell = card.querySelector(".rv-hc-after");
    const bestCell = card.querySelector(".rv-hc-best");
    if (!afterCell || !bestCell) return;
    afterCell.className = "rv-hc-v rv-hc-after";
    if (!data || data.failed) {
        afterCell.textContent = "couldn't load";
        afterCell.classList.add("rv-muted");
        bestCell.textContent = "–";
        const why = data?.errors?.length ? `Roblox didn't answer: ${data.errors.join(", ")}.` : "Roblox didn't return any market data.";
        afterCell.parentElement.title = bestCell.parentElement.title = `${why} RoTrade tries again in a minute.`;
        return;
    }
    bestCell.textContent = data.best ? utilities.commafyFull(data.best) : "none listed";
    if (data.rapAfter) {
        const diff = data.rapAfter - data.rap;
        afterCell.textContent = utilities.commafyFull(data.rapAfter);
        afterCell.appendChild(el("small", diff < 0 ? "rv-neg" : diff > 0 ? "rv-pos" : "rv-muted", ` ${diff > 0 ? "+" : diff < 0 ? "-" : "±"}${utilities.commafyFull(Math.abs(diff))}`));
        afterCell.parentElement.title = `If the cheapest copy (${utilities.commafyFull(data.best)}) sells next, RAP goes from ${utilities.commafyFull(data.rap)} to ${utilities.commafyFull(data.rapAfter)}. Roblox moves RAP a tenth of the way toward each sale price.`;
    } else {
        afterCell.textContent = "no copies listed";
        afterCell.classList.add("rv-muted");
        afterCell.parentElement.title = "Nobody is selling a copy right now, so there is no next sale price to work it out from.";
    }
}

function pct(value) {
    if (value === null || value === undefined) return "–";
    const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function build(item, info) {
    const card = el("div");
    card.id = CARD_ID;
    card.setAttribute("role", "tooltip");
    const head = el("div", "rv-hc-head");
    const name = el("div", "rv-hc-name", info.name);
    if (info.acronym) name.appendChild(el("span", "rv-hc-acr", ` ${info.acronym}`));
    const star = el("button", "rv-hc-star", "★");
    star.type = "button";
    star.setAttribute("aria-pressed", String(isWished(item.id)));
    star.title = isWished(item.id) ? "Remove from wishlist" : "Add to wishlist";
    star.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const on = await toggleWish(item.id, info.name);
        star.setAttribute("aria-pressed", String(on));
        star.title = on ? "Remove from wishlist" : "Add to wishlist";
    });
    head.append(name, star);

    //RAP after sale and best price are always shown; they fill in as soon as Roblox's listings arrive
    const grid = el("div", "rv-hc-grid");
    stat(grid, info.hasValue ? "Value" : "Value (RAP)", utilities.commafyFull(info.value));
    stat(grid, "RAP", utilities.commafyFull(info.rap));
    const after = stat(grid, "RAP after sale", item.type === 2 ? "n/a" : "…", "rv-hc-after");
    stat(grid, "Best price", item.type === 2 ? "n/a" : "…", "rv-hc-best");
    stat(grid, "Demand", info.demandText ?? "–", info.demand >= 3 ? "rv-pos" : info.demand !== null && info.demand <= 1 ? "rv-neg" : "");
    stat(grid, "Trend", info.trendText ?? "–", info.trend === 3 ? "rv-pos" : info.trend === 0 ? "rv-neg" : "");
    if (item.type === 2) after.title = "Bundles have no resale market, so their RAP doesn't move with sales.";

    const tags = el("div", "rv-hc-tags");
    const tag = (text, tone) => tags.appendChild(el("span", `rv-hc-tag ${tone ?? ""}`, text));
    if (info.projected) tag("Projected", "rv-bad");
    if (info.hyped) tag("Hyped", "rv-warn");
    if (info.rare) tag("Rare", "rv-good");
    if (!info.hasValue) tag("RAP-only");

    const market = el("div", "rv-hc-market");
    if (item.type === 2) fillMarket(market, null, info);
    else market.appendChild(el("div", "rv-muted", "Checking sales..."));

    const links = el("div", "rv-hc-links");
    const link = (text, href) => {
        const a = el("a", "", text);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        links.appendChild(a);
    };
    link("Rolimons ↗", item.type === 2 ? `https://www.rolimons.com/bundle/${item.id}` : `https://www.rolimons.com/item/${item.id}`);
    if (item.type !== 2) link("All sales ↗", salesUrl(item.id));

    card.append(head, grid);
    if (tags.childElementCount) card.appendChild(tags);
    card.append(market, links);
    card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.addEventListener("mouseleave", scheduleHide);
    return { card, market };
}

function moveLine(data, info) {
    const move = directionFor(data, info);
    const line = el("div", `rv-hc-move rv-${move.dir === "up" ? "pos" : "neg"}`, `${move.dir === "up" ? "▲ Going up" : "▼ Going down"}${move.pct === null ? "" : ` ${pct(move.pct)}`}`);
    line.appendChild(el("span", "rv-muted", ` · ${move.basis}`));
    return line;
}

function fillMarket(box, data, info) {
    box.replaceChildren();
    box.appendChild(moveLine(data && !data.failed ? data : null, info));
    if (!data || data.failed) {
        box.appendChild(el("div", "rv-muted", data?.failed ? "Couldn't load Roblox sales right now (hover the numbers above for why)." : "No resale data for this item."));
        return;
    }
    if (!data.spark.length) {
        box.appendChild(el("div", "rv-muted", "No sale history from Roblox, only the current listing."));
        return;
    }
    const row = el("div", "rv-hc-mrow");
    const left = el("span", "rv-muted", `${data.salesPerDay >= 10 ? Math.round(data.salesPerDay) : data.salesPerDay.toFixed(1)} sales a day · last 60 days`);
    row.append(left, sparkline(data.spark, 80, 22, data.direction === "down" ? "#f87171" : data.direction === "up" ? "#4ade80" : "currentColor"));
    box.appendChild(row);
    if (data.possiblyProjected) box.appendChild(el("div", "rv-neg", "RAP is well above recent sales: might be projected"));
}

function show(link, item, info) {
    const key = `${item.type}:${item.id}`;
    if (currentKey === key && document.getElementById(CARD_ID)) return;
    document.getElementById(CARD_ID)?.remove();
    currentKey = key;
    const { card, market } = build(item, info);
    document.body.appendChild(card);
    place(card, link.getBoundingClientRect());
    if (item.type === 2) return;
    clearTimeout(marketTimer);
    //wait a moment before asking Roblox, so sweeping the mouse across a page of items does not fire a request for each
    marketTimer = setTimeout(async () => {
        const raw = await getMarket(item.id, item.type);
        if (currentKey !== key) return;
        const data = analyze(raw, info);
        fillStats(card, data, info);
        fillMarket(market, data, info);
        place(card, link.getBoundingClientRect());
    }, 450);
}

function onOver(event) {
    if (!enabled || event.target.closest?.(`#${CARD_ID}, #rovalkTradeTools, #rovalkOrb`)) return;
    const link = event.target.closest?.(LINK_SELECTOR);
    if (!link) return;
    const item = itemFromLink(link);
    const info = item && utilities.getItemInfo(item.id, item.type);
    if (!info) return;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
        if (link.isConnected && link.matches(":hover")) show(link, item, info);
    }, 320);
    link.addEventListener("mouseleave", () => { clearTimeout(showTimer); scheduleHide(); }, { once: true });
}

export function initHoverCard() {
    const read = () => chrome.storage.local.get([OPTION], (result) => {
        enabled = result?.[OPTION] !== false;
        if (!enabled) hide();
    });
    read();
    chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && OPTION in changes) read(); });
    getWishlist();
    utilities.refreshData(() => {});
    document.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
}
