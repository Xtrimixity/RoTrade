/*
Trade breakdown panel (#rovalkTradeTools), shown under the offers on trade detail pages and on the send / counter page.
Every section has its own option, and the panel disappears when all of them are off:
  Trade Breakdown       give vs get table (items, value, RAP, Robux, after the 30% fee) and value-share bars per side
  Trade Warnings        chips for things worth a second look: projected items, rares, untracked items, upgrades, Robux fee
  Copy Trade Summary    a copy button in the panel header
  Market Pulse          a Market table with Roblox sale prices (marketPulse.js)
  Even-It-Out Suggestions  items that would make the trade fair (send / counter page, evenItOut.js)
The header also has Image (save the trade as a picture).
offers[0] is always what you give and offers[1] what you receive.
*/
import * as utilities from "../utilities";
import { sideNet, percentDiff, verdictKey, VERDICT_TEXT, FAIR_PERCENT, KEEP_RATE, formatPercent } from "../tradeMath";
import { buildMarketSection } from "./marketPulse";
import { buildEvenSection } from "./evenItOut";
import { shareTradeImage } from "./shareImage";

const PANEL_ID = "rovalkTradeTools";
const COLLAPSE_KEY = "RoValk Breakdown Collapsed";
const OPTION_NAMES = ["Trade Breakdown", "Trade Warnings", "Copy Trade Summary", "Market Pulse", "Even-It-Out Suggestions"];
const SHARE_COLORS = ["#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#A78BFA", "#F87171", "#2DD4BF", "#FB923C"];
const VERDICT_COLOR = { bigwin: "--rv-good", win: "--rv-good", fair: "--rv-accent", loss: "--rv-bad", bigloss: "--rv-bad" };

let collapsed = false;
chrome.storage.local.get([COLLAPSE_KEY], (result) => { collapsed = !!result?.[COLLAPSE_KEY]; });

async function updateTradeTools() {
    const options = Object.fromEntries(await Promise.all(OPTION_NAMES.map(async (name) => [name, !!(await utilities.getOption(name))])));
    if (!Object.values(options).some(Boolean)) return stripTradeTools();

    const pageType = utilities.getPageType();
    let offers;
    let isClosedTrade = false;
    if (pageType === "details") {
        offers = document.querySelector(".trades-container")?.getElementsByClassName("trade-list-detail-offer");
        isClosedTrade = !document.querySelector(".trade-buttons"); //completed, declined and expired trades have no Accept/Decline row
    } else if (pageType === "sendOrCounter") {
        offers = document.getElementsByClassName("trade-request-window-offer");
    } else {
        return;
    }
    if (!offers?.[1]) return;
    offers[0].setAttribute("data-rv-side", "give");
    offers[1].setAttribute("data-rv-side", "get");

    const [give, get] = await Promise.all([collectOffer(offers[0], pageType), collectOffer(offers[1], pageType)]);
    if (give.items.length === 0 && get.items.length === 0 && give.robux === 0 && get.robux === 0) {
        return stripTradeTools();
    }

    let box = document.getElementById(PANEL_ID);
    if (!box) {
        box = document.createElement("section");
        box.id = PANEL_ID;
        box.setAttribute("aria-label", "RoTrade trade breakdown");
    }
    //Trade details page: right under the receiving offer.
    //Send / counter page: at the bottom of the big inventory column, where there is room for it to be wide.
    const wideSpot = pageType === "sendOrCounter" ? document.querySelector(".inventory-panel-holder") : null;
    box.classList.toggle("rv-wide", !!wideSpot);
    if (wideSpot) {
        if (box.previousElementSibling !== wideSpot) wideSpot.insertAdjacentElement("afterend", box);
    } else if (box.previousElementSibling !== offers[1]) offers[1].insertAdjacentElement("afterend", box);

    const signature = JSON.stringify([options, isClosedTrade, collapsed, give.items.map((i) => [i.id, i.value]), give.robux, get.items.map((i) => [i.id, i.value]), get.robux]);
    if (box.dataset.sig === signature) return; //same trade, same numbers: leave it alone so nothing flickers
    box.dataset.sig = signature;
    box.classList.toggle("rv-closed", isClosedTrade);
    box.classList.toggle("rv-collapsed", collapsed);
    box.replaceChildren(...buildPanel(give, get, options, isClosedTrade, box));
}

