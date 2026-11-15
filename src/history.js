/*
Stats and trade history screens. Used by the popup's Stats tab and by the full history page (popup.html?full=1).
All text from Roblox (names, items) goes in with textContent, never as HTML.
*/
import * as utilities from "./utilities";
import { sideNet, percentDiff, verdictKey, VERDICT_TEXT, summarize, cumulativeSeries, formatSigned } from "./tradeMath";

export const HISTORY_KEY = "rovalkTradeHistory";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function getFromStorage(key) {
    return new Promise((resolve) => chrome.storage.local.get([key], (result) => resolve(result?.[key])));
}

function getRolimonsData() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage("getData", (response) => {
            chrome.runtime.lastError;
            resolve(response ?? null);
        });
    });
}

/*
Turns the saved trades into rows. mode "now" prices items with today's Rolimons values (falling back to the value saved
at the time for items Rolimons no longer lists); mode "then" uses only the values saved when the trade was recorded.
*/
export function computeRows(store, data, mode) {
    const rows = [];
    for (const trade of Object.values(store?.trades ?? {})) {
        const offers = utilities.getTradeOffers(trade);
        if (offers.length < 2) continue;
        const sides = offers.slice(0, 2).map((offer, index) => {
            const items = utilities.getTradeOfferItems(offer).map((item) => {
                let value = item.value ?? 0;
                if (mode === "now" && data) {
                    const info = utilities.getItemInfo(item.assetId, utilities.getItemTypeFromAssetData(item), data);
                    if (info && info.value > 0) value = info.value;
                }
                return { ...item, current: value };
            });
            const itemValue = items.reduce((sum, item) => sum + item.current, 0);
            const robux = Number(offer.robux) || 0;
            return { items, robux, net: sideNet(itemValue, robux, index === 1), itemValue };
        });
        const time = Date.parse(trade.created) || trade.savedAt || 0;
        const giveNet = sides[0].net;
        const receiveNet = sides[1].net;
        const percent = percentDiff(giveNet, receiveNet);
        rows.push({
            id: trade.id,
            time,
            partner: trade.partner,
            give: sides[0],
            receive: sides[1],
            giveNet,
            receiveNet,
            profit: receiveNet - giveNet,
            percent,
            verdict: verdictKey(percent),
            //hindsight: how the items on each side moved in value since the trade (only differs in "Current" prices mode)
            gaveChange: sides[0].items.reduce((sum, item) => sum + (item.current - (item.value ?? 0)), 0),
            gotChange: sides[1].items.reduce((sum, item) => sum + (item.current - (item.value ?? 0)), 0)
        });
    }
    return rows;
}

