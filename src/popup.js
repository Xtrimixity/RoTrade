/*
The extension popup (also opened full-page as popup.html?tab=... and popup.html?full=1 for the trade history).
Pages: Settings (grouped switches with search), Trade Ads, Tools, Stats, Themes.
*/
import * as utilities from "./utilities";
import { THEMES, THEME_STORAGE_KEY, THEME_COLORS_KEY, EFFECTS_STORAGE_KEY, COLOR_FIELDS, initTheme, loadThemeSettings, isValidHex, getTheme, resolveTheme } from "./themes";
import { initPageEffects } from "./pageEffects";
import { initAmbient } from "./ambient";
import { mountStats } from "./history";
import { mountAds } from "./adsTab";
import { mountTools } from "./toolsTab";
import { makeSwitch } from "./popupKit";
import optionsJSON from "./data/options.json";
import { mountSupport } from "./supportTab";
import { WEBHOOK_KEY, WEBHOOK_EVENTS, PING_MODES, isWebhookUrl, isDiscordId } from "./webhook";

initTheme();
initPageEffects();
initAmbient();

document.getElementById("rovalkImage").src = utilities.getURL("/assets/icons/RoTrade.svg");

//NAVIGATION -------------------------------------------------------------------
const mounted = {};
const mounters = {
    3: () => mountStats(document.getElementById("window-3"), { full: false }),
    5: () => mountAds(document.getElementById("window-5")),
    6: () => mountTools(document.getElementById("window-6")),
    7: () => mountSupport(document.getElementById("window-7"))
};
const tabs = [...document.querySelectorAll(".rv-tab")];
const ink = document.querySelector(".rv-nav-ink");

function moveInk(tab) {
    if (!ink || !tab) return;
    ink.style.width = `${tab.offsetWidth}px`;
    ink.style.transform = `translateX(${tab.offsetLeft}px)`;
}

function openPage(page) {
    if (ink && !tabs.some((tab) => tab.dataset.page === String(page))) ink.style.width = "0px"; //pages without a tab (Support)
    for (const tab of tabs) {
        const active = tab.dataset.page === String(page);
        tab.classList.toggle("rv-active", active);
        tab.setAttribute("aria-selected", String(active));
        if (active) moveInk(tab);
    }
    for (const section of document.querySelectorAll(".window")) {
        const show = section.id === `window-${page}`;
        section.hidden = !show;
        section.classList.toggle("rv-enter", show);
    }
    if (mounters[page] && !mounted[page]) {
        mounted[page] = true;
        mounters[page]();
    }
}
tabs.forEach((tab) => tab.addEventListener("click", () => openPage(tab.dataset.page)));
window.addEventListener("resize", () => moveInk(document.querySelector(".rv-tab.rv-active")));
document.getElementById("rvHeaderAdsButton").addEventListener("click", () => openPage(5));
document.getElementById("rvHeaderSupportButton").addEventListener("click", () => openPage(7));

//green dot on the Trade Ads tab and header button while auto-post is on
function showAdState() {
    chrome.storage.local.get(["rovalkTradeAd"], (result) => {
        const on = !!result?.rovalkTradeAd?.enabled;
        for (const id of ["rvHeaderAdsDot", "rvTabAdsDot"]) document.getElementById(id)?.classList.toggle("rv-on", on);
    });
}
showAdState();
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && "rovalkTradeAd" in changes) showAdState(); });

//SETTINGS ---------------------------------------------------------------------
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

//tell open Roblox tabs to refresh their RoValk features after a switch changes
function broadcast() {
    chrome.tabs.query({}, (openTabs) => openTabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, "Values", {}, () => chrome.runtime.lastError)));
}

function save(name, value) {
    return new Promise((resolve) => chrome.storage.local.set({ [name]: value }, () => { broadcast(); resolve(); }));
}

const COLLAPSED_KEY = "RoValk Settings Collapsed";

