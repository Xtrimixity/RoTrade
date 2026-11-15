/*
Background watchers, run every 10 minutes:
  Inventory snapshot   your limiteds (refreshed every 30 minutes), used by the popup's Tools and Trade Ads tabs
  Value history        one point a day of your inventory's total value and RAP, for the Portfolio chart
  Value changes        compares Rolimons values with the last run; every change is listed in the popup and a
                       notification is sent for items you own (Value Change Notifications)
Also answers popup requests for the inventory and opens popup pages in a tab.
*/
import * as utilities from "./utilities.js";
import { getMarket, listenForMarketRequests } from "./market.js";
import { KEYS, get, set, dayKey } from "./store.js";
import { sendWebhook } from "./webhook.js";

const ALARM = "rovalkWatchers";
const SNAPSHOT_AGE = 30 * 60000;
const DATA_AGE = 9 * 60000;

function notify(id, title, message) {
    if (!chrome.notifications?.create) return; //the notifications permission has not been granted
    chrome.notifications.create(id, { type: "basic", iconUrl: "assets/icons/logo128.png", title, message, priority: 1 });
}

async function myUserId() {
    try {
        const response = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" });
        return response.ok ? (await response.json())?.id ?? null : null;
    } catch (e) {
        return null;
    }
}

async function freshRolimonsData() {
    const [data, lastRequest] = await Promise.all([get("data", null), get("lastRequestForData", 0)]);
    if (data && Date.now() - lastRequest < DATA_AGE) return data;
    const fresh = await utilities.getData().catch(() => null);
    if (!fresh) return data;
    await chrome.storage.local.set({ data: fresh, lastRequestForData: Date.now() });
    return fresh;
}

export async function refreshInventory(force = false) {
    const snapshot = await get(KEYS.inventory, null);
    if (!force && snapshot && Date.now() - snapshot.time < SNAPSHOT_AGE) return snapshot;
    const userId = await myUserId();
    if (!userId) return snapshot;
    const inventory = await utilities.getUserInventory(userId).catch(() => false);
    if (!Array.isArray(inventory)) return snapshot;
    const next = {
        userId,
        time: Date.now(),
        items: inventory.map((entry) => ({
            assetId: Number(entry.assetId),
            name: entry.name,
            serial: entry.serialNumber ?? null,
            uaid: entry.userAssetId ?? null,
            onHold: !!entry.isOnHold
        }))
    };
    await set(KEYS.inventory, next);
    return next;
}

async function recordValueHistory(snapshot, data) {
    if (!snapshot?.items?.length || !data) return;
    let value = 0;
    let rap = 0;
    for (const item of snapshot.items) {
        const info = utilities.getItemInfo(item.assetId, 1, data);
        value += info?.value ?? 0;
        rap += info?.rap ?? 0;
    }
    const history = (await get(KEYS.valueHistory, [])).filter((point) => point.userId === undefined || point.userId === snapshot.userId);
    const today = dayKey();
    const point = { day: today, value, rap, count: snapshot.items.length, userId: snapshot.userId };
    if (history.length && history[history.length - 1].day === today) history[history.length - 1] = point;
    else history.push(point);
    await set(KEYS.valueHistory, history.slice(-730));
}

async function checkValueChanges(snapshot, data) {
    if (!data?.assets) return;
    const baseline = await get(KEYS.valueBaseline, null);
    const current = {};
    for (const [id, entry] of Object.entries(data.assets)) {
        if (Array.isArray(entry) && typeof entry[3] === "number") current[id] = entry[3];
    }
    await set(KEYS.valueBaseline, current);
    if (!baseline) return; //first run: nothing to compare with yet

    const owned = new Set((snapshot?.items ?? []).map((item) => String(item.assetId)));
    const changes = [];
    for (const [id, to] of Object.entries(current)) {
        const from = baseline[id];
        if (from === undefined || from === to) continue;
        if (!(from > 0) && !(to > 0)) continue;
        changes.push({ assetId: Number(id), name: data.assets[id][0], from, to, time: Date.now(), owned: owned.has(id) });
    }
    if (!changes.length) return;
    const list = [...changes, ...(await get(KEYS.valueChanges, []))].slice(0, 300);
    await set(KEYS.valueChanges, list);

    const mine = changes.filter((change) => change.owned);
    if (mine.length) {
        sendWebhook("value", {
            title: mine.length === 1 ? "Value change on your item" : `${mine.length} of your items changed value`,
            description: mine.slice(0, 15).map((change) => {
                const arrow = change.to > change.from ? "🔼" : "🔽";
                return `${arrow} **${change.name}**: ${change.from > 0 ? utilities.commafyFull(change.from) : "no value"} → ${change.to > 0 ? utilities.commafyFull(change.to) : "no value"}`;
            }).join("\n").slice(0, 3900)
        }).catch(() => {});
    }
    if (mine.length && (await utilities.getOption("Value Change Notifications"))) {
        const describe = (change) => `${change.name}: ${change.from > 0 ? utilities.commafyFull(change.from) : "no value"} → ${change.to > 0 ? utilities.commafyFull(change.to) : "no value"}`;
        notify(`rovalkValueChange${Date.now()}`, mine.length === 1 ? "Value change on your item" : `${mine.length} of your items changed value`,
            mine.slice(0, 3).map(describe).join("\n") + (mine.length > 3 ? `\n+${mine.length - 3} more (see RoTrade → Tools)` : ""));
    }
}

let running = false;
export async function runWatchers() {
    if (running) return;
    running = true;
    try {
        const [snapshot, data] = await Promise.all([refreshInventory(), freshRolimonsData()]);
        await recordValueHistory(snapshot, data);
        await checkValueChanges(snapshot, data);
    } catch (e) {
        console.warn("RoTrade watchers:", e);
    } finally {
        running = false;
    }
}

listenForMarketRequests(); //content scripts get market data through here (see market.js)

chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) runWatchers();
});

function popupPage() {
    const manifest = chrome.runtime.getManifest();
    return manifest.action?.default_popup ?? manifest.options_ui?.page ?? "popup.html";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.title === "getMyInventory") {
        refreshInventory(!!request.force).then(sendResponse);
        return true;
    }
    if (request?.title === "runWatchers") {
        runWatchers().then(() => sendResponse(true));
        return true;
    }
    if (request?.title === "openPopupTab") {
        chrome.tabs.create({ url: chrome.runtime.getURL(popupPage() + `?tab=${encodeURIComponent(request.tab ?? "ads")}`) });
        sendResponse(true);
        return true;
    }
});
