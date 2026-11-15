import * as utilities from "./utilities.js";
import { webhookTrade } from "./webhook.js";

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request === "getTradeListData") {
            (async () => {
                sendResponse(await utilities.getOption("cachedTrades"));
            })();
            return true;
        }
    }
);

const delayInMinutes = 0;
const periodInMinutes = 1;
chrome.alarms.create("cachingSystem", {
    delayInMinutes,
    periodInMinutes
});

async function notifyTrade(trade, tradeType, detail) {
    //Discord webhook has its own on/off per event, separate from desktop notifications
    const webhookEvent = { inbound: "inbound", inactive: "declined", completed: "completed" }[tradeType];
    if (webhookEvent) webhookTrade(webhookEvent, trade, detail).catch(() => {});
    let message;
    switch (tradeType) {
        case "inbound":
            const inboundNotificationsEnabled = await utilities.getOption("Inbound Trade Notifications");
            if (!inboundNotificationsEnabled) return;
            message = `Trade received from ${trade.user.displayName}`;
            break;
        case "inactive":
            const declinedNotificationsEnabled = await utilities.getOption("Declined Trade Notifications");
            if (!declinedNotificationsEnabled) return;
            message = `Trade sent to ${trade.user.displayName} has been declined`;
            break;
        case "completed":
            const completedNotificationsEnabled = await utilities.getOption("Completed Trade Notifications");
            if (!completedNotificationsEnabled) return;
            message = `Trade sent to ${trade.user.displayName} has been accepted`;
            break;
        default:
            return;
    }
    const thumbnailResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${trade.user.id}&size=48x48&format=Png&isCircular=true`, { credentials: 'include' });
    const thumbnailData = await thumbnailResponse.json();
    let iconURL = "assets/logo128.png"
    if (thumbnailData) {
        iconURL = thumbnailData.data[0].imageUrl
    }
    chrome.notifications.create("rovalkTradeNotification" + String(trade.id), {
        type: 'basic',
        iconUrl: iconURL,
        title: 'RoTrade Trade Notification',
        message: message,
        priority: 2
    });
    tryAddOnClickedListener();
}

function tryAddOnClickedListener() {
    chrome.permissions.contains({
        permissions: ['notifications'],
    }, (result) => {
        if (result) {
            chrome.notifications.onClicked.addListener(function (notificationId) {
                if (notificationId.startsWith("rovalkTradeNotification")) {
                    chrome.tabs.create({ url: "https://www.roblox.com/trades" });
                }
            });
        }
    });
}
tryAddOnClickedListener();

async function updateCachedTrades() {
    const valuesOnTradeListsEnabled = await utilities.getOption("Values on Trade Lists");
    if (!valuesOnTradeListsEnabled) return;

    let cachedTrades = (await utilities.getOption("cachedTrades")) ?? {};
    /*
    getOption is here being used not to get an "option", but to get a piece of data saved in extension storage.
    I could rename the getOption function to something more general like getFromStorage, but this is the only place in the extension where the function is not used for fetching an option, so I'm going to accept the minor naming confusion.
    */
    let tradesLoaded = 0;
    let tradeTypeIndex = 0;
    const tradeTypes = ["inbound", "outbound", "completed", "inactive"];

    async function loadTradeType(tradeType) {
        const response = await fetch(`https://trades.roblox.com/v1/trades/${tradeType}?limit=100&sortOrder=Desc`, { credentials: "include" });
        if (response.status !== 200) return;
        const fetchedTrades = await response.json();

        for (let i = 0; i < fetchedTrades.data.length; i++) {
            const trade = fetchedTrades.data[i]
            if (tradesLoaded < 20) { //maximum of 20 trades requested per minute
                if (!(trade.id in cachedTrades) || (trade.status !== cachedTrades[trade.id].status)) {
                    const previousTradeType = cachedTrades[trade.id]?.tradeType;
                    const tradeFetchResponse = await fetch(`https://trades.roblox.com/v2/trades/${trade.id}`, { credentials: "include" });
                    if (tradeFetchResponse.status !== 200) continue;
                    const tradeFetched = await tradeFetchResponse.json();
                    cachedTrades[trade.id] = tradeFetched;
                    cachedTrades[trade.id].tradeType = tradeType;
                    cachedTrades[trade.id].expiration = trade.expiration ?? tradeFetched.expiration ?? null; //for the trade list expiry timers
                    if ((previousTradeType && previousTradeType !== tradeType) || (tradeType === "inbound" && new Date().getTime() - new Date(tradeFetched.created).getTime() < 1000 * 120))
                        if ((tradeType !== "inactive") || previousTradeType === "outbound") { //make sure that we don't notify for trades that were inbound but then declined
                            notifyTrade(trade, tradeType, tradeFetched);
                        }
                    tradesLoaded++;
                }
            } else {
                break;
            }
        }
        utilities.setOption("cachedTrades", cachedTrades);
        if (tradesLoaded <= 20 && tradeTypeIndex < 3) {
            tradeTypeIndex++;
            loadTradeType(tradeTypes[tradeTypeIndex]);
        }
    }
    loadTradeType(tradeTypes[tradeTypeIndex]);
}

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm && alarm.name !== "cachingSystem") return; //other alarms (like trade history) have their own listeners
    const resp = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" });
    const respJSON = await resp.json();
    const currentAuthUser = respJSON.id;
    if (currentAuthUser !== undefined) {
        let lastReset = await utilities.getOption("lastReset");
        if (!lastReset || Date.now() - lastReset > 1000 * 60 * 60 * 24 * 7) { //if it's been at least a week since last reset
            utilities.setOption("lastReset", Date.now());
            utilities.setOption("cachedTrades", {});
        }
    }
    updateCachedTrades();

    chrome.tabs.query({}, function (tabs) {
        tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, "Values", {}, () => {
                chrome.runtime.lastError; //suppress error if tab does not have injected content script
            });
        })
    });
});
