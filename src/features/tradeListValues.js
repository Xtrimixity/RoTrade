/*
Trade list extras (the list of inbound / outbound / completed trades on the left of the trades page):
  Values on Trade Lists   what you give and what you get on each row
  Trade List Grades       a small win/loss ring with the percentage, plus a "hide trades worse than" filter above the list
  Trade Expiry Timers     how long each open trade has left before Roblox expires it
Row ids come from scripts/addTradeIdToRow.js and trade data from the background cache (cachingSystem.js).
*/
import * as utilities from "../utilities";
import { percentDiff, verdictKey, VERDICT_TEXT, formatPercent } from "../tradeMath";
import { KEYS, get as getStored, set as setStored } from "../store";

const FILTER_ID = "rovalkListFilter";
const FILTERS = [["off", "Show all"], ["-10", "Hide worse than -10%"], ["-5", "Hide worse than -5%"], ["0", "Hide losses"], ["5", "Only wins (+5%)"]];
const SORTS = [["roblox", "Newest first"], ["best", "Best trade first"], ["worst", "Worst trade first"]];
const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function ring(percent, verdict) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("class", `rv-tl-ring rv-v-${verdict}`);
    svg.setAttribute("aria-hidden", "true");
    const r = 14;
    const c = 2 * Math.PI * r;
    const track = document.createElementNS(SVG_NS, "circle");
    track.setAttribute("cx", 18); track.setAttribute("cy", 18); track.setAttribute("r", r); track.setAttribute("class", "rv-tl-track");
    const arc = document.createElementNS(SVG_NS, "circle");
    arc.setAttribute("cx", 18); arc.setAttribute("cy", 18); arc.setAttribute("r", r); arc.setAttribute("class", "rv-tl-arc");
    const fraction = Math.min(Math.abs(percent), 50) / 50;
    arc.setAttribute("stroke-dasharray", c.toFixed(2));
    arc.setAttribute("stroke-dashoffset", (c * (1 - fraction)).toFixed(2));
    if (percent < 0) arc.setAttribute("transform", "translate(0 36) scale(1 -1)");
    svg.append(track, arc);
    return svg;
}

function timeLeft(expiration) {
    const end = Date.parse(expiration);
    if (!Number.isFinite(end)) return null;
    const ms = end - Date.now();
    if (ms <= 0 || ms > 31 * 86400000) return null; //Roblox trades last days, not months: anything further out is bad data
    const hours = ms / 3600000;
    return { text: hours < 1 ? `${Math.max(1, Math.round(ms / 60000))}m left` : hours < 48 ? `${Math.round(hours)}h left` : `${Math.round(hours / 24)}d left`, urgent: hours < 24 };
}

function getTradeListData() {
    return new Promise((resolve) => chrome.runtime.sendMessage("getTradeListData", (data) => { chrome.runtime.lastError; resolve(data ?? {}); }));
}

function requestRowIds() {
    if (!document.getElementById("rolimonsAddTradeIdToRowScript")) {
        return new Promise((resolve) => {
            const s = document.createElement("script");
            s.id = "rolimonsAddTradeIdToRowScript";
            s.src = utilities.getURL("scripts/addTradeIdToRow.js"); //connects to the page's own data to add a rolimonsTradeId attribute to each row
            s.onload = () => { document.dispatchEvent(new CustomEvent("addTradeIdToRow")); resolve(); };
            s.onerror = resolve;
            (document.head || document.documentElement).appendChild(s);
        });
    }
    document.dispatchEvent(new CustomEvent("addTradeIdToRow"));
    return Promise.resolve();
}

