/*
Small helpers shared by the popup's Trade Ads and Tools tabs: element building, loading Rolimons data and your
inventory from the background worker, and a reusable item search box.
*/
import * as utilities from "./utilities";
import { searchItems } from "./tradeMath";

export function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function button(text, className = "rv-btn", onClick) {
    const node = el("button", className, text);
    node.type = "button";
    if (onClick) node.addEventListener("click", onClick);
    return node;
}

export function send(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            chrome.runtime.lastError;
            resolve(response ?? null);
        });
    });
}

let dataPromise = null;
export function rolimonsData() {
    if (!dataPromise) dataPromise = send("getData");
    return dataPromise;
}

export function myInventory(force = false) {
    return send({ title: "getMyInventory", force });
}

let catalog = null;
export function buildCatalog(data) {
    if (catalog) return catalog;
    catalog = [];
    Object.entries(data?.assets ?? {}).forEach(([id, entry]) => {
        if (entry?.[0]) catalog.push({ id: Number(id), type: 1, name: String(entry[0]), acr: entry[1] ? String(entry[1]) : "" });
    });
    return catalog;
}

export function info(id, data, type = 1) {
    return utilities.getItemInfo(id, type, data);
}

/*
A search box over every Rolimons item. onPick(item) gets { id, type, name, acr }.
*/
export function itemSearch(data, placeholder, onPick) {
    const wrap = el("div", "rv-isearch");
    const input = el("input", "rv-search");
    input.type = "search";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    const results = el("div", "rv-calc-results");
    input.addEventListener("input", () => {
        results.replaceChildren();
        for (const item of searchItems(buildCatalog(data), input.value, 6)) {
            const detail = info(item.id, data);
            const row = button("", "rv-calc-result-item", () => {
                input.value = "";
                results.replaceChildren();
                onPick(item);
            });
            row.append(el("span", "rv-side-name", item.name + (item.acr ? ` (${item.acr})` : "")), el("span", "rv-side-value", detail ? utilities.commafyFull(detail.value) : "?"));
            results.appendChild(row);
        }
    });
    wrap.append(input, results);
    return wrap;
}

export function relative(time) {
    if (!time) return "never";
    const diff = Date.now() - time;
    const future = diff < 0;
    const minutes = Math.round(Math.abs(diff) / 60000);
    let text;
    if (minutes < 1) text = "less than a minute";
    else if (minutes < 60) text = `${minutes} min`;
    else if (minutes < 1440) text = `${Math.round(minutes / 60)} h`;
    else text = `${Math.round(minutes / 1440)} d`;
    return future ? `in ${text}` : `${text} ago`;
}

export function section(title, hint) {
    const box = el("section", "rv-section");
    box.appendChild(el("h3", "rv-section-h", title));
    if (hint) box.appendChild(el("p", "rv-section-hint", hint));
    return box;
}

//The popup's one switch style (styles in popup.css .rv-switch).
export function makeSwitch(checked, label) {
    const wrap = el("span", "rv-switch");
    const input = el("input");
    input.type = "checkbox";
    input.checked = !!checked;
    if (label) input.setAttribute("aria-label", label);
    wrap.append(input, el("i"));
    return { wrap, input };
}

//Item thumbnails from Roblox, 100 per request, remembered for the life of the popup.
const thumbCache = new Map();
export async function thumbnails(ids) {
    const wanted = [...new Set(ids.map(Number))].filter((id) => id > 0 && !thumbCache.has(id));
    for (let i = 0; i < wanted.length; i += 100) {
        const batch = wanted.slice(i, i + 100);
        batch.forEach((id) => thumbCache.set(id, null));
        try {
            const response = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${batch.join(",")}&returnPolicy=PlaceHolder&size=110x110&format=Png&isCircular=false`, { credentials: "include" });
            const body = response.ok ? await response.json() : null;
            for (const entry of body?.data ?? []) if (entry.imageUrl) thumbCache.set(Number(entry.targetId), entry.imageUrl);
        } catch (e) { /* no thumbnails: tiles show the item's initial instead */ }
    }
    return thumbCache;
}

//A square item picture (or its first letter while the picture loads / when there is none).
export function thumb(id, name, size = 44) {
    const box = el("span", "rv-thumb");
    box.style.width = box.style.height = `${size}px`;
    const url = thumbCache.get(Number(id));
    if (url) {
        const img = el("img");
        img.src = url;
        img.alt = "";
        img.loading = "lazy";
        box.appendChild(img);
    } else {
        box.textContent = (name || "?").trim().charAt(0).toUpperCase();
    }
    return box;
}
