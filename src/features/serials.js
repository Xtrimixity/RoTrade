/*
Serial numbers on the trade details page. Roblox's trade data has each copy's serial; this reads the open trade once
(trades.roblox.com/v2/trades/{id}), then puts "#123" on each item card. Special serials get a gold badge:
#1-#100, 1337, the same digit repeated (777, 2222), straight runs (123, 4567) and palindromes (1221).
*/
import * as utilities from "../utilities";
import { getOpenTradeId } from "../tradeId";

const cache = new Map(); //tradeId -> Promise<offers>

export function specialSerial(serial) {
    const n = Number(serial);
    if (!Number.isInteger(n) || n <= 0) return null;
    const text = String(n);
    if (n <= 100) return "Low serial";
    if (n === 1337 || n === 420 || n === 69 || n === 666) return "Meme serial";
    if (text.length >= 3 && /^(\d)\1+$/.test(text)) return "Repeating digits";
    if (text.length >= 3 && ("0123456789".includes(text) || "9876543210".includes(text))) return "Sequential";
    if (text.length >= 3 && text === [...text].reverse().join("")) return "Palindrome";
    return null;
}

function loadTrade(tradeId) {
    if (!cache.has(tradeId)) {
        cache.set(tradeId, fetch(`https://trades.roblox.com/v2/trades/${tradeId}`, { credentials: "include" })
            .then((response) => (response.ok ? response.json() : null))
            .then((trade) => utilities.getTradeOffers(trade ?? {}).map((offer) => utilities.getTradeOfferItems(offer).map((item) => ({
                id: Number(item.assetId ?? item.itemTarget?.targetId),
                serial: item.serialNumber ?? null
            }))))
            .catch(() => []));
    }
    return cache.get(tradeId);
}

export function serialBadge(serial) {
    const special = specialSerial(serial);
    const badge = document.createElement("span");
    badge.className = `rv-serial${special ? " rv-serial-special" : ""}`;
    badge.textContent = `#${utilities.commafyFull(serial)}`;
    badge.title = special ? `${special}: #${serial}` : `Serial #${serial}`;
    return badge;
}

export default async function updateSerials() {
    if (utilities.getPageType() !== "details") return;
    if (!(await utilities.getOption("Serial Numbers"))) {
        document.querySelectorAll(".rv-serial").forEach((badge) => badge.remove());
        return;
    }
    const offerElements = document.querySelectorAll(".trade-list-detail-offer");
    if (offerElements.length < 2) return;
    const tradeId = await getOpenTradeId();
    if (!tradeId) return;
    const offers = await loadTrade(tradeId);
    [...offerElements].slice(0, 2).forEach((offerElement, index) => {
        const queue = [...(offers[index] ?? [])];
        for (const card of offerElement.querySelectorAll(".item-card-container")) {
            const item = utilities.readCardItem(card);
            const at = queue.findIndex((entry) => entry.id === item?.id);
            const match = at >= 0 ? queue.splice(at, 1)[0] : null;
            const existing = card.querySelector(".rv-serial");
            if (!match?.serial) { existing?.remove(); continue; }
            if (existing?.dataset.serial === String(match.serial)) continue;
            existing?.remove();
            const badge = serialBadge(match.serial);
            badge.dataset.serial = String(match.serial);
            const price = card.querySelector(".item-card-price");
            if (price) price.parentElement.insertBefore(badge, price);
            else card.appendChild(badge);
        }
    });
}
