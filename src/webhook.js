/*
Discord webhook notifications (background). Optional: the user pastes a webhook URL in Settings → Discord webhook
and picks which events to send. Messages go out as Discord embeds, in RoTrade orange.
Events: inbound trade, trade accepted, trade declined, trade ad posted / failed, value change on an item you own.
Discord access is an optional permission, asked for when the webhook is switched on.
*/
import * as utilities from "./utilities.js";
import { renderTradeImage } from "./tradeImage.js";

export const WEBHOOK_KEY = "rotradeWebhook"; // { url, enabled, events: { inbound, completed, declined, ad, value } }
export const WEBHOOK_EVENTS = [
    ["inbound", "New trades"], ["completed", "Accepted trades"], ["declined", "Declined trades"],
    ["ad", "Trade ad posted / failed"], ["value", "Value changes on your items"]
];
const COLORS = { inbound: 0xF97316, completed: 0x22C55E, declined: 0xEF4444, ad: 0xFB923C, value: 0x3B82F6, test: 0xF97316 };
const URL_PATTERN = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isWebhookUrl(url) {
    return URL_PATTERN.test(String(url ?? "").trim());
}

function getConfig() {
    return new Promise((resolve) => chrome.storage.local.get([WEBHOOK_KEY], (result) => resolve(result?.[WEBHOOK_KEY] ?? null)));
}

/*
Sends one embed if the webhook is on and the event is ticked (event "test" always sends).
Returns { ok, message }.
*/
export async function sendWebhook(event, embed, image) {
    const config = await getConfig();
    if (event !== "test" && (!config?.enabled || !config.events?.[event])) return { ok: false, message: "off" };
    const url = config?.url?.trim();
    if (!isWebhookUrl(url)) return { ok: false, message: "That doesn't look like a Discord webhook URL." };
    try {
        const payload = {
            username: "RoTrade",
            embeds: [{ color: COLORS[event] ?? COLORS.test, timestamp: new Date().toISOString(), footer: { text: "RoTrade" }, ...embed, ...(image ? { image: { url: "attachment://trade.png" } } : {}) }]
        };
        let response;
        if (image) {
            //picture of the trade attached to the message and shown inside the embed
            const form = new FormData();
            form.append("payload_json", JSON.stringify(payload));
            form.append("files[0]", image, "trade.png");
            response = await fetch(url, { method: "POST", body: form });
        } else {
            response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        }
        if (response.ok) return { ok: true, message: "Sent." };
        if (response.status === 404 || response.status === 401) return { ok: false, message: "Discord says this webhook doesn't exist (deleted?)." };
        if (response.status === 429) return { ok: false, message: "Discord is rate limiting this webhook; try again shortly." };
        return { ok: false, message: `Discord answered ${response.status}.` };
    } catch (e) {
        return { ok: false, message: "Couldn't reach Discord (is the Discord permission allowed?)." };
    }
}

//Item thumbnails for the trade picture, from Roblox's thumbnail API (150x150 PNG).
export async function withThumbnails(trade) {
    const ids = [...trade.give.items, ...trade.get.items].map((item) => item.id).filter((id) => id > 0);
    const urls = {};
    for (let i = 0; i < ids.length; i += 100) {
        try {
            const response = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i, i + 100).join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`, { credentials: "include" });
            const body = response.ok ? await response.json() : null;
            for (const entry of body?.data ?? []) if (entry.imageUrl) urls[entry.targetId] = entry.imageUrl;
        } catch (e) { /* letters instead of pictures */ }
    }
    for (const side of [trade.give, trade.get]) for (const item of side.items) item.thumb = urls[item.id] ?? null;
    return trade;
}

//A trade from Roblox's trade API turned into tradeImage.js's shape, priced with Rolimons data.
function tradeFromDetail(detail, data) {
    const offers = utilities.getTradeOffers(detail ?? {});
    const side = (offer) => {
        const items = utilities.getTradeOfferItems(offer).map((item) => {
            const id = Number(item.assetId ?? item.itemTarget?.targetId);
            const info = utilities.getItemInfo(id, utilities.getItemTypeFromAssetData(item), data);
            return { id, name: item.name ?? item.itemName ?? info?.name ?? `Item ${id}`, value: info?.value ?? 0, rap: info?.rap ?? 0, projected: !!info?.projected, rare: !!info?.rare };
        });
        const robux = Number(offer?.robux) || 0;
        const value = items.reduce((sum, item) => sum + item.value, 0);
        return { items, robux, total: value + robux, rap: items.reduce((sum, item) => sum + item.rap, 0) + robux };
    };
    return offers.length >= 2 ? { give: side(offers[0]), get: side(offers[1]) } : null;
}

//A trade event: a short embed plus a picture of both sides.
export async function webhookTrade(event, trade, detail) {
    const config = await getConfig();
    if (!config?.enabled || !config.events?.[event]) return;
    const data = await utilities.getOption("data");
    const who = trade.user?.displayName ?? trade.user?.name ?? "someone";
    const titles = { inbound: `New trade from ${who}`, completed: `Trade with ${who} accepted`, declined: `Trade with ${who} declined` };
    const shaped = data ? tradeFromDetail(detail, data) : null;
    let description;
    let image = null;
    if (shaped) {
        const give = shaped.give.total;
        const get = shaped.get.total;
        const percent = give > 0 ? Math.round(((get - give) / give) * 1000) / 10 : 0;
        description = `**${percent > 0 ? "+" : ""}${percent}%** · you give ${utilities.commafyFull(give)}, you get ${utilities.commafyFull(get)} (${get - give >= 0 ? "+" : "-"}${utilities.commafyFull(Math.abs(get - give))})`;
        try {
            image = await renderTradeImage({ ...(await withThumbnails(shaped)), partner: who, title: titles[event] });
        } catch (e) { /* send the text even if drawing fails */ }
    }
    await sendWebhook(event, { title: titles[event], url: "https://www.roblox.com/trades", description }, image);
}

function blobToDataUrl(blob) {
    return blob.arrayBuffer().then((buffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:image/png;base64,${btoa(binary)}`;
    });
}

//only the background worker (no window) answers test requests; the popup imports this file just for the constants
if (typeof window === "undefined") chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.title === "renderTradeImage") {
        //the trade page's Image button: drawn here so thumbnails load with the extension's own permissions
        withThumbnails(request.trade)
            .then((trade) => renderTradeImage(trade))
            .then(blobToDataUrl)
            .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
            .catch((error) => sendResponse({ ok: false, message: String(error) }));
        return true;
    }
    if (request?.title === "testWebhook") {
        sendWebhook("test", { title: "RoTrade webhook connected", description: "You'll get your selected RoTrade notifications here." }).then(sendResponse);
        return true;
    }
});
