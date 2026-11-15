/*
Market data for limiteds, straight from Roblox.
  catalog details  lowestResalePrice / lowestPrice: the cheapest copy for sale right now (the best price), plus the
                   collectibleItemId that Limiteds 2.0 need
  resale-data      daily average sale price and volume (the graph on an item's page) and recentAveragePrice (RAP)
  resellers        the listings themselves, only used when catalog details gave no price
Every source is tried on its own, so one failing (Roblox changes these often) no longer blanks out the rest.

All requests run in the background worker, which has host permission for *.roblox.com and sends your Roblox login.
Content scripts ask it with a "getMarket" message instead of calling Roblox from the page (page-side calls can be
blocked by the browser, which is what left "RAP after sale" empty). Results are cached for 10 minutes, failures for
1 minute, requests run two at a time, and a 429 pauses everything for a while.
Bundles have no resale market and return null.
*/

const CACHE_KEY = "rovalkMarketCache";
const TTL = 10 * 60 * 1000;
const FAIL_TTL = 60 * 1000;
const MAX_CACHED = 250;
const DAY = 86400000;
//content scripts have no chrome.tabs; the background worker and the popup do
const IN_PAGE = typeof chrome === "undefined" || !chrome.tabs;

const memory = new Map(); //key -> { time, data }
let storageLoaded = null;
let pausedUntil = 0;
let active = 0;
const waiting = [];

function loadStorage() {
    if (!storageLoaded) {
        storageLoaded = new Promise((resolve) => {
            try {
                chrome.storage.local.get([CACHE_KEY], (result) => {
                    for (const [key, entry] of Object.entries(result?.[CACHE_KEY] ?? {})) {
                        if (Date.now() - entry.time < TTL && !entry.data?.failed) memory.set(key, entry);
                    }
                    resolve();
                });
            } catch (e) {
                resolve();
            }
        });
    }
    return storageLoaded;
}

let saveTimer = null;
function saveSoon() {
    if (IN_PAGE) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const entries = [...memory.entries()].filter(([, entry]) => Date.now() - entry.time < TTL && !entry.data?.failed).slice(-MAX_CACHED);
        try { chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) }); } catch (e) { /* storage unavailable */ }
    }, 800);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//Runs fn when a slot is free (two at a time), waiting out any rate-limit pause first.
async function slot(fn) {
    if (active >= 2) await new Promise((resolve) => waiting.push(resolve));
    active++;
    try {
        const wait = pausedUntil - Date.now();
        if (wait > 0) await sleep(wait);
        return await fn();
    } finally {
        active--;
        await sleep(120);
        waiting.shift()?.();
    }
}

async function getJSON(url) {
    return slot(async () => {
        try {
            const response = await fetch(url, { credentials: "include" });
            if (response.status === 429) pausedUntil = Date.now() + 20000;
            if (!response.ok) return { status: response.status, body: null };
            return { status: response.status, body: await response.json().catch(() => null) };
        } catch (e) {
            return { status: 0, body: null }; //network or browser blocked the request
        }
    });
}

