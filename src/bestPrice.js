/*
Current selling price (the cheapest copy for sale right now) for many limiteds at once.
Roblox's item cards show the item's RAP in the Robux line, which just repeats the RAP. RoTrade swaps that for the
real current price.

Background side: one POST to catalog.roblox.com/v1/catalog/items/details per 100 items (with Roblox's CSRF token),
falling back to the per-item details call. Prices are cached for 5 minutes.
Page side: getBestPrices(ids) asks the background and caches answers for the page.
*/
const TTL = 5 * 60 * 1000;
const IN_PAGE = typeof chrome === "undefined" || !chrome.tabs;
const cache = new Map(); // id -> { time, price }  (price null = nobody is selling)
let csrfToken = "";

const positive = (n) => (Number(n) > 0 ? Number(n) : null);
const priceOf = (entry) => positive(entry?.lowestResalePrice) ?? positive(entry?.lowestPrice);

async function postDetails(ids) {
    const body = JSON.stringify({ items: ids.map((id) => ({ itemType: 1, id: Number(id) })) });
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
            body
        });
        if (response.status === 403 && response.headers.get("x-csrf-token")) {
            csrfToken = response.headers.get("x-csrf-token");
            continue;
        }
        if (!response.ok) return null;
        return (await response.json())?.data ?? [];
    }
    return null;
}

async function getOne(id) {
    try {
        const response = await fetch(`https://catalog.roblox.com/v1/catalog/items/${id}/details?itemType=Asset`, { credentials: "include" });
        return response.ok ? priceOf(await response.json()) : undefined;
    } catch {
        return undefined;
    }
}

//Background: prices for the ids, using the cache where it is fresh.
async function fetchBestPrices(ids) {
    const out = {};
    const todo = [];
    for (const id of new Set(ids.map(Number).filter((id) => id > 0))) {
        const hit = cache.get(id);
        if (hit && Date.now() - hit.time < TTL) out[id] = hit.price;
        else todo.push(id);
    }
    for (let i = 0; i < todo.length; i += 100) {
        const chunk = todo.slice(i, i + 100);
        let data = null;
        try { data = await postDetails(chunk); } catch { data = null; }
        if (data) {
            const found = new Map(data.map((entry) => [Number(entry.id), priceOf(entry)]));
            for (const id of chunk) {
                const price = found.get(id) ?? null;
                cache.set(id, { time: Date.now(), price });
                out[id] = price;
            }
        } else {
            //batch call refused: a few at a time, one by one
            for (let j = 0; j < chunk.length; j += 6) {
                await Promise.all(chunk.slice(j, j + 6).map(async (id) => {
                    const price = await getOne(id);
                    if (price === undefined) return;
                    cache.set(id, { time: Date.now(), price });
                    out[id] = price;
                }));
            }
        }
    }
    return out;
}

//Page: ask the background, remember answers for this page.
export function getBestPrices(ids) {
    if (!IN_PAGE) return fetchBestPrices(ids);
    const out = {};
    const todo = [];
    for (const id of new Set(ids.map(Number).filter((id) => id > 0))) {
        const hit = cache.get(id);
        if (hit && Date.now() - hit.time < TTL) out[id] = hit.price;
        else todo.push(id);
    }
    if (!todo.length) return Promise.resolve(out);
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ title: "getBestPrices", ids: todo }, (response) => {
                chrome.runtime.lastError;
                for (const [id, price] of Object.entries(response ?? {})) {
                    cache.set(Number(id), { time: Date.now(), price });
                    out[id] = price;
                }
                resolve(out);
            });
        } catch {
            resolve(out);
        }
    });
}

export function listenForBestPriceRequests() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request?.title !== "getBestPrices" || !Array.isArray(request.ids)) return;
        fetchBestPrices(request.ids.slice(0, 600)).then(sendResponse).catch(() => sendResponse({}));
        return true;
    });
}
