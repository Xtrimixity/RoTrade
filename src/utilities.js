//BACKGROUND

export async function getData() {
    async function fetchItemDetails(url) {
        const response = await fetch(url, {
            headers: {
                "From-Extension": true

            },
        });
        if (response.status !== 200) {
            return null;
        }
        return await response.json();
    }

    const v3Data = await fetchItemDetails("https://api.rolimons.com/items/v3/itemdetails");
    const data = v3Data ?? await fetchItemDetails("https://api.rolimons.com/items/v2/itemdetails");
    if (!data) {
        return null;
    }
    return normalizeItemDetailsData(data);
}

//CONTENT SCRIPT
let rolimonsData;
export function refreshData(update) {
    let messageName = "getData"; //if this is an initial fetch
    if (rolimonsData !== undefined) {
        messageName = "getDataPeriodic"; //if this is a periodic update fetch
    }
    chrome.runtime.sendMessage(messageName, function (response) {
        rolimonsData = response;
        rolimonsData && update(); //only call update callback if we have value data
        setTimeout(() => refreshData(update), 1000 * 60); //every 1 minute attempt to refresh
    });
}
export function getRolimonsData() {
    return rolimonsData;
}
export function getItemKey(itemType, itemId) {
    return `${itemType}:${itemId}`;
}

export function getItemTypeFromPath(pathname) {
    const cleanPath = removeTwoLetterPath(pathname || "");
    if (cleanPath.includes("/bundle/") || cleanPath.includes("/bundles/")) {
        return 2;
    }
    return 1;
}

export function getItemIdFromPath(pathname) {
    const cleanPath = removeTwoLetterPath(pathname || "");
    const matches = cleanPath.match(/\/(?:catalog|item|bundle|bundles)\/(\d+)/);
    if (matches) {
        return parseInt(matches[1]);
    }
    return parseInt(cleanPath.substring(nthIndex(cleanPath, "/", 2) + 1, nthIndex(cleanPath, "/", 3)));
}

export function getItemData(itemId, itemType = 1, valueData = rolimonsData) {
    if (!valueData) {
        return undefined;
    }
    const itemKey = getItemKey(itemType, itemId);
    return valueData.items?.[itemKey]
        ?? valueData.items?.[itemId]
        ?? valueData.assets?.[itemId]
        ?? valueData.bundles?.[itemId]
        ?? valueData.rolimons?.items?.[itemKey]
        ?? valueData.rolimons?.items?.[itemId];
}

export function findRolimonsEntryByName(name, valueData = rolimonsData) {
    if (!valueData || !name) {
        return null;
    }

    const normalizedName = name.toString().trim().toLowerCase();
    const candidates = [
        valueData.bundles,
        valueData.assets,
        valueData.items,
        valueData.rolimons?.bundles,
        valueData.rolimons?.items,
        valueData.rolimons?.assets,
    ].filter(Boolean);

    const readEntryName = (entry) => {
        if (Array.isArray(entry)) {
            return entry[0];
        }
        return entry?.name ?? entry?.[0] ?? entry?.item_name ?? entry?.title;
    };

    for (const candidateMap of candidates) {
        for (const [id, entry] of Object.entries(candidateMap)) {
            const entryName = readEntryName(entry);
            if (!entryName) {
                continue;
            }

            const normalizedEntryName = entryName.toString().trim().toLowerCase();
            if (normalizedEntryName === normalizedName || normalizedEntryName.includes(normalizedName) || normalizedName.includes(normalizedEntryName)) {
                return {
                    id,
                    entry,
                    itemType: candidateMap === valueData.bundles || candidateMap === valueData.rolimons?.bundles ? 2 : 1,
                };
            }
        }
    }

    return null;
}

function normalizeItemDetailsData(data) {
    if (data.items && data.assets && data.bundles) {
        return data;
    }

    const normalized = { ...data };
    const items = {};

    const assets = data.assets ?? data?.rolimons?.items ?? {};
    const bundles = data.bundles ?? {};

    Object.entries(assets).forEach(([itemId, itemData]) => {
        items[getItemKey(1, itemId)] = itemData;
        items[itemId] = itemData;
    });

    Object.entries(bundles).forEach(([itemId, itemData]) => {
        items[getItemKey(2, itemId)] = itemData;
    });

    normalized.assets = assets;
    normalized.bundles = bundles;
    normalized.items = items;
    normalized.rolimons = normalized.rolimons ?? {};
    normalized.rolimons.items = items;
    return normalized;
}

