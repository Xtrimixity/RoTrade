/*
Trade queue: set up one trade (your items, optional Robux, the item you want), pick who to send it to, and RoTrade
fills in each trade for you on Roblox's send page. YOU press "Make Offer" every time. RoTrade never sends a trade
by itself.

Stored under QUEUE_KEY:
  template:   { offer: [assetId...], robux: number, want: [assetId...] }
  recipients: [{ id, name, status: "pending" | "sent" | "skipped" | "failed", note }]
  active:     the queue is running (send pages for these people get filled in)
  limit:      stop after this many sent trades today (0 = no limit, stop when the list runs out)
  sentToday:  { date: "YYYY-MM-DD", count }
  agreed:     the user accepted the warning
  hideWarning: don't show the warning again
  maxTabs:    most trade tabs the queue may have open at once (1 to 10). Each tab works through people one after
              another, so with 1 there is only ever one tab.
  recipients[].claimed: time a tab took this person, so two tabs never fill in the same person
*/
export const QUEUE_KEY = "rotradeQueue";
export const DEFAULT_QUEUE = {
    template: { offer: [], robux: 0, want: [] },
    recipients: [],
    active: false,
    limit: 20,
    sentToday: { date: "", count: 0 },
    agreed: false,
    hideWarning: false,
    maxTabs: 1
};
export const QUEUE_LIMITS = { offer: 4, want: 4, recipients: 1000, maxTabs: 10 };
const CLAIM_MS = 10 * 60 * 1000; //a tab that took someone and then went quiet for 10 minutes gives them back

export function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function loadQueue() {
    return new Promise((resolve) => {
        chrome.storage.local.get([QUEUE_KEY], (result) => {
            const saved = result?.[QUEUE_KEY] ?? {};
            const queue = { ...DEFAULT_QUEUE, ...saved, template: { ...DEFAULT_QUEUE.template, ...(saved.template ?? {}) } };
            if (queue.sentToday?.date !== today()) queue.sentToday = { date: today(), count: 0 };
            resolve(queue);
        });
    });
}

export function saveQueue(queue) {
    return new Promise((resolve) => chrome.storage.local.set({ [QUEUE_KEY]: queue }, resolve));
}

export async function updateQueue(change) {
    const queue = await loadQueue();
    const next = typeof change === "function" ? (change(queue) ?? queue) : { ...queue, ...change };
    await saveQueue(next);
    return next;
}

export function nextRecipient(queue) {
    return queue.recipients.find((recipient) => recipient.status === "pending" && !(recipient.claimed && Date.now() - recipient.claimed < CLAIM_MS)) ?? null;
}

//Take the next person for a tab (marks them so another tab doesn't take them too). Returns null when nobody is left.
export async function claimNext() {
    const queue = await loadQueue();
    const next = nextRecipient(queue);
    if (!next || limitReached(queue)) return { queue, next: null };
    next.claimed = Date.now();
    await saveQueue(queue);
    return { queue, next };
}

export function maxTabs(queue) {
    return Math.max(1, Math.min(QUEUE_LIMITS.maxTabs, Math.floor(Number(queue.maxTabs) || 1)));
}

//Trade send pages open right now (needs only the roblox.com permission RoTrade already has).
export function openTradeTabs() {
    return new Promise((resolve) => {
        try {
            chrome.tabs.query({ url: ["https://www.roblox.com/users/*/trade*", "https://www.roblox.com/*/users/*/trade*"] }, (tabs) => {
                chrome.runtime.lastError;
                resolve(tabs ?? []);
            });
        } catch {
            resolve([]);
        }
    });
}

export function limitReached(queue) {
    return queue.limit > 0 && (queue.sentToday?.count ?? 0) >= queue.limit;
}

export function tradeUrl(userId) {
    return `https://www.roblox.com/users/${userId}/trade`;
}