async function collectOffer(offerElement, pageType) {
    const items = [];
    let robux = 0;
    if (pageType === "details") {
        await utilities.waitForElm(".item-card-container");
        for (const card of offerElement.querySelectorAll(".item-card-container")) {
            const link = card.querySelector(".item-card-price")?.parentElement?.parentElement;
            if (!link?.pathname) continue;
            items.push(describeItem(utilities.getItemIdFromPath(link.pathname), utilities.getItemTypeFromPath(link.pathname), card));
        }
        robux = (await utilities.calculateValueTotalDetails(offerElement, true))[1];
    } else {
        const cards = offerElement.querySelectorAll('.trade-request-item, .trade-item-card, .item-card-container, [ng-repeat="slot in offer.slots"]');
        for (const card of cards) {
            const thumbnailContainer = card.querySelector(".thumbnail-2d-container");
            const thumbnail = card.querySelector("[thumbnail-target-id]");
            const linkPath = card.querySelector("a")?.pathname;
            const itemId = parseInt(
                thumbnail?.getAttribute("thumbnail-target-id")
                || thumbnailContainer?.getAttribute("thumbnail-target-id")
                || utilities.getItemIdFromPath(linkPath || "")
            );
            if (isNaN(itemId)) continue;
            items.push(describeItem(itemId, utilities.getItemTypeFromTradeElement(card), card));
        }
        robux = (await utilities.calculateValueTotalSendOrCounter(offerElement, true))[1];
    }
    robux = Math.max(Number(robux) || 0, 0);
    const value = items.reduce((sum, item) => sum + item.value, 0);
    const rap = items.reduce((sum, item) => sum + item.rap, 0);
    return { items, robux, value, rap, total: value + robux };
}