//Downloads the saved trades as a CSV file that opens in Excel or Google Sheets.
function exportCSV(rows) {
    const cell = (value) => {
        const text = String(value ?? "");
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const items = (side) => side.items.map((item) => `${item.name}${item.serial ? ` #${item.serial}` : ""} (${item.current})`).join("; ");
    const lines = [["Date", "Partner", "Verdict", "Percent", "Profit", "You gave", "Robux given", "Gave value", "You got", "Robux got", "Got value", "Hindsight"].join(",")];
    [...rows].sort((a, b) => b.time - a.time).forEach((row) => {
        lines.push([
            row.time ? new Date(row.time).toISOString().slice(0, 10) : "",
            row.partner?.name ?? row.partner?.displayName ?? "",
            VERDICT_TEXT[row.verdict],
            row.percent,
            row.profit,
            items(row.give), row.give.robux, row.giveNet,
            items(row.receive), row.receive.robux, row.receiveNet,
            row.gotChange - row.gaveChange
        ].map(cell).join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rovalk-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function statBox(label, value, sub) {
    const box = el("div", "rv-stat");
    box.append(el("div", "rv-stat-label", label), el("div", "rv-stat-value", value));
    if (sub) box.appendChild(el("div", "rv-stat-sub", sub));
    return box;
}

function buildChart(series, width, height, fmt = (n) => String(n)) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "rv-chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Cumulative profit over time");
    if (series.length < 2) {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", width / 2);
        text.setAttribute("y", height / 2);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "currentColor");
        text.setAttribute("opacity", ".6");
        text.setAttribute("font-size", "13");
        text.textContent = "Not enough trades to draw a chart yet";
        svg.appendChild(text);
        return svg;
    }
    const pad = 6;
    const values = series.map((point) => point.total);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const t0 = series[0].time;
    const tSpan = series[series.length - 1].time - t0 || 1;
    const x = (time) => pad + ((time - t0) / tSpan) * (width - pad * 2);
    const y = (total) => pad + (1 - (total - min) / span) * (height - pad * 2);
    const points = series.map((point) => `${x(point.time).toFixed(1)},${y(point.total).toFixed(1)}`);

    const zero = document.createElementNS(ns, "line");
    zero.setAttribute("x1", pad);
    zero.setAttribute("x2", width - pad);
    zero.setAttribute("y1", y(0));
    zero.setAttribute("y2", y(0));
    zero.setAttribute("stroke", "currentColor");
    zero.setAttribute("opacity", ".3");
    zero.setAttribute("stroke-dasharray", "4 4");

    const area = document.createElementNS(ns, "polygon");
    area.setAttribute("points", `${x(t0)},${y(0)} ${points.join(" ")} ${x(series[series.length - 1].time)},${y(0)}`);
    area.setAttribute("fill", "var(--rv-accent, #EA580C)");
    area.setAttribute("opacity", ".18");

    const line = document.createElementNS(ns, "polyline");
    line.setAttribute("points", points.join(" "));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "var(--rv-accent, #EA580C)");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linejoin", "round");

    //hover: a guide line and dot follow the pointer to the nearest saved trade; the tooltip shows date and running profit
    const guide = document.createElementNS(ns, "line");
    guide.setAttribute("y1", pad);
    guide.setAttribute("y2", height - pad);
    guide.setAttribute("stroke", "currentColor");
    guide.setAttribute("opacity", ".45");
    guide.setAttribute("visibility", "hidden");
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "var(--rv-accent, #EA580C)");
    dot.setAttribute("stroke", "var(--rv-bg, #fff)");
    dot.setAttribute("stroke-width", "2");
    dot.setAttribute("visibility", "hidden");
    svg.append(zero, area, line, guide, dot);

    const wrap = el("div", "rv-chart-wrap");
    const tip = el("div", "rv-chart-tip");
    tip.hidden = true;
    wrap.append(svg, tip);
    const show = (event) => {
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const px = ((event.clientX - rect.left) / rect.width) * width;
        let best = series[0];
        for (const point of series) if (Math.abs(x(point.time) - px) < Math.abs(x(best.time) - px)) best = point;
        const cx = x(best.time);
        const cy = y(best.total);
        guide.setAttribute("x1", cx);
        guide.setAttribute("x2", cx);
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        guide.setAttribute("visibility", "visible");
        dot.setAttribute("visibility", "visible");
        tip.replaceChildren(el("div", "rv-tip-date", best.baseline ? "Start of window" : formatDate(best.time)), el("div", "rv-tip-value", "Running profit: " + formatSigned(best.total, fmt)));
        if (!best.baseline && best.profit !== undefined) tip.appendChild(el("div", "rv-tip-sub", "This trade: " + formatSigned(best.profit, fmt)));
        tip.hidden = false;
        const left = (cx / width) * rect.width;
        tip.style.left = Math.min(Math.max(left, tip.offsetWidth / 2), rect.width - tip.offsetWidth / 2) + "px";
        tip.style.top = Math.max((cy / height) * rect.height - tip.offsetHeight - 10, 0) + "px";
    };
    const hide = () => { guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true; };
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", hide);
    return wrap;
}

const RANGES = [["all", "All time"], ["30d", "30 days"], ["6m", "6 months"], ["1y", "1 year"], ["ytd", "This year"], ["custom", "Custom"]];

//Start and end (ms) of the chosen time window. A custom window with an empty end date runs to the present.
function rangeBounds(state, now = Date.now()) {
    const today = new Date(now);
    const back = (months, days = 0) => { const d = new Date(today); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() - days); return d.getTime(); };
    const day = 86400000;
    switch (state.range) {
        case "30d": return { start: back(0, 30), end: Infinity };
        case "6m": return { start: back(6), end: Infinity };
        case "1y": return { start: back(12), end: Infinity };
        case "ytd": return { start: new Date(today.getFullYear(), 0, 1).getTime(), end: Infinity };
        case "custom": {
            const from = state.from ? new Date(state.from + "T00:00:00").getTime() : 0;
            const to = state.to ? new Date(state.to + "T00:00:00").getTime() + day - 1 : Infinity;
            return { start: Number.isFinite(from) ? from : 0, end: Number.isFinite(to) ? to : Infinity };
        }
        default: return { start: 0, end: Infinity };
    }
}