export function getItemTypeFromAssetData(asset) {
    const itemType = asset?.itemType ?? asset?.assetType ?? asset?.itemTarget?.itemType;
    return itemType === 2 || itemType === "Bundle" ? 2 : 1;
}

export function getTradeOfferItems(offer) {
    return offer?.userAssets ?? offer?.items ?? [];
}

export function getTradeOffers(extraData) {
    if (extraData?.offers) {
        return extraData.offers;
    }

    return [extraData?.participantAOffer, extraData?.participantBOffer].filter(Boolean);
}

export function getItemTypeFromTradeElement(element) {
    const bundleLink = element?.querySelector('a[href*="/bundle/"], a[href*="/bundles/"]');
    if (bundleLink) {
        return 2;
    }

    const typeElement = element?.querySelector("[thumbnail-type]") || element?.querySelector(".thumbnail-2d-container[thumbnail-type]");
    if (typeElement?.getAttribute("thumbnail-type") === "Bundle") {
        return 2;
    }

    return 1;
}

export function getURL(URL) {
    return chrome.runtime.getURL(URL);
}

export function waitForElm(selector, parent) {
    /*
    Very important function for the extension. It allows waiting for an element with a specific querySelector to load into the DOM.
    */
    return new Promise(resolve => {
        let observeParentElement = document; //if a parent is not specified, then we will default to the document root
        if (parent !== undefined) {
            observeParentElement = parent;
        }
        function tryGetElem() {
            let elem = observeParentElement.querySelector(selector);
            if (elem) {
                resolve(elem);
                observer.disconnect();
            }
        }

        const observer = new MutationObserver(tryGetElem);

        observer.observe(parent === undefined ? document.body : observeParentElement, {
            childList: true,
            subtree: true
        });

        tryGetElem(); //initial try
    });
}

export function nthIndex(str, pat, n) {

    var L = str.length, i = -1;
    while (n-- && i++ < L) {
        i = str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
}


//"Compact Value Numbers" option: show 1,250,000 as 1.25M. The flag is kept in sync with extension storage.
let compactNumbers = false;
try {
    chrome.storage.local.get(["Compact Value Numbers"], (result) => {
        compactNumbers = !!result?.["Compact Value Numbers"];
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes["Compact Value Numbers"]) {
            compactNumbers = !!changes["Compact Value Numbers"].newValue;
        }
    });
} catch (e) {
    //storage is not available in this context, so numbers just stay in the full format
}

export function formatCompact(x) {
    const abs = Math.abs(x);
    const sign = x < 0 ? "-" : "";
    const trim = (n) => n.toFixed(2).replace(/\.?0+$/, "");
    if (abs >= 1e9) return sign + trim(abs / 1e9) + "B";
    if (abs >= 1e6) return sign + trim(abs / 1e6) + "M";
    if (abs >= 1e4) return sign + trim(abs / 1e3) + "K";
    return null;
}

export function commafy(x) {
    if (compactNumbers && typeof x === "number" && isFinite(x)) {
        const compact = formatCompact(x);
        if (compact) return compact;
    }
    return commafyFull(x);
}

