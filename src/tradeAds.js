/*
Rolimons trade ad auto-poster (background).
You build one ad in the popup's Trade Ads tab (up to 4 items you offer, up to 4 requests made of items and tags like
Upgrade or Any). While "Auto-post" is on, it is posted every 15.5 minutes (Rolimons' cooldown is 15 minutes, the extra
half minute is a safety margin) and never more than 55 times in 24 hours, Rolimons' daily limit.

Posting uses your own Rolimons login: the request is sent with the cookies of the browser, so you must be signed in
to rolimons.com in this browser with a verified account. Chrome must be open for posts to happen.
Endpoint: POST https://api.rolimons.com/tradeads/v1/createad
  { player_id, offer_item_ids, request_item_ids, request_tags }  ->  201 posted, 400 cooldown not over,
  422 Rolimons login missing or expired, 429 too many requests.
*/
import { KEYS, AD_LIMITS, get, set } from "./store.js";
import { sendWebhook } from "./webhook.js";

const ALARM = "rovalkTradeAds";
const ENDPOINT = "https://api.rolimons.com/tradeads/v1/createad";
const INTERVAL_MS = AD_LIMITS.intervalMinutes * 60000;
const DAY_MS = 86400000;

const DEFAULT_STATUS = { lastPost: 0, posts: [], log: [] };

export function validateAd(config) {
    const offer = config?.offer ?? [];
    const requests = (config?.requestItems?.length ?? 0) + (config?.requestTags?.length ?? 0);
    if (offer.length < 1) return "Pick at least one item to offer.";
    if (offer.length > AD_LIMITS.offer) return `Rolimons allows up to ${AD_LIMITS.offer} offered items.`;
    if (requests < 1) return "Add at least one request (an item or a tag such as Any or Upgrade).";
    if (requests > AD_LIMITS.request) return `Rolimons allows up to ${AD_LIMITS.request} requests (items and tags together).`;
    return null;
}

async function myUserId() {
    try {
        const response = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" });
        if (!response.ok) return null;
        return (await response.json())?.id ?? null;
    } catch (e) {
        return null;
    }
}

async function notifyPost(result) {
    if (!chrome.notifications?.create) return; //permission not granted
    const enabled = await get("Trade Ad Posted Notifications", false);
    if (!enabled) return;
    chrome.notifications.create(`rovalkTradeAd${Date.now()}`, {
        type: "basic",
        iconUrl: "assets/icons/logo128.png",
        title: result.ok ? "Trade ad posted" : "Trade ad not posted",
        message: result.message,
        priority: result.ok ? 0 : 1
    });
}

async function record(status, entry) {
    status.log = [{ time: Date.now(), ...entry }, ...(status.log ?? [])].slice(0, 25);
    await set(KEYS.adStatus, status);
}

export async function postAd({ manual = false } = {}) {
    const config = await get(KEYS.adConfig, null);
    const status = { ...DEFAULT_STATUS, ...(await get(KEYS.adStatus, {})) };
    const now = Date.now();
    status.posts = (status.posts ?? []).filter((time) => now - time < DAY_MS);

    if (!manual && !config?.enabled) return { ok: false, message: "Auto-post is off." };
    const problem = validateAd(config);
    if (problem) {
        await record(status, { ok: false, message: problem });
        return { ok: false, message: problem };
    }
    if (status.posts.length >= AD_LIMITS.perDay) {
        const freeAt = new Date(Math.min(...status.posts) + DAY_MS);
        const message = `Daily limit reached (${AD_LIMITS.perDay} in 24 hours). Posting resumes around ${freeAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
        if (manual || !status.log?.[0]?.message?.startsWith("Daily limit")) await record(status, { ok: false, message });
        return { ok: false, message };
    }
    const sinceLast = now - (status.lastPost || 0);
    if (sinceLast < INTERVAL_MS - 5000) {
        const minutes = Math.ceil((INTERVAL_MS - sinceLast) / 60000);
        return { ok: false, message: `Too soon: the next post is allowed in about ${minutes} min.` };
    }

    const userId = await myUserId();
    if (!userId) {
        const message = "Not signed in to Roblox in this browser.";
        await record(status, { ok: false, message });
        return { ok: false, message };
    }

    let response;
    try {
        response = await fetch(ENDPOINT, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({
                player_id: userId,
                offer_item_ids: config.offer.map(Number),
                request_item_ids: (config.requestItems ?? []).map(Number),
                request_tags: config.requestTags ?? []
            })
        });
    } catch (e) {
        const message = "Could not reach Rolimons. Check your connection.";
        await record(status, { ok: false, message });
        return { ok: false, message };
    }

    let detail = "";
    try { detail = (await response.json())?.message ?? ""; } catch (e) { /* no body */ }
    let result;
    if (response.status === 201 || response.status === 200) {
        status.lastPost = now;
        status.posts.push(now);
        result = { ok: true, message: `Posted (${status.posts.length} of ${AD_LIMITS.perDay} today).` };
        scheduleNext(); //line the timer up with this post so the next one is exactly 15.5 minutes later
    } else if (response.status === 400) {
        result = { ok: false, message: `Rolimons says the 15 minute cooldown isn't over yet${detail ? ` (${detail})` : ""}. Trying again next round.` };
    } else if (response.status === 422) {
        result = { ok: false, message: "Rolimons login missing or expired. Open rolimons.com in this browser, sign in and verify your account." };
    } else if (response.status === 429) {
        result = { ok: false, message: "Rolimons is rate limiting right now. Trying again next round." };
    } else {
        result = { ok: false, message: `Rolimons answered ${response.status}${detail ? `: ${detail}` : ""}.` };
    }
    await record(status, result);
    //tell the user about posts and about problems they need to fix; routine "cooldown / try again" misses stay quiet
    if (result.ok || response.status === 422 || ![400, 429].includes(response.status)) {
        notifyPost(result);
        sendWebhook("ad", { title: result.ok ? "Trade ad posted" : "Trade ad not posted", description: result.message, url: `https://www.rolimons.com/playertrades/${userId}` }).catch(() => {});
    }
    return result;
}

function scheduleNext() {
    chrome.alarms.create(ALARM, { delayInMinutes: AD_LIMITS.intervalMinutes, periodInMinutes: AD_LIMITS.intervalMinutes });
}

async function syncAlarm() {
    const config = await get(KEYS.adConfig, null);
    if (!config?.enabled) {
        chrome.alarms.clear(ALARM);
        return;
    }
    const status = await get(KEYS.adStatus, {});
    const wait = Math.max(0.1, ((status.lastPost || 0) + INTERVAL_MS - Date.now()) / 60000);
    chrome.alarms.get(ALARM, (alarm) => {
        if (!alarm) chrome.alarms.create(ALARM, { delayInMinutes: wait, periodInMinutes: AD_LIMITS.intervalMinutes });
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) postAd();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(KEYS.adConfig in changes)) return;
    const before = changes[KEYS.adConfig].oldValue?.enabled;
    const after = changes[KEYS.adConfig].newValue?.enabled;
    if (before !== after) {
        chrome.alarms.clear(ALARM, () => syncAlarm());
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.title === "postTradeAdNow") {
        postAd({ manual: true }).then(sendResponse);
        return true;
    }
    if (request?.title === "getTradeAdTimer") {
        chrome.alarms.get(ALARM, (alarm) => sendResponse({ next: alarm?.scheduledTime ?? null }));
        return true;
    }
});

syncAlarm();
