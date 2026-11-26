/*
Trade queue, page side (see tradeQueue.js).
On a send page for the next person in a running queue: put your items, the Robux and the item you want into the trade,
then show a bar at the top. Nothing is sent until YOU press Roblox's "Make Offer" button.
When you press it, RoTrade notes it. Once Roblox takes you back to the trades page (the trade went through), the
person is marked as sent, today's count goes up, and the next person's send page opens a few seconds later
(with a button to cancel that).
*/
import * as utilities from "../utilities";
import { loadQueue, saveQueue, limitReached, tradeUrl, claimNext } from "../tradeQueue";

const BAR_ID = "rotradeQueueBar";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let filledFor = null;
let watchingSend = false;
let movingOn = null;

function bar() {
    let node = document.getElementById(BAR_ID);
    if (!node) {
        node = document.createElement("div");
        node.id = BAR_ID;
        node.innerHTML = `<div class="rv-qbar-main"><b class="rv-qbar-title">RoTrade queue</b><span class="rv-qbar-text"></span></div><div class="rv-qbar-buttons"></div>`;
        document.body.appendChild(node);
    }
    return node;
}

function setBar(text, buttons = [], tone = "") {
    const node = bar();
    node.dataset.tone = tone;
    node.querySelector(".rv-qbar-text").textContent = text;
    const holder = node.querySelector(".rv-qbar-buttons");
    holder.replaceChildren(...buttons.map(([label, onClick, primary]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = primary ? "rv-qbar-btn rv-qbar-primary" : "rv-qbar-btn";
        b.textContent = label;
        b.addEventListener("click", onClick);
        return b;
    }));
}

function removeBar() {
    document.getElementById(BAR_ID)?.remove();
}

function cardId(card) {
    const thumbnail = card.querySelector("[thumbnail-target-id]") || card.querySelector(".thumbnail-2d-container");
    const linkPath = card.querySelector("a")?.pathname;
    return parseInt(thumbnail?.getAttribute("thumbnail-target-id") || utilities.getItemIdFromPath(linkPath || ""));
}

//The two inventory panels: yours first, theirs second (checked against the headings when Roblox shows them).
function panels() {
    const holder = document.querySelector(".inventory-panel-holder") || document;
    let list = [...holder.querySelectorAll(".trade-inventory-panel")];
    if (list.length < 2) list = [...holder.querySelectorAll(".inventory-panel, [class*='inventory-panel']")].filter((panel) => panel.querySelector(".item-card-container"));
    if (list.length < 2) return null;
    const [first, second] = list;
    const heading = (panel) => (panel.querySelector("h2, h3, .panel-heading, .inventory-title")?.textContent ?? "").toLowerCase();
    if (/\byour\b/.test(heading(second)) && !/\byour\b/.test(heading(first))) return { mine: second, theirs: first };
    return { mine: first, theirs: second };
}

function nextPageButton(panel) {
    const candidates = panel.querySelectorAll("button, .btn-generic-right-sm, .pager-next, [class*='pager'] [class*='right'], [aria-label*='ext']");
    return [...candidates].find((node) => {
        const label = `${node.className} ${node.getAttribute("aria-label") ?? ""} ${node.textContent}`.toLowerCase();
        return /next|right|›|>/.test(label) && !node.disabled && !node.classList.contains("disabled") && node.offsetParent !== null;
    });
}

//Click one copy of the item in a panel, paging through the panel if needed.
async function pickItem(panel, assetId, used) {
    for (let page = 0; page < 20; page++) {
        const card = [...panel.querySelectorAll(".item-card-container")].find((candidate) => cardId(candidate) === assetId && !used.has(candidate));
        if (card) {
            used.add(card);
            (card.querySelector(".item-card-thumb-container") || card).click();
            await sleep(350);
            return true;
        }
        const next = nextPageButton(panel);
        if (!next) return false;
        next.click();
        await sleep(700);
    }
    return false;
}

