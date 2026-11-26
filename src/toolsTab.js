/*
Popup "Tools" tab. A row of chips switches between:
  Trade queue     set up one trade and RoTrade fills it in for each person; you press Make Offer (queueView.js)
  Wishlist        items you starred (also from the hover card); highlighted in trades and inventories
  Value changes   every Rolimons value change RoValk has seen, yours first
  Goal planner    pick an item you want and see which of your items add up to it
  Compare offers  inbound trades that ask for the same item of yours, side by side
  Portfolio       what your inventory is made of, and its value over time
  Expiring        open trades that run out soon
*/
import * as utilities from "./utilities";
import { KEYS, get, onChange, toggleWish } from "./store";
import { percentDiff, verdictKey, VERDICT_TEXT, formatPercent } from "./tradeMath";
import { queueView } from "./queueView";
import { el, button, send, rolimonsData, myInventory, itemSearch, info, relative, section, thumbnails, thumb } from "./popupKit";

const VIEWS = [
    ["queue", "Trade queue"], ["wishlist", "Wishlist"], ["changes", "Value changes"], ["goal", "Goal planner"],
    ["compare", "Compare offers"], ["portfolio", "Portfolio"], ["expiring", "Expiring"]
];
const SVG_NS = "http://www.w3.org/2000/svg";
const PIE_COLORS = ["#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#A78BFA", "#F87171", "#2DD4BF", "#94A3B8"];

function svg(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
}

function empty(text) {
    return el("p", "rv-calc-hint", text);
}

function itemRow(name, valueText, extra, id) {
    const row = el("div", "rv-tool-row");
    if (id) row.appendChild(thumb(id, name, 32));
    row.append(el("span", "rv-side-name", name), el("span", "rv-side-value", valueText));
    if (extra) row.appendChild(extra);
    return row;
}

