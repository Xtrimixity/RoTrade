/*
Win/loss orb: the round badge that sits on the line between what you give and what you receive.
The ring in the middle fills with how far the trade leans (a full ring is 50% or more) and is colored win / fair / loss.
The pill on the left shows the RAP difference, the pill on the right the Rolimons value difference.

On the trade details page it sits inside the divider between the two offers; on the send / counter page it sits between
your offer and your request. Everything is built with textContent, never HTML from the page.
*/
import * as utilities from "../utilities";
import { percentDiff, verdictKey, VERDICT_TEXT, formatPercent } from "../tradeMath";

const ORB_ID = "rovalkOrb";
const HOST_CLASS = "rv-orb-host";
const SVG_NS = "http://www.w3.org/2000/svg";
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SHORT_VERDICT = { bigwin: "Big win", win: "Win", fair: "Fair", loss: "Loss", bigloss: "Big loss" };

async function updateWinLossStats() {
    if (!(await utilities.getOption("Trade Win/Loss Stats"))) {
        return stripWinLossStats();
    }
    const pageType = utilities.getPageType();
    if (pageType !== "details" && pageType !== "sendOrCounter") return;

    const rap = getRAPTotals();
    const value = await getValueTotals();
    if (!rap || !value) return;
    if (value.give + value.receive === 0 && rap.give + rap.receive === 0) {
        return stripWinLossStats(); //nothing in the trade yet
    }

    const placement = findPlacement(pageType);
    if (!placement) return;

    const signature = [rap.give, rap.receive, value.give, value.receive].join("|");
    const existing = document.getElementById(ORB_ID);
    if (existing && existing.dataset.sig === signature && isPlaced(existing, placement)) return; //nothing changed: keep it (and its animation) as is

    const orb = buildOrb(rap, value);
    orb.dataset.sig = signature;
    stripWinLossStats();
    place(orb, placement);
}

//Where the orb goes: inside the divider between the offers on the details page, between the offers on the send / counter page.
function findPlacement(pageType) {
    if (pageType === "details") {
        const offers = document.querySelector(".trades-container")?.getElementsByClassName("trade-list-detail-offer");
        const dividers = document.getElementsByClassName("trade-offer-divider");
        const divider = dividers[1] ?? (offers?.[1]?.previousElementSibling?.classList.contains("trade-offer-divider") ? offers[1].previousElementSibling : null);
        if (divider) return { inside: divider };
        if (offers?.[1]) return { before: offers[1] };
        return null;
    }
    const offers = document.getElementsByClassName("trade-request-window-offer");
    if (offers[1]) return { before: offers[1] };
    return null;
}

function isPlaced(orb, placement) {
    if (placement.inside) return orb.parentElement === placement.inside;
    return orb.nextElementSibling === placement.before;
}

function place(orb, placement) {
    if (placement.inside) {
        placement.inside.classList.add(HOST_CLASS);
    ["data-rv-gray", "data-rv-gborder", "data-rv-gul"].forEach((name) => placement.inside.removeAttribute(name)); //undo the site-wide grey repaint on the old dashed line
        placement.inside.appendChild(orb);
    } else {
        placement.before.insertAdjacentElement("beforebegin", orb);
    }
}

function svg(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, String(val)));
    return node;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function signedNumber(number) {
    if (number > 0) return "+" + utilities.commafy(number);
    if (number < 0) return "-" + utilities.commafy(Math.abs(number));
    return "0";
}

function percentText(give, receive) {
    if (give <= 0) return receive > 0 ? "+∞%" : "0%";
    return formatPercent(percentDiff(give, receive));
}

function verdictFor(give, receive) {
    if (give <= 0) return receive > 0 ? "bigwin" : "fair";
    return verdictKey(percentDiff(give, receive));
}

function arrowIcon(direction) {
    const icon = svg("svg", { viewBox: "0 0 24 24", width: 14, height: 14, "aria-hidden": "true", class: "rv-orb-arrow" });
    const paths = {
        up: "M12 4l7 8h-4.5v8h-5v-8H5z",
        down: "M12 20l-7-8h4.5V4h5v8H19z",
        flat: "M4 10h16v4H4z"
    };
    icon.appendChild(svg("path", { d: paths[direction], fill: "currentColor" }));
    return icon;
}

function buildPill(kind, label, give, receive) {
    const diff = receive - give;
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const pill = el("div", `rv-orb-pill rv-${direction}`);
    pill.dataset.kind = kind;

    const top = el("div", "rv-orb-pill-label", label);
    const number = el("div", "rv-orb-pill-num");
    number.append(arrowIcon(direction), document.createTextNode(signedNumber(diff)));
    const sub = el("div", "rv-orb-pill-sub", `${percentText(give, receive)} · ${utilities.commafy(give)} → ${utilities.commafy(receive)}`);
    pill.append(top, number, sub);

    let tooltip;
    const name = kind === "rap" ? "RAP" : "value";
    if (diff === 0) tooltip = `This trade is equal in ${name}.`;
    else if (diff > 0) tooltip = `You gain ${utilities.commafyFull(diff)} ${name} on this trade (${percentText(give, receive)}).`;
    else tooltip = `You lose ${utilities.commafyFull(-diff)} ${name} on this trade (${percentText(give, receive)}).`;
    if (kind === "value") tooltip += " Uses Rolimons value, or RAP for items without a value, plus added Robux.";
    pill.title = tooltip;
    return pill;
}

