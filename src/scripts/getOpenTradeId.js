/*
Runs in the page (not the extension) so it can read React's internal data, the same way addTradeIdToRow.js does.
It looks upward from the trade detail panel for a component that was given the open trade, and writes its id to
an attribute on <html> for the content script to read. If nothing is found the attribute is left empty.
*/
function getReactFiber(element) {
    const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
    return fiberKey ? element[fiberKey] : null;
}

function idFromProps(props) {
    if (!props) return null;
    const candidates = [props.trade?.id, props.tradeId, props.trade?.tradeId, props.selectedTrade?.id, props.currentTrade?.id];
    for (const value of candidates) {
        const id = Number(value);
        if (Number.isInteger(id) && id > 0) return id;
    }
    return null;
}

document.addEventListener("getOpenTradeId", function () {
    const roots = document.querySelectorAll(".trade-list-detail-offer, .trades-list-detail, .trade-list-detail, .trades-container");
    let found = null;
    for (const element of roots) {
        let fiber = getReactFiber(element);
        let hops = 0;
        while (fiber && hops++ < 40) {
            found = idFromProps(fiber.memoizedProps);
            if (found) break;
            fiber = fiber.return;
        }
        if (found) break;
    }
    document.documentElement.setAttribute("rolimons-open-trade-id", found ? String(found) : "");
});