async function buildSettings() {
    const container = document.getElementById("window-1");
    const names = optionsJSON.filter((line) => typeof line !== "string").map((line) => line.name);
    const values = await new Promise((resolve) => chrome.storage.local.get([...names, COLLAPSED_KEY], resolve));
    const collapsed = new Set(values[COLLAPSED_KEY] ?? []);

    const search = el("input", "rv-set-search");
    search.type = "search";
    search.placeholder = "Search settings";
    search.setAttribute("aria-label", "Search settings");
    const groupsBox = el("div", "rv-set-groups");
    const empty = el("p", "rv-set-empty", "No settings match.");
    empty.hidden = true;

    const groups = [];
    let current = null;
    for (const line of optionsJSON) {
        if (typeof line === "string") {
            current = { title: line, items: [] };
            groups.push(current);
        } else if (current) {
            current.items.push(line);
        }
    }

    const rendered = groups.map((group) => {
        const box = el("div", "rv-set-group");
        const head = el("button", "rv-set-head");
        head.type = "button";
        const count = el("span", "rv-set-count");
        head.append(el("span", "rv-set-title", group.title), count, el("span", "rv-chev"));
        const body = el("div", "rv-set-body");
        const rows = group.items.map((option) => {
            const row = el("label", "rv-set-row");
            const text = el("span", "rv-set-text");
            text.append(el("span", "rv-set-name", option.label ?? option.name), el("span", "rv-set-desc", option.desc ?? ""));
            const { wrap, input } = makeSwitch(values[option.name], option.label ?? option.name);
            input.addEventListener("change", () => {
                if (input.checked && option.name.includes("Notifications")) {
                    //notifications are an optional permission: Chrome asks the first time one is switched on
                    chrome.permissions.request({ permissions: ["notifications"] }, (granted) => {
                        chrome.runtime.lastError;
                        if (!granted) input.checked = false;
                        save(option.name, input.checked);
                        updateCount();
                    });
                    return;
                }
                save(option.name, input.checked);
                updateCount();
            });
            row.append(text, wrap);
            row.dataset.search = `${option.label ?? ""} ${option.name} ${option.desc ?? ""} ${group.title}`.toLowerCase();
            body.appendChild(row);
            return { row, input };
        });
        function updateCount() {
            const on = rows.filter((entry) => entry.input.checked).length;
            count.textContent = `${on}/${rows.length} on`;
        }
        updateCount();
        const setOpen = (open) => {
            box.classList.toggle("rv-open", open);
            head.setAttribute("aria-expanded", String(open));
        };
        setOpen(!collapsed.has(group.title));
        head.addEventListener("click", () => {
            const open = !box.classList.contains("rv-open");
            setOpen(open);
            if (open) collapsed.delete(group.title);
            else collapsed.add(group.title);
            chrome.storage.local.set({ [COLLAPSED_KEY]: [...collapsed] });
        });
        box.append(head, body);
        groupsBox.appendChild(box);
        return { box, rows, setOpen, title: group.title };
    });

    search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        let anyShown = false;
        for (const group of rendered) {
            let shown = 0;
            for (const { row } of group.rows) {
                const match = !query || row.dataset.search.includes(query);
                row.hidden = !match;
                if (match) shown++;
            }
            group.box.hidden = shown === 0;
            if (query) group.box.classList.add("rv-open");
            else group.setOpen(!collapsed.has(group.title));
            anyShown = anyShown || shown > 0;
        }
        empty.hidden = anyShown;
    });

    const reset = el("button", "rv-link-btn", "Restore default settings");
    reset.type = "button";
    reset.addEventListener("click", async () => {
        if (!confirm("Turn every setting back to its default?")) return;
        const defaults = {};
        optionsJSON.forEach((line) => { if (typeof line !== "string") defaults[line.name] = line.enabledByDefault; });
        chrome.storage.local.set(defaults, () => { broadcast(); container.replaceChildren(); buildSettings(); });
    });

    groupsBox.appendChild(await buildWebhookCard());
    container.replaceChildren(search, groupsBox, empty, reset);
}

const DISCORD_ORIGINS = ["https://discord.com/api/webhooks/*", "https://discordapp.com/api/webhooks/*", "https://canary.discord.com/api/webhooks/*", "https://ptb.discord.com/api/webhooks/*"];