function formatDate(time) {
    return time ? new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "unknown date";
}

function buildSide(title, side) {
    const column = el("div", "rv-side");
    column.appendChild(el("div", "rv-side-title", `${title} (${utilities.commafyFull(side.net)})`));
    if (side.items.length === 0 && side.robux === 0) column.appendChild(el("div", "rv-side-empty", "nothing"));
    side.items.forEach((item) => {
        const line = el("div", "rv-side-item");
        line.appendChild(el("span", "rv-side-name", item.name + (item.serial ? ` #${item.serial}` : "")));
        line.appendChild(el("span", "rv-side-value", utilities.commafyFull(item.current)));
        column.appendChild(line);
    });
    if (side.robux > 0) {
        const line = el("div", "rv-side-item");
        line.appendChild(el("span", "rv-side-name", "Robux"));
        line.appendChild(el("span", "rv-side-value", utilities.commafyFull(side.robux)));
        column.appendChild(line);
    }
    return column;
}

function buildTradeCard(row) {
    const card = el("div", `rv-trade rv-v-${row.verdict}`);
    const head = el("div", "rv-trade-head");
    const who = row.partner?.displayName || row.partner?.name || "Unknown user";
    head.append(
        el("span", "rv-trade-who", `${who}`),
        el("span", "rv-trade-date", formatDate(row.time)),
        el("span", "rv-trade-pill", `${VERDICT_TEXT[row.verdict]} ${row.percent > 0 ? "+" : ""}${row.percent}%`),
        el("span", "rv-trade-profit", formatSigned(row.profit, utilities.commafyFull))
    );
    const body = el("div", "rv-trade-body");
    body.append(buildSide("You gave", row.give), buildSide("You got", row.receive));
    card.append(head, body);
    if (row.gaveChange || row.gotChange) {
        const fmt = (n) => formatSigned(n, utilities.commafyFull);
        const net = row.gotChange - row.gaveChange;
        const line = el("div", `rv-hindsight ${net > 0 ? "rv-pos" : net < 0 ? "rv-neg" : ""}`);
        line.textContent = `Since then: what you gave ${fmt(row.gaveChange)}, what you got ${fmt(row.gotChange)} → ${net >= 0 ? "the trade aged well" : "you'd be better off having kept your items"} (${fmt(net)})`;
        card.appendChild(line);
    }
    return card;
}

function relativeTime(time) {
    if (!time) return "never";
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
}

