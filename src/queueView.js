/*
Tools -> "Trade queue" in the popup. Set up the trade, pick people, read and accept the warning, then Start.
Start opens the first person's send page; RoTrade fills it in there and you press Make Offer yourself.
*/
import * as utilities from "./utilities";
import { el, button, myInventory, itemSearch, info, section, thumbnails, thumb } from "./popupKit";
import { loadQueue, saveQueue, updateQueue, nextRecipient, limitReached, tradeUrl, findTraders, findOwners, resolveUsers, claimNext, maxTabs, openTradeTabs, QUEUE_LIMITS, QUEUE_KEY } from "./tradeQueue";

//Open trade tabs up to the "max tabs at once" limit. Returns how many were opened.
async function openUpToLimit() {
    const queue = await loadQueue();
    const room = maxTabs(queue) - (await openTradeTabs()).length;
    let opened = 0;
    for (let i = 0; i < room; i++) {
        const { next } = await claimNext();
        if (!next) break;
        chrome.tabs.create({ url: tradeUrl(next.id), active: opened === 0 });
        opened++;
    }
    return opened;
}

function warningDialog(queue, onAccept) {
    const overlay = el("div", "rv-q-overlay");
    const box = el("div", "rv-q-dialog");
    overlay.appendChild(box);
    box.append(el("h3", "rv-q-title", "Before you start the trade queue"));
    const list = el("ul", "rv-q-list");
    [
        "RoTrade fills in each trade for you. You check it and press Make Offer yourself. RoTrade never sends a trade on its own.",
        "Sending lots of similar trades, especially lowballs, can get you reported, and Roblox can restrict or ban accounts for trade spam. You're responsible for the trades you send.",
        "Roblox limits how many trades you can send. When you hit the limit, stop and come back later.",
        "Robux you add has a 30% fee, and Roblox caps it at 50% of the value of the items you're offering.",
        "Only send trades you'd be happy for people to accept."
    ].forEach((text) => list.appendChild(el("li", "", text)));
    box.appendChild(list);

    const agreeRow = el("label", "rv-q-check");
    const agree = el("input");
    agree.type = "checkbox";
    agreeRow.append(agree, el("span", "", "I understand and agree"));
    const hideRow = el("label", "rv-q-check rv-q-muted");
    const hide = el("input");
    hide.type = "checkbox";
    hide.checked = !!queue.hideWarning;
    hideRow.append(hide, el("span", "", "Don't show this again"));

    const buttons = el("div", "rv-q-buttons");
    const cancel = button("Cancel", "rv-chip", () => overlay.remove());
    const go = button("Agree and start", "rv-btn", async () => {
        if (!agree.checked) return;
        overlay.remove();
        await updateQueue({ agreed: true, hideWarning: hide.checked });
        onAccept();
    });
    go.disabled = true;
    agree.addEventListener("change", () => { go.disabled = !agree.checked; });
    buttons.append(cancel, go);
    box.append(agreeRow, hideRow, buttons);
    document.body.appendChild(overlay);
}