/*
People who are trading the item you want right now, from Rolimons' public recent trade ads:
GET https://api.rolimons.com/tradeads/v1/getrecentads -> { trade_ads: [[adId, time, userId, username, { items, robux }, { items, tags }], ...] }
Anyone whose ad offers one of the wanted items is a match. Newest first, one entry per person.
*/
export async function findTraders(wantIds, myUserId) {
    const want = new Set(wantIds.map(Number));
    const response = await fetch("https://api.rolimons.com/tradeads/v1/getrecentads");
    if (!response.ok) throw new Error(response.status === 429 ? "Rolimons is busy, try again in a minute." : `Rolimons answered ${response.status}.`);
    const ads = (await response.json())?.trade_ads ?? [];
    const seen = new Set();
    const out = [];
    for (const ad of [...ads].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
        const userId = Number(ad?.[2]);
        const offered = (ad?.[4]?.items ?? []).map(Number);
        if (!userId || userId === Number(myUserId) || seen.has(userId)) continue;
        if (!offered.some((id) => want.has(id))) continue;
        seen.add(userId);
        out.push({ id: userId, name: String(ad[3] ?? userId), status: "pending", note: "From a Rolimons trade ad" });
    }
    return out;
}

/*
Everyone who owns the wanted items, from the owner list on Rolimons' item page (www.rolimons.com/item/{id} has
"var all_copies_data = {...}" with owner_ids, owner_names, owner_bc_levels (0 = no Premium/Plus) and last_online,
a unix time). One entry per person, most recently online first.
options: activeDays (only people online in the last N days, 0 = anyone), premiumOnly
*/
export async function findOwners(wantIds, myUserId, options = {}) {
    const activeDays = Number(options.activeDays) || 0;
    const since = activeDays > 0 ? Date.now() / 1000 - activeDays * 86400 : 0;
    const people = new Map();
    for (const itemId of wantIds) {
        const response = await fetch(`https://www.rolimons.com/item/${Number(itemId)}`);
        if (!response.ok) throw new Error(response.status === 429 ? "Rolimons is busy, try again in a minute." : `Rolimons answered ${response.status}.`);
        const html = await response.text();
        const start = html.indexOf("var all_copies_data = ");
        if (start < 0) throw new Error("Rolimons' item page has changed, so RoTrade can't read the owner list.");
        const from = start + "var all_copies_data = ".length;
        const end = html.indexOf("};", from);
        const copies = JSON.parse(html.slice(from, end + 1));
        (copies.owner_ids ?? []).forEach((id, index) => {
            const userId = Number(id);
            if (!userId || userId === 1 || userId === Number(myUserId)) return;
            const lastOnline = Number(copies.last_online?.[index]) || 0;
            const premium = Number(copies.owner_bc_levels?.[index]) > 0;
            if (since && lastOnline < since) return;
            if (options.premiumOnly && !premium) return;
            const known = people.get(userId);
            if (known) { known.copies++; return; }
            people.set(userId, { id: userId, name: String(copies.owner_names?.[index] ?? userId), status: "pending", lastOnline, copies: 1 });
        });
    }
    return [...people.values()]
        .sort((a, b) => b.lastOnline - a.lastOnline)
        .map((person) => ({ ...person, note: `Owns ${person.copies > 1 ? `${person.copies} copies` : "it"}${person.lastOnline ? `, online ${ago(person.lastOnline)}` : ""}` }));
}

function ago(unixSeconds) {
    const minutes = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 60));
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
    return `${Math.round(minutes / 1440)} d ago`;
}

//Usernames or user IDs typed by the user -> recipients.
export async function resolveUsers(text) {
    const parts = [...new Set(String(text).split(/[\s,;]+/).map((part) => part.trim().replace(/^@/, "")).filter(Boolean))];
    const ids = parts.filter((part) => /^\d{3,}$/.test(part)).map(Number);
    const names = parts.filter((part) => !/^\d{3,}$/.test(part));
    const out = ids.map((id) => ({ id, name: String(id), status: "pending", note: "Added by you" }));
    if (names.length) {
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: names.slice(0, 100), excludeBannedUsers: true })
        });
        const found = response.ok ? (await response.json())?.data ?? [] : [];
        found.forEach((user) => out.push({ id: Number(user.id), name: user.name, status: "pending", note: "Added by you" }));
        const missing = names.filter((name) => !found.some((user) => user.requestedUsername?.toLowerCase() === name.toLowerCase() || user.name?.toLowerCase() === name.toLowerCase()));
        return { recipients: out, missing };
    }
    return { recipients: out, missing: [] };
}