function buildRing(value) {
    const verdict = verdictFor(value.give, value.receive);
    const percent = value.give > 0 ? percentDiff(value.give, value.receive) : (value.receive > 0 ? 100 : 0);
    const fraction = Math.min(Math.abs(percent), 50) / 50;

    const orb = el("div", "rv-orb");
    orb.setAttribute("role", "img");
    orb.setAttribute("aria-label", `${VERDICT_TEXT[verdict]}, ${percentText(value.give, value.receive)} in value`);

    const ring = svg("svg", { viewBox: "0 0 100 100", class: "rv-orb-ring", "aria-hidden": "true" });
    ring.appendChild(svg("circle", { cx: 50, cy: 50, r: RADIUS, class: "rv-orb-track" }));
    //tick marks every 10% so the fill can be read at a glance
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ring.appendChild(svg("line", {
            x1: 50 + Math.cos(angle) * 36, y1: 50 + Math.sin(angle) * 36,
            x2: 50 + Math.cos(angle) * 33, y2: 50 + Math.sin(angle) * 33,
            class: "rv-orb-tick"
        }));
    }
    const arc = svg("circle", {
        cx: 50, cy: 50, r: RADIUS, class: "rv-orb-arc",
        "stroke-dasharray": CIRCUMFERENCE.toFixed(2),
        "stroke-dashoffset": (CIRCUMFERENCE * (1 - fraction)).toFixed(2)
    });
    arc.style.setProperty("--rv-orb-c", CIRCUMFERENCE.toFixed(2));
    if (percent < 0) arc.classList.add("rv-ccw");
    if (fraction === 0) arc.classList.add("rv-empty");
    ring.appendChild(arc);

    const center = el("div", "rv-orb-center");
    const pct = el("div", "rv-orb-pct", percentText(value.give, value.receive));
    if (pct.textContent.length > 5) pct.classList.add("rv-long");
    center.append(pct, el("div", "rv-orb-verdict", SHORT_VERDICT[verdict]));
    orb.append(ring, center);
    orb.title = `${VERDICT_TEXT[verdict]}: the ring fills as the trade leans one way, a full ring is 50% or more. Within 5% counts as fair.`;
    return { orb, verdict };
}

function buildOrb(rap, value) {
    const wrap = el("div");
    wrap.id = ORB_ID;
    const { orb, verdict } = buildRing(value);
    wrap.className = `rv-v-${verdict}`;
    const capsule = el("div", "rv-orb-capsule");
    capsule.append(buildPill("rap", "RAP", rap.give, rap.receive), orb, buildPill("value", "Value", value.give, value.receive));
    wrap.append(el("div", "rv-orb-line"), capsule, el("div", "rv-orb-line"));
    return wrap;
}

//RAP totals straight from Roblox's own total rows (they already include added Robux).
function getRAPTotals() {
    const totals = document.querySelectorAll(".text-robux-lg:not(.valueSpan)");
    if (totals.length < 2) return null;
    const read = (element) => parseInt(element.innerText.replaceAll(",", "")) || 0;
    return { give: read(totals[totals.length - 2]), receive: read(totals[totals.length - 1]) };
}

async function getValueTotals() {
    const tradesContainer = await utilities.waitForElm(".trades-container");
    let offers = tradesContainer.getElementsByClassName("trade-list-detail-offer"); //trade details page
    if (!offers[0]) offers = document.getElementsByClassName("trade-request-window-offer"); //send or counter page
    if (!offers[1]) return null;
    const [give, receive] = await Promise.all([calculateValueTotal(offers[0]), calculateValueTotal(offers[1])]);
    return { give: Math.max(give || 0, 0), receive: Math.max(receive || 0, 0) };
}

async function calculateValueTotal(offerElement) {
    if (utilities.getPageType() === "details") {
        return await utilities.calculateValueTotalDetails(offerElement);
    }
    return await utilities.calculateValueTotalSendOrCounter(offerElement);
}

function stripWinLossStats() {
    document.getElementById(ORB_ID)?.remove();
    document.getElementById("winLossStatsContainer")?.remove(); //the old two-box version
    for (const host of document.querySelectorAll(`.${HOST_CLASS}`)) {
        if (!host.querySelector(`#${ORB_ID}`)) host.classList.remove(HOST_CLASS);
    }
}

export default updateWinLossStats;