function describeItem(id, type, card) {
    const info = utilities.getItemInfo(id, type);
    const shownName = card?.querySelector(".item-card-name, .item-name")?.textContent?.trim();
    return {
        id,
        type,
        name: info?.name ?? shownName ?? `Item ${id}`,
        value: Math.max(utilities.getValueOrRAP(id, type), 0),
        rap: info?.rap ?? 0,
        known: !!info,
        hasValue: !!info?.hasValue,
        projected: !!info?.projected,
        rare: !!info?.rare,
        hyped: !!info?.hyped,
        demand: info?.demand ?? null,
        trend: info?.trend ?? null,
        thumb: card?.querySelector("img")?.src || null
    };
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function signed(number) {
    if (number > 0) return "+" + utilities.commafyFull(number);
    if (number < 0) return "-" + utilities.commafyFull(-number);
    return "0";
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function buildPanel(give, get, options, isClosedTrade, box) {
    const percent = percentDiff(give.total, get.total);
    const verdict = verdictKey(percent);
    const parts = [buildHeader(give, get, options, isClosedTrade, verdict, percent, box)];
    const body = el("div", "rv-panel-body");
    if (options["Trade Breakdown"]) body.append(buildCompare(give, get), buildShare(give, get));
    if (options["Trade Warnings"]) body.appendChild(buildWarnings(give, get));
    if (options["Market Pulse"] && (give.items.length || get.items.length)) body.appendChild(buildMarketSection(give, get));
    if (options["Even-It-Out Suggestions"] && !isClosedTrade) {
        const even = buildEvenSection(give, get);
        if (even) body.appendChild(even);
    }
    if (body.childElementCount) parts.push(body);
    return parts;
}

function buildHeader(give, get, options, isClosedTrade, verdict, percent, box) {
    const head = el("div", "rv-panel-head");
    const title = el("div", "rv-panel-title");
    title.append(el("span", "rv-panel-dot"), el("span", "", isClosedTrade ? "Trade breakdown (today's values)" : "Trade breakdown"));
    const chip = el("span", "rv-verdict-chip", `${VERDICT_TEXT[verdict]} · ${formatPercent(percent)}`);
    chip.style.setProperty("--rv-chip", `var(${VERDICT_COLOR[verdict]})`);
    const actions = el("div", "rv-panel-actions");
    if (options["Copy Trade Summary"]) actions.appendChild(buildCopyButton(give, get));
    const image = el("button", "rv-icon-btn", "Image");
    image.id = "rovalkImageBtn";
    image.type = "button";
    image.title = "Save this trade as a picture (also copies it when the browser allows)";
    image.addEventListener("click", (event) => { event.preventDefault(); shareTradeImage(give, get, image); });
    actions.appendChild(image);
    const toggle = el("button", "rv-icon-btn rv-collapse-btn", collapsed ? "Show" : "Hide");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.addEventListener("click", (event) => {
        event.preventDefault();
        collapsed = !collapsed;
        chrome.storage.local.set({ [COLLAPSE_KEY]: collapsed });
        box.classList.toggle("rv-collapsed", collapsed);
        toggle.textContent = collapsed ? "Show" : "Hide";
        toggle.setAttribute("aria-expanded", String(!collapsed));
        delete box.dataset.sig;
    });
    actions.appendChild(toggle);
    head.append(title, chip, actions);
    return head;
}

function buildCompare(give, get) {
    const anyRobux = give.robux > 0 || get.robux > 0;
    const giveNet = sideNet(give.value, give.robux, false);
    const getNet = sideNet(get.value, get.robux, true);
    const rows = [
        ["Items", give.items.length, get.items.length, false],
        ["Value", give.total, get.total, true],
        ["RAP", give.rap + give.robux, get.rap + get.robux, true]
    ];
    if (anyRobux) {
        rows.push(["Robux", give.robux, get.robux, true]);
        rows.push(["After 30% fee", giveNet, getNet, true]);
    }

    const table = el("div", "rv-compare");
    table.setAttribute("role", "table");
    const header = el("div", "rv-compare-row rv-compare-head");
    header.setAttribute("role", "row");
    ["", "You give", "You get", "Difference"].forEach((text) => header.appendChild(el("span", "", text)));
    table.appendChild(header);

    rows.forEach(([label, giveNumber, getNumber, money]) => {
        const row = el("div", "rv-compare-row");
        row.setAttribute("role", "row");
        const diff = getNumber - giveNumber;
        const diffCell = el("span", `rv-diff ${diff > 0 ? "rv-pos" : diff < 0 ? "rv-neg" : ""}`, money ? signed(diff) : (diff > 0 ? `+${diff}` : String(diff)));
        if (!money && diff !== 0) diffCell.className = "rv-diff"; //more items is not a win by itself
        row.append(
            el("span", "rv-compare-label", label),
            el("span", "", money ? utilities.commafyFull(giveNumber) : String(giveNumber)),
            el("span", "", money ? utilities.commafyFull(getNumber) : String(getNumber)),
            diffCell
        );
        if (label === "After 30% fee") row.title = "Robux you receive is cut by Roblox's 30% fee; Robux you give costs you the full amount.";
        table.appendChild(row);
    });
    return table;
}

function buildShare(give, get) {
    const wrap = el("div", "rv-share");
    wrap.appendChild(el("div", "rv-section-title", "Where the value is"));
    [["You give", give], ["You get", get]].forEach(([label, side]) => {
        const row = el("div", "rv-share-row");
        row.appendChild(el("span", "rv-share-label", label));
        const bar = el("div", "rv-share-bar");
        const parts = side.items.map((item) => ({ name: item.name, amount: item.value }));
        if (side.robux > 0) parts.push({ name: "Robux", amount: side.robux, robux: true });
        const total = parts.reduce((sum, part) => sum + part.amount, 0);
        const legend = el("div", "rv-share-legend");
        if (total <= 0) {
            bar.appendChild(el("span", "rv-share-empty", "nothing"));
        } else {
            const shown = [...parts].filter((part) => part.amount > 0).sort((a, b) => b.amount - a.amount);
            shown.forEach((part, index) => {
                const share = (part.amount / total) * 100;
                const color = part.robux ? "var(--rv-accent-2)" : SHARE_COLORS[index % SHARE_COLORS.length];
                const segment = el("span", "rv-share-seg");
                segment.style.flexGrow = String(part.amount);
                segment.style.background = color;
                segment.title = `${part.name}: ${utilities.commafyFull(part.amount)} (${share.toFixed(1)}%)`;
                if (share >= 18) segment.textContent = `${Math.round(share)}%`;
                bar.appendChild(segment);
                if (index < 4) {
                    const key = el("span", "", `${part.name} ${share < 1 ? "<1" : Math.round(share)}%`);
                    const swatch = el("i");
                    swatch.style.setProperty("--rv-sw", color);
                    key.prepend(swatch);
                    key.title = segment.title;
                    legend.appendChild(key);
                }
            });
            if (shown.length > 4) legend.appendChild(el("span", "", `+${shown.length - 4} more`));
        }
        row.appendChild(bar);
        wrap.appendChild(row);
        if (legend.childElementCount > 1) wrap.appendChild(legend); //a single item already reads as 100%
    });
    return wrap;
}

function buildWarnings(give, get) {
    const notes = [];
    const names = (list) => list.slice(0, 2).map((item) => item.name).join(", ") + (list.length > 2 ? ` +${list.length - 2} more` : "");
    const add = (tone, text, title) => notes.push({ tone, text, title });

    const projectedGet = get.items.filter((item) => item.projected);
    const projectedGive = give.items.filter((item) => item.projected);
    const rareGive = give.items.filter((item) => item.rare);
    const rareGet = get.items.filter((item) => item.rare);
    const rapOnlyGet = get.items.filter((item) => item.known && !item.hasValue);
    const unknown = [...give.items, ...get.items].filter((item) => !item.known);

    if (projectedGet.length) add("bad", `You get ${plural(projectedGet.length, "projected item")}: ${names(projectedGet)}`, "Rolimons flags these as projected: their RAP was pushed up recently and is likely to fall.");
    if (rareGive.length) add("warn", `You give ${rareGive.length === 1 ? "a rare item" : plural(rareGive.length, "rare item")}: ${names(rareGive)}`, "Rare items have very few copies and can be hard to get back.");
    if (rapOnlyGet.length) add("warn", `${plural(rapOnlyGet.length, "item")} you get ${rapOnlyGet.length === 1 ? "has" : "have"} no Rolimons value (priced by RAP)`, "RAP can be moved by a few sales, so these are less certain than valued items.");
    if (unknown.length) add("warn", `${plural(unknown.length, "item")} not tracked by Rolimons, counted as 0`, names(unknown));
    if (rareGet.length) add("good", `You get ${rareGet.length === 1 ? "a rare item" : plural(rareGet.length, "rare item")}: ${names(rareGet)}`);
    if (projectedGive.length) add("info", `You give ${plural(projectedGive.length, "projected item")}`);
    const lowDemandGet = get.items.filter((item) => item.demand !== null && item.demand <= 1);
    const loweringGet = get.items.filter((item) => item.trend === 0);
    const hypedGet = get.items.filter((item) => item.hyped);
    if (lowDemandGet.length) add("warn", `${plural(lowDemandGet.length, "item")} you get ${lowDemandGet.length === 1 ? "has" : "have"} low demand: ${names(lowDemandGet)}`, "Low-demand items can be slow to trade away.");
    if (loweringGet.length) add("warn", `Rolimons trend is Lowering for ${names(loweringGet)}`);
    if (hypedGet.length) add("warn", `${names(hypedGet)} ${hypedGet.length === 1 ? "is" : "are"} hyped right now`, "Hyped items can drop back once the hype fades.");

    if (give.items.length && get.items.length && give.items.length !== get.items.length) {
        const upgrade = give.items.length > get.items.length;
        add("info", `${upgrade ? "Upgrade" : "Downgrade"}: ${plural(give.items.length, "item")} for ${get.items.length}`,
            upgrade ? "Fewer, bigger items are usually easier to trade later." : "More, smaller items: you are splitting value up.");
    }

    //value and RAP pointing in different directions is worth knowing about
    const valuePercent = percentDiff(give.total, get.total);
    const rapPercent = percentDiff(give.rap + give.robux, get.rap + get.robux);
    if (Math.abs(valuePercent) > FAIR_PERCENT && Math.abs(rapPercent) > FAIR_PERCENT && Math.sign(valuePercent) !== Math.sign(rapPercent)) {
        add("warn", `Value says ${valuePercent > 0 ? "win" : "loss"} but RAP says ${rapPercent > 0 ? "win" : "loss"}`, `Value ${formatPercent(valuePercent)}, RAP ${formatPercent(rapPercent)}.`);
    }

    if (get.robux > 1) add("info", `You get R$ ${utilities.commafyFull(get.robux)}, you keep R$ ${utilities.commafyFull(Math.round(get.robux * KEEP_RATE))} after the 30% fee`);
    if (give.robux > 0) add("info", `You add R$ ${utilities.commafyFull(give.robux)} (they keep R$ ${utilities.commafyFull(Math.round(give.robux * KEEP_RATE))})`);

    const wrap = el("div", "rv-alerts");
    if (notes.length === 0) add("good", "Nothing unusual in this trade");
    notes.forEach((note) => {
        const chip = el("span", `rv-alert rv-${note.tone}`, note.text);
        if (note.title) chip.title = note.title;
        wrap.appendChild(chip);
    });
    return wrap;
}

function formatOffer(title, data) {
    const lines = [`${title} (${utilities.commafyFull(data.total)} value, ${utilities.commafyFull(data.rap + data.robux)} RAP):`];
    data.items.forEach((item) => {
        const tags = [item.rare && "rare", item.projected && "projected"].filter(Boolean);
        lines.push(`- ${item.name} - ${utilities.commafyFull(item.value)}${tags.length ? ` [${tags.join(", ")}]` : ""}`);
    });
    if (data.robux > 0) lines.push(`- R$ ${utilities.commafyFull(data.robux)}`);
    if (data.items.length === 0 && data.robux === 0) lines.push("- nothing");
    return lines.join("\n");
}

function buildSummaryText(give, get) {
    const percent = percentDiff(give.total, get.total);
    const diff = get.total - give.total;
    return [
        formatOffer("I give", give),
        "",
        formatOffer("I receive", get),
        "",
        `Difference: ${signed(diff)} (${formatPercent(percent)}) - ${VERDICT_TEXT[verdictKey(percent)]}`,
        "Values from Rolimons via RoTrade"
    ].join("\n");
}

function buildCopyButton(give, get) {
    const button = el("button", "rv-icon-btn", "Copy");
    button.id = "rovalkCopyBtn";
    button.type = "button";
    button.title = "Copy a text summary of this trade";
    button.addEventListener("click", async (event) => {
        event.preventDefault();
        const text = buildSummaryText(give, get);
        let copied = false;
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
        } catch (e) {
            //clipboard API can be blocked; fall back to a temporary textarea
            const area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            try { copied = document.execCommand("copy"); } catch (err) { copied = false; }
            area.remove();
        }
        button.textContent = copied ? "Copied!" : "Copy failed";
        setTimeout(() => { button.textContent = "Copy"; }, 1500);
    });
    return button;
}

function stripTradeTools() {
    document.getElementById(PANEL_ID)?.remove();
}

export default updateTradeTools;
