
/*
This is the Content Script (that is the CS in csCatalog.js) that runs on catalog pages.
This file handles initializes and updates all of the features associated with those pages.
See the "content_scripts" property of manifest.json to know exactly which pages this script runs on.
*/
import * as utilities from "./utilities";
import { initTheme } from "./themes";
import { initPageEffects } from "./pageEffects";
console.info(`%c${utilities.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`, "color: #0084DD");
import updateCatalogValues from "./features/catalogValues";
import updateFlags from "./features/flags.js"
import updateAssetsLinks from "./features/assetLinks";
initTheme();
initPageEffects();
utilities.refreshData(update); //starts the refresh data cycle in utilities which allows utilities.getRolimonsData to be accessed.

let lastUpdateTimestamp = 0;
async function update() {
    if (Date.now() - lastUpdateTimestamp < 100) return; //the catalog changes quite a bit, so this is just an extra check to make sure we are not updating more than we need to
    lastUpdateTimestamp = Date.now();

    updateAssetsLinks();
    updateCatalogValues();
    updateFlags();
}

(async () => {
    /*
        This observer checks for when new elements with class "item-card-price", aka new items, are loaded into the page.
        When this happens, it calls the update() function to update links, flags, and values.
    */

    const config = { attributes: true, childList: true, subtree: true };
    const observer = new MutationObserver((mutationList) => {
        for (const mutation of mutationList) {
            if (mutation.type === 'childList') {
                if (mutation.addedNodes) {
                    for (node of mutation.addedNodes) {
                        if (node.classList?.contains("grid-item-container")) {

                            return update();


                        }
                    }
                }
            }
        }
    });
    observer.observe(await utilities.waitForElm("#results"), config);
})();


const updateListenerCategories = ["Values", "Item Flags", "Links"];
chrome.runtime.onMessage.addListener(function (request, sender) {
    if (updateListenerCategories.indexOf(request) !== -1) {
        update();
    }
});