export async function queueView(data, rerender) {
    const queue = await loadQueue();
    const inventory = await myInventory().catch(() => null);
    const myItems = inventory?.items ?? [];
    const myUserId = inventory?.userId;
    const save = async (change) => { Object.assign(queue, change); await saveQueue(queue); rerender(); };
    const ids = [...queue.template.offer, ...queue.template.want, ...queue.recipients.map(() => null)].filter(Boolean);
    await thumbnails(ids);

    const out = [];

    //---- status / start ----
    const status = section("Trade queue", "Set up one trade and RoTrade fills it in for each person on Roblox's send page. You press Make Offer every time.");
    const pending = queue.recipients.filter((r) => r.status === "pending").length;
    const sent = queue.sentToday?.count ?? 0;
    status.appendChild(el("p", "rv-q-progress", `${sent} sent today${queue.limit > 0 ? ` of ${queue.limit}` : ""} · ${pending} waiting${queue.active ? " · running" : ""}`));
    const problems = [];
    if (!queue.template.offer.length && !(queue.template.robux > 0)) problems.push("add something to give");
    if (!queue.template.want.length) problems.push("pick the item you want");
    if (!pending) problems.push("add people to send to");
    const controls = el("div", "rv-q-row");
    if (queue.active) {
        controls.append(
            button("Open next trade", "rv-btn", async () => {
                const opened = await openUpToLimit();
                if (!opened) tabNote.textContent = limitReached(queue) ? "You've reached today's limit." : nextRecipient(queue) ? `Already ${maxTabs(queue)} trade tab${maxTabs(queue) === 1 ? "" : "s"} open (your max). Finish or close one first.` : "Nobody left in the list.";
            }),
            button("Stop", "rv-chip", () => save({ active: false }))
        );
    } else {
        const start = button("Start", "rv-btn", () => {
            const begin = async () => {
                await updateQueue({ active: true });
                await openUpToLimit();
                rerender();
            };
            if (queue.hideWarning && queue.agreed) begin();
            else warningDialog(queue, begin);
        });
        start.disabled = problems.length > 0 || limitReached(queue);
        controls.append(start);
    }
    status.appendChild(controls);
    const tabNote = el("p", "rv-calc-hint", "");
    status.appendChild(tabNote);
    if (problems.length && !queue.active) status.appendChild(el("p", "rv-calc-hint", `To start: ${problems.join(", ")}.`));
    if (limitReached(queue)) status.appendChild(el("p", "rv-calc-hint", "You've reached today's limit. Raise it below or come back tomorrow."));
    out.push(status);

    //---- the trade ----
    const trade = section("The trade", "Up to 4 items each side. Robux is optional.");
    const giveTitle = el("p", "rv-q-sub", `You give (${queue.template.offer.length}/${QUEUE_LIMITS.offer})`);
    const giveList = el("div", "rv-q-items");
    queue.template.offer.forEach((id, index) => {
        const chip = el("span", "rv-q-item");
        chip.append(thumb(id, info(id, data)?.name ?? `Item ${id}`, 26), el("span", "", info(id, data)?.name ?? `Item ${id}`));
        chip.append(button("×", "rv-ad-x", () => save({ template: { ...queue.template, offer: queue.template.offer.filter((_, i) => i !== index) } })));
        giveList.appendChild(chip);
    });
    trade.append(giveTitle, giveList);
    if (queue.template.offer.length < QUEUE_LIMITS.offer) {
        const picker = el("select", "rv-set-search rv-q-select");
        picker.appendChild(Object.assign(el("option", "", myItems.length ? "+ Add one of your items" : "Open Roblox once so RoTrade can read your inventory"), { value: "" }));
        const used = queue.template.offer.reduce((map, id) => map.set(id, (map.get(id) ?? 0) + 1), new Map());
        const counts = myItems.reduce((map, item) => map.set(item.assetId, (map.get(item.assetId) ?? 0) + 1), new Map());
        [...counts.entries()]
            .map(([id, count]) => ({ id, count, name: info(id, data)?.name ?? myItems.find((item) => item.assetId === id)?.name ?? `Item ${id}`, value: info(id, data)?.value ?? 0 }))
            .filter((item) => item.count > (used.get(item.id) ?? 0))
            .sort((a, b) => b.value - a.value)
            .forEach((item) => picker.appendChild(Object.assign(el("option", "", `${item.name} (${utilities.commafyFull(item.value)})`), { value: String(item.id) })));
        picker.addEventListener("change", () => {
            if (picker.value) save({ template: { ...queue.template, offer: [...queue.template.offer, Number(picker.value)] } });
        });
        trade.appendChild(picker);
    }

    const robuxRow = el("label", "rv-q-robux");
    const robux = el("input", "rv-set-search");
    robux.type = "number";
    robux.min = "0";
    robux.step = "1";
    robux.value = queue.template.robux > 0 ? String(queue.template.robux) : "";
    robux.placeholder = "0";
    robux.addEventListener("change", () => save({ template: { ...queue.template, robux: Math.max(0, Math.floor(Number(robux.value) || 0)) } }));
    const offerValue = queue.template.offer.reduce((sum, id) => sum + Math.max(info(id, data)?.value ?? 0, 0), 0);
    robuxRow.append(el("span", "rv-q-sub", "Plus Robux"), robux);
    trade.appendChild(robuxRow);
    if (offerValue > 0) trade.appendChild(el("p", "rv-calc-hint", `Roblox caps added Robux at about half your items' value (${utilities.commafyFull(Math.floor(offerValue / 2))} here) and takes a 30% fee.`));

    trade.appendChild(el("p", "rv-q-sub", `You want (${queue.template.want.length}/${QUEUE_LIMITS.want})`));
    const wantList = el("div", "rv-q-items");
    queue.template.want.forEach((id, index) => {
        const chip = el("span", "rv-q-item");
        chip.append(thumb(id, info(id, data)?.name ?? `Item ${id}`, 26), el("span", "", info(id, data)?.name ?? `Item ${id}`));
        chip.append(button("×", "rv-ad-x", () => save({ template: { ...queue.template, want: queue.template.want.filter((_, i) => i !== index) } })));
        wantList.appendChild(chip);
    });
    trade.appendChild(wantList);
    if (queue.template.want.length < QUEUE_LIMITS.want) {
        trade.appendChild(itemSearch(data, "Search the item you want", (item) => save({ template: { ...queue.template, want: [...queue.template.want, item.id] } })));
    }
    const wantValue = queue.template.want.reduce((sum, id) => sum + Math.max(info(id, data)?.value ?? 0, 0), 0);
    if (offerValue + queue.template.robux > 0 && wantValue > 0) {
        const give = offerValue + queue.template.robux * 0.7;
        const diff = Math.round(((wantValue - give) / Math.max(give, 1)) * 100);
        trade.appendChild(el("p", `rv-q-verdict ${diff >= 0 ? "rv-pos" : "rv-neg"}`, `You give ${utilities.commafyFull(Math.round(give))} for ${utilities.commafyFull(wantValue)} · ${diff >= 0 ? "+" : ""}${diff}% for you`));
    }
    out.push(trade);

    //---- people ----
    const people = section("Who to send it to", "Find owners lists everyone who owns the item you want (from Rolimons), most recently online first. Recent trade ads only has people who posted an ad in the last few minutes.");
    const peopleStatus = el("p", "rv-calc-hint rv-q-found", "");
    const findRow = el("div", "rv-q-row");
    const addFound = async (found, label) => {
        const known = new Set(queue.recipients.map((r) => r.id));
        const fresh = found.filter((r) => !known.has(r.id));
        const added = fresh.slice(0, Math.max(0, QUEUE_LIMITS.recipients - queue.recipients.length));
        await save({ recipients: [...queue.recipients, ...added] });
        setTimeout(() => { const note = document.querySelector(".rv-q-found"); if (note) note.textContent = `${label}: found ${found.length}, added ${added.length} new${fresh.length > added.length ? ` (list is full at ${QUEUE_LIMITS.recipients})` : ""}.`; }, 30);
    };
    const filters = el("div", "rv-q-row");
    const days = el("input", "rv-set-search rv-q-days");
    days.type = "number";
    days.min = "0";
    days.value = String(queue.ownerDays ?? 7);
    days.addEventListener("change", () => { queue.ownerDays = Math.max(0, Math.floor(Number(days.value) || 0)); saveQueue(queue); });
    const premiumRow = el("label", "rv-q-check rv-q-muted");
    const premium = el("input");
    premium.type = "checkbox";
    premium.checked = !!queue.ownerPremiumOnly;
    premium.addEventListener("change", () => { queue.ownerPremiumOnly = premium.checked; saveQueue(queue); });
    premiumRow.append(premium, el("span", "", "Premium / Plus only"));
    filters.append(el("span", "rv-q-sub", "Online in the last"), days, el("span", "rv-q-sub", "days (0 = anyone)"), premiumRow);
    const owners = button("Find owners", "rv-btn", async () => {
        if (!queue.template.want.length) { peopleStatus.textContent = "Pick the item you want first."; return; }
        owners.disabled = true;
        peopleStatus.textContent = "Reading the owner list on Rolimons...";
        try {
            return await addFound(await findOwners(queue.template.want, myUserId, { activeDays: queue.ownerDays ?? 7, premiumOnly: !!queue.ownerPremiumOnly }), "Owners");
        } catch (error) {
            peopleStatus.textContent = String(error?.message ?? error);
        }
        owners.disabled = false;
    });
    const find = button("From recent trade ads", "rv-chip", async () => {
        if (!queue.template.want.length) { peopleStatus.textContent = "Pick the item you want first."; return; }
        find.disabled = true;
        peopleStatus.textContent = "Looking through recent Rolimons trade ads...";
        try {
            return await addFound(await findTraders(queue.template.want, myUserId), "Recent trade ads");
        } catch (error) {
            peopleStatus.textContent = String(error?.message ?? error);
        }
        find.disabled = false;
    });
    people.append(filters);
    findRow.append(owners, find);
    if (queue.recipients.length) findRow.append(button("Clear list", "rv-chip", () => save({ recipients: [], active: false })));
    people.append(findRow);

    const addBox = el("textarea", "rv-set-search rv-q-textarea");
    addBox.placeholder = "Usernames or user IDs, separated by spaces or commas";
    const add = button("Add", "rv-chip", async () => {
        if (!addBox.value.trim()) return;
        add.disabled = true;
        try {
            const { recipients, missing } = await resolveUsers(addBox.value);
            const known = new Set(queue.recipients.map((r) => r.id));
            await updateQueue((current) => ({ ...current, recipients: [...current.recipients, ...recipients.filter((r) => !known.has(r.id) && r.id !== Number(myUserId))].slice(0, QUEUE_LIMITS.recipients) }));
            if (missing.length) alertLater(`Couldn't find: ${missing.join(", ")}`);
            rerender();
        } catch {
            peopleStatus.textContent = "Couldn't look those users up right now.";
            add.disabled = false;
        }
    });
    people.append(addBox, add, peopleStatus);

    const list = el("div", "rv-q-people");
    queue.recipients.slice(0, 60).forEach((recipient, index) => {
        const row = el("div", `rv-tool-row rv-q-person rv-q-${recipient.status}`);
        const who = el("span", "rv-side-name", recipient.name);
        if (recipient.note) who.title = recipient.note;
        row.append(who, el("span", "rv-q-state", { pending: "waiting", sent: "sent", skipped: "skipped", failed: "failed" }[recipient.status] ?? recipient.status));
        row.append(button("×", "rv-ad-x", () => save({ recipients: queue.recipients.filter((_, i) => i !== index) })));
        list.appendChild(row);
    });
    if (queue.recipients.length > 60) list.appendChild(el("p", "rv-calc-hint", `+ ${queue.recipients.length - 60} more`));
    people.appendChild(list);

    const limitRow = el("label", "rv-q-robux");
    const limit = el("input", "rv-set-search");
    limit.type = "number";
    limit.min = "0";
    limit.value = String(queue.limit ?? 20);
    limit.addEventListener("change", () => save({ limit: Math.max(0, Math.floor(Number(limit.value) || 0)) }));
    limitRow.append(el("span", "rv-q-sub", "Stop after this many trades today (0 = until the list runs out)"), limit);
    people.appendChild(limitRow);
    const tabsRow = el("label", "rv-q-robux");
    const tabs = el("input", "rv-set-search");
    tabs.type = "number";
    tabs.min = "1";
    tabs.max = String(QUEUE_LIMITS.maxTabs);
    tabs.value = String(maxTabs(queue));
    tabs.addEventListener("change", () => save({ maxTabs: Math.max(1, Math.min(QUEUE_LIMITS.maxTabs, Math.floor(Number(tabs.value) || 1))) }));
    tabsRow.append(el("span", "rv-q-sub", `Max trade tabs open at once (1 to ${QUEUE_LIMITS.maxTabs}). Each tab moves on to the next person by itself.`), tabs);
    people.appendChild(tabsRow);
    if (queue.hideWarning) people.appendChild(button("Show the warning again next time", "rv-chip", () => save({ hideWarning: false })));
    out.push(people);
    return out;
}

function alertLater(text) {
    setTimeout(() => {
        const note = document.querySelector(".rv-q-people")?.previousElementSibling;
        if (note) note.textContent = text;
    }, 50);
}

export { QUEUE_KEY };