//Settings card for the optional Discord webhook (sending is done by webhook.js in the background)
async function buildWebhookCard() {
    const saved = await new Promise((resolve) => chrome.storage.local.get([WEBHOOK_KEY], (r) => resolve(r?.[WEBHOOK_KEY] ?? {})));
    let config = { url: "", enabled: false, events: { inbound: true, completed: true, declined: false, ad: true, value: true }, ...saved };
    config.ping = { mode: "off", id: "", events: { inbound: true, completed: true, declined: false, ad: false, value: false }, ...(saved.ping ?? {}) };
    const store = () => chrome.storage.local.set({ [WEBHOOK_KEY]: config });

    const box = el("div", "rv-set-group rv-open rv-webhook");
    const head = el("div", "rv-set-head");
    head.append(el("span", "rv-set-title", "Discord webhook"), el("span", "rv-set-count", "optional"));
    const body = el("div", "rv-set-body rv-webhook-body");
    const hint = el("p", "rv-set-desc", "Get RoTrade notifications in your own Discord channel. In Discord: Channel settings → Integrations → Webhooks → New webhook → Copy URL, then paste it here.");
    const input = el("input", "rv-set-search rv-webhook-url");
    input.type = "url";
    input.placeholder = "https://discord.com/api/webhooks/...";
    input.value = config.url ?? "";
    input.spellcheck = false;
    const status = el("div", "rv-webhook-status");

    const onRow = el("label", "rv-set-row");
    const onText = el("span", "rv-set-text");
    onText.append(el("span", "rv-set-name", "Send to Discord"), el("span", "rv-set-desc", "Uses the URL above."));
    const { wrap: onWrap, input: onInput } = makeSwitch(config.enabled, "Send to Discord");
    onRow.append(onText, onWrap);

    input.addEventListener("change", () => {
        config.url = input.value.trim();
        store();
        status.textContent = !config.url || isWebhookUrl(config.url) ? "" : "That doesn't look like a Discord webhook URL.";
    });
    onInput.addEventListener("change", () => {
        if (!onInput.checked) { config.enabled = false; store(); return; }
        if (!isWebhookUrl(input.value)) {
            onInput.checked = false;
            status.textContent = "Paste a Discord webhook URL first.";
            return;
        }
        //Discord access is optional, so Chrome asks once
        chrome.permissions.request({ origins: DISCORD_ORIGINS }, (granted) => {
            chrome.runtime.lastError;
            onInput.checked = !!granted;
            config.enabled = !!granted;
            config.url = input.value.trim();
            store();
            status.textContent = granted ? "On. Use Send test to check it." : "Chrome didn't allow Discord access, so this stays off.";
        });
    });

    const events = el("div", "rv-webhook-events");
    WEBHOOK_EVENTS.forEach(([key, label]) => {
        const chip = el("button", "rv-chip", label);
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(!!config.events?.[key]));
        chip.addEventListener("click", () => {
            config.events = { ...config.events, [key]: !config.events?.[key] };
            chip.setAttribute("aria-pressed", String(!!config.events[key]));
            store();
        });
        events.appendChild(chip);
    });

    //Pings: who gets pinged and on which events
    const pingTitle = el("span", "rv-set-name", "Ping");
    const pingRow = el("div", "rv-webhook-ping");
    const pingMode = el("select", "rv-set-search rv-webhook-select");
    pingMode.setAttribute("aria-label", "Who to ping");
    PING_MODES.forEach(([key, label]) => {
        const option = el("option", "", label);
        option.value = key;
        pingMode.appendChild(option);
    });
    pingMode.value = config.ping.mode;
    const pingId = el("input", "rv-set-search rv-webhook-id");
    pingId.inputMode = "numeric";
    pingId.spellcheck = false;
    pingId.value = config.ping.id ?? "";
    const pingHint = el("p", "rv-set-desc rv-webhook-pinghint");
    const pingOnTitle = el("span", "rv-set-name", "Ping me on (the rest still send, just silently)");
    const pingEvents = el("div", "rv-webhook-events");
    WEBHOOK_EVENTS.forEach(([key, label]) => {
        const chip = el("button", "rv-chip", label);
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(!!config.ping.events?.[key]));
        chip.addEventListener("click", () => {
            config.ping.events = { ...config.ping.events, [key]: !config.ping.events?.[key] };
            chip.setAttribute("aria-pressed", String(!!config.ping.events[key]));
            store();
        });
        pingEvents.appendChild(chip);
    });
    const refreshPing = () => {
        const mode = pingMode.value;
        const needsId = mode === "user" || mode === "role";
        pingId.hidden = !needsId;
        pingEvents.hidden = mode === "off";
        pingOnTitle.hidden = mode === "off";
        pingId.placeholder = mode === "role" ? "Role ID, e.g. 112233445566778899" : "Your Discord user ID, e.g. 112233445566778899";
        pingHint.textContent = mode === "off" ? "Messages are sent without pinging anyone."
            : needsId ? (mode === "role"
                ? "Server settings → Roles → right-click the role → Copy Role ID. (Turn on Developer Mode in Discord's Advanced settings first.)"
                : "In Discord: Settings → Advanced → turn on Developer Mode, then right-click your name → Copy User ID.")
            : `Pings ${mode === "here" ? "everyone online in the channel" : "everyone in the channel"}.`;
        if (needsId && pingId.value && !isDiscordId(pingId.value)) pingHint.textContent = "That ID should be a long number (15 to 21 digits).";
    };
    pingMode.addEventListener("change", () => { config.ping.mode = pingMode.value; store(); refreshPing(); });
    pingId.addEventListener("input", () => { config.ping.id = pingId.value.trim(); store(); refreshPing(); });
    refreshPing();
    pingRow.append(pingMode, pingId);

    const test = el("button", "rv-btn", "Send test");
    test.type = "button";
    test.addEventListener("click", () => {
        config.url = input.value.trim();
        store();
        if (!isWebhookUrl(config.url)) { status.textContent = "Paste a Discord webhook URL first."; return; }
        chrome.permissions.request({ origins: DISCORD_ORIGINS }, (granted) => {
            chrome.runtime.lastError;
            if (!granted) { status.textContent = "Chrome didn't allow Discord access."; return; }
            test.disabled = true;
            test.textContent = "Sending...";
            chrome.runtime.sendMessage({ title: "testWebhook" }, (result) => {
                chrome.runtime.lastError;
                test.disabled = false;
                test.textContent = "Send test";
                status.textContent = result?.ok ? "Test sent. Check your Discord channel." : (result?.message ?? "No answer from RoTrade's background.");
            });
        });
    });
    const eventsTitle = el("span", "rv-set-name", "What to send");
    body.append(hint, input, onRow, eventsTitle, events, pingTitle, pingRow, pingHint, pingOnTitle, pingEvents, test, status);
    box.append(head, body);
    return box;
}
buildSettings();