export function commafyFull(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export function getOption(name) {

    return new Promise((resolve) => {
        chrome.storage.local.get([name], function (result) {
            if (chrome.runtime.lastError) {
                console.info(chrome.runtime.lastError);
            }
            resolve(result[name]);
        });
    });
}

export function setOption(name, value) {


    return new Promise((resolve) => {
        chrome.storage.local.set({ [name]: value }, function () {
            if (chrome.runtime.lastError) {
                console.info(chrome.runtime.lastError);
            }
            resolve();
        });
    });
}



export function getPageType() {

    if (window.location.pathname.includes("/bundle/") || window.location.pathname.includes("/bundles/")) {
        return "itemProfile";
    }


    const tradeRequestDiv = document.querySelector('[ng-show="layout.view === tradesConstants.views.tradeRequest"]'); //this div always contains the ng-hide class unless you are on the counter or send pages
    const tradesPageElement = document.querySelector("#trades-web-app");
    if (tradesPageElement) {
        if (tradesPageElement.querySelector(".trade-request-react")) {
            return "sendOrCounter";
        } else {

            return "details";
        }
    }
    const resultsContainer = document.querySelector(".results-container");
    if (resultsContainer) {
        return "catalog";
    }

    if (document.querySelector('[data-internal-page-name]')?.getAttribute('data-internal-page-name') === "CatalogItem") {
        return "itemProfile";
    }
    const dataUserProfile = document.querySelector('meta[data-internal-page-name="Profile"]');
    if (dataUserProfile) {
        return "userProfile";
    }
    const userInventoryBody = document.querySelector('meta[data-internal-page-name="Inventory"]');
    if (userInventoryBody) {
        return "userInventory";
    }

}
export function getValueOrRAP(itemId, itemType = 1, valueData = rolimonsData) { //this function gets the value if it exists or the RAP, unlike the getValue function from csTrade.js.
    return getItemData(itemId, itemType, valueData)?.[4] ?? getItemData(itemId, itemType, valueData)?.[3] ?? -1;
}
export function getRAP(itemId, itemType = 1, valueData = rolimonsData) {
    return getItemData(itemId, itemType, valueData)?.[2] ?? -1;
}

/*
One place that turns a Rolimons item array into something readable.
Rolimons documents the layout as [0] name, [1] acronym, [2] RAP, [3] value (-1 = no set value), [4] default value
(value, or RAP when there is none), [5] demand, [6] trend, [7] projected, [8] hyped, [9] rare.
Older RoValk code read rare from [8]. Hyped items are a handful while rare items number in the hundreds, so instead of
trusting either guess, detectLayout() counts the 1s in both columns once per data set and uses the busier one as "rare".
*/
const layoutCache = new WeakMap();
export function detectLayout(valueData = rolimonsData) {
    if (!valueData || typeof valueData !== "object") return { rare: 8, hyped: 9 };
    if (layoutCache.has(valueData)) return layoutCache.get(valueData);
    let at8 = 0;
    let at9 = 0;
    for (const entry of Object.values(valueData.assets ?? valueData.items ?? {})) {
        if (!Array.isArray(entry)) continue;
        if (entry[8] === 1) at8++;
        if (entry[9] === 1) at9++;
    }
    const layout = at9 > at8 ? { rare: 9, hyped: 8 } : { rare: 8, hyped: 9 };
    layoutCache.set(valueData, layout);
    return layout;
}

export const DEMAND_TEXT = { 0: "Terrible", 1: "Low", 2: "Normal", 3: "High", 4: "Amazing" };
export const TREND_TEXT = { 0: "Lowering", 1: "Unstable", 2: "Stable", 3: "Raising", 4: "Fluctuating" };

export function getItemInfo(itemId, itemType = 1, valueData = rolimonsData) {
    const data = getItemData(itemId, itemType, valueData);
    if (!data) return null;
    const isPositive = (n) => typeof n === "number" && n > 0;
    const rap = isPositive(data[2]) ? data[2] : 0;
    let hasValue;
    if (typeof data[3] === "number") {
        hasValue = data[3] > 0; //-1 means Rolimons has not set a value for this item
    } else {
        hasValue = isPositive(data[4]) && data[4] !== data[2]; //fallback if index 3 is missing: a value that differs from RAP is a set value
    }
    //same number the rest of RoValk uses for totals (see getValueOrRAP), but guarded against -1
    const value = isPositive(data[4]) ? data[4] : isPositive(data[3]) ? data[3] : rap;
    const layout = detectLayout(valueData);
    const demand = typeof data[5] === "number" && data[5] >= 0 && data[5] <= 4 ? data[5] : null;
    const trend = typeof data[6] === "number" && data[6] >= 0 && data[6] <= 4 ? data[6] : null;
    return {
        id: Number(itemId),
        type: itemType,
        name: data[0],
        acronym: data[1] || "",
        rap,
        hasValue,
        value,
        demand,
        demandText: demand === null ? null : DEMAND_TEXT[demand],
        trend,
        trendText: trend === null ? null : TREND_TEXT[trend],
        projected: data[7] === 1,
        hyped: data[layout.hyped] === 1,
        rare: data[layout.rare] === 1
    };
}

export function applyTax(robux) {
    return Math.round(robux * .7);
}
export function calculateTotalsFromExtraData(extraData, valueData, subtractRobuxFeeFromValue) {

    let totals = {};
    getTradeOffers(extraData).forEach((offer, index) => {
        let totalValue = 0;
        getTradeOfferItems(offer).forEach((asset) => {
            const itemId = asset?.assetId ?? asset?.itemTarget?.targetId;
            if (itemId === undefined) {
                return;
            }
            totalValue += getValueOrRAP(parseInt(itemId), getItemTypeFromAssetData(asset), valueData);
        });
        const addedRobux = Number(offer?.robux) || 0;
        const addedRobuxAfterFee = applyTax(addedRobux);
        totalValue += subtractRobuxFeeFromValue ? addedRobuxAfterFee : addedRobux;
        totals[index] = totalValue;
    });
    return totals;
}


export function getExtensionTitle(full) {
    if (full) {
        return chrome.runtime.getManifest().name;
    } else {
        return chrome.runtime.getManifest()["short_name"];
    }
}
export function getColorMode() {
    return document.getElementById("rbx-body").classList.contains("light-theme") ? "light" : "dark";
}
export function calculateTimeEstimate(tradeCount, i) {

    function toHHMMSS(str) {
        var sec_num = parseInt(str, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);
        return (hours !== 0 ? (hours + 'h ') : "") + (minutes !== 0 ? (minutes + 'm ') : "") + (seconds !== 0 ? (seconds + 's') : "");
    }

    let seconds = 60 * (tradeCount / 12) - i;
    if (seconds < 60) {
        seconds = 60;
    }
    return toHHMMSS(String(seconds));
}


const inventoryCache = {};
export function getUserInventoryCached(userId, maxAgeMs = 60000) {
    //several features need the same inventory; share one request per minute
    const cached = inventoryCache[userId];
    if (cached && Date.now() - cached.time < maxAgeMs) return cached.promise;
    const promise = getUserInventory(userId);
    inventoryCache[userId] = { time: Date.now(), promise };
    return promise;
}

export async function getUserInventory(userId) {


    let cursor;
    let finished = false;
    let inventory = [];
    while (!finished) {
        const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Desc&limit=100${cursor ? ("&cursor=" + cursor) : ""}`;

        const response = await fetch(url, { credentials: "include" });


        if (response.status === 200) {
            const inventoryData = await response.json();
            inventory = inventory.concat(inventoryData.data);
            cursor = inventoryData.nextPageCursor;
            if (cursor === null) {
                finished = true;
            }
        } else {
            return false;
        }
    }
    return inventory;
}


export async function getAuthenticatedUserId() {
    userId = parseInt(document.querySelector('meta[name="user-data"]').getAttribute("data-userid"));
    return userId;
}
export function addTooltip(element, text) {
    element.setAttribute("data-toggle", "tooltip");
    element.setAttribute("title", text);
}
export function removeTooltipsFromClass(className) {
    for (element of document.querySelectorAll(`.${className}`)) {
        element.removeAttribute("data-toggle");
        element.removeAttribute("data-original-title");
    }
}
export function initTooltips() {
    /*
        This function initializes bootstrapJQuery tooltips on the page. 
        It does this by using the injected script "initTooltips.js" which calls the JQuery .tooltip() method on every tooltip in the page.
    */
    if (!document.getElementById("rolimonsInitTooltipsScript")) {
        const s = document.createElement("script");
        s.id = "rolimonsInitTooltipsScript";
        s.src = getURL("scripts/initTooltips.js"); //this script runs the JQuery command on the page to initialize all tooltips
        s.onload = function () { document.dispatchEvent(new CustomEvent("initTooltips")); };
        (document.head || document.documentElement).appendChild(s);
    } else {
        document.dispatchEvent(new CustomEvent("initTooltips"));
    }
}


export function checkIfAssetTypeIsOnRolimons(assetType) {
    let assetTypesOnRolimons = [
        8,  // hat
        17, // head
        18, // face
        19, // gear
        27, // torso
        28, // right arm
        29, // left arm
        30, // left leg
        31, // right leg
        41, // hair accessory
        42, // face accessory
        43, // neck accessory
        44, // shoulder accessory
        45, // front accessory
        46, // back accessory
        47, // waist accessory
        48, // climb animation
        49, // death animation
        50, // fall animation
        51, // idle animation
        52, // jump animation
        53, // run animation
        54, // swim animation
        55, // walk animation
        56, // pose animation
        61, // emote animation
        64, // t-shirt accessory
        65, // shirt accessory
        66, // pants accessory
        67, // jacket accessory
        68, // sweater accessory
        69, // shorts accessory
        70, // left shoe accessory
        71, // right shoe accessory
        72, // dress skirt accessory
        76, // eyebrow accessory
        77, // eyelash accessory
        78, // mood animation
        79  // dynamic head
    ]


    if (assetTypesOnRolimons.indexOf(assetType) !== -1) {
        return true;
    } else {
        return false;
    }
}

export function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return string.replace(reg, (match) => (map[match]));
}

import optionsJSON from "./data/options.json"
export function setDefaultOptionValues(override) {
    function getOptionNames() {
        const options = [];
        optionsJSON.forEach((line) => {
            if (typeof line !== "string") {
                //option
                options.push(line.name);
            }
        });
        return options;
    }
    const optionNames = getOptionNames();
    chrome.storage.local.get(optionNames, function (result) {
        optionsJSON.forEach((line) => {
            if (!(typeof line === "string")) {
                //option
                let enabled = result[line.name];
                if (enabled === undefined || override) {
                    enabled = line.enabledByDefault;
                    chrome.storage.local.set({ [line.name]: enabled });
                }
            }
        });
    });
}

//TRADE
export function removeTwoLetterPath(url) {
    return url.split('/').filter(segment => segment.length !== 2).join('/');
}

export async function calculateValueTotalDetails(offerElement, returnAddedRobux) {
    /*
    This function only works on the trade details page.
    This function calculates the total value added to one side of a trade, given an offerElement.
    It is used in winLossStats.js, tradeDetailsValues.js and tradeTools.js.
    */
    await waitForElm(".item-card-container");
    const items = offerElement.querySelectorAll(".item-card-container");
    await waitForElm(".item-card-price");
    //wait for key elements to load

    let totalValue = 0;
    for (item of items) {
        const textDiv = item.querySelector(".item-card-price");
        const link = textDiv.parentElement.parentElement;
        const itemType = getItemTypeFromPath(link.pathname);
        const itemId = getItemIdFromPath(link.pathname);
        totalValue += Math.max(getValueOrRAP(itemId, itemType), 0); //items Rolimons does not track count as 0, not -1
    }
    const totalValueWithoutRobux = totalValue;

    const addedRobuxAfterTaxElement = offerElement.querySelector(".text-label.robux-line-value");
    let addedRobux = 0;
    if (addedRobuxAfterTaxElement) {
        const addedRobuxAfterTax = parseInt(addedRobuxAfterTaxElement.innerText.replace(",", "")) || 0;
        addedRobux = Math.round(addedRobuxAfterTax / 0.7); //undo the tax
        totalValue += addedRobux;
    }
    if (!returnAddedRobux) {
        return totalValue;
    } else {
        return [totalValueWithoutRobux, addedRobux]
    }
}
export async function calculateValueTotalSendOrCounter(offerElement, returnAddedRobux) {
    /*
    This function only works on the trade send or counter pages.
    This function calculates the total value added to one side of a trade, given an offerElement.
    It is used in winLossStats.js, tradeDetailsValues.js and tradeTools.js.
    */
    await waitForElm('.trade-request-item, [ng-repeat="slot in offer.slots"]', document);
    //wait for key elements to load

    const itemValueSpans = offerElement.querySelectorAll('.trade-request-item .valueSpan');
    let totalValue = 0;

    if (false) { //itemValueSpans.length > 0
        for (const valueSpan of itemValueSpans) {
            const rawValue = parseInt(valueSpan.innerText.replaceAll(',', ''));
            if (!isNaN(rawValue)) {
                totalValue += rawValue;
            }
        }
    } else {
        const items = offerElement.querySelectorAll('.trade-request-item, .trade-item-card, .item-card-container, [ng-repeat="slot in offer.slots"]');
        for (item of items) {
            const thumbnailContainer = item.querySelector('.thumbnail-2d-container');
            const thumbnail = item.querySelector('[thumbnail-target-id]');
            const linkPath = item.querySelector('a')?.pathname;
            const itemId = parseInt(thumbnail?.getAttribute("thumbnail-target-id") || thumbnailContainer?.getAttribute("thumbnail-target-id") || getItemIdFromPath(linkPath || ""));
            const itemType = getItemTypeFromTradeElement(item);
            if (!isNaN(itemId)) {
                totalValue += Math.max(getValueOrRAP(itemId, itemType), 0);
            }
        }
    }
    const totalValueWithoutRobux = totalValue;

    const addedRobuxElement = offerElement.querySelector('[name="robux"]');

    let addedRobux = parseInt(addedRobuxElement.value) || 0;
    if (addedRobuxElement.parentElement.classList.contains("form-has-error")) //if you have gone over the max amount of Robux
        addedRobux = 0;
    totalValue += addedRobux;

    if (!returnAddedRobux) {
        return totalValue;
    } else {
        return [totalValueWithoutRobux, addedRobux]
    }
}
export function createValuesSpans(parent, options) {
    function insert(element, parent) { //insert before the icon link always
        const iconLink = parent.querySelector(".icon-link");
        if (iconLink) {
            parent.insertBefore(element, iconLink.parentElement);
        } else {
            parent.appendChild(element);
        }
    }
    parent.style.height = "44px";

    //create new spans for values
    if (!options?.inline) {
        const br = document.createElement("br");
        insert(br, parent);
    }
    const imageSpan = document.createElement("span");
    imageSpan.className = "icon icon-rolimons";
    imageSpan.style.backgroundImage = `url(${getURL("assets/icons/logo.svg")})`;
    imageSpan.style.display = "inline-block";
    imageSpan.style.backgroundSize = "cover";
    imageSpan.style.width = options?.large ? "21px" : "19px";
    imageSpan.style.height = imageSpan.style.width;
    imageSpan.style.marginTop = options?.inline ? "-4px" : "0px";
    imageSpan.style.marginRight = options?.inline ? "3px" : "6px";
    imageSpan.style.marginLeft = options?.inline ? "5px" : "0px";
    imageSpan.style.verticalAlign = options?.inline && "middle";
    imageSpan.style.transform = options?.large ? "translateY(4px)" : "translateY(2px)";
    imageSpan.style.backgroundColor = "transparent";
    insert(imageSpan, parent);
    const valueSpan = document.createElement("span");
    valueSpan.className = `valueSpan ${options?.large ? "text-robux-lg" : "text-robux"}`;
    valueSpan.innerHTML = "";
    insert(valueSpan, parent);
}

export async function fetchIDFromName(username) {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: false
        })
    });

    const data = await response.json();
    return data.data[0].id;
}

//The other person in the open trade: from the URL on the send page (/users/123/trade), otherwise from the profile link in the trade panel.
export function getPartnerId() {
    const fromUrl = window.location.pathname.match(/\/users\/(\d+)\/trade/i);
    if (fromUrl) return Number(fromUrl[1]);
    const scope = document.querySelector(".trades-list-detail, .trade-list-detail, .trade-request-window") || document.querySelector(".trades-container");
    const link = [...(scope?.querySelectorAll('a[href*="/users/"]') ?? [])].find((a) => !a.closest("#rovalkPartnerCard, #rovalkTradeTools"));
    const match = link?.getAttribute("href")?.match(/\/users\/(\d+)/);
    return match ? Number(match[1]) : null;
}

//The signed-in user, read from Roblox's own page metadata (no request needed).
export function getMyUserId() {
    const id = Number(document.querySelector('meta[name="user-data"]')?.getAttribute("data-userid"));
    return Number.isInteger(id) && id > 0 ? id : null;
}

//Item id and type for a card on any trade page (details offers, inventories, or items already added on the send page).
export function readCardItem(card) {
    const price = card.querySelector(".item-card-price");
    const link = price?.parentElement?.querySelector(":scope > a") || price?.parentElement?.parentElement;
    if (link?.pathname) {
        const path = removeTwoLetterPath(link.pathname);
        const id = getItemIdFromPath(path);
        if (!isNaN(id)) return { id, type: getItemTypeFromPath(path) };
    }
    const thumb = card.querySelector("[thumbnail-target-id]");
    const anyLink = card.querySelector('a[href*="/catalog/"], a[href*="/bundles/"], a[href*="/bundle/"]');
    const id = parseInt(thumb?.getAttribute("thumbnail-target-id") || getItemIdFromPath(anyLink?.pathname || ""));
    return isNaN(id) ? null : { id, type: getItemTypeFromTradeElement(card) };
}