export async function mountTools(container) {
    let view = "queue";
    container.replaceChildren(el("p", "rv-calc-hint", "Loading..."));
    const data = await rolimonsData();
    const nav = el("div", "rv-tool-nav");
    const body = el("div", "rv-tool-body");
    container.replaceChildren(nav, body);

    function renderNav() {
        nav.replaceChildren();
        VIEWS.forEach(([id, label]) => {
            const chip = button(label, "rv-chip", () => { view = id; renderNav(); render(); });
            chip.setAttribute("aria-pressed", String(view === id));
            nav.appendChild(chip);
        });
    }

    async function render() {
        body.replaceChildren(el("p", "rv-calc-hint", "Loading..."));
        const views = { queue: () => queueView(data, render), wishlist, changes, goal, compare, portfolio, expiring };
        const content = await views[view]();
        body.replaceChildren(...[].concat(content));
    }

    //---------- wishlist ----------
    async function wishlist() {
        const list = await get(KEYS.wishlist, {});
        const box = section("Wishlist", "Starred items get a gold star in trades and inventories. Star items from here or from the hover card on any Roblox page.");
        box.appendChild(itemSearch(data, "Add an item to your wishlist", async (item) => {
            if (!list[item.id]) await toggleWish(item.id, item.name);
            render();
        }));
        const entries = Object.entries(list).sort((a, b) => (b[1].added ?? 0) - (a[1].added ?? 0));
        await thumbnails(entries.map(([id]) => id));
        if (!entries.length) box.appendChild(empty("Nothing starred yet."));
        entries.forEach(([id, entry]) => {
            const detail = info(id, data);
            const actions = el("span", "rv-tool-actions");
            actions.append(
                button("×", "rv-ad-x", async () => { await toggleWish(Number(id), entry.name); render(); })
            );
            box.appendChild(itemRow(entry.name, detail ? `${utilities.commafy(detail.value)}${detail.demandText ? ` · ${detail.demandText}` : ""}` : "", actions, id));
        });
        return box;
    }

    //---------- value changes ----------
    let changesFilter = "mine";
    async function changes() {
        const list = await get(KEYS.valueChanges, []);
        const box = section("Value changes", "Rolimons value changes RoTrade has noticed (checked every 10 minutes while Chrome is open). Get notified about your own items with Settings → Notifications → Value changes.");
        const filters = el("div", "rv-group");
        [["mine", "My items"], ["all", "All items"], ["up", "Raised"], ["down", "Lowered"]].forEach(([id, label]) => {
            const chip = button(label, "rv-chip", () => { changesFilter = id; render(); });
            chip.setAttribute("aria-pressed", String(changesFilter === id));
            filters.appendChild(chip);
        });
        box.appendChild(filters);
        const shown = list.filter((change) => {
            if (changesFilter === "mine") return change.owned;
            if (changesFilter === "up") return change.to > change.from;
            if (changesFilter === "down") return change.to < change.from;
            return true;
        }).slice(0, 60);
        if (!list.length) box.appendChild(empty("No changes seen yet. RoTrade compares values every 10 minutes, so give it a little while."));
        else if (!shown.length) box.appendChild(empty("Nothing matches this filter."));
        shown.forEach((change) => {
            const up = change.to > change.from;
            const percent = change.from > 0 && change.to > 0 ? formatPercent(Math.round((change.to / change.from - 1) * 1000) / 10) : (change.to > 0 ? "newly valued" : "value removed");
            const row = el("div", "rv-tool-row rv-tool-row2");
            const text = el("div");
            const name = el("div", "rv-side-name", change.name);
            if (change.owned) name.appendChild(el("span", "rv-own", " yours"));
            text.append(name, el("span", "rv-tool-sub", `${change.from > 0 ? utilities.commafyFull(change.from) : "–"} → ${change.to > 0 ? utilities.commafyFull(change.to) : "–"} · ${relative(change.time)}`));
            row.append(text, el("span", `rv-tool-pct ${up ? "rv-pos" : "rv-neg"}`, percent));
            box.appendChild(row);
        });
        return box;
    }

    //---------- goal planner ----------
    let goalTarget = null;
    async function goal() {
        const box = section("Goal planner", "Pick an item you want. RoTrade adds up your inventory and finds the 1 to 4 of your items whose value lands closest to it (aiming for 0-10% over, a usual upgrade overpay).");
        box.appendChild(itemSearch(data, "Search the item you want", (item) => { goalTarget = item; render(); }));
        const inventory = await myInventory();
        if (!goalTarget) {
            box.appendChild(empty("No goal picked yet."));
            return box;
        }
        const target = info(goalTarget.id, data);
        if (!target?.value) {
            box.appendChild(empty("That item has no value or RAP to aim for."));
            return box;
        }
        const mine = (inventory?.items ?? []).map((item) => ({ ...item, detail: info(item.assetId, data) })).filter((item) => item.detail?.value > 0);
        const total = mine.reduce((sum, item) => sum + item.detail.value, 0);
        const head = el("div", "rv-goal-head");
        const progress = Math.min(100, Math.round((total / target.value) * 100));
        head.append(
            el("div", "rv-goal-name", target.name),
            el("div", "", `Value ${utilities.commafyFull(target.value)} · your inventory ${utilities.commafyFull(total)} (${progress}%)`)
        );
        const bar = el("div", "rv-goal-bar");
        const fill = el("div", "rv-goal-fill");
        fill.style.width = `${progress}%`;
        bar.appendChild(fill);
        head.appendChild(bar);
        box.appendChild(head);
        if (!mine.length) {
            box.appendChild(empty("Couldn't read your inventory. Sign in to Roblox in this browser and try again."));
            return box;
        }
        if (total < target.value * 0.95) {
            box.appendChild(empty(`You're ${utilities.commafyFull(target.value - total)} short in total value, so no combination reaches it yet.`));
            return box;
        }
        //search combinations of 1 to 4 of your 40 most valuable items
        const pool = mine.sort((a, b) => b.detail.value - a.detail.value).filter((item) => item.detail.value <= target.value * 1.3).slice(0, 40);
        const goalValue = target.value;
        const best = [];
        const consider = (combo, sum) => {
            const over = sum / goalValue - 1;
            if (over < -0.05 || over > 0.3) return;
            const score = Math.abs(over - 0.05) + combo.length * 0.01;
            best.push({ combo, sum, over, score });
            if (best.length > 60) { best.sort((a, b) => a.score - b.score); best.length = 20; }
        };
        for (let a = 0; a < pool.length; a++) {
            const va = pool[a].detail.value;
            consider([a], va);
            for (let b = a + 1; b < pool.length; b++) {
                const vb = va + pool[b].detail.value;
                if (vb > goalValue * 1.3) continue;
                consider([a, b], vb);
                for (let c = b + 1; c < pool.length; c++) {
                    const vc = vb + pool[c].detail.value;
                    if (vc > goalValue * 1.3) continue;
                    consider([a, b, c], vc);
                    for (let d = c + 1; d < pool.length; d++) {
                        const vd = vc + pool[d].detail.value;
                        if (vd <= goalValue * 1.3) consider([a, b, c, d], vd);
                    }
                }
            }
        }
        best.sort((a, b) => a.score - b.score);
        const seen = new Set();
        const top = best.filter((entry) => {
            //combos that only differ by a tiny filler item count as the same suggestion
            const key = entry.combo.filter((i) => pool[i].detail.value >= goalValue * 0.05).map((i) => pool[i].assetId).sort().join(",");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 4);
        if (!top.length) box.appendChild(empty("No mix of up to 4 of your items lands near its value. Try adding Robux or more items."));
        top.forEach((entry) => {
            const card = el("div", "rv-goal-combo");
            card.appendChild(el("div", "rv-goal-sum", `${utilities.commafyFull(entry.sum)} · ${formatPercent(Math.round(entry.over * 1000) / 10)} vs its value`));
            entry.combo.forEach((i) => card.appendChild(itemRow(pool[i].detail.name, utilities.commafy(pool[i].detail.value))));
            box.appendChild(card);
        });
        return box;
    }

    //---------- compare offers ----------
    async function compare() {
        const box = section("Compare offers", "Inbound trades that ask for the same item of yours, best offer first. Values are today's Rolimons values (or RAP).");
        const trades = Object.values((await send("getTradeListData")) ?? {}).filter((trade) => trade.tradeType === "inbound");
        const groups = new Map();
        for (const trade of trades) {
            const offers = utilities.getTradeOffers(trade);
            if (offers.length < 2) continue;
            const totals = utilities.calculateTotalsFromExtraData(trade, data, false);
            const giveTotal = totals[0] ?? 0;
            const getTotal = totals[1] ?? 0;
            const theirItems = utilities.getTradeOfferItems(offers[1]).map((item) => item.name ?? info(item.assetId ?? item.itemTarget?.targetId, data)?.name ?? "item");
            for (const item of utilities.getTradeOfferItems(offers[0])) {
                const id = Number(item.assetId ?? item.itemTarget?.targetId);
                if (!id) continue;
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push({ trade, giveTotal, getTotal, theirItems, robux: offers[1].robux ?? 0, percent: giveTotal > 0 ? percentDiff(giveTotal, getTotal) : 0 });
            }
        }
        const shared = [...groups.entries()].filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length);
        if (!trades.length) box.appendChild(empty("No inbound trades cached yet. Open your trades page once and give RoTrade a minute (Settings → Trade list → Values must be on)."));
        else if (!shared.length) box.appendChild(empty("None of your items are wanted by more than one inbound trade right now."));
        shared.forEach(([id, list]) => {
            const card = el("div", "rv-compare-card");
            const detail = info(id, data);
            card.appendChild(el("div", "rv-compare-title", `${detail?.name ?? `Item ${id}`} · ${list.length} offers`));
            list.sort((a, b) => b.percent - a.percent).forEach((entry, index) => {
                const verdict = verdictKey(entry.percent);
                const row = el("div", `rv-compare-offer rv-v-${verdict}`);
                const left = el("div");
                left.append(
                    el("div", "rv-side-name", `${index === 0 ? "★ " : ""}${entry.trade.user?.displayName ?? entry.trade.user?.name ?? "Someone"}`),
                    el("span", "rv-tool-sub", `${entry.theirItems.join(", ") || "no items"}${entry.robux ? ` + R$ ${utilities.commafyFull(entry.robux)}` : ""}`)
                );
                const right = el("div", "rv-compare-num");
                right.append(el("div", verdict.includes("win") ? "rv-pos" : verdict.includes("loss") ? "rv-neg" : "", formatPercent(entry.percent)), el("div", "rv-tool-sub", `${utilities.commafy(entry.getTotal)} for ${utilities.commafy(entry.giveTotal)}`));
                row.append(left, right);
                row.title = VERDICT_TEXT[verdict];
                card.appendChild(row);
            });
            box.appendChild(card);
        });
        return box;
    }

    //---------- portfolio ----------
    async function portfolio() {
        const box = section("Portfolio", "What your inventory is made of, using today's Rolimons values (RAP for items without one).");
        const inventory = await myInventory();
        const items = (inventory?.items ?? []).map((item) => ({ ...item, detail: info(item.assetId, data) })).filter((item) => item.detail);
        if (!items.length) {
            box.appendChild(empty("Couldn't read your inventory. Sign in to Roblox in this browser and try again."));
            return box;
        }
        const total = items.reduce((sum, item) => sum + item.detail.value, 0);
        const rap = items.reduce((sum, item) => sum + item.detail.rap, 0);
        const share = (filter) => total ? Math.round(items.filter(filter).reduce((sum, item) => sum + item.detail.value, 0) / total * 100) : 0;
        const stats = el("div", "rv-summary");
        const stat = (label, value, sub) => {
            const node = el("div", "rv-stat");
            node.append(el("div", "rv-stat-label", label), el("div", "rv-stat-value", value));
            if (sub) node.appendChild(el("div", "rv-stat-sub", sub));
            stats.appendChild(node);
        };
        stat("Value", utilities.commafy(total), `${items.length} items`);
        stat("RAP", utilities.commafy(rap));
        stat("Biggest item", `${share((item) => item === [...items].sort((a, b) => b.detail.value - a.detail.value)[0])}%`, [...items].sort((a, b) => b.detail.value - a.detail.value)[0].detail.name);
        stat("Projected", `${share((item) => item.detail.projected)}%`, "of value");
        stat("RAP-only", `${share((item) => !item.detail.hasValue)}%`, "no Rolimons value");
        stat("Rare", `${share((item) => item.detail.rare)}%`, "of value");
        box.appendChild(stats);

        //donut by item (same items grouped)
        const grouped = new Map();
        items.forEach((item) => {
            const entry = grouped.get(item.assetId) ?? { name: item.detail.name, value: 0, count: 0 };
            entry.value += item.detail.value;
            entry.count++;
            grouped.set(item.assetId, entry);
        });
        const slices = [...grouped.values()].sort((a, b) => b.value - a.value);
        const top = slices.slice(0, 7);
        const rest = slices.slice(7).reduce((sum, entry) => sum + entry.value, 0);
        if (rest > 0) top.push({ name: `${slices.length - 7} other items`, value: rest, count: 0 });
        const chartRow = el("div", "rv-pie-row");
        const pie = svg("svg", { viewBox: "0 0 120 120", class: "rv-pie", role: "img", "aria-label": "Inventory value by item" });
        let angle = -Math.PI / 2;
        top.forEach((slice, index) => {
            const portion = total ? slice.value / total : 0;
            if (portion <= 0) return;
            const end = angle + portion * Math.PI * 2;
            const large = portion > 0.5 ? 1 : 0;
            const point = (a, r) => [60 + Math.cos(a) * r, 60 + Math.sin(a) * r];
            const [x1, y1] = point(angle, 54);
            const [x2, y2] = point(end - 0.0001, 54);
            const [x3, y3] = point(end - 0.0001, 32);
            const [x4, y4] = point(angle, 32);
            const path = svg("path", { d: `M${x1} ${y1} A54 54 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A32 32 0 ${large} 0 ${x4} ${y4} Z`, fill: PIE_COLORS[index % PIE_COLORS.length] });
            const title = svg("title");
            title.textContent = `${slice.name}: ${utilities.commafyFull(slice.value)} (${Math.round(portion * 100)}%)`;
            path.appendChild(title);
            pie.appendChild(path);
            angle = end;
        });
        const legend = el("div", "rv-pie-legend");
        top.forEach((slice, index) => {
            const row = el("div", "rv-pie-key");
            const swatch = el("i");
            swatch.style.background = PIE_COLORS[index % PIE_COLORS.length];
            row.append(swatch, el("span", "rv-side-name", slice.name + (slice.count > 1 ? ` ×${slice.count}` : "")), el("span", "rv-side-value", `${total ? Math.round(slice.value / total * 100) : 0}%`));
            legend.appendChild(row);
        });
        chartRow.append(pie, legend);
        box.appendChild(chartRow);

        //value over time
        const history = (await get(KEYS.valueHistory, [])).filter((point) => !inventory.userId || point.userId === undefined || point.userId === inventory.userId);
        const chartBox = el("div", "rv-chart-box");
        chartBox.appendChild(el("div", "rv-chart-title", "Inventory value over time (one point a day)"));
        if (history.length < 2) {
            chartBox.appendChild(empty("RoTrade saves one point a day while Chrome is open. The line appears after the second day."));
        } else {
            const width = 360;
            const height = 110;
            const values = history.map((point) => point.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const span = max - min || 1;
            const x = (i) => 6 + (i / (history.length - 1)) * (width - 12);
            const y = (v) => 6 + (1 - (v - min) / span) * (height - 12);
            const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "rv-chart" });
            const pts = history.map((point, i) => `${x(i).toFixed(1)},${y(point.value).toFixed(1)}`);
            chart.appendChild(svg("polygon", { points: `${x(0)},${height - 6} ${pts.join(" ")} ${x(history.length - 1)},${height - 6}`, fill: "var(--rv-accent, #EA580C)", opacity: ".18" }));
            chart.appendChild(svg("polyline", { points: pts.join(" "), fill: "none", stroke: "var(--rv-accent, #EA580C)", "stroke-width": 2, "stroke-linejoin": "round" }));
            history.forEach((point, i) => {
                const dot = svg("circle", { cx: x(i), cy: y(point.value), r: 6, fill: "transparent" });
                const title = svg("title");
                title.textContent = `${point.day}: ${utilities.commafyFull(point.value)} value, ${utilities.commafyFull(point.rap)} RAP`;
                dot.appendChild(title);
                chart.appendChild(dot);
            });
            chartBox.appendChild(chart);
            const first = history[0].value;
            const last = history[history.length - 1].value;
            chartBox.appendChild(el("div", `rv-tool-sub ${last >= first ? "rv-pos" : "rv-neg"}`, `${history[0].day} → ${history[history.length - 1].day}: ${last >= first ? "+" : "-"}${utilities.commafyFull(Math.abs(last - first))} (${first ? formatPercent(Math.round((last / first - 1) * 1000) / 10) : "–"})`));
        }
        box.appendChild(chartBox);
        return box;
    }

    //---------- expiring trades ----------
    async function expiring() {
        const box = section("Expiring trades", "Open trades that run out within 3 days, soonest first.");
        const trades = Object.values((await send("getTradeListData")) ?? {})
            .filter((trade) => (trade.tradeType === "inbound" || trade.tradeType === "outbound") && Date.parse(trade.expiration) > Date.now())
            .filter((trade) => Date.parse(trade.expiration) - Date.now() < 3 * 86400000)
            .sort((a, b) => Date.parse(a.expiration) - Date.parse(b.expiration));
        if (!trades.length) box.appendChild(empty("Nothing expires in the next 3 days (or RoTrade hasn't cached your trades yet)."));
        trades.forEach((trade) => {
            const totals = utilities.calculateTotalsFromExtraData(trade, data, false);
            const percent = (totals[0] ?? 0) > 0 ? percentDiff(totals[0], totals[1] ?? 0) : 0;
            const ms = Date.parse(trade.expiration) - Date.now();
            const row = el("div", "rv-tool-row rv-tool-row2");
            const text = el("div");
            text.append(
                el("div", "rv-side-name", `${trade.tradeType === "inbound" ? "From" : "To"} ${trade.user?.displayName ?? trade.user?.name ?? "someone"}`),
                el("span", "rv-tool-sub", `${formatPercent(percent)} · expires ${new Date(trade.expiration).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`)
            );
            row.append(text, el("span", `rv-tool-pct ${ms < 86400000 ? "rv-neg" : ""}`, relative(Date.parse(trade.expiration)).replace("in ", "") + " left"));
            box.appendChild(row);
        });
        return box;
    }

    renderNav();
    render();
    onChange([KEYS.wishlist, KEYS.valueChanges], () => { if (["wishlist", "changes"].includes(view)) render(); });
}
