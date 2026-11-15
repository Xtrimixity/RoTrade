/*
This file handles values that appear on both the main catalog page, and item profile pages on the catalog.

Main catalog page values and user inventory values are handled in:
updateCatalogPageValues()

Catalog item profile page values are handled in:
updateItemProfilePageValues()

User inventory values are also handled here, just because they are so similar to the catalog (I know, I should name this feature module something more general, but I'm not going to).
*/
import * as utilities from "../utilities";

async function updateCatalogValues() {
    if (utilities.getPageType() === "catalog" || utilities.getPageType() === "itemProfile") {
        if (!(await utilities.getOption("Values on Catalog Pages"))) {
            return stripCatalogValues();
        }
        if (utilities.getPageType() === "itemProfile") {
            //item profile page
            updateItemProfilePageValues();
        } else {
            //catalog page

            updateCatalogPageValues();
        }
    }

    if (utilities.getPageType() === "userInventory") {
        if (!(await utilities.getOption("Values on User Pages"))) {
            return stripCatalogValues();
        }

        //user inventory page
        updateCatalogPageValues();
    }
}

function stripCatalogValues() {
    document.querySelector(".value-price-info")?.remove();
    document.querySelector(".value-price-label")?.remove();

    for (element of document.querySelectorAll(".valueSpan")) {
        element.parentElement.getElementsByTagName("br")[0]?.remove();
        element.parentElement.getElementsByClassName("icon-rolimons")[0]?.remove();
        element.remove();
    }
}

async function updateItemProfilePageValues() {
    //const itemContainer = await utilities.waitForElm("#item-container");
    const itemType = utilities.getItemTypeFromPath(window.location.pathname);
    const itemId = utilities.getItemIdFromPath(window.location.pathname);
    if (utilities.getItemData(itemId, itemType) !== undefined) { //if item is limited
        const priceContainer = await utilities.waitForElm(".price-container-text");
        if (priceContainer.querySelector(".icon-rolimons") === null) {
            priceContainer.insertAdjacentHTML('beforeend', '<div class="text-label field-label price-label value-price-label row-label" style="width: 150px;">Value</div>');
            priceContainer.insertAdjacentHTML('beforeend', `
                <div class="price-info value-price-info">
                    <div class="icon-text-wrapper clearfix icon-robux-price-container">
                        <span style="margin-top:0px;" class="icon-rolimons icon-robux-16x16 wait-for-i18n-format-render"></span>
                        <span class="valueSpan text-robux-lg wait-for-i18n-format-render"></span>
                    </div>
                </div>
                `);

            priceContainer.querySelector(".item-info-row-container").style.marginBottom = "5px";
        }
        const rolimonsIcon = priceContainer.querySelector(".icon-rolimons");
        rolimonsIcon.style.setProperty("background-image", `url(${utilities.getURL("assets/icons/logo.svg")})`, "important");
        rolimonsIcon.style.backgroundSize = "cover";
        rolimonsIcon.style.backgroundPosition = "center";

        const valueSpan = priceContainer.querySelector(".valueSpan");
        let value = utilities.getValueOrRAP(itemId, itemType);
        valueSpan.innerText = utilities.commafy(value);
    }
}

async function updateCatalogPageValues() {
    function setTextDivValue(textDiv, value) {
        const valueSpan = textDiv.getElementsByClassName("valueSpan")[0];
        valueSpan.innerText = utilities.commafy(value);
    }

    await utilities.waitForElm(".item-card-price");
    const textDivs = document.getElementsByClassName('item-card-price');
    for (textDiv of textDivs) {
        const pathname = utilities.removeTwoLetterPath(textDiv.parentElement.parentElement.pathname || textDiv.parentElement.parentElement); //the first case is for the catalog, the second for user inventories
        const itemType = utilities.getItemTypeFromPath(pathname);
        const itemId = utilities.getItemIdFromPath(pathname);
        if (utilities.getItemData(itemId, itemType) !== undefined) { //if item is limited
            //create value spans if they don't already exist
            if (textDiv.getElementsByClassName("valueSpan")[0] === undefined) {
                utilities.createValuesSpans(textDiv);
            }

            //item values
            let value = utilities.getValueOrRAP(itemId, itemType);
            setTextDivValue(textDiv, value);
        }
    }
    for (element of document.getElementsByClassName("list-item")) {
        element.style.marginBottom = "35px";
    }
}

export default updateCatalogValues;