/*
This file handles the profile links to rolimons.com for user profile pages on roblox.com.
*/
import * as utilities from "../utilities";

async function updateUserProfileLinks() {
    const userProfileLinksEnabled = await utilities.getOption("Add User Profile Links");
    if (!userProfileLinksEnabled) return stripUserProfileLinks();

    if (utilities.getPageType() === "details" || utilities.getPageType() === "sendOrCounter") {
        updateTradeUserProfileLinks();
    }
    if (utilities.getPageType() === "userProfile") {
        updateProfileUserProfileLinks();
    }
}

async function updateProfileUserProfileLinks() { //the links on user profiles
    const headerTitle = await waitForProfileHeaderTitle();
    if (!headerTitle) return;
    const dataProfile = document.querySelector('[data-profile-id]');
    const userId = parseInt(dataProfile.getAttribute('data-profile-id'));
    let link = document.createElement("a");
    link.href = `https://www.rolimons.com/player/${userId}`;
    link.target = "_blank";
    link.style.display = "inline-block";
    link.style.order = 1;
    link.style.width = "32px";
    link.style.height = "32px";
    utilities.addTooltip(link, "Quick link to Rolimon's page");
    utilities.initTooltips();

    let linkSpan = document.createElement("span");
    const assetName = utilities.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
    linkSpan.style.backgroundImage = `url(${utilities.getURL(`assets/${assetName}`)})`;
    linkSpan.className = "icon icon-link user-profile-link";
    linkSpan.style.display = "inline-block";
    linkSpan.style.backgroundSize = "cover";
    if (screen.width > 767) { //make the link smaller on smaller screens
        linkSpan.style.width = "32px";
        linkSpan.style.height = "32px";
    } else {
        linkSpan.style.width = "20px";
        linkSpan.style.height = "20px";
    }
    linkSpan.style.cursor = "pointer";
    linkSpan.style.transition = "filter 0.2s";
    linkSpan.style.backgroundColor = "transparent";
    linkSpan.onmouseover = () => { linkSpan.style.filter = "brightness(50%)" };
    linkSpan.onmouseout = () => { linkSpan.style.filter = "" };

    link.appendChild(linkSpan);
    stripUserProfileLinks();
    headerTitle.appendChild(link);
}

async function updateTradeUserProfileLinks() { //the links on trade pages
    const extractNumber = url => parseInt((url.match(/\/users\/(\d+)\/trade/) || [])[1], 10) || null;
    let userId = extractNumber(window.location.pathname);
    
    if (!userId){
        const username = [...document.getElementsByClassName("trades-header-nowrap")].at(-1).querySelector(".paired-name")?.children[2]?.innerText;
        if (!username) return;
        userId = await utilities.fetchIDFromName(username);
    }
    
    await utilities.waitForElm(".trades-header-nowrap");
    const tradesHeader = [...document.getElementsByClassName("trades-header-nowrap")].at(-1);

    const pairedName = tradesHeader.querySelector(".paired-name");
    const charCount = pairedName.innerText.length;
    pairedName.style.position = "relative";

    let link = document.createElement("a");
    link.href = `https://www.rolimons.com/player/${userId}`;
    link.target = "_blank";
    link.style.display = "inline-block";
    if (charCount > 35) { //checks if the link won't fit
        //kick down to the next line
        link.style.display = "block";
        link.style.marginBottom = "5px";
    }
    link.style.paddingLeft = "4px";
    link.style.width = "28px";
    link.style.height = "28px";
    link.style.transform = "translateY(3px)";
    utilities.addTooltip(link, "Quick link to Rolimon's page");

    let linkSpan = document.createElement("span");
    const assetName = utilities.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
    linkSpan.style.backgroundImage = `url(${utilities.getURL(`assets/${assetName}`)})`;
    linkSpan.className = "icon icon-link user-profile-link";
    linkSpan.style.display = "inline-block";
    linkSpan.style.position = "absolute";
    linkSpan.style.verticalAlign = "bottom";
    linkSpan.style.backgroundSize = "cover";
    linkSpan.style.width = "28px";
    linkSpan.style.height = "28px";
    linkSpan.style.cursor = "pointer";
    linkSpan.style.transition = "filter 0.2s";
    linkSpan.style.backgroundColor = "transparent";
    linkSpan.onmouseover = () => { linkSpan.style.filter = "brightness(50%)" };
    linkSpan.onmouseout = () => { linkSpan.style.filter = "" };

    link.appendChild(linkSpan);
    stripUserProfileLinks();
    pairedName.appendChild(link);

    utilities.initTooltips();
}

async function waitForProfileHeaderTitle() {
    const headerTitle = await utilities.waitForElm("#profile-header-title-container-name");
    while (!headerTitle.textContent.trim()) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return headerTitle;
}

function stripUserProfileLinks() {
    document.querySelector(".user-profile-link")?.parentElement.remove();
}

export default updateUserProfileLinks;