//THEMES TAB
function fillSwatches(container, theme) {
    container.replaceChildren();
    [theme.bg, theme.surface, theme.accent, theme.accent2].forEach((color) => {
        const swatch = document.createElement("span");
        swatch.style.background = color;
        container.appendChild(swatch);
    });
}

async function setEffects(patch) {
    const current = (await loadThemeSettings()).effects;
    await chrome.storage.local.set({ [EFFECTS_STORAGE_KEY]: { ...current, ...patch } });
}

//Color editor for themes marked "configurable" (Cherry Blossom). Every change is saved right away and shows live.
let editorOpenFor = null;
async function toggleThemeEditor(themeId) {
    const box = document.getElementById("themeEditor");
    if (editorOpenFor === themeId && !box.hidden) {
        box.hidden = true;
        editorOpenFor = null;
        return;
    }
    editorOpenFor = themeId;
    const base = getTheme(themeId);
    const settings = await loadThemeSettings();
    box.replaceChildren();
    box.hidden = false;

    const title = document.createElement("div");
    title.className = "theme-editor-title";
    const fxOnly = !!base.rgbFlow; //RGB Flow has no fixed colors to edit, only strength and speed
    const sKey = fxOnly ? "flowStrength" : "strength";
    const pKey = fxOnly ? "flowPeriod" : "period";
    title.textContent = fxOnly ? `${base.name} settings` : `${base.name} colors`;
    const hint = document.createElement("div");
    hint.className = "theme-editor-hint";
    hint.textContent = "Changes save instantly and apply to the popup and the whole Roblox site.";
    const grid = document.createElement("div");
    grid.className = "theme-editor-grid";
    const inputs = {};

    async function save(key, value) {
        const current = (await loadThemeSettings()).colors;
        const edited = { ...(current[themeId] ?? {}) };
        if (value === null) delete edited[key]; else edited[key] = value;
        const next = { ...current };
        if (Object.keys(edited).length) next[themeId] = edited; else delete next[themeId];
        await chrome.storage.local.set({ [THEME_COLORS_KEY]: next });
        const swatches = document.querySelector(`[data-swatches-for="${themeId}"]`);
        if (swatches) fillSwatches(swatches, resolveTheme(themeId, next));
    }

    for (const [key, label] of COLOR_FIELDS) {
        const row = document.createElement("label");
        row.className = "theme-editor-row";
        const input = document.createElement("input");
        input.type = "color";
        input.className = "accent-picker";
        input.value = resolveTheme(themeId, settings.colors)[key];
        input.addEventListener("input", () => { save(key, input.value); });
        inputs[key] = input;
        const text = document.createElement("span");
        text.textContent = label;
        row.append(input, text);
        grid.appendChild(row);
    }

    const buttons = document.createElement("div");
    buttons.className = "theme-editor-buttons";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "reset-accent";
    reset.textContent = "Reset to default colors";
    reset.addEventListener("click", async () => {
        const current = (await loadThemeSettings()).colors;
        const next = { ...current };
        delete next[themeId];
        await chrome.storage.local.set({ [THEME_COLORS_KEY]: next });
        for (const [key] of COLOR_FIELDS) inputs[key].value = base[key];
        const swatches = document.querySelector(`[data-swatches-for="${themeId}"]`);
        if (swatches) fillSwatches(swatches, base);
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "reset-accent";
    close.textContent = "Close";
    close.addEventListener("click", () => { box.hidden = true; editorOpenFor = null; });
    buttons.append(reset, close);

    //soft RGB glow: slow, faint and transparent color drift (off by default)
    const fxBox = document.createElement("div");
    fxBox.className = "theme-editor-fx";
    const fxTitle = document.createElement("div");
    fxTitle.className = "theme-editor-subtitle";
    fxTitle.textContent = "RGB glow";
    const fxHint = document.createElement("div");
    fxHint.className = "theme-editor-hint";
    fxHint.textContent = "A slow color drift on borders and the page edges (raise Strength for a stronger glow). Also switchable with the RGB button on the card.";
    const toggleRow = document.createElement("label");
    toggleRow.className = "theme-editor-row";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = !!settings.effects.rgb;
    const toggleText = document.createElement("span");
    toggleText.textContent = "Turn on RGB glow";
    toggleRow.append(toggle, toggleText);

    const saveFx = async (patch) => {
        const current = (await loadThemeSettings()).effects;
        await chrome.storage.local.set({ [EFFECTS_STORAGE_KEY]: { ...current, ...patch } });
    };
    const slider = (labelText, min, max, step, value, describe, key) => {
        const row = document.createElement("label");
        row.className = "theme-editor-slider";
        const text = document.createElement("span");
        const input = document.createElement("input");
        input.type = "range";
        input.min = min; input.max = max; input.step = step; input.value = value;
        const refresh = () => { text.textContent = `${labelText}: ${describe(Number(input.value))}`; };
        input.addEventListener("input", () => { refresh(); saveFx({ [key]: Number(input.value) }); });
        refresh();
        row.append(text, input);
        return row;
    };
    const strengthRow = slider("Strength", 1, 10, 1, settings.effects[sKey], (v) => (v <= 3 ? `${v} (subtle)` : v <= 6 ? `${v} (vivid)` : v <= 8 ? `${v} (strong)` : `${v} (intense)`), sKey);
    const speedRow = slider("Cycle time", 10, 300, 5, settings.effects[pKey], (v) => `${v}s per full color loop${v >= 90 ? " (very slow)" : v >= 40 ? " (slow)" : " (fast)"}`, pKey);
    toggle.addEventListener("change", () => { saveFx({ rgb: toggle.checked }); });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && EFFECTS_STORAGE_KEY in changes && changes[EFFECTS_STORAGE_KEY].newValue) toggle.checked = !!changes[EFFECTS_STORAGE_KEY].newValue.rgb;
    });
    if (fxOnly) {
        fxTitle.textContent = "Glow and color flow";
        fxHint.textContent = "The whole theme's accent colors, borders and page glow drift through the rainbow together.";
        fxBox.append(fxTitle, fxHint, strengthRow, speedRow);
        fxBox.classList.add("theme-editor-fx-only");
        box.append(title, hint, fxBox);
        return;
    }
    box.append(title, hint, grid, buttons); //RGB glow removed in 1.0.3
}

