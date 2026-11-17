import * as utilities from "./utilities.js";
import "./cachingSystem.js"; //start caching system
import "./tradeHistory.js"; //start trade history tracking
import "./tradeAds.js"; //Rolimons trade ad auto-poster
import "./webhook.js"; //Discord webhook notifications
import "./watchers.js"; //value changes, inventory snapshots, market data for the pages
import { listenForBestPriceRequests } from "./bestPrice.js";
listenForBestPriceRequests(); //current selling prices for item cards

//No pages are opened on install or update; RoTrade just starts working.
chrome.runtime.onInstalled.addListener((details) => {


    utilities.setDefaultOptionValues();

    //settings and data for features that were removed in 3.12.0 (trade notes, the separate post-tax box, the RAP-only toggle)
    chrome.storage.local.remove(["rovalkTradeNotes", "Trade Notes", "Post-Tax Trade Value", "Disable Win/Loss Stats RAP"]);
    //removed in 3.14.0: calculator, trade style picker, custom accent, animations, compact layout, mobile button, meter, overpay helper
    chrome.storage.local.remove(["RoValk Calculator Preset", "RoValk Trade Style", "RoValk Custom Accent", "Theme Animations", "Compact Trade Layout", "Mobile Trade Items Button", "Trade Fairness Meter", "Overpay Helper", "Shortcut Keys"]);
    //removed in 3.15.0: price alerts and wishlist trade notifications
    chrome.storage.local.remove(["rovalkPriceAlerts", "Price Alert Notifications", "Wishlist Trade Notifications"]);


});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request === "getData" || request === "getDataPeriodic") {

            chrome.storage.local.get(["data", "lastRequestForData"], async function (result) {
                const minTime = (request === "getDataPeriodic" ? 1000 * 60 * 5 : 1000 * 59); //if it's the periodic auto update then it must have been at least 10 minutes; otherwise it must have been at least 59 seconds


                if (result.data !== undefined && Date.now() - result.lastRequestForData < minTime) {
                    sendResponse(result.data);
                } else {
                    await utilities.setOption("lastRequestForData", Date.now());
                    utilities.getData().then((responseData) => {
                        if (responseData !== null) {

                            chrome.storage.local.set({ data: responseData }, function () {
                                sendResponse(responseData);
                            });
                        } else {


                            sendResponse(null);
                        }
                    });
                }
            });
        }

        if (request.title === "getUserProfileData") {
            (async () => {
                const response = await fetch(`https://api.rolimons.com/players/v1/playerinfo/${request.userId}`, {
                    headers: {
                        "From-Extension": true
                    },
                });
                const rolimonsPlayerData = await response.json();
                sendResponse(rolimonsPlayerData);
            })();
        }


        return true;
    }
);