function getReactFiber(element) {
    const fiberKey = Object.keys(element).find(key =>
        key.startsWith("__reactFiber$")
    );
    return fiberKey ? element[fiberKey] : null;
}

function getTradeRowProps(row) {
    let fiber = getReactFiber(row);
    let hops = 0;

    while (fiber && hops++ <= 8) {
        const props = fiber.memoizedProps;

        if (
            props &&
            props.trade &&
            props.trade.id != null &&
            props.trade.user &&
            typeof props.onClick === "function"
        ) {
            return props;
        }

        fiber = fiber.return;
    }

    return null;
}

document.addEventListener("addTradeIdToRow", function () {
    document.querySelectorAll(".trade-row").forEach(row => {
        const props = getTradeRowProps(row);
        const tradeId = Number(props?.trade?.id);

        if (Number.isInteger(tradeId) && tradeId > 0) {
            row.setAttribute("rolimonsTradeId", String(tradeId));
        } else {
            row.removeAttribute("rolimonsTradeId");
        }
    });
});