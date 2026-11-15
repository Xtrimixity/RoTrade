/*
Background trade history tracker.
Every few minutes (and when you press "Sync now" in the popup) it asks Roblox for your completed trades, fetches the
details of any it has not stored yet, and saves them with the item values at the time they were saved.
The history page and Stats tab then compare those saved values with today's Rolimons values, so a trade's profit or
loss keeps updating as item prices change.

Stored under "rovalkTradeHistory" in extension storage:
{ v, userId, lastSync, trades: { [tradeId]: { id, partner, created, status, offers: [give, receive] } } }
Each offer is { robux, items: [{ assetId, itemType, name, serial, value }] }. offers[0] is what you gave and
offers[1] is what you received, the same order the rest of RoValk uses.
*/
import * as utilities from "./utilities.js";

export const HISTORY_KEY = "rovalkTradeHistory";
const ALARM_NAME = "rovalkTradeHistory";
const MAX_PAGES = 6; //up to 600 completed trades are listed per run
const NEW_PER_ALARM = 12; //detail requests per automatic run (keeps us well under Roblox's rate limits)
const NEW_PER_MANUAL = 30;

let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRolimonsData() {
    let data = await utilities.getOption("data");
    if (!data) {
        data = await utilities.getData();
        if (data) await utilities.setOption("data", data);
    }
    return data;
}

function snapshotOffer(offer, data) {
    const items = utilities.getTradeOfferItems(offer).map((asset) => {
        const rawId = asset?.assetId ?? asset?.itemTarget?.targetId;
        if (rawId === undefined) return null;
        const assetId = Number(rawId);
        const type = utilities.getItemTypeFromAssetData(asset);
        const info = utilities.getItemInfo(assetId, type, data);
        return {
            assetId,
            itemType: type === 2 ? "Bundle" : "Asset",
            name: asset.name ?? asset.itemName ?? info?.name ?? `Item ${assetId}`,
            serial: asset.serialNumber ?? null,
            value: info?.value ?? 0
        };
    }).filter(Boolean);
    return { robux: Number(offer?.robux) || 0, items };
}

export async function syncHistory(maxNew = NEW_PER_ALARM) {
    if (running) return { ok: false, reason: "busy" };
    running = true;
    try {
        if (!(await utilities.getOption("Trade History Tracking"))) return { ok: false, reason: "disabled" };

        const authResponse = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" });
        if (authResponse.status !== 200) return { ok: false, reason: "signed-out" };
        const userId = (await authResponse.json()).id;
        if (userId === undefined) return { ok: false, reason: "signed-out" };

        let store = await utilities.getOption(HISTORY_KEY);
        if (!store || store.userId !== userId) store = { v: 1, userId, lastSync: 0, trades: {} }; //a different account starts a fresh history

        const data = await getRolimonsData();
        const pending = [];
        let cursor = null;
        let pages = 0;
        do {
            const url = `https://trades.roblox.com/v1/trades/completed?limit=100&sortOrder=Desc${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`;
            const response = await fetch(url, { credentials: "include" });
            if (response.status === 429) return { ok: false, reason: "rate-limited" };
            if (response.status !== 200) break;
            const page = await response.json();
            for (const trade of page.data ?? []) {
                if (!store.trades[trade.id]) pending.push(trade);
            }
            cursor = page.nextPageCursor;
            pages++;
            //once everything listed has been saved, a page of known trades means nothing new lies further back; until then keep paging so older trades still get backfilled
            if (store.backfilled && (page.data ?? []).length > 0 && page.data.every((trade) => store.trades[trade.id])) break;
        } while (cursor && pages < MAX_PAGES);

        let added = 0;
        for (const trade of pending.slice(0, maxNew)) {
            const detailResponse = await fetch(`https://trades.roblox.com/v2/trades/${trade.id}`, { credentials: "include" });
            if (detailResponse.status === 429) break;
            if (detailResponse.status !== 200) continue;
            const detail = await detailResponse.json();
            const offers = utilities.getTradeOffers(detail);
            if (offers.length < 2) continue;
            store.trades[trade.id] = {
                id: trade.id,
                partner: trade.user ?? detail.user ?? null,
                created: trade.created ?? detail.created ?? null,
                status: trade.status ?? detail.status ?? "Completed",
                savedAt: Date.now(),
                offers: [snapshotOffer(offers[0], data), snapshotOffer(offers[1], data)]
            };
            added++;
            await sleep(250);
        }

        store.backfilled = added >= pending.length; //true when every listed trade is now saved
        store.lastSync = Date.now();
        await utilities.setOption(HISTORY_KEY, store);
        return { ok: true, added, remaining: Math.max(0, pending.length - added), total: Object.keys(store.trades).length };
    } catch (error) {
        return { ok: false, reason: "error", message: String(error) };
    } finally {
        running = false;
    }
}

chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) syncHistory(NEW_PER_ALARM);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request === "syncTradeHistory") {
        syncHistory(NEW_PER_MANUAL).then(sendResponse);
        return true;
    }
});
