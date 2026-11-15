/*
Trade partner card: a strip at the top of the open trade (details page and send / counter page) about the other person:
avatar, account age, Rolimons value / RAP / rank / last online, and the trades you have already completed with them
(from RoValk's own trade history).
*/
import * as utilities from "../utilities";
import { HISTORY_KEY } from "../tradeId"; //(not ../tradeHistory: that one is a background module with alarms)

const CARD_ID = "rovalkPartnerCard";
const cache = new Map(); //userId -> Promise<info>

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function rolimonsPlayer(userId) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ title: "getUserProfileData", userId }, (response) => {
                chrome.runtime.lastError;
                resolve(response ?? null);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

async function fetchJSON(url) {
    try {
        const response = await fetch(url, { credentials: "include" });
        return response.ok ? await response.json() : null;
    } catch (e) {
        return null;
    }
}

function pastTrades(userId) {
    return new Promise((resolve) => {
        chrome.storage.local.get([HISTORY_KEY], (result) => {
            const trades = Object.values(result?.[HISTORY_KEY]?.trades ?? {}).filter((trade) => Number(trade.partner?.id) === userId);
            let net = 0;
            for (const trade of trades) {
                const sideValue = (offer, received) => (offer?.items ?? []).reduce((sum, item) => {
                    const info = utilities.getItemInfo(item.assetId, item.itemType === "Bundle" ? 2 : 1);
                    return sum + (info?.value || item.value || 0);
                }, 0) + (received ? Math.round((offer?.robux || 0) * 0.7) : (offer?.robux || 0));
                net += sideValue(trade.offers?.[1], true) - sideValue(trade.offers?.[0], false);
            }
            resolve({ count: trades.length, net });
        });
    });
}

function loadInfo(userId) {
    if (!cache.has(userId)) {
        cache.set(userId, Promise.all([
            fetchJSON(`https://users.roblox.com/v1/users/${userId}`),
            rolimonsPlayer(userId),
            fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=60x60&format=Png&isCircular=true`),
            pastTrades(userId)
        ]).then(([user, roli, thumb, history]) => ({ user, roli, avatar: thumb?.data?.[0]?.imageUrl ?? null, history })));
    }
    return cache.get(userId);
}

function ageText(created) {
    const time = Date.parse(created);
    if (!Number.isFinite(time)) return null;
    const days = Math.floor((Date.now() - time) / 86400000);
    const joined = new Date(time).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    if (days < 60) return `Joined ${joined} · ${days} days old`;
    if (days < 730) return `Joined ${joined} · ${Math.floor(days / 30)} months old`;
    return `Joined ${joined} · ${Math.floor(days / 365)} years old`;
}

function lastOnlineText(seconds) {
    if (!seconds) return null;
    const minutes = Math.round((Date.now() / 1000 - seconds) / 60);
    if (minutes < 60) return "online recently";
    if (minutes < 1440) return `seen ${Math.round(minutes / 60)} h ago`;
    return `seen ${Math.round(minutes / 1440)} d ago`;
}

function stat(label, value, className) {
    const box = el("div", "rv-pc-stat");
    box.append(el("span", "rv-pc-label", label), el("span", `rv-pc-value ${className ?? ""}`, value));
    return box;
}

function build(userId, info) {
    const card = el("div");
    card.id = CARD_ID;
    card.dataset.userId = String(userId);
    if (info.avatar) {
        const img = el("img", "rv-pc-avatar");
        img.src = info.avatar;
        img.alt = "";
        card.appendChild(img);
    }
    const who = el("div", "rv-pc-who");
    const name = el("a", "rv-pc-name", info.user?.displayName || info.roli?.name || `User ${userId}`);
    name.href = `https://www.roblox.com/users/${userId}/profile`;
    who.appendChild(name);
    const sub = [info.user?.name ? `@${info.user.name}` : null, ageText(info.user?.created), lastOnlineText(info.roli?.last_online)].filter(Boolean).join(" · ");
    who.appendChild(el("div", "rv-pc-sub", sub));
    if (info.user?.isBanned || info.roli?.terminated) who.appendChild(el("div", "rv-pc-flag", "Account is banned / terminated"));
    card.appendChild(who);

    const stats = el("div", "rv-pc-stats");
    if (info.roli && info.roli.value !== undefined && info.roli.value !== null) {
        stats.append(stat("Value", utilities.commafy(info.roli.value)), stat("RAP", utilities.commafy(info.roli.rap ?? 0)));
        if (info.roli.rank) stats.appendChild(stat("Rank", `#${utilities.commafyFull(info.roli.rank)}`));
        const badges = Object.keys(info.roli.rolibadges ?? {}).length;
        if (badges) stats.appendChild(stat("Badges", String(badges)));
    } else if (info.roli?.privacy_enabled) {
        stats.appendChild(stat("Inventory", "private"));
    }
    const history = info.history;
    stats.appendChild(stat("Your trades", history.count ? `${history.count} · ${history.net >= 0 ? "+" : "-"}${utilities.commafy(Math.abs(history.net))}` : "none yet", history.count ? (history.net >= 0 ? "rv-pos" : "rv-neg") : ""));
    card.appendChild(stats);

    const link = el("a", "rv-pc-link", "Rolimons ↗");
    link.href = `https://www.rolimons.com/player/${userId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);
    return card;
}

export default async function updatePartnerCard() {
    const pageType = utilities.getPageType();
    if (!(await utilities.getOption("Trade Partner Card")) || (pageType !== "details" && pageType !== "sendOrCounter")) {
        document.getElementById(CARD_ID)?.remove();
        return;
    }
    const firstOffer = document.querySelector(pageType === "details" ? ".trade-list-detail-offer" : ".trade-request-window-offer");
    const userId = utilities.getPartnerId();
    if (!firstOffer || !userId) return;
    const existing = document.getElementById(CARD_ID);
    if (existing && existing.dataset.userId === String(userId) && existing.nextElementSibling === firstOffer) return;
    const info = await loadInfo(userId);
    if (utilities.getPartnerId() !== userId) return; //the user switched trades while we were loading
    document.getElementById(CARD_ID)?.remove();
    firstOffer.insertAdjacentElement("beforebegin", build(userId, info));
}