function setRobux(amount) {
    if (!(amount > 0)) return true;
    const input = document.querySelector('.trade-request-window-offer [name="robux"], [name="robux"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(amount)); //so Roblox's page sees the change
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

function watchMakeOffer(queue, recipient) {
    if (watchingSend) return;
    watchingSend = true;
    document.addEventListener("click", async (event) => {
        const target = event.target.closest?.("button, a");
        if (!target || !/make offer|send( trade)?$/i.test(target.textContent.trim())) return;
        if (target.closest(`#${BAR_ID}`)) return;
        const fresh = await loadQueue();
        fresh.pendingSend = { id: recipient.id, time: Date.now() };
        await saveQueue(fresh);
        setBar(`Sending to ${recipient.name}... if Roblox shows an error, fix it or press Skip.`, [["Skip", () => finish("skipped")]], "busy");
        //Roblox usually takes you to the trades page after sending (handled in updateQueueFill). If it stays on this
        //page and clears the trade instead, that also means it went through.
        for (let i = 0; i < 20; i++) {
            await sleep(1000);
            const offerItems = document.querySelectorAll(".trade-request-window-offer .trade-request-item, .trade-request-window-offer [thumbnail-target-id]").length;
            const q = await loadQueue();
            if (!q.pendingSend || q.pendingSend.id !== recipient.id) return;
            if (offerItems === 0) {
                const r = q.recipients.find((entry) => entry.id === recipient.id);
                if (r && r.status === "pending") {
                    r.status = "sent";
                    q.sentToday.count = (q.sentToday.count ?? 0) + 1;
                }
                delete q.pendingSend;
                await saveQueue(q);
                return goNext(q);
            }
        }
    }, true);
}

async function finish(status) {
    const queue = await loadQueue();
    const id = utilities.getPartnerId();
    const recipient = queue.recipients.find((r) => r.id === id);
    if (recipient) recipient.status = status;
    delete queue.pendingSend;
    await saveQueue(queue);
    goNext(queue);
}

async function goNext(queue) {
    if (limitReached(queue)) {
        queue.active = false;
        await saveQueue(queue);
        return setBar(`Done for today: ${queue.sentToday.count} trades sent. The queue is stopped.`, [["Close", removeBar]], "done");
    }
    //this tab takes the next person (other queue tabs skip them), so the number of tabs never grows
    const { queue: fresh, next } = await claimNext();
    if (!next) {
        const left = fresh.recipients.some((r) => r.status === "pending");
        if (!left) {
            fresh.active = false;
            await saveQueue(fresh);
        }
        return setBar(left ? "The other queue tabs have the rest of the list. You can close this one." : `That's everyone in the list (${fresh.sentToday.count} sent today). The queue is stopped.`, [["Close tab", () => window.close()], ["Close", removeBar]], "done");
    }
    let seconds = 3;
    const pause = async () => {
        clearInterval(movingOn);
        const q = await loadQueue();
        const r = q.recipients.find((entry) => entry.id === next.id);
        if (r) delete r.claimed; //give them back
        q.active = false;
        await saveQueue(q);
        setBar("Queue paused. Start it again from RoTrade → Tools → Trade queue.", [["Close", removeBar]]);
    };
    const tick = () => setBar(`Next: ${next.name} in ${seconds}s`, [["Go now", () => { clearInterval(movingOn); location.href = tradeUrl(next.id); }, true], ["Pause", pause]], "busy");
    tick();
    clearInterval(movingOn);
    movingOn = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
            clearInterval(movingOn);
            location.href = tradeUrl(next.id);
        } else tick();
    }, 1000);
}

/*
Roblox's send page loads in stages, and moving between the trades list and a send page doesn't reload the page,
so RoTrade's normal update can run before there's anything to fill. Keep checking every second for a while after
the page (or its address) changes, until the trade is filled in.
*/
let watchStarted = false;
export function startQueueWatch() {
    if (watchStarted) return;
    watchStarted = true;
    let lastUrl = location.href;
    let triesLeft = 45;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            filledFor = null;
            triesLeft = 45;
        }
        if (triesLeft <= 0) return;
        triesLeft--;
        updateQueueFill().then((done) => { if (done) triesLeft = 0; }).catch(() => {});
    }, 1000);
}

