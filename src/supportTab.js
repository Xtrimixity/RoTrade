/*
Popup "Support" page (the ♥ Support button in the header): ways to support the RoTrade developer.
  Trade me     opens a trade with the developer on Roblox
  Profile      the developer's Roblox profile
  Send Robux   Roblox Plus members can send Robux directly. Roblox has no link that fills in the person for you,
               so this copies the username and opens Roblox's Robux page, where you pick "Send" and paste it.
*/
import { el } from "./popupKit";

const DEV_ID = 10830584924;
const PROFILE_URL = `https://www.roblox.com/users/${DEV_ID}/profile`;
const TRADE_URL = `https://www.roblox.com/users/${DEV_ID}/trade`;
const ROBUX_URL = "https://www.roblox.com/upgrades/robux";

function open(url) {
    chrome.tabs.create({ url });
}

async function fetchDev() {
    const out = { name: "", displayName: "", headshot: "" };
    try {
        const user = await (await fetch(`https://users.roblox.com/v1/users/${DEV_ID}`)).json();
        out.name = user?.name ?? "";
        out.displayName = user?.displayName ?? "";
    } catch { /* offline or blocked: the buttons still work */ }
    try {
        const thumbs = await (await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${DEV_ID}&size=150x150&format=Png&isCircular=true`)).json();
        out.headshot = thumbs?.data?.[0]?.imageUrl ?? "";
    } catch { /* no picture */ }
    return out;
}

function actionButton(icon, title, desc, onClick, primary) {
    const node = el("button", `rv-support-action${primary ? " rv-support-primary" : ""}`);
    node.type = "button";
    node.append(el("span", "rv-support-icon", icon));
    const text = el("span", "rv-support-text");
    text.append(el("b", "", title), el("small", "", desc));
    node.append(text);
    node.addEventListener("click", onClick);
    return node;
}

export async function mountSupport(container) {
    container.replaceChildren();
    container.append(el("h2", "rv-page-title", "Support RoTrade"), el("p", "rv-page-hint", "RoTrade is free. If it's helped your trading, you can trade with or send Robux to the developer. Totally optional, and thank you!"));

    const card = el("div", "rv-support-card");
    const who = el("div", "rv-support-who");
    const pic = el("div", "rv-support-pic");
    const names = el("div", "rv-support-names");
    const display = el("b", "", "RoTrade developer");
    const handle = el("small", "", `User ID ${DEV_ID}`);
    names.append(display, handle);
    who.append(pic, names);
    card.append(who);

    const status = el("p", "rv-set-desc rv-support-status", "");
    let username = "";
    const copyName = async () => {
        if (!username) return false;
        try {
            await navigator.clipboard.writeText(username);
            return true;
        } catch {
            return false;
        }
    };

    const actions = el("div", "rv-support-actions");
    actions.append(
        actionButton("⇄", "Trade me", "Open a trade with the developer on Roblox", () => open(TRADE_URL), true),
        actionButton("R$", "Send Robux via Roblox Plus", "Copies the username and opens Roblox's Robux page (needs Roblox Plus)", async () => {
            const copied = await copyName();
            status.textContent = copied
                ? `Copied "${username}". On the Robux page choose Send, paste the username and pick an amount.`
                : "On the Robux page choose Send, then search for the username shown above.";
            open(ROBUX_URL);
        }),
        actionButton("☺", "View profile", "See the developer's Roblox profile", () => open(PROFILE_URL))
    );
    card.append(actions, status);
    container.append(card);

    const dev = await fetchDev();
    username = dev.name;
    if (dev.displayName) display.textContent = dev.displayName;
    if (dev.name) handle.textContent = `@${dev.name}`;
    if (dev.headshot) {
        const img = el("img");
        img.src = dev.headshot;
        img.alt = "";
        pic.append(img);
    }
}
