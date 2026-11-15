/*
Good deal finder for the send / counter page: marks items in the other person's inventory that are worth asking for.
  "Raising"      Rolimons has the item's trend set to Raising (free, no request needed)
  "Underrated"   it sells on Roblox for 10% or more above its Rolimons value, so a value raise is likely
  "Rising"       its sale price went up 10% or more this week
The market checks only run for cards that are on screen (and are cached), so browsing an inventory stays light.
*/
import * as utilities from "../utilities";
import { getMarket, analyze } from "../market";

const OPTION = "Good Deal Finder";
let observer = null;
const checked = new WeakSet();

function partnerCards() {
    const lists = document.querySelectorAll(".inventory-panel-holder .hlist");
    const theirs = lists[1]; //the first inventory is yours, the second is theirs
    return theirs ? [...theirs.querySelectorAll(".item-card-container")] : [];
}

function setBadge(card, label, title, tone) {
    const anchor = card.querySelector(".item-card-thumb-container") || card;
    anchor.querySelector(":scope > .rv-deal")?.remove();
    if (!label) return;
    if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative";
    const badge = document.createElement("span");
    badge.className = `rv-deal rv-deal-${tone}`;
    badge.textContent = label;
    badge.title = title;
    anchor.appendChild(badge);
}

async function checkCard(card) {
    const item = utilities.readCardItem(card);
    if (!item) return;
    const info = utilities.getItemInfo(item.id, item.type);
    if (info?.trend === 3) setBadge(card, "Raising", "Rolimons has this item's trend set to Raising.", "good");
    if (item.type === 2 || !info) return;
    const market = analyze(await getMarket(item.id, item.type), info);
    if (!market) return;
    if (market.bestVsValue !== null && market.bestVsValue >= 10 && info.hasValue) {
        setBadge(card, `Underrated +${Math.round(market.bestVsValue)}%`, `Cheapest copy sells for ${utilities.commafyFull(market.best)}, above its Rolimons value of ${utilities.commafyFull(info.value)}. A value raise is likely.`, "good");
    } else if (market.change7 !== null && market.change7 >= 10) {
        setBadge(card, `Rising +${Math.round(market.change7)}%`, `Sale prices are up ${Math.round(market.change7)}% this week.`, "good");
    }
}

export default async function updateGoodDeals() {
    const enabled = utilities.getPageType() === "sendOrCounter" && (await utilities.getOption(OPTION));
    if (!enabled) {
        observer?.disconnect();
        document.querySelectorAll(".rv-deal").forEach((badge) => badge.remove());
        return;
    }
    if (!observer) {
        observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.unobserve(entry.target);
                checkCard(entry.target);
            }
        }, { rootMargin: "100px" });
    }
    for (const card of partnerCards()) {
        const key = String(utilities.readCardItem(card)?.id ?? "");
        if (checked.has(card) && card.dataset.rvDeal === key) continue;
        checked.add(card);
        card.dataset.rvDeal = key;
        observer.observe(card);
    }
}
