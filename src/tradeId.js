/*
Works out which trade is open on the trades page. Roblox does not put the id in the URL, so there are two attempts:
1. Ask the page script (scripts/getOpenTradeId.js) to read it from the page's own data.
2. Compare the items on screen with the trades RoValk has already stored. If exactly one trade matches, that is it.
Returns a number, or null when it cannot be sure.
*/
import * as utilities from "./utilities";

const SCRIPT_ID = "rolimonsGetOpenTradeIdScript";
export const HISTORY_KEY = "rovalkTradeHistory";

function readFromPage() {
    return new Promise((resolve) => {
        function ask() {
            document.documentElement.removeAttribute("rolimons-open-trade-id");
            document.dispatchEvent(new CustomEvent("getOpenTradeId"));
            const id = Number(document.documentElement.getAttribute("rolimons-open-trade-id"));
            resolve(Number.isInteger(id) && id > 0 ? id : null);
        }
        if (document.getElementById(SCRIPT_ID)) return ask();
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = utilities.getURL("scripts/getOpenTradeId.js");
        script.onload = ask;
        script.onerror = () => resolve(null);
        (document.head || document.documentElement).appendChild(script);
    });
}

function itemIdsOf(offer) {
    return utilities.getTradeOfferItems(offer)
        .map((asset) => asset?.assetId ?? asset?.itemTarget?.targetId)
        .filter((id) => id !== undefined)
        .map(Number)
        .sort((a, b) => a - b)
        .join(",");
}

async function readOnScreenOffers() {
    const offerElements = document.querySelectorAll(".trade-list-detail-offer");
    if (offerElements.length < 2) return null;
    const sides = [];
    for (const element of [offerElements[0], offerElements[1]]) {
        const ids = [...element.querySelectorAll(".item-card-container")]
            .map((card) => {
                const link = card.querySelector(".item-card-price")?.parentElement?.parentElement;
                return link?.pathname ? utilities.getItemIdFromPath(link.pathname) : NaN;
            })
            .filter((id) => !isNaN(id))
            .sort((a, b) => a - b)
            .join(",");
        const [, robux] = await utilities.calculateValueTotalDetails(element, true);
        sides.push({ ids, robux });
    }
    return sides;
}

function getStoredTrades() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage("getTradeListData", (cached) => {
            chrome.runtime.lastError;
            chrome.storage.local.get([HISTORY_KEY], (result) => {
                const history = result?.[HISTORY_KEY]?.trades ?? {};
                resolve([...Object.values(cached ?? {}), ...Object.values(history)]);
            });
        });
    });
}

async function matchBySignature() {
    const onScreen = await readOnScreenOffers();
    if (!onScreen) return null;
    const trades = await getStoredTrades();
    const seen = new Set();
    let matches = trades.filter((trade) => {
        if (!trade?.id || seen.has(trade.id)) return false;
        seen.add(trade.id);
        const offers = utilities.getTradeOffers(trade);
        if (offers.length < 2) return false;
        return itemIdsOf(offers[0]) === onScreen[0].ids && itemIdsOf(offers[1]) === onScreen[1].ids;
    });
    if (matches.length > 1) {
        matches = matches.filter((trade) => {
            const offers = utilities.getTradeOffers(trade);
            return Math.abs((offers[0].robux ?? 0) - onScreen[0].robux) <= 1 && Math.abs((offers[1].robux ?? 0) - onScreen[1].robux) <= 1;
        });
    }
    return matches.length === 1 ? Number(matches[0].id) : null;
}

export async function getOpenTradeId() {
    return (await readFromPage()) ?? (await matchBySignature());
}