function readPoints(list) {
    return (Array.isArray(list) ? list : [])
        .map((point) => ({ t: Date.parse(point.date), v: Number(point.value) }))
        .filter((point) => Number.isFinite(point.t) && point.v > 0)
        .sort((a, b) => a.t - b.t);
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function windowMedian(points, now, fromDays, toDays) {
    return median(points.filter((p) => now - p.t >= fromDays * DAY && now - p.t < toDays * DAY).map((p) => p.v));
}

//How Roblox moves RAP after one sale: a tenth of the gap between the sale price and the current RAP.
export function rapAfterSale(rap, price) {
    if (!(rap > 0) || !(price > 0)) return null;
    return Math.round(rap + (price - rap) / 10);
}

const positive = (n) => (Number(n) > 0 ? Number(n) : null);

async function fetchMarket(assetId) {
    const out = { rap: 0, points: [], volume: [], best: null, sellers: null, stock: null, source: [], errors: [] };
    const note = (what, status) => out.errors.push(`${what} ${status || "blocked"}`);

    //1. catalog details: best price and the collectible id
    let collectibleId = null;
    const details = await getJSON(`https://catalog.roblox.com/v1/catalog/items/${assetId}/details?itemType=Asset`);
    if (details.body) {
        collectibleId = details.body.collectibleItemId || null;
        const best = positive(details.body.lowestResalePrice) ?? positive(details.body.lowestPrice);
        //only limiteds are looked up here, so the lowest price on the item is the cheapest resale listing
        if (best) {
            out.best = best;
            out.source.push("catalog");
        }
        if (details.body.unitsAvailableForConsumption !== undefined) out.stock = details.body.unitsAvailableForConsumption;
    } else {
        note("catalog details", details.status);
    }

    //2. sale history and RAP: the route that matches the item first, the other one as a fallback
    const routes = [
        collectibleId ? `https://apis.roblox.com/marketplace-sales/v1/item/${collectibleId}/resale-data` : null,
        `https://economy.roblox.com/v1/assets/${assetId}/resale-data`
    ].filter(Boolean);
    for (const url of routes) {
        const resale = await getJSON(url);
        if (resale.body && (resale.body.recentAveragePrice !== undefined || Array.isArray(resale.body.priceDataPoints))) {
            out.rap = Number(resale.body.recentAveragePrice) || 0;
            out.points = readPoints(resale.body.priceDataPoints);
            out.volume = readPoints(resale.body.volumeDataPoints);
            out.stock = out.stock ?? resale.body.numberRemaining ?? resale.body.assetStock ?? null;
            out.source.push(url.includes("marketplace-sales") ? "collectible history" : "classic history");
            break;
        }
        note(url.includes("marketplace-sales") ? "collectible history" : "classic history", resale.status);
    }

    //3. listings, only when catalog details gave no price
    if (!out.best) {
        const sellerRoutes = [
            collectibleId ? `https://apis.roblox.com/marketplace-sales/v1/item/${collectibleId}/resellers?limit=10` : null,
            `https://economy.roblox.com/v1/assets/${assetId}/resellers?limit=10`
        ].filter(Boolean);
        for (const url of sellerRoutes) {
            const sellers = await getJSON(url);
            if (sellers.body) {
                const listings = (sellers.body.data ?? []).map((entry) => Number(entry.price ?? entry.unitPrice)).filter((price) => price > 0);
                out.sellers = listings.length;
                if (listings.length) {
                    out.best = Math.min(...listings);
                    out.source.push("resellers");
                }
                break;
            }
            note("resellers", sellers.status);
        }
    }

    out.failed = !out.best && !out.points.length && !out.rap;
    if (out.errors.length) console.debug(`RoTrade market ${assetId}: ${out.source.join(", ") || "nothing loaded"}; failed: ${out.errors.join(", ")}`);
    return out;
}

const inflight = new Map();
/*
Market data for one item: { rap, points, volume, best, sellers, stock, source, errors, failed }, or null for bundles.
`failed` is true when Roblox gave nothing usable; `errors` says which lookups failed and how.
Pass { fresh: true } to skip the cache.
*/
export async function getMarket(assetId, itemType = 1, options = {}) {
    if (itemType === 2 || !(Number(assetId) > 0)) return null;
    const key = String(assetId);
    if (!IN_PAGE) await loadStorage();
    const cached = memory.get(key);
    if (!options.fresh && cached && Date.now() - cached.time < (cached.data?.failed ? FAIL_TTL : TTL)) return cached.data;
    if (inflight.has(key)) return inflight.get(key);
    const job = (IN_PAGE ? askBackground(assetId, options) : fetchMarket(assetId))
        .then((result) => {
            if (!result) return cached?.data ?? null;
            memory.delete(key);
            memory.set(key, { time: Date.now(), data: result });
            saveSoon();
            return result;
        })
        .catch(() => (cached ? cached.data : null))
        .finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
}

function askBackground(assetId, options) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ title: "getMarket", assetId: Number(assetId), fresh: !!options.fresh }, (response) => {
                chrome.runtime.lastError;
                resolve(response ?? { failed: true, errors: ["extension background did not answer"], points: [], volume: [], rap: 0, best: null, source: [] });
            });
        } catch (e) {
            resolve({ failed: true, errors: ["extension was reloaded: refresh the page"], points: [], volume: [], rap: 0, best: null, source: [] });
        }
    });
}

//Background side of getMarket for content scripts.
export function listenForMarketRequests() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request?.title !== "getMarket") return;
        getMarket(request.assetId, 1, { fresh: request.fresh }).then(sendResponse);
        return true;
    });
}

