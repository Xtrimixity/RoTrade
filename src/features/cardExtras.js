/*
Extra marks on item cards, applied by flags.js wherever it already visits cards (trade offers and inventories):
  Demand Badges        a small pill with Rolimons demand (Terrible .. Amazing) in the bottom corner of the thumbnail
  Wishlist Highlights  a gold star and glow on items you starred (popup Tools tab or the hover card)
*/
import * as utilities from "../utilities";
import { getWishlist } from "../store";

const DEMAND_CLASS = { 0: "rv-d0", 1: "rv-d1", 2: "rv-d2", 3: "rv-d3", 4: "rv-d4" };

export async function loadCardExtraOptions() {
    const [demand, wishlist] = await Promise.all([utilities.getOption("Demand Badges"), utilities.getOption("Wishlist Highlights")]);
    return { demand: !!demand, wishlist: !!wishlist, wished: wishlist ? await getWishlist() : {} };
}

export function decorateCard(card, info, itemId, options) {
    const anchor = card.querySelector(".item-card-thumb-container") || card.querySelector(".item-card-link") || card;
    if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative";

    anchor.querySelector(":scope > .rv-demand")?.remove();
    if (options.demand && info && info.demand !== null && info.demand !== undefined) {
        const pill = document.createElement("span");
        pill.className = `rv-demand ${DEMAND_CLASS[info.demand]}`;
        pill.textContent = info.demandText;
        pill.title = `Rolimons demand: ${info.demandText}${info.trendText ? ` · trend: ${info.trendText}` : ""}`;
        anchor.appendChild(pill);
    }

    const wished = options.wishlist && !!options.wished?.[itemId];
    card.toggleAttribute("data-rv-wish", wished);
    anchor.querySelector(":scope > .rv-wish-star")?.remove();
    if (wished) {
        const star = document.createElement("span");
        star.className = "rv-wish-star";
        star.textContent = "★";
        star.title = "On your wishlist";
        anchor.appendChild(star);
    }
}
