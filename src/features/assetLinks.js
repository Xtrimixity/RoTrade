/*
This file handles all of the asset links. 
The itemAssetTypeCache defined towards the bottom of this file assists with caching asset types obtained from the Roblox API, when they are not available for use in the DOM.

Additionally, this feature does require a CSRF token to make the request to get item details data. 
Originally, the token is pulled from the page meta data. Eventually however, this token will expire, at which point we request for a new one.
*/
import * as utilities from "../utilities";

async function updateAssetsLinks() {
    if (!(await utilities.getOption("Add Item Profile Links"))) {
        return stripAssetLinks();
    }
    if (utilities.getPageType() === "itemProfile")
        updateItemProfilePageAssetLinks();


    const acceptedPageTypes = ["details", "sendOrCounter", "catalog", "userInventory"];
    if (acceptedPageTypes.indexOf(utilities.getPageType()) !== -1)
        updateGeneralAssetLinks();
}

function stripAssetLinks() {
    document.querySelectorAll(".icon-link").forEach(element => {
        element.parentElement.remove();
    });
    document.querySelectorAll(".hasAssetLink").forEach(element => {
        element.classList.remove("hasAssetLink");
    });
}
let csrfToken;
function createRolimonsIconLink(href, size, translateY = "-2px") {
    let link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.style.display = "inline-block";
    link.style.paddingLeft = "2px";
    link.style.transform = `translateY(${translateY})`;
    utilities.addTooltip(link, "Quick link to Rolimon's page");

    let linkSpan = document.createElement("span");
    const assetName = utilities.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
    linkSpan.style.backgroundImage = `url(${utilities.getURL(`assets/${assetName}`)})`;
    linkSpan.className = "icon icon-link";
    linkSpan.style.display = "inline-block";
    linkSpan.style.verticalAlign = "bottom";
    linkSpan.style.backgroundSize = "cover";
    linkSpan.style.width = size;
    linkSpan.style.height = size;
    linkSpan.style.cursor = "pointer";
    linkSpan.style.transition = "filter 0.2s";
    linkSpan.style.backgroundColor = "transparent";
    linkSpan.onmouseover = () => { linkSpan.style.filter = "brightness(50%)" };
    linkSpan.onmouseout = () => { linkSpan.style.filter = "" };
    link.appendChild(linkSpan);
    return link;
}

async function getItemProfileAssetType(itemId) {
    if (csrfToken === undefined) {
        csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("data-token");
    }

    const response = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
        method: "POST",
        headers: {
            "X-CSRF-TOKEN": csrfToken
        },
        body: JSON.stringify({ items: [{ itemType: 1, id: itemId }] }),
        credentials: "include"
    });

    if (response.status === 403 && (await response.json()).code === 0) {
        csrfToken = response.headers.get("X-CSRF-TOKEN");
        return getItemProfileAssetType(itemId);
    }

    if (response.status !== 200) {
        return null;
    }

    const responseJSON = await response.json();
    return responseJSON.data?.[0]?.assetType ?? null;
}

async function updateItemProfilePageAssetLinks() {
    await utilities.waitForElm(".item-name-container");
    const itemNameH1 = document.querySelector('.item-name-container').getElementsByTagName("h1")[0];
    if (itemNameH1.querySelector(".icon-link") === null) {
        itemNameH1.style.overflow = "visible"; //prevent tooltip from being hidden for multi-line item titles

        const itemType = utilities.getItemTypeFromPath(window.location.pathname);
        const itemId = utilities.getItemIdFromPath(window.location.pathname);
        const itemData = utilities.getItemData(itemId, itemType);
        if (itemData !== undefined) { //if item is limited

            const link = createRolimonsIconLink(itemType === 2 ? `https://www.rolimons.com/bundle/${itemId}` : `https://www.rolimons.com/item/${itemId}`, "30px", "4px");
            link.style.width = "28px";
            link.style.height = "28px";
            link.style.marginLeft = "4px";
            itemNameH1.appendChild(link);

            utilities.initTooltips();
        }
    }
}

let itemAssetTypeCache = {};
//Finds the item's page address for a price/value element, trying the places Roblox has used for it.
function findItemPathname(textDiv) {
    const candidates = [
        () => textDiv.parentElement?.parentElement?.pathname, //catalog and inventory cards
        () => textDiv.parentElement?.querySelector("span > a")?.pathname, //items already placed in a trade
        () => textDiv.closest(".item-card-container, .trade-request-item, .list-item")?.querySelector('a[href*="/catalog/"], a[href*="/bundles/"], a[href*="/bundle/"], a[href*="/library/"]')?.pathname
    ];
    for (const candidate of candidates) {
        try {
            const pathname = candidate();
            if (pathname && Number.isFinite(utilities.getItemIdFromPath(utilities.removeTwoLetterPath(pathname)))) return pathname;
        } catch (e) { /* try the next place */ }
    }
    return null;
}

async function updateGeneralAssetLinks() {
    const textDivs = document.querySelectorAll(".item-card-price:not(.hasAssetLink), .item-value");
    for (const textDiv of textDivs) {
        //one broken card must never stop the rest from getting their link
        try {
            const found = findItemPathname(textDiv);
            if (found === null) continue; //not drawn yet, a later pass picks it up
            for (const oldLink of textDiv.querySelectorAll(".icon-link")) oldLink.parentElement.remove(); //remove old
            const pathname = utilities.removeTwoLetterPath(found);
            const itemType = utilities.getItemTypeFromPath(pathname);
            const itemId = utilities.getItemIdFromPath(pathname);
            //every item gets its Rolimons link, including ones Rolimons does not track a value for
            const link = createRolimonsIconLink(itemType === 2 ? `https://www.rolimons.com/bundle/${itemId}` : `https://www.rolimons.com/item/${itemId}`, "18px", "-2px");
            textDiv.appendChild(link);
            textDiv.style.overflow = "visible";
            textDiv.classList.add("hasAssetLink");
        } catch (error) {
            console.warn("RoTrade: could not add a Rolimons link to an item", error);
        }
    }

    utilities.initTooltips();
}

export default updateAssetsLinks;