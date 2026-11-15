/*
Value tier borders: a colored ring on item cards by value (grey under 5k, then green, blue, purple and gold).
It is a switch (an html attribute) so the CSS below only applies while the option is on.
Used by the popup and by every content script.
*/

const STYLE_ELEMENT_ID = "rovalk-effects-style";
const OPTION_TIERS = "Value Tier Borders";

const css = `
/* ---------- value tier borders (item cards) ---------- */
html[data-rv-tiers="on"] .item-card-container[data-rv-tier="t1"]{box-shadow:0 0 0 2px #9CA3AF !important;}
html[data-rv-tiers="on"] .item-card-container[data-rv-tier="t2"]{box-shadow:0 0 0 2px #34D399 !important;}
html[data-rv-tiers="on"] .item-card-container[data-rv-tier="t3"]{box-shadow:0 0 0 2px #38BDF8 !important;}
html[data-rv-tiers="on"] .item-card-container[data-rv-tier="t4"]{box-shadow:0 0 0 2px #A78BFA,0 0 10px #A78BFA88 !important;}
html[data-rv-tiers="on"] .item-card-container[data-rv-tier="t5"]{box-shadow:0 0 0 2px #FBBF24,0 0 14px #FBBF24AA !important;}
html[data-rv-tiers="on"] .item-card-container[data-rv-tier]{border-radius:8px;}

`;

function ensureStyle() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
}

function applyFlags(values) {
    const root = document.documentElement;
    root.setAttribute("data-rv-tiers", values[OPTION_TIERS] === false ? "off" : "on");
}

export function initPageEffects() {
    ensureStyle();
    const keys = [OPTION_TIERS];
    chrome.storage.local.get(keys, applyFlags);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !keys.some((key) => key in changes)) return;
        chrome.storage.local.get(keys, applyFlags);
    });
}
