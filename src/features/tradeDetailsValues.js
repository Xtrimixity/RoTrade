import * as utilities from "../utilities";

async function updateTradeDetailsValues() {
    const valuesOnTradingWindowEnabled = await utilities.getOption("Values on Trading Window");
    if (!valuesOnTradingWindowEnabled) return stripTradeDetailsValues();

    const tradesContainer = await utilities.waitForElm('.trades-container');

    addItemValues();

    if (utilities.getPageType() === "details") {
        const offers = tradesContainer.getElementsByClassName("trade-list-detail-offer");
        for (offer of offers) {
            const totalTextSpan = [...offer.querySelectorAll('.robux-line-amount')].pop()
            const totalValue = await utilities.calculateValueTotalDetails(offer);
            setTotalTextSpanValue(totalTextSpan, totalValue);
        }
    }
    if (utilities.getPageType() === "sendOrCounter") {
        const offers = document.getElementsByClassName("trade-request-window-offer");
        for (offer of offers) {
            const totalTextSpan = [...offer.querySelectorAll('.robux-line-amount')].pop()
            const totalValue = await utilities.calculateValueTotalSendOrCounter(offer);
            setTotalTextSpanValue(totalTextSpan, totalValue);
        }
    }
}

async function addItemValues() {
    await utilities.waitForElm(".item-card-container");
    const items = document.querySelectorAll(".item-card-container"); //these are the inventory items
    
    for (item of items) {
        const textDiv = item.querySelector(".item-card-price");

        const itemLink = textDiv.parentElement.parentElement;
        const itemType = utilities.getItemTypeFromPath(itemLink.pathname);
        const itemId = utilities.getItemIdFromPath(itemLink.pathname);
        if (!textDiv.querySelector(".valueSpan")) {
            utilities.createValuesSpans(textDiv);
        }

        const value = utilities.getValueOrRAP(itemId, itemType);
        const valueSpan = textDiv.querySelector(".valueSpan");
        valueSpan.innerText = utilities.commafy(value);

        item.parentElement.parentElement.style.marginBottom = "0px";
    }

    const tradeRequestItems = document.querySelectorAll(".trade-request-item"); //these are the items that you have already added to the trade
    for (item of tradeRequestItems){
        const textDiv = item.querySelector(".item-value");
        if (!textDiv) continue;
        const thumbnailContainer = textDiv.parentElement.querySelector(".thumbnail-2d-container");
        const linkPath = item.querySelector('a')?.pathname;
        const itemId = utilities.getItemIdFromPath(linkPath || "");
        
        const itemType = utilities.getItemTypeFromTradeElement(item);

        if (!textDiv.querySelector(".valueSpan")) {
            utilities.createValuesSpans(textDiv, { "inline": true });
        }
        const value = utilities.getValueOrRAP(itemId, itemType);
        const valueSpan = textDiv.querySelector(".valueSpan");
        valueSpan.innerText = utilities.commafy(value);
    }
}

function setTotalTextSpanValue(totalTextSpan, totalValue) {
    if (totalTextSpan.getElementsByClassName("valueSpan")[0] === undefined) {
        utilities.createValuesSpans(totalTextSpan, { "large": true });
    }
    const valueSpan = totalTextSpan.getElementsByClassName("valueSpan")[0];
    valueSpan.innerText = utilities.commafy(totalValue);
}

function stripTradeDetailsValues() {
    for (element of document.querySelectorAll(".valueSpan")) {
        element.parentElement.getElementsByTagName("br")[0]?.remove();
        element.parentElement.getElementsByClassName("icon-rolimons")[0]?.remove();
        element.remove();
    }
}

export default updateTradeDetailsValues;