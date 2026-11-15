/*
Two small summaries built from a player's limited items:
- the Profile Value Banner on profile pages (value, RAP, item counts, most valuable item)
- the Inventory Summary above the item grid on inventory pages
Both read the same inventory request (shared through utilities.getUserInventoryCached).
*/
import * as utilities from "../utilities";

function computeStats(inventory) {
    const data = utilities.getRolimonsData();
    const stats = { value: 0, rap: 0, count: 0, unique: new Set(), rare: 0, projected: 0, unpriced: 0, top: null };
    for (const item of inventory) {
        const rawId = item.assetId ?? item.bundleId ?? item.itemTarget?.targetId;
        if (rawId === undefined) continue;
        const itemId = parseInt(rawId);
        const itemType = (item.assetId === undefined && (item.bundleId !== undefined || item.itemTarget?.targetId !== undefined))
            ? 2
            : utilities.getItemTypeFromAssetData(item);
        stats.count++;
        stats.unique.add(`${itemType}:${itemId}`);
        const info = utilities.getItemInfo(itemId, itemType, data);
        if (!info) {
            stats.unpriced++;
            continue;
        }
        stats.value += info.value;
        stats.rap += info.rap;
        if (info.rare) stats.rare++;
        if (info.projected) stats.projected++;
        if (!stats.top || info.value > stats.top.value) stats.top = { id: itemId, name: info.name, value: info.value };
    }
    return stats;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function stat(label, value, sub, tone) {
    const box = el("div", "rv-pb-stat");
    box.append(el("span", "rv-pb-label", label), el("span", `rv-pb-value${tone ? ` rv-pb-${tone}` : ""}`, value));
    if (sub) box.appendChild(el("span", "rv-pb-sub", sub));
    return box;
}

async function thumbnailFor(id) {
    try {
        const response = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=110x110&format=Png&isCircular=false`, { credentials: "include" });
        return response.ok ? (await response.json())?.data?.[0]?.imageUrl ?? null : null;
    } catch (e) {
        return null;
    }
}

//One card: a small header, the totals in a row, and the most valuable item with its picture.
async function fillSummary(container, userId) {
    const inventory = await utilities.getUserInventoryCached(userId);
    container.replaceChildren();
    const head = el("div", "rv-pb-head");
    head.appendChild(el("span", "rv-pb-brand", "RoTrade · Inventory"));
    const link = el("a", "rv-pb-link", "Rolimons ↗");
    link.href = `https://www.rolimons.com/player/${userId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    head.appendChild(link);
    container.appendChild(head);
    const row = el("div", "rv-pb-row");
    container.appendChild(row);
    if (!inventory) {
        row.appendChild(stat("Inventory", "Private", "totals can't be worked out"));
        return;
    }
    const stats = computeStats(inventory);
    row.append(
        stat("Value", utilities.commafy(stats.value), null, "accent"),
        stat("RAP", utilities.commafy(stats.rap)),
        stat("Limiteds", utilities.commafy(stats.count), `${utilities.commafy(stats.unique.size)} unique`)
    );
    if (stats.rare > 0 || stats.projected > 0) row.appendChild(stat("Rare · Projected", `${stats.rare} · ${stats.projected}`));
    if (stats.unpriced > 0) row.appendChild(stat("Not on Rolimons", String(stats.unpriced), "counted as 0"));
    if (stats.top) {
        const top = el("div", "rv-pb-top");
        const pic = el("span", "rv-pb-pic");
        const text = el("div", "rv-pb-toptext");
        text.append(el("span", "rv-pb-label", "Top item"), el("span", "rv-pb-topname", stats.top.name), el("span", "rv-pb-sub", `${utilities.commafy(stats.top.value)} value`));
        top.append(pic, text);
        top.title = stats.top.name;
        row.appendChild(top);
        thumbnailFor(stats.top.id).then((url) => {
            if (!url) return;
            const img = el("img");
            img.src = url;
            img.alt = "";
            pic.appendChild(img);
        });
    }
}

function ensureContainer(id, userId, place) {
    let container = document.getElementById(id);
    if (container && container.dataset.userId !== String(userId)) {
        container.remove();
        container = null;
    }
    if (!container) {
        container = document.createElement("div");
        container.id = id;
        container.dataset.userId = String(userId);
        container.textContent = "Loading inventory totals...";
        container.classList.add("rv-pb");
        place(container);
    }
    return container;
}

export async function updateProfileBanner(userId) {
    const enabled = await utilities.getOption("Profile Value Banner");
    if (!enabled) return document.getElementById("rovalkProfileBanner")?.remove();
    const detailsInfo = document.querySelector(".flex-nowrap.gap-small.flex");
    if (!detailsInfo) return;
    const banner = ensureContainer("rovalkProfileBanner", userId, (node) => detailsInfo.insertAdjacentElement("afterend", node));
    await fillSummary(banner, userId);
}

export async function updateInventorySummary(userId) {
    const enabled = await utilities.getOption("Inventory Summary");
    if (!enabled) return document.getElementById("rovalkInventorySummary")?.remove();
    const grid = document.getElementById("assetsItems");
    if (!grid) return;
    const bar = ensureContainer("rovalkInventorySummary", userId, (node) => grid.insertAdjacentElement("beforebegin", node));
    await fillSummary(bar, userId);
}