/*
Turns raw resale data into the numbers RoValk shows.
direction: "up" | "down" | "flat" | null, from the last 7 days of sale prices against the 3 weeks before.
*/
export function analyze(raw, rolimonsInfo) {
    if (!raw) return null;
    if (raw.failed) return { failed: true, errors: raw.errors ?? [], rap: rolimonsInfo?.rap || 0, best: null, rapAfter: null, bestVsRap: null, bestVsValue: null, change7: null, change30: null, direction: null, salesPerDay: 0, lastSale: null, typical: null, possiblyProjected: false, spark: [], sellers: null, source: [] };
    const points = raw.points ?? [];
    const now = points.length ? Math.max(points[points.length - 1].t, Date.now() - 3 * DAY) : Date.now();
    const recent = windowMedian(points, now, 0, 7);
    const before = windowMedian(points, now, 7, 30);
    const older = windowMedian(points, now, 30, 60);
    const change7 = recent && before ? (recent / before - 1) * 100 : null;
    const change30 = recent && older ? (recent / older - 1) * 100 : null;
    const basis = change7 ?? change30;
    const direction = basis === null ? null : basis > 5 ? "up" : basis < -5 ? "down" : "flat";
    const rap = raw.rap > 0 ? raw.rap : (rolimonsInfo?.rap || 0);
    const volume30 = (raw.volume ?? []).filter((p) => now - p.t < 30 * DAY).reduce((sum, p) => sum + p.v, 0);
    const lastTen = points.slice(-10).map((p) => p.v);
    const typical = median(lastTen);
    const best = raw.best > 0 ? raw.best : null;
    return {
        rap,
        best,
        sellers: raw.sellers ?? null,
        rapAfter: rapAfterSale(rap, best),
        bestVsRap: best && rap ? (best / rap - 1) * 100 : null,
        bestVsValue: best && rolimonsInfo?.value ? (best / rolimonsInfo.value - 1) * 100 : null,
        change7,
        change30,
        direction,
        salesPerDay: volume30 / 30,
        lastSale: points.length ? points[points.length - 1] : null,
        typical,
        possiblyProjected: !!(typical && rap > typical * 1.25 && points.length >= 3),
        spark: points.filter((p) => now - p.t < 60 * DAY),
        source: raw.source ?? [],
        errors: raw.errors ?? [],
        failed: false
    };
}

//Small SVG line of recent sale prices. points: [{t, v}].
export function sparkline(points, width = 90, height = 24, color = "currentColor") {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("class", "rv-spark");
    svg.setAttribute("aria-hidden", "true");
    if (!points || points.length < 2) {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", 2); line.setAttribute("x2", width - 2);
        line.setAttribute("y1", height / 2); line.setAttribute("y2", height / 2);
        line.setAttribute("stroke", color); line.setAttribute("stroke-opacity", ".3"); line.setAttribute("stroke-dasharray", "3 3");
        svg.appendChild(line);
        return svg;
    }
    const values = points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const t0 = points[0].t;
    const tSpan = points[points.length - 1].t - t0 || 1;
    const coords = points.map((p) => [2 + ((p.t - t0) / tSpan) * (width - 4), 2 + (1 - (p.v - min) / span) * (height - 4)]);
    const path = document.createElementNS(ns, "polyline");
    path.setAttribute("points", coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "1.6");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    const dot = document.createElementNS(ns, "circle");
    const [lx, ly] = coords[coords.length - 1];
    dot.setAttribute("cx", lx); dot.setAttribute("cy", ly); dot.setAttribute("r", "2.2"); dot.setAttribute("fill", color);
    svg.append(path, dot);
    return svg;
}

/*
Always answers "up" or "down" for an item, using the best signal available, in this order:
  1. sale prices this week vs the 3 weeks before     2. this month vs the month before
  3. cheapest listing vs RAP (where RAP is heading)  4. last sale vs RAP
  5. Rolimons trend (Raising / Lowering)             6. Rolimons value vs RAP
Returns { dir: "up" | "down", pct: number | null, basis: text for the tooltip, weak: true when the move is under 2% }.
`market` may be null (no resale data, bundles); then only the Rolimons signals are used.
*/
export function directionFor(market, info) {
    const candidates = [];
    if (market) {
        candidates.push([market.change7, "sale prices this week"]);
        candidates.push([market.change30, "sale prices this month"]);
        candidates.push([market.bestVsRap, "cheapest listing vs RAP"]);
        if (market.lastSale && market.rap) candidates.push([(market.lastSale.v / market.rap - 1) * 100, "last sale vs RAP"]);
    }
    for (const [value, basis] of candidates) {
        if (value !== null && value !== undefined && Number.isFinite(value) && Math.abs(value) >= 0.05) {
            return { dir: value > 0 ? "up" : "down", pct: value, basis, weak: Math.abs(value) < 2 };
        }
    }
    if (info?.trend === 3) return { dir: "up", pct: null, basis: "Rolimons trend: Raising", weak: false };
    if (info?.trend === 0) return { dir: "down", pct: null, basis: "Rolimons trend: Lowering", weak: false };
    if (info && info.value > 0 && info.rap > 0 && info.value !== info.rap) {
        const pct = (info.rap / info.value - 1) * 100;
        return { dir: pct > 0 ? "up" : "down", pct, basis: "RAP vs Rolimons value", weak: Math.abs(pct) < 2 };
    }
    return { dir: info?.trend === 1 ? "down" : "up", pct: null, basis: info?.trendText ? `Rolimons trend: ${info.trendText}` : "no recent sales", weak: true };
}

export function salesUrl(assetId) {
    return `https://www.rolimons.com/itemsales/${assetId}`;
}
