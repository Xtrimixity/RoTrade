/*
This file handles the extension flags: flag rare, flag projected, etc.
The flag box is the little box that contains all of the flags.
*/
import * as utilities from "../utilities";
import { tierFor } from "../tradeMath";
import { loadCardExtraOptions, decorateCard } from "./cardExtras";

async function updateFlags() {
    const rareFlagging = await utilities.getOption("Flag Rare Items");
    const projectedFlagging = await utilities.getOption("Flag Projected Items");
    const valuedFlagging = await utilities.getOption("Flag Valued Items");
    const rapFlagging = await utilities.getOption("Flag RAP-only Items");
    const extras = await loadCardExtraOptions();

    function flagItem(item) {
        const textDiv = item.querySelector(".item-card-price");
        /*
        The next line contains two different selectors that try to find the <a></a> tag containing the item URL href. 
        Unfortunately the relation between .item-card-price and the <a></a> tag is different for the catalog vs trade pages.
        The first condition is for the trade page case, the second is for the catalog.
        */
        const aTag = textDiv?.parentElement?.querySelector(":scope > a") || textDiv?.parentElement?.parentElement;

        const pathname = utilities.removeTwoLetterPath(aTag.pathname);
        const itemType = utilities.getItemTypeFromPath(pathname);
        const itemId = utilities.getItemIdFromPath(pathname);
        if (item.getElementsByClassName("flagBox")[0] === undefined) { //if flag box does not already exist
            const itemCardLink = item.querySelector(".item-card-link");
            itemCardLink.style.position = "relative";
            createFlagBox(itemCardLink);
        }

        const flagBox = item.getElementsByClassName("flagBox")[0];
        flagBox.replaceChildren(); //remove children
        const rolimonsItemData = utilities.getItemData(itemId, itemType);
        const itemInfo = utilities.getItemInfo(itemId, itemType);
        if (itemInfo?.value > 0) { //the tier border color comes from the value (or RAP when there is no value); pageEffects.js decides if it is shown
            item.setAttribute("data-rv-tier", tierFor(itemInfo.value));
        } else {
            item.removeAttribute("data-rv-tier");
        }
        decorateCard(item, itemInfo, itemId, extras);
        if (rolimonsItemData) {
            rareFlagging && itemInfo?.rare && (addFlag(flagBox, "rare", itemId, itemType));
            projectedFlagging && itemInfo?.projected && (addFlag(flagBox, "projected", itemId, itemType));
            valuedFlagging && itemInfo?.hasValue && (addFlag(flagBox, "value", itemId, itemType));
            rapFlagging && itemInfo && !itemInfo.hasValue && itemInfo.rap > 0 && (addFlag(flagBox, "rap", itemId, itemType));
            for (hlist of document.getElementsByClassName("hlist")) { //makes sure flags don't get cut off
                hlist.style.cssText += ";overflow:visible !important;";
            }
        }
    }
    if (utilities.getPageType() === "details") {
        const offersContainer = await utilities.waitForElm(".trades-list-detail");
        if (offersContainer) {
            await utilities.waitForElm(".trade-list-detail-offer");
            const offers = offersContainer.getElementsByClassName("trade-list-detail-offer");
            for (offer of offers) {
                await utilities.waitForElm(".item-card-container");
                const items = offer.querySelectorAll(".item-card-container");
                for (item of items) {
                    flagItem(item);
                }
            }
        }
    }
    if (utilities.getPageType() === "sendOrCounter") {
        const inventoryPanelHolder = await utilities.waitForElm(".inventory-panel-holder");
        await utilities.waitForElm(".hlist", inventoryPanelHolder);
        const inventories = inventoryPanelHolder.querySelectorAll(".hlist");
        for (inventory of inventories) {
            await utilities.waitForElm(".item-card-container"); //wait for the first item card container to load in; they all load in at the same time, so this check if sufficient
            const items = inventory.querySelectorAll(".item-card-container");
            for (item of items) {
                flagItem(item);
            }
        }
    }

    if (utilities.getPageType() === "catalog") {
        await utilities.waitForElm(".item-card-container");
        await utilities.waitForElm(".item-card-price");
        const items = document.querySelectorAll(".item-card-container");
        for (item of items) {
            flagItem(item);
        }
    }

    utilities.initTooltips();
}

/*
Every flag is drawn the same way: a small round badge with one character, so rare, projected, value and RAP marks
line up and match on every page (they used to be a mix of PNG and SVG files with different sizes and padding).
Styles live in featureStyles.js (.rv-flag).
*/
const FLAGS = {
    value: { glyph: "V", tip: "This item has a Rolimons value." },
    rap: { glyph: "R", tip: "This item has no Rolimons value, so its RAP is used instead." },
    rare: { glyph: "★", tip: "This item is rare (few copies exist)." },
    projected: { glyph: "P", tip: "This item is projected: its RAP was pushed up and is likely to fall." }
};
const ORDER = ["value", "rap", "rare", "projected"];

async function createFlagBox(item) {
    const flagBox = document.createElement("div");
    flagBox.className = "flagBox rv-flagbox";
    //RoPro puts its own icon in the top left corner; move out of its way when it is there
    flagBox.classList.toggle("rv-flagbox-right", document.getElementsByClassName("ropro-icon")[0] !== undefined);
    item.appendChild(flagBox);
}

function rolimonsUrl(itemId, itemType) {
    return itemType === 2 ? `https://www.rolimons.com/bundle/${itemId}` : `https://www.rolimons.com/item/${itemId}`;
}
function addFlag(flagBox, flagName, itemId, itemType) {
    const flag = FLAGS[flagName];
    const badge = document.createElement("span");
    badge.className = `rv-flag rv-flag-${flagName} ${flagName}-flag`;
    badge.textContent = flag.glyph;
    badge.setAttribute("role", "link");
    badge.style.order = String(ORDER.indexOf(flagName));
    badge.title = `${flag.tip} Click to open its Rolimons page.`;
    //the flag sits inside Roblox's own item link, so stop that link from firing and open the Rolimons page instead
    badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(rolimonsUrl(itemId, itemType), "_blank", "noopener,noreferrer");
    });
    flagBox.appendChild(badge);
}

export default updateFlags;