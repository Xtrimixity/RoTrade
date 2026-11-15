/*
This file handles the send button which appears besides the "Counter" button on the trade details page.
*/

import * as utilities from "../utilities";

async function updateSendButton() {
    if (!(await utilities.getOption("Add Send Button")))
        return document.querySelector(".sendButton")?.remove();
    if (document.querySelector(".sendButton"))
        return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-control-md ng-binding sendButton";
    button.innerText = "Send";

    const tradeButtons = await utilities.waitForElm(".trade-buttons");
    tradeButtons.style.padding = "5px";
    const counterButton = tradeButtons.querySelector('[ng-click="counterTrade(data.trade)"]');
    if (document.querySelector(".sendButton"))
        return;
    counterButton.parentNode.insertBefore(button, counterButton.nextSibling);

    utilities.addTooltip(button, "Send a brand new trade to this user");
    utilities.initTooltips();

    button.onclick = () => {
        const pathname = utilities.removeTwoLetterPath(document.querySelector(".trade-row.selected").querySelector(".avatar-card-link").pathname);
        const userId = parseInt(pathname.substring(utilities.nthIndex(pathname, "/", 2) + 1, utilities.nthIndex(pathname, "/", 3)));
        window.location.href = `https://www.roblox.com/users/${userId}/trade`;
    }

    for (element of document.querySelectorAll(".btn-control-md, .btn-cta-md")) {
        element.style.marginBottom = "5px";
    }
}

export default updateSendButton;