async function buildThemePicker() {
    const grid = document.getElementById("themeGrid");
    const settings = await loadThemeSettings();

    function markSelected(themeId) {
        for (const card of grid.children) {
            card.setAttribute("aria-pressed", String(card.dataset.themeId === themeId));
        }
    }

    THEMES.forEach((theme) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "theme-card";
        card.dataset.themeId = theme.id;

        const swatches = document.createElement("div");
        swatches.className = "theme-swatches";
        swatches.dataset.swatchesFor = theme.id;
        fillSwatches(swatches, resolveTheme(theme.id, settings.colors));

        const name = document.createElement("div");
        name.className = "theme-name";
        name.textContent = theme.name;
        const tagline = document.createElement("div");
        tagline.className = "theme-tagline";
        tagline.textContent = theme.tagline;

        if (theme.ambient || theme.rgbFlow) {
            const badge = document.createElement("span");
            badge.className = "theme-badge";
            badge.textContent = theme.rgbFlow ? "RGB" : "Animated";
            name.appendChild(badge);
        }
        card.append(swatches, name, tagline);
        if (theme.configurable || theme.rgbFlow) {
            //small gear in the corner of the card opens the color editor for this theme
            const gear = document.createElement("span");
            gear.className = "theme-gear";
            gear.setAttribute("role", "button");
            gear.tabIndex = 0;
            gear.title = `Edit ${theme.name} colors`;
            gear.setAttribute("aria-label", `Edit ${theme.name} colors`);
            gear.textContent = "\u2699";
            const openEditor = (event) => {
                event.stopPropagation();
                event.preventDefault();
                chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme.id });
                markSelected(theme.id);
                toggleThemeEditor(theme.id);
            };
            //quick on/off switch for the RGB glow, right on the card (strength and speed are in the gear editor); the RGB Flow theme is always on
            const rgb = document.createElement("span");
            rgb.className = "theme-rgb";
            rgb.setAttribute("role", "button");
            rgb.tabIndex = 0;
            rgb.textContent = "RGB";
            rgb.title = "RGB glow: slow rainbow light on borders and page edges. Click to turn on or off.";
            rgb.setAttribute("aria-pressed", String(!!settings.effects.rgb));
            const toggleRgb = (event) => {
                event.stopPropagation();
                event.preventDefault();
                const next = rgb.getAttribute("aria-pressed") !== "true";
                rgb.setAttribute("aria-pressed", String(next));
                setEffects({ rgb: next });
            };
            rgb.addEventListener("click", toggleRgb);
            rgb.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") toggleRgb(event); });
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === "local" && EFFECTS_STORAGE_KEY in changes) rgb.setAttribute("aria-pressed", String(!!changes[EFFECTS_STORAGE_KEY].newValue?.rgb));
            });
            //RGB glow switch removed in 1.0.3
            gear.addEventListener("click", openEditor);
            gear.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openEditor(event); });
            card.appendChild(gear);
        }
        card.addEventListener("click", () => {
            chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme.id });
            markSelected(theme.id);
        });
        grid.appendChild(card);
    });
    markSelected(getTheme(settings.themeId).id);
}
buildThemePicker();

//START PAGE -------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
if (params.get("full") === "1") {
    //popup.html?full=1 is the full-page trade history (opened from the Stats tab)
    document.title = "RoTrade Trade History";
    document.body.classList.add("rv-full");
    document.querySelector(".rv-nav").hidden = true;
    for (const section of document.querySelectorAll(".window")) section.hidden = true;
    const historyApp = document.getElementById("historyApp");
    historyApp.hidden = false;
    mountStats(historyApp, { full: true });
} else {
    const startPage = { settings: 1, ads: 5, tools: 6, stats: 3, themes: 2 }[params.get("tab")];
    if (startPage) document.body.classList.add("rv-wide");
    openPage(startPage ?? 1);
    requestAnimationFrame(() => moveInk(document.querySelector(".rv-tab.rv-active")));
}
