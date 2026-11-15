/*
Extension storage keys and small helpers shared by the content scripts, the background worker and the popup.
Everything lives in chrome.storage.local so every part of the extension sees the same data.
*/

export const KEYS = {
    wishlist: "rovalkWishlist",              // { [assetId]: { name, added } }
    valueBaseline: "rovalkValueBaseline",    // { [assetId]: value } last values seen, to spot changes
    valueChanges: "rovalkValueChanges",      // [{ assetId, name, from, to, time, owned }] newest first
    inventory: "rovalkInventorySnapshot",    // { userId, time, items: [{ assetId, name, serial, uaid, onHold }] }
    valueHistory: "rovalkValueHistory",      // [{ day: "YYYY-MM-DD", value, rap, count }]
    adConfig: "rovalkTradeAd",               // { enabled, offer: [assetId], requestItems: [assetId], requestTags: [tag] }
    adStatus: "rovalkTradeAdStatus",         // { lastPost, nextPost, posts: [time], log: [{ time, ok, message }] }
    listFilter: "RoValk Trade List Filter",
    listSort: "RoValk Trade List Sort"           // "roblox" | "best" | "worst"
};

export function get(key, fallback) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            chrome.runtime?.lastError;
            resolve(result?.[key] ?? fallback);
        });
    });
}

export function set(key, value) {
    return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));
}

export function onChange(keys, callback) {
    const list = Array.isArray(keys) ? keys : [keys];
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && list.some((key) => key in changes)) callback(changes);
    });
}

//Wishlist ---------------------------------------------------------------
let wishlistCache = null;
export async function getWishlist() {
    if (!wishlistCache) {
        wishlistCache = await get(KEYS.wishlist, {});
        onChange(KEYS.wishlist, (changes) => { wishlistCache = changes[KEYS.wishlist].newValue ?? {}; });
    }
    return wishlistCache;
}
export function isWished(assetId) {
    return !!wishlistCache?.[assetId];
}
export async function toggleWish(assetId, name) {
    const list = { ...(await get(KEYS.wishlist, {})) };
    if (list[assetId]) delete list[assetId];
    else list[assetId] = { name: name ?? `Item ${assetId}`, added: Date.now() };
    wishlistCache = list;
    await set(KEYS.wishlist, list);
    return !!list[assetId];
}

//Rolimons trade ads ----------------------------------------------------------
export const AD_TAGS = [
    ["any", "Any"], ["demand", "Demand"], ["rares", "Rares"], ["robux", "Robux"], ["upgrade", "Upgrade"],
    ["downgrade", "Downgrade"], ["rap", "RAP"], ["wishlist", "Wishlist"], ["projecteds", "Projecteds"], ["adds", "Adds"]
];
export const AD_LIMITS = { offer: 4, request: 4, intervalMinutes: 15.5, perDay: 55 };

export function dayKey(time = Date.now()) {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
