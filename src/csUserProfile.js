/*
This is the Content Script (that is the CS in csUserProfile.js) that runs on user profile pages. 
This file initializes and updates all of the features associated with those pages.
See the "content_scripts" property of manifest.json to know exactly which pages this script runs on.
*/
import * as utilities from "./utilities";
import { initTheme } from "./themes";
import { initPageEffects } from "./pageEffects";
console.info(`%c${utilities.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`, "color: #0084DD");
import updateUserProfileLinks from "./features/userProfileLinks";
import updateCatalogValues from "./features/catalogValues";
import updateAssetsLinks from "./features/assetLinks";
import updateUserProfileRoliBadges from "./features/userProfileRoliBadges";
import { updateProfileBanner, updateInventorySummary } from "./features/inventorySummary";
initTheme();
initPageEffects();
utilities.refreshData(update); //starts the refresh data cycle in utilities which allows utilities.getRolimonsData to be accessed.

async function update() {
    if (utilities.getPageType() === "userProfile") {
        const dataProfile = document.querySelector('[data-profile-id]');
        const userId = parseInt(dataProfile.getAttribute('data-profile-id'));
        updateUserProfileLinks(userId);
        updateUserProfileRoliBadges(userId);
        updateProfileBanner(userId);
    }
    if (utilities.getPageType() === "userInventory") {
        updateCatalogValues();
        updateAssetsLinks();
        const inventoryUserId = parseInt(window.location.pathname.match(/\/users\/(\d+)\/inventory/)?.[1]);
        if (!isNaN(inventoryUserId)) updateInventorySummary(inventoryUserId);
    }
}

if (utilities.getPageType() === "userInventory") {
    (async () => {
        /*
            This observer checks for when new elements with class "item-card-price", aka new items, are loaded into the page.
            When this happens, it calls the update() function to update all features.
        */
        const config = { attributes: true, childList: true, subtree: true };
        const observer = new MutationObserver((mutationList) => {
            for (const mutation of mutationList) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes) {
                        for (node of mutation.addedNodes) {
                            if (node.classList?.contains("item-card-price")) {
                                return update();
                            }
                        }
                    }
                }
            }
        });
        observer.observe(await utilities.waitForElm("#assetsItems"), config);
    })();
}

const updateListenerCategories = ["Values", "Links", "Other"];
chrome.runtime.onMessage.addListener(function (request, sender) {
    if (updateListenerCategories.indexOf(request) !== -1) {
        update();
    }
});