//The bar above the trade list: sort, filter and a shortcut to the Rolimons trade ad builder.
function ensureBar(firstRow, state, handlers) {
    const list = firstRow.parentElement;
    let bar = document.getElementById(FILTER_ID);
    if (bar && bar.nextElementSibling !== list) bar.remove(); //Roblox rebuilt the list
    bar = document.getElementById(FILTER_ID);
    if (!bar) {
        bar = el("div");
        bar.id = FILTER_ID;
        list.insertAdjacentElement("beforebegin", bar);
    }
    const signature = JSON.stringify([state.grades, state.sort, state.filter]);
    if (bar.dataset.sig !== signature) {
        bar.dataset.sig = signature;
        bar.replaceChildren();
        if (state.grades) {
            const select = (options, value, label, onChange) => {
                const node = el("select", "rv-tl-select");
                node.setAttribute("aria-label", label);
                options.forEach(([key, text]) => {
                    const option = el("option", "", text);
                    option.value = key;
                    node.appendChild(option);
                });
                node.value = value;
                node.addEventListener("change", () => onChange(node.value));
                return node;
            };
            bar.append(
                select(SORTS, state.sort, "Sort trades", handlers.sort),
                select(FILTERS, state.filter, "Filter trades by how good they are", handlers.filter)
            );
        }
        bar.appendChild(el("span", "rv-tl-hidden"));
        const ad = el("button", "rv-tl-ad", "Trade ad");
        ad.type = "button";
        ad.title = "Open the Rolimons trade ad builder (auto-posts every 15.5 minutes)";
        ad.addEventListener("click", () => chrome.runtime.sendMessage({ title: "openPopupTab", tab: "ads" }, () => chrome.runtime.lastError));
        bar.appendChild(ad);
    }
    return bar;
}

//Sorting never moves Roblox's rows: the list becomes a flex column and each row gets a CSS order.
function applySort(rows, scores, mode) {
    const list = rows[0]?.parentElement;
    if (!list) return;
    if (mode === "roblox") {
        if (list.dataset.rvSorted) {
            delete list.dataset.rvSorted;
            list.style.removeProperty("display");
            list.style.removeProperty("flex-direction");
            rows.forEach((row) => row.style.removeProperty("order"));
        }
        return;
    }
    list.dataset.rvSorted = "1";
    list.style.setProperty("display", "flex", "important");
    list.style.setProperty("flex-direction", "column", "important");
    const ranked = rows.filter((row) => scores.has(row)).sort((a, b) => (mode === "best" ? scores.get(b) - scores.get(a) : scores.get(a) - scores.get(b)));
    ranked.forEach((row, index) => { row.style.order = String(index); });
    rows.filter((row) => !scores.has(row)).forEach((row) => { row.style.order = "9999"; }); //trades RoValk has no data for yet go last
}

/*
The background cache (cachingSystem.js) only refreshes once a minute and loads at most 20 trades per run,
so a trade that just arrived has no data yet. Rows like that are fetched here straight away and kept for this page.
They are not written to the background cache, so trade notifications still fire as normal.
*/
const liveTrades = {};
const inFlight = new Set();
async function fetchMissingTrades(ids) {
    const todo = ids.filter((id) => !inFlight.has(id)).slice(0, 12);
    if (!todo.length) return false;
    todo.forEach((id) => inFlight.add(id));
    let added = false;
    for (let i = 0; i < todo.length; i += 4) {
        await Promise.all(todo.slice(i, i + 4).map(async (id) => {
            try {
                const response = await fetch(`https://trades.roblox.com/v2/trades/${id}`, { credentials: "include" });
                if (response.status !== 200) return;
                const trade = await response.json();
                trade.tradeType = trade.status === "Open" ? "open" : String(trade.status ?? "").toLowerCase();
                liveTrades[id] = trade;
                added = true;
            } catch { /* try again on the next update */ }
            finally { inFlight.delete(id); }
        }));
    }
    return added;
}