export default async function updateQueueFill() {
    const queue = await loadQueue();
    if (!queue.active) { removeBar(); return true; }
    const onSendPage = /\/users\/\d+\/trade/i.test(location.pathname);
    const pageType = onSendPage ? "sendOrCounter" : utilities.getPageType();

    //back on the trades page right after pressing Make Offer: the trade went through
    if (pageType === "details") {
        if (queue.pendingSend && Date.now() - queue.pendingSend.time < 90 * 1000) {
            const recipient = queue.recipients.find((r) => r.id === queue.pendingSend.id);
            if (recipient && recipient.status === "pending") {
                recipient.status = "sent";
                queue.sentToday.count = (queue.sentToday.count ?? 0) + 1;
            }
            delete queue.pendingSend;
            await saveQueue(queue);
            goNext(queue);
        }
        return true;
    }
    if (pageType !== "sendOrCounter") return false;

    const partnerId = utilities.getPartnerId();
    const recipient = queue.recipients.find((r) => r.id === partnerId);
    if (!recipient) { removeBar(); return true; }
    if (recipient.status !== "pending") {
        setBar(`${recipient.name} is already marked ${recipient.status}.`, [["Next person", () => goNext(queue), true], ["Close", removeBar]]);
        return true;
    }
    if (limitReached(queue)) {
        setBar("You've reached today's limit, so RoTrade won't fill this one in.", [["Close", removeBar]], "done");
        return true;
    }
    if (filledFor === partnerId) return true;
    //wait until Roblox has drawn both inventories before filling anything in
    if (!document.querySelector(".inventory-panel-holder .item-card-container, .trade-inventory-panel .item-card-container")) {
        setBar(`Waiting for Roblox to load the trade for ${recipient.name}...`, [["Skip", () => finish("skipped")]], "busy");
        return false;
    }
    filledFor = partnerId;

    const counter = `${queue.sentToday.count}${queue.limit > 0 ? `/${queue.limit}` : ""} sent today`;
    setBar(`Filling in the trade for ${recipient.name}...`, [], "busy");
    await sleep(600);
    const sides = panels();
    if (!sides) {
        return setBar(`Couldn't find the inventories on this page. Add the items yourself, then press Make Offer. (${counter})`, [["Skip", () => finish("skipped")]], "warn");
    }
    const missing = [];
    const used = new Set();
    for (const id of queue.template.offer) if (!(await pickItem(sides.mine, Number(id), used))) missing.push(`your ${utilities.getItemInfo(id)?.name ?? id}`);
    let gotWanted = false;
    for (const id of queue.template.want) {
        if (await pickItem(sides.theirs, Number(id), used)) gotWanted = true;
        else missing.push(`their ${utilities.getItemInfo(id)?.name ?? id}`);
    }
    if (!setRobux(queue.template.robux)) missing.push("the Robux box");

    watchMakeOffer(queue, recipient);
    const buttons = [["Skip", () => finish("skipped")], ["Stop queue", async () => { const q = await loadQueue(); q.active = false; await saveQueue(q); setBar("Queue stopped.", [["Close", removeBar]]); }]];
    if (!gotWanted && queue.template.want.length) {
        return setBar(`${recipient.name} doesn't seem to have the item anymore (or their inventory is private). Skip them? (${counter})`, [["Skip", () => finish("skipped"), true], ...buttons.slice(1)], "warn");
    }
    setBar(
        missing.length
            ? `Filled in, but couldn't add ${missing.join(", ")}. Check the trade, then press Make Offer. (${counter})`
            : `Trade filled in for ${recipient.name}. Check it, then press Make Offer. (${counter})`,
        buttons,
        missing.length ? "warn" : "ready"
    );
}
