/*
This is the Content Script (that is the CS in csTrade.js) that runs on trade pages.
This file initializes and updates all of the features associated with those pages.
See the "content_scripts" property of manifest.json to know exactly which pages this script runs on.
*/
import * as utilities from "./utilities";
import updateAssetsLinks from "./features/assetLinks";
import updateWinLossStats from "./features/winLossStats";
import updateTradeDetailsValues from "./features/tradeDetailsValues";
import updateSendButton from "./features/sendButton";
import updateUserProfileLinks from "./features/userProfileLinks";
import updateFlags from "./features/flags.js"
import updateTradeListValues from "./features/tradeListValues";
import updateTradeTools from "./features/tradeTools";
import updateInventoryTools from "./features/inventoryTools";
import { updateMarketBadges } from "./features/marketPulse";
import updatePartnerCard from "./features/partnerCard";
import updateSerials from "./features/serials";
import updateGoodDeals from "./features/goodDeals";
import updateQueueFill from "./features/queueFill";
import { initTheme } from "./themes";
import { initPageEffects } from "./pageEffects";
import { initTradeRedesign } from "./tradeRedesign";
import { injectFeatureStyles } from "./featureStyles";
console.info(`%c${utilities.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`, "color: #0084DD");

initTheme();
initPageEffects();
initTradeRedesign();
injectFeatureStyles();
utilities.refreshData(update); //starts the refresh data cycle in utilities which allows utilities.getRolimonsData to be accessed.

//The parts of the page that change when items or Robux in the open trade change.
function updateTradeSummary() {
    updateWinLossStats();
    updateTradeDetailsValues();
    updateTradeTools();
    updateInventoryTools();
    updateMarketBadges();
    updatePartnerCard();
    updateGoodDeals();
}

function update() {
    updateAssetsLinks();
    updateTradeSummary();
    updateSendButton();
    updateUserProfileLinks();
    updateFlags();
    updateTradeListValues();
    updateSerials();
    updateQueueFill(); //trade queue: fill in the trade (you press Make Offer)

    tryAddingRobuxHandler();
}

(async () => {
    /*
        This observer checks for when new key elements are loaded into the page.
    */
    const config = { attributes: true, childList: true, subtree: true };
    const observer = new MutationObserver((mutationList) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                if (mutation.addedNodes) {
                    for (const node of mutation.addedNodes) {
                        if (node.classList?.contains("trade-item-card")) {
                            //general trade card added
                            return update();
                        }
                        if (node.classList?.contains("trade-row")) {
                            //trade row added in the trade list
                            return updateTradeListValues();
                        }
                        if (node.classList?.contains("loading") || node.classList?.contains("trade-request-item")) {
                            // changes on trade send / counter page
                            updateTradeSummary();
                            updateUserProfileLinks();
                            updateAssetsLinks();
                            updateTradeListValues();
                            return;
                        }
                    }
                }
            }
        }
    });
    const tradesContainer = await utilities.waitForElm(".trades-container");
    observer.observe(tradesContainer, config);

    //Safety net: Roblox draws item cards (inventory pages, scrolling, switching trades) at moments the observer above does not
    //notice, so any card still missing its Rolimons link is picked up here. Rate limited so it can never loop.
    let linkTimer = null;
    let lastLinkPass = 0;
    new MutationObserver(() => {
        if (linkTimer || Date.now() - lastLinkPass < 600) return;
        linkTimer = setTimeout(() => {
            linkTimer = null;
            lastLinkPass = Date.now();
            if (tradesContainer.querySelector(".item-card-price:not(.hasAssetLink), .item-value:not(:has(.icon-link))")) updateAssetsLinks();
        }, 350);
    }).observe(tradesContainer, { childList: true, subtree: true });
})();

const robuxInputsWithHandler = new WeakSet();
function tryAddingRobuxHandler() {
    /*
    Updates the trade summary when you add or remove Robux from a trade (send / counter page only).
    Each input gets one listener; the inputs are thrown away by Roblox when the trade closes, so nothing needs cleaning up.
    */
    for (const robuxInput of document.querySelectorAll('[name="robux"]')) {
        if (robuxInputsWithHandler.has(robuxInput)) continue;
        robuxInputsWithHandler.add(robuxInput);
        robuxInput.addEventListener("input", updateTradeSummary);
    }
}

chrome.runtime.onMessage.addListener(function (request, sender) {
    update();
    // Don't call sendResponse, don't return anything
});