let running = false;
let pending = false;
async function updateTradeListValues() {
    const [valuesOn, gradesOn, expiryOn] = await Promise.all([
        utilities.getOption("Values on Trade Lists"), utilities.getOption("Trade List Grades"), utilities.getOption("Trade Expiry Timers")
    ]);
    if (!valuesOn && !gradesOn && !expiryOn) return stripTradeListValues();
    if (running) { pending = true; return; }
    running = true;
    try {
        await utilities.waitForElm(".trade-row");
        const [cachedData] = await Promise.all([getTradeListData(), requestRowIds()]);
        const tradeListData = { ...liveTrades, ...cachedData };
        const missing = [];
        await new Promise((resolve) => setTimeout(resolve, 50)); //let the page script finish tagging rows
        const threshold = await getStoredFilter();
        const sortMode = await getStoredSort();
        const scores = new Map();
        const rows = [...document.querySelectorAll(".trade-row")];
        let hiddenCount = 0;

        for (const row of rows) {
            const rowId = row.getAttribute("rolimonsTradeId");
            const tradeData = tradeListData[rowId];
            if (!tradeData) {
                if (/^\d+$/.test(rowId ?? "")) missing.push(rowId);
                continue;
            }
            const totals = utilities.calculateTotalsFromExtraData(tradeData, utilities.getRolimonsData(), false);
            const give = totals[0] ?? 0;
            const receive = totals[1] ?? 0;
            const percent = give > 0 ? percentDiff(give, receive) : (receive > 0 ? 100 : 0);
            const verdict = verdictKey(percent);
            scores.set(row, percent);

            row.querySelector(".tradeListValuesBox")?.remove();
            const box = el("div", `tradeListValuesBox rv-tlv rv-v-${verdict}`);
            if (gradesOn) {
                const grade = el("div", "rv-tl-grade");
                grade.append(ring(percent, verdict), el("span", "rv-tl-pct", formatPercent(percent)));
                grade.title = `${VERDICT_TEXT[verdict]}: you give ${utilities.commafyFull(give)}, you get ${utilities.commafyFull(receive)}`;
                box.appendChild(grade);
            }
            if (valuesOn) {
                const values = el("div", "rv-tl-values");
                values.append(el("span", "rv-tl-give", utilities.commafy(give)), el("span", "rv-tl-get", utilities.commafy(receive)));
                values.title = "Top: what you give. Bottom: what you get (Rolimons value, or RAP when there is none)";
                box.appendChild(values);
            }
            const left = expiryOn && (tradeData.tradeType === "inbound" || tradeData.tradeType === "outbound" || tradeData.tradeType === "open") ? timeLeft(tradeData.expiration) : null;
            if (left) {
                const chip = el("span", `rv-tl-exp${left.urgent ? " rv-urgent" : ""}`, left.text);
                chip.title = `Expires ${new Date(tradeData.expiration).toLocaleString()}`;
                box.appendChild(chip);
            }
            if (box.childElementCount) (row.querySelector(".trade-row-details") || row).appendChild(box);

            const hide = gradesOn && threshold !== "off" && percent < Number(threshold);
            row.style.display = hide ? "none" : "";
            if (hide) hiddenCount++;
        }

        if (rows[0]) {
            const bar = ensureBar(rows[0], { grades: !!gradesOn, sort: sortMode, filter: threshold }, {
                sort: async (value) => { await setStored(KEYS.listSort, value); updateTradeListValues(); },
                filter: async (value) => { await setStored(KEYS.listFilter, value); updateTradeListValues(); }
            });
            bar.querySelector(".rv-tl-hidden").textContent = hiddenCount ? `${hiddenCount} hidden` : "";
            applySort(rows, scores, gradesOn ? sortMode : "roblox");
        }
        if (missing.length && await fetchMissingTrades(missing)) pending = true; //draw the new rows as soon as their data is in
    } finally {
        running = false;
        if (pending) {
            pending = false;
            setTimeout(updateTradeListValues, 100); //rows arrived while we were busy
        }
    }
}

async function getStoredSort() {
    const value = await getStored(KEYS.listSort, "roblox");
    return SORTS.some(([key]) => key === value) ? value : "roblox";
}

async function getStoredFilter() {
    const value = await getStored(KEYS.listFilter, "off");
    return FILTERS.some(([key]) => key === value) ? value : "off";
}

function stripTradeListValues() {
    for (const element of document.querySelectorAll(".tradeListValuesBox")) element.remove();
    for (const row of document.querySelectorAll(".trade-row")) {
        row.style.display = "";
        row.style.removeProperty("order");
    }
    document.querySelectorAll("[data-rv-sorted]").forEach((list) => {
        delete list.dataset.rvSorted;
        list.style.removeProperty("display");
        list.style.removeProperty("flex-direction");
    });
    document.getElementById(FILTER_ID)?.remove();
}

export default updateTradeListValues;