/*
Builds the whole screen inside `container` and keeps it up to date. options.full is true on the full page.
*/
export function mountStats(container, options = {}) {
    const full = !!options.full;
    const state = { mode: "now", search: "", filter: "all", sort: "new", shown: 40, range: "all", from: "", to: "" };
    let store = null;
    let data = null;

    container.replaceChildren();
    container.classList.add("rv-history");
    const controls = el("div", "rv-controls");
    const status = el("div", "rv-status");
    const summaryBox = el("div", "rv-summary");
    const chartBox = el("div", "rv-chart-box");
    const listBox = el("div", "rv-list");
    container.append(controls, status, summaryBox, chartBox);
    if (full) container.appendChild(listBox);

    function chip(label, pressed, onClick) {
        const button = el("button", "rv-chip", label);
        button.type = "button";
        button.setAttribute("aria-pressed", String(pressed));
        button.addEventListener("click", onClick);
        return button;
    }

    function renderControls(syncMessage) {
        controls.replaceChildren();
        const modeGroup = el("div", "rv-group");
        modeGroup.append(
            el("span", "rv-group-label", "Prices:"),
            chip("Current", state.mode === "now", () => { state.mode = "now"; render(); }),
            chip("When saved", state.mode === "then", () => { state.mode = "then"; render(); })
        );
        const actions = el("div", "rv-group");
        const sync = el("button", "rv-btn", "Sync now");
        sync.type = "button";
        sync.addEventListener("click", () => {
            sync.disabled = true;
            sync.textContent = "Syncing...";
            chrome.runtime.sendMessage("syncTradeHistory", (result) => {
                chrome.runtime.lastError;
                sync.disabled = false;
                sync.textContent = "Sync now";
                renderControls(describeSync(result));
            });
        });
        actions.appendChild(sync);
        const exportButton = el("button", "rv-btn", "Export CSV");
        exportButton.type = "button";
        exportButton.title = "Download your saved trades as a spreadsheet file";
        exportButton.addEventListener("click", () => exportCSV(computeRows(store, data, state.mode)));
        actions.appendChild(exportButton);
        if (!full) {
            const open = el("button", "rv-btn", "Full history");
            open.type = "button";
            open.addEventListener("click", () => {
                //the build can rename popup.html (for example to popup.1a2b3c.html), so ask the manifest for the real file name
                const manifest = chrome.runtime.getManifest();
                const page = manifest.action?.default_popup ?? manifest.browser_action?.default_popup ?? manifest.options_ui?.page ?? "popup.html";
                chrome.tabs.create({ url: chrome.runtime.getURL(page + "?full=1") });
            });
            actions.appendChild(open);
        }
        controls.append(modeGroup, actions);
        const rangeGroup = el("div", "rv-group rv-range");
        rangeGroup.append(el("span", "rv-group-label", "Time:"));
        for (const [key, label] of RANGES) rangeGroup.appendChild(chip(label, state.range === key, () => { state.range = key; render(); }));
        if (state.range === "custom") {
            const input = (value, label, onChange) => {
                const field = el("input", "rv-date");
                field.type = "date";
                field.value = value;
                field.setAttribute("aria-label", label);
                field.addEventListener("change", () => { onChange(field.value); render(); });
                return field;
            };
            rangeGroup.append(
                input(state.from, "From date", (v) => { state.from = v; }),
                el("span", "rv-group-label", "to"),
                input(state.to, "To date (leave empty for today)", (v) => { state.to = v; }),
                chip("Today", !state.to, () => { state.to = ""; render(); })
            );
        }
        controls.appendChild(rangeGroup);
        if (syncMessage) controls.appendChild(el("div", "rv-sync-message", syncMessage));
    }

    function describeSync(result) {
        if (!result) return "Sync did not respond. Try reloading the extension.";
        if (result.ok) {
            const more = result.remaining > 0 ? ` ${result.remaining} older trades are still waiting; press Sync now again.` : "";
            return `Saved ${result.added} new trade${result.added === 1 ? "" : "s"}.${more}`;
        }
        const reasons = {
            disabled: "Trade History Tracking is turned off in Options.",
            "signed-out": "Sign in to Roblox in this browser first.",
            "rate-limited": "Roblox asked us to slow down. Try again in a minute.",
            busy: "A sync is already running.",
            error: "Sync failed: " + (result.message ?? "unknown error")
        };
        return reasons[result.reason] ?? "Sync failed.";
    }

    function render() {
        renderControls();
        const allRows = computeRows(store, data, state.mode);
        const window_ = rangeBounds(state);
        const rows = allRows.filter((row) => row.time >= window_.start && row.time <= window_.end);
        const count = rows.length;

        const modeNote = state.mode === "now"
            ? (data ? "Profit uses today's Rolimons values." : "Live values were unavailable, so saved values are shown.")
            : "Profit uses the values saved when each trade was first recorded.";
        status.textContent = allRows.length === 0
            ? "No trades saved yet. Make sure you are signed in to Roblox, then press Sync now. Older trades are added a batch at a time."
            : `${count === allRows.length ? count : `${count} of ${allRows.length}`} trade${allRows.length === 1 ? "" : "s"} ${count === allRows.length ? "saved" : "in this time window"}, last sync ${relativeTime(store?.lastSync)}. ${modeNote}`;
        if (count === 0 && allRows.length > 0) status.textContent = `No trades in this time window (${allRows.length} saved in total). Pick a different range.`;

        summaryBox.replaceChildren();
        chartBox.replaceChildren();
        if (count === 0) {
            if (full) listBox.replaceChildren();
            return;
        }
        const summary = summarize(rows);
        const fmt = (n) => utilities.commafy(n);
        summaryBox.append(
            statBox("Trades", String(summary.count), `${summary.wins} W / ${summary.fair} fair / ${summary.losses} L`),
            statBox("Win rate", summary.winRate === null ? "n/a" : `${summary.winRate}%`, "wins vs losses, fair trades left out"),
            statBox("Net profit", formatSigned(summary.net, fmt)),
            statBox("Volume", fmt(summary.volume), "value moved, both sides"),
            statBox("Best trade", formatSigned(summary.best.profit, fmt), summary.best.partner?.displayName || summary.best.partner?.name || ""),
            statBox("Worst trade", formatSigned(summary.worst.profit, fmt), summary.worst.partner?.displayName || summary.worst.partner?.name || "")
        );
        if (state.mode === "now") {
            const hindsight = rows.reduce((sum, row) => sum + (row.gotChange - row.gaveChange), 0);
            summaryBox.appendChild(statBox("Hindsight", formatSigned(hindsight, fmt), "value change of items since each trade (got minus gave)"));
        }
        chartBox.append(el("div", "rv-chart-title", "Running profit over time"), buildChart(cumulativeSeries(rows, window_.start > 0 ? window_.start : undefined), 520, full ? 180 : 110, fmt));

        if (full) renderList(rows);
    }

    function renderList(rows) {
        listBox.replaceChildren();
        const tools = el("div", "rv-controls");
        const search = el("input", "rv-search");
        search.type = "search";
        search.placeholder = "Search by user or item";
        search.value = state.search;
        search.addEventListener("input", () => { state.search = search.value; state.shown = 40; renderListBody(rows, body); });
        const filterGroup = el("div", "rv-group");
        [["all", "All"], ["win", "Wins"], ["fair", "Fair"], ["loss", "Losses"]].forEach(([id, label]) => {
            filterGroup.appendChild(chip(label, state.filter === id, () => { state.filter = id; state.shown = 40; render(); }));
        });
        const sort = el("select", "rv-select");
        [["new", "Newest first"], ["old", "Oldest first"], ["bestpct", "Best trade first (%)"], ["worstpct", "Worst trade first (%)"], ["best", "Biggest win (value)"], ["worst", "Biggest loss (value)"]].forEach(([id, label]) => {
            const option = el("option", "", label);
            option.value = id;
            sort.appendChild(option);
        });
        sort.value = state.sort;
        sort.addEventListener("change", () => { state.sort = sort.value; render(); });
        tools.append(search, filterGroup, sort);
        const body = el("div", "rv-list-body");
        listBox.append(tools, body);
        renderListBody(rows, body);
    }

    function renderListBody(rows, body) {
        const query = state.search.trim().toLowerCase();
        let visible = rows.filter((row) => {
            if (state.filter === "win" && !(row.verdict === "win" || row.verdict === "bigwin")) return false;
            if (state.filter === "loss" && !(row.verdict === "loss" || row.verdict === "bigloss")) return false;
            if (state.filter === "fair" && row.verdict !== "fair") return false;
            if (!query) return true;
            const haystack = [
                row.partner?.name, row.partner?.displayName,
                ...row.give.items.map((item) => item.name), ...row.receive.items.map((item) => item.name)
            ].join(" ").toLowerCase();
            return haystack.includes(query);
        });
        const sorters = {
            new: (a, b) => b.time - a.time,
            old: (a, b) => a.time - b.time,
            best: (a, b) => b.profit - a.profit,
            worst: (a, b) => a.profit - b.profit,
            bestpct: (a, b) => b.percent - a.percent || b.profit - a.profit,
            worstpct: (a, b) => a.percent - b.percent || a.profit - b.profit
        };
        visible = visible.sort(sorters[state.sort]);
        body.replaceChildren();
        if (visible.length === 0) {
            body.appendChild(el("div", "rv-side-empty", "No trades match."));
            return;
        }
        visible.slice(0, state.shown).forEach((row) => body.appendChild(buildTradeCard(row)));
        if (visible.length > state.shown) {
            const more = el("button", "rv-btn", `Show more (${visible.length - state.shown} left)`);
            more.type = "button";
            more.addEventListener("click", () => { state.shown += 40; renderListBody(rows, body); });
            body.appendChild(more);
        }
    }

    async function refresh() {
        [store, data] = await Promise.all([getFromStorage(HISTORY_KEY), getRolimonsData()]);
        render();
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && HISTORY_KEY in changes) refresh();
    });
    refresh();
}
