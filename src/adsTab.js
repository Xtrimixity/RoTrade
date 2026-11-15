/*
Popup "Trade Ads" tab: build your Rolimons trade ad and switch auto-posting on or off.
The background worker (tradeAds.js) does the posting; this page only edits the ad and shows how posting is going.
*/
import * as utilities from "./utilities";
import { KEYS, AD_TAGS, AD_LIMITS, get, set, onChange } from "./store";
import { el, button, send, rolimonsData, myInventory, itemSearch, info, relative, section, makeSwitch, thumbnails, thumb } from "./popupKit";

const EMPTY = { enabled: false, offer: [], requestItems: [], requestTags: [] };
const NOTIFY_OPTION = "Trade Ad Posted Notifications";

function problemWith(config) {
    if (!config.offer.length) return "Pick at least one item to offer.";
    if (config.requestItems.length + config.requestTags.length < 1) return "Add at least one request: an item or a tag like Any or Upgrade.";
    return null;
}

export async function mountAds(container) {
    container.replaceChildren(el("p", "rv-calc-hint", "Loading your inventory..."));
    const [data, inventory] = await Promise.all([rolimonsData(), myInventory()]);
    const adConfigNow = await get(KEYS.adConfig, {});
    await thumbnails([...(inventory?.items ?? []).map((item) => item.assetId), ...(adConfigNow.requestItems ?? [])]);
    let config = { ...EMPTY, ...(await get(KEYS.adConfig, {})) };
    let status = await get(KEYS.adStatus, {});
    let message = "";
    let invFilter = "";

    const save = async (patch) => {
        config = { ...config, ...patch };
        await set(KEYS.adConfig, config);
        render();
    };

    const head = section("Rolimons trade ads", "Build one ad and RoTrade posts it for you every 15.5 minutes while Chrome is open (Rolimons allows one ad per 15 minutes and 55 a day). It posts with your own Rolimons login, so sign in at rolimons.com in this browser and verify your account first.");
    const statusBox = el("div", "rv-ad-status");
    const adBox = el("div", "rv-ad-builder");
    container.replaceChildren(head, statusBox, adBox);

    function renderStatus(nextTime) {
        statusBox.replaceChildren();
        const switchRow = el("label", "rv-ad-switch");
        const { wrap: toggleWrap, input: toggle } = makeSwitch(config.enabled, "Auto-post");
        toggle.addEventListener("change", async () => {
            const problem = problemWith(config);
            if (toggle.checked && problem) {
                toggle.checked = false;
                message = problem;
                renderStatus(nextTime);
                return;
            }
            message = toggle.checked ? "Auto-post is on. The first post goes out within a minute." : "Auto-post is off.";
            await save({ enabled: toggle.checked });
        });
        switchRow.append(el("span", "", "Auto-post every 15.5 minutes"), toggleWrap);
        statusBox.appendChild(switchRow);

        //notification each time an ad posts (same switch as Settings → Notifications → Trade ad posted)
        const notifyRow = el("label", "rv-ad-switch rv-ad-notify");
        const { wrap: notifyWrap, input: notify } = makeSwitch(false, "Notify when an ad posts");
        get(NOTIFY_OPTION, false).then((on) => { notify.checked = !!on; });
        notify.addEventListener("change", () => {
            if (!notify.checked) { set(NOTIFY_OPTION, false); return; }
            //the notifications permission is optional, so Chrome asks the first time
            chrome.permissions.request({ permissions: ["notifications"] }, (granted) => {
                chrome.runtime.lastError;
                if (granted) {
                    set(NOTIFY_OPTION, true);
                } else {
                    notify.checked = false;
                    message = "Chrome didn't allow notifications, so this stays off.";
                    renderStatus(nextTime);
                }
            });
        });
        notifyRow.append(el("span", "", "Notify me when an ad posts (or can't post)"), notifyWrap);
        statusBox.appendChild(notifyRow);

        const posts = (status.posts ?? []).filter((time) => Date.now() - time < 86400000);
        const grid = el("div", "rv-ad-stats");
        const stat = (label, value) => {
            const box = el("div", "rv-stat");
            box.append(el("div", "rv-stat-label", label), el("div", "rv-stat-value", value));
            grid.appendChild(box);
        };
        stat("Last post", status.lastPost ? relative(status.lastPost) : "never");
        stat("Next post", config.enabled ? (nextTime ? relative(nextTime) : "soon") : "off");
        stat("Last 24 hours", `${posts.length} / ${AD_LIMITS.perDay}`);
        statusBox.appendChild(grid);

        const postNow = button("Post now", "rv-btn", async () => {
            const problem = problemWith(config);
            if (problem) { message = problem; return renderStatus(nextTime); }
            postNow.disabled = true;
            postNow.textContent = "Posting...";
            const result = await send({ title: "postTradeAdNow" });
            message = result?.message ?? "No answer from the background worker.";
            status = await get(KEYS.adStatus, {});
            refreshTimer();
        });
        const actions = el("div", "rv-group");
        actions.appendChild(postNow);
        const profile = el("a", "rv-link", "My ads on Rolimons ↗");
        profile.href = inventory?.userId ? `https://www.rolimons.com/playertrades/${inventory.userId}` : "https://www.rolimons.com/trades";
        profile.target = "_blank";
        actions.appendChild(profile);
        statusBox.appendChild(actions);
        if (message) statusBox.appendChild(el("div", "rv-ad-message", message));

        const log = (status.log ?? []).slice(0, 5);
        if (log.length) {
            const list = el("div", "rv-ad-log");
            log.forEach((entry) => {
                const row = el("div", `rv-ad-log-row ${entry.ok ? "rv-ok" : "rv-err"}`);
                row.append(el("span", "rv-ad-log-time", new Date(entry.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })), el("span", "", entry.message));
                list.appendChild(row);
            });
            statusBox.appendChild(list);
        }
    }

    function refreshTimer() {
        send({ title: "getTradeAdTimer" }).then((timer) => renderStatus(timer?.next ?? null));
    }

    function chip(text, onRemove, sub, id) {
        const node = el("span", "rv-ad-chip");
        if (id) node.appendChild(thumb(id, text, 22));
        node.appendChild(el("span", "", text));
        if (sub) node.appendChild(el("span", "rv-muted", ` ${sub}`));
        node.appendChild(button("×", "rv-ad-x", onRemove));
        return node;
    }

    function renderAd() {
        adBox.replaceChildren();
        const owned = new Map();
        for (const item of inventory?.items ?? []) owned.set(item.assetId, (owned.get(item.assetId) ?? 0) + 1);

        //offer
        const offer = section(`You offer (${config.offer.length}/${AD_LIMITS.offer})`);
        const offerChips = el("div", "rv-ad-chips");
        config.offer.forEach((id, index) => {
            const detail = info(id, data);
            offerChips.appendChild(chip(detail?.name ?? `Item ${id}`, () => save({ offer: config.offer.filter((_, i) => i !== index) }), detail ? utilities.commafy(detail.value) : "", id));
        });
        if (!config.offer.length) offerChips.appendChild(el("span", "rv-muted", "Click items below to add them."));
        offer.appendChild(offerChips);

        if (!inventory?.items?.length) {
            offer.appendChild(el("p", "rv-calc-hint", "Couldn't load your inventory. Make sure you're signed in to Roblox in this browser, then reopen this tab."));
        } else {
            const filter = el("input", "rv-search");
            filter.type = "search";
            filter.placeholder = "Filter your items";
            filter.value = invFilter;
            const grid = el("div", "rv-ad-inv");
            const fill = () => {
                grid.replaceChildren();
                const seen = new Set();
                const rows = inventory.items
                    .filter((item) => !seen.has(item.assetId) && seen.add(item.assetId))
                    .map((item) => ({ ...item, detail: info(item.assetId, data) }))
                    .filter((item) => item.detail && item.detail.name.toLowerCase().includes(invFilter.toLowerCase()))
                    .sort((a, b) => b.detail.value - a.detail.value);
                rows.forEach((item) => {
                    const used = config.offer.filter((id) => id === item.assetId).length;
                    const full = config.offer.length >= AD_LIMITS.offer || used >= (owned.get(item.assetId) ?? 1);
                    const node = button("", `rv-ad-item${used ? " rv-picked" : ""}`, () => {
                        if (used) {
                            //clicking a picked item takes one copy back out
                            const at = config.offer.lastIndexOf(item.assetId);
                            save({ offer: config.offer.filter((_, i) => i !== at) });
                            return;
                        }
                        if (full) return;
                        save({ offer: [...config.offer, item.assetId] });
                    });
                    node.disabled = full && !used;
                    node.title = `${item.detail.name} · ${utilities.commafyFull(item.detail.value)}${used ? " · click to remove" : ""}`;
                    node.append(
                        thumb(item.assetId, item.detail.name, 64),
                        el("span", "rv-ad-item-name", item.detail.name),
                        el("span", "rv-ad-item-value", utilities.commafy(item.detail.value) + (owned.get(item.assetId) > 1 ? ` ×${owned.get(item.assetId)}` : ""))
                    );
                    if (used) node.appendChild(el("span", "rv-ad-check", used > 1 ? `×${used}` : "✓"));
                    grid.appendChild(node);
                });
                if (!rows.length) grid.appendChild(el("span", "rv-muted", "No items match."));
            };
            filter.addEventListener("input", () => { invFilter = filter.value; fill(); });
            fill();
            offer.append(filter, grid);
        }
        adBox.appendChild(offer);

        //request
        const requestCount = config.requestItems.length + config.requestTags.length;
        const request = section(`You want (${requestCount}/${AD_LIMITS.request})`, "Items and tags share the 4 request slots.");
        const tags = el("div", "rv-ad-tags");
        AD_TAGS.forEach(([id, label]) => {
            const on = config.requestTags.includes(id);
            const node = button(label, "rv-chip", () => {
                if (on) save({ requestTags: config.requestTags.filter((tag) => tag !== id) });
                else if (requestCount < AD_LIMITS.request) save({ requestTags: [...config.requestTags, id] });
            });
            node.setAttribute("aria-pressed", String(on));
            node.disabled = !on && requestCount >= AD_LIMITS.request;
            tags.appendChild(node);
        });
        request.appendChild(tags);
        const wanted = el("div", "rv-ad-chips");
        config.requestItems.forEach((id, index) => {
            const detail = info(id, data);
            wanted.appendChild(chip(detail?.name ?? `Item ${id}`, () => save({ requestItems: config.requestItems.filter((_, i) => i !== index) }), detail ? utilities.commafy(detail.value) : "", id));
        });
        request.appendChild(wanted);
        if (requestCount < AD_LIMITS.request) {
            request.appendChild(itemSearch(data, "Search an item you want", async (item) => {
                if (config.requestItems.includes(item.id)) return;
                await thumbnails([item.id]);
                save({ requestItems: [...config.requestItems, item.id] });
            }));
        }
        adBox.appendChild(request);

        //preview
        const offerValue = config.offer.reduce((sum, id) => sum + (info(id, data)?.value ?? 0), 0);
        const askValue = config.requestItems.reduce((sum, id) => sum + (info(id, data)?.value ?? 0), 0);
        const preview = el("div", "rv-ad-preview");
        preview.append(
            el("div", "", `Offering ${utilities.commafyFull(offerValue)} value`),
            el("div", "", `Asking for ${[...config.requestTags.map((tag) => AD_TAGS.find(([id]) => id === tag)?.[1] ?? tag), ...config.requestItems.map((id) => info(id, data)?.name ?? `Item ${id}`)].join(", ") || "nothing yet"}${askValue ? ` (${utilities.commafyFull(askValue)} in items)` : ""}`)
        );
        const problem = problemWith(config);
        if (problem) preview.appendChild(el("div", "rv-ad-message", problem));
        adBox.appendChild(preview);
    }

    function render() {
        refreshTimer();
        renderAd();
    }

    onChange(KEYS.adStatus, async () => {
        status = await get(KEYS.adStatus, {});
        refreshTimer();
    });
    render();
}
