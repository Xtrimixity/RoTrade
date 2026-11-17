/*
Current selling price on item cards (catalog, inventories) and on item pages.
Roblox puts the item's RAP in the Robux line of a collectible's card, so it showed the same number as the RAP line
under it. This swaps it for the cheapest copy for sale right now. If nobody is selling, it says "No sellers".
Hovering the price shows what it is and the RAP.
*/
import * as utilities from "../utilities";
import { getBestPrices } from "../bestPrice";

const OPTION = "Current Price on Items";

function robuxSpanOf(container) {
    //Roblox's own Robux number, never RoTrade's value line
    return [...container.querySelectorAll(".text-robux-tile, .text-robux-lg, .text-robux")].find((span) => !span.classList.contains("valueSpan") && !span.closest(".value-price-info"));
}

function show(span, price, itemId, itemType) {
    if (!span.dataset.rvOriginal) span.dataset.rvOriginal = span.textContent;
    const rap = utilities.getItemInfo?.(itemId, itemType)?.rap;
    const rapText = rap > 0 ? ` · RAP ${utilities.commafyFull(rap)}` : "";
    if (price > 0) {
        span.textContent = utilities.commafy(price);
        span.title = `Cheapest for sale right now${rapText}`;
        span.classList.remove("rv-no-sellers");
    } else {
        span.textContent = "No sellers";
        span.title = `Nobody is selling this right now${rapText}`;
        span.classList.add("rv-no-sellers");
    }
    span.dataset.rvPrice = String(price ?? "none");
}

function restore() {
    for (const span of document.querySelectorAll("[data-rv-original]")) {
        span.textContent = span.dataset.rvOriginal;
        span.removeAttribute("title");
        span.classList.remove("rv-no-sellers");
        delete span.dataset.rvOriginal;
        delete span.dataset.rvPrice;
    }
}

export default async function updateCurrentPrices() {
    if (!(await utilities.getOption(OPTION))) return restore();
    const pageType = utilities.getPageType();

    //item page: Roblox's "Price" row
    if (pageType === "itemProfile") {
        const itemType = utilities.getItemTypeFromPath(window.location.pathname);
        const itemId = utilities.getItemIdFromPath(window.location.pathname);
        if (utilities.getItemData(itemId, itemType) === undefined || itemType === 2) return;
        const container = await utilities.waitForElm(".price-container-text");
        const span = container && robuxSpanOf(container);
        if (!span) return;
        const prices = await getBestPrices([itemId]);
        if (itemId in prices) show(span, prices[itemId], itemId, itemType);
        return;
    }

    //item cards: catalog and inventories
    const cards = [];
    for (const textDiv of document.getElementsByClassName("item-card-price")) {
        if (textDiv.closest(".trades-container, .trade-request-window, .trades-list-detail, .trade-list-detail")) continue;
        const link = textDiv.parentElement?.parentElement;
        const pathname = utilities.removeTwoLetterPath(link?.pathname || link);
        const itemType = utilities.getItemTypeFromPath(pathname);
        const itemId = utilities.getItemIdFromPath(pathname);
        if (isNaN(itemId) || itemType === 2 || utilities.getItemData(itemId, itemType) === undefined) continue;
        const span = robuxSpanOf(textDiv);
        if (!span) continue;
        cards.push({ span, itemId, itemType });
    }
    if (!cards.length) return;
    const prices = await getBestPrices(cards.map((card) => card.itemId));
    for (const { span, itemId, itemType } of cards) {
        if (itemId in prices && span.dataset.rvPrice !== String(prices[itemId] ?? "none")) show(span, prices[itemId], itemId, itemType);
    }
}
