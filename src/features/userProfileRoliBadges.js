/*
This script handles the display of RoliBadges on Roblox user profile pages.
The Rolimon's API returns the names of badges in a format like this:
"own_1_valued_federation_item"

/data/roliBadgeNames.json converts from this special identifier name for the badge to the common badge name for humans.

/data/roliBadgePriorities.json lists these special identifier names in the order in which they are preferred to appear in the DOM.
This list also determines which will be visible, since only around 5 badges can actually be displayed at once on the page.
*/
import * as utilities from "../utilities";
import roliBadgePriorities from "../data/roliBadgePriorities.json";
import roliBadgeNames from "../data/roliBadgeNames.json";

function stripUserProfileRoliBadges() {
    document.getElementById("roli-badges-container")?.remove();
}

async function updateUserProfileRoliBadges(userId) {
    const userProfileValuesEnabled = await utilities.getOption("Show User RoliBadges");
    if (!userProfileValuesEnabled) return stripUserProfileRoliBadges();

    chrome.runtime.sendMessage({ title: "getUserProfileData", userId: userId }, async function (rolimonsPlayerData) {
        const roliBadges = Object.keys(rolimonsPlayerData.rolibadges);
        const robloxBadgesContainer = await utilities.waitForElm("#roblox-badges-container");
        const badgeContainerHTML = `<div class="section" id="roli-badges-container">
    <div class="container-header">
        <h2>RoliBadges</h2><a class="btn-fixed-width btn-secondary-xs btn-more see-all-link-icon"
            href="https://www.rolimons.com/playerrolibadges/${userId}">See All</a>
    </div>
    <div class="section-content remove-panel">
        <ul class="hlist badge-list">
        
        </ul>
    </div>
    </div>`;
        if (!document.getElementById("roli-badges-container")) {
            robloxBadgesContainer.insertAdjacentHTML("afterend", badgeContainerHTML);
            roliBadgesContainer = document.getElementById("roli-badges-container");
            for (i in roliBadgePriorities) {
                const badge = roliBadgePriorities[i];
                if (roliBadges.indexOf(badge) !== -1) {
                    const badgeURL = utilities.getURL(`/assets/roliBadges/${badge}.svg`);
                    const badgeName = roliBadgeNames[badge];
                    roliBadgesContainer.querySelector(".badge-list").innerHTML += `
                    <li class="list-item asset-item"><a class="" href="https://www.rolimons.com/playerrolibadges/${userId}"
                    title="${badgeName}"><span class="thumbnail-2d-container"><img
                    class="asset-thumb-container"
                    src="${badgeURL}"
                    alt="${badgeName}"
                    title="${badgeName}"></span><span
                    class="font-header-2 text-overflow item-name">${badgeName}</span></a></li>
                `;
                }
            }
        }
    });
}

export default updateUserProfileRoliBadges;