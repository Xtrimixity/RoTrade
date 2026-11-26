/*
Theme engine for RoValk.
Themes are plain data. applyTheme() turns one into a <style> element containing CSS variables plus a few
override rules for the elements RoValk injects into Roblox pages (value text, win/loss boxes, flag box, etc).
The same module is used by the popup and by every content script, so everything stays in sync.
*/

export const THEME_STORAGE_KEY = "RoValk Theme";
export const ACCENT_STORAGE_KEY = "RoValk Custom Accent";
export const EFFECTS_STORAGE_KEY = "RoValk Theme Effects"; //{ rgb: bool, strength: 1-10, period: seconds per full color cycle, flowStrength, flowPeriod }
export const DEFAULT_EFFECTS = { rgb: false, strength: 5, period: 90, flowStrength: 6, flowPeriod: 40 }; //flow* belong to the RGB Flow theme
export const THEME_COLORS_KEY = "RoValk Theme Colors"; //{ [themeId]: { accent, accent2, bg, ... } } colors the user edited for a theme
//The colors that can be edited on a configurable theme (see "configurable" in THEMES): [key, label]
export const COLOR_FIELDS = [
    ["accent", "Accent (buttons, highlights)"], ["accent2", "Accent 2 (petals, links)"], ["bg", "Background"], ["text", "Text"],
    ["surface", "Panels and cards"], ["border", "Borders"], ["value", "Value numbers"], ["good", "Win / good"], ["bad", "Loss / bad"]
];
export const DEFAULT_THEME_ID = "roblox"; //Roblox Default: looks like Roblox itself until the user picks something else
const STYLE_ELEMENT_ID = "rovalk-theme-style";

/*
Fields:
  accent / accent2   primary and secondary brand colors
  bg / text          popup background and text
  surface / border   boxes RoValk draws (win/loss, tax reminder, fairness meter)
  value              color of item values on Roblox pages (null = leave Roblox's own color)
  good / bad         win and loss colors
  font               optional font stack used on RoValk-drawn elements
  override           false = don't restyle boxes on Roblox pages (keeps the stock look)
*/
export const THEMES = [
    {
        id: "roblox", name: "Roblox Default", tagline: "Roblox's own look, dark or light like your Roblox setting",
        accent: "#335FFF", accent2: "#6E8BFF", bg: "#F2F4F5", text: "#393B3D",
        surface: "#FFFFFF", border: "#D0D3D6", value: null, good: "#02B757", bad: "#E0313D", override: true, robloxDefault: true
    },
    {
        id: "rovalk", name: "RoTrade Orange", tagline: "Warm orange, the RoTrade look",
        accent: "#EA580C", accent2: "#FB923C", bg: "#FFFFFF", text: "#333333",
        surface: "rgba(127,127,127,0.18)", border: "rgba(127,127,127,0.35)",
        value: null, good: "#16A34A", bad: "#DC2626", override: false
    },
    {
        id: "cherry-blossom", name: "Cherry Blossom", tagline: "Pink petals drifting on a dusk breeze",
        accent: "#FF8FB1", accent2: "#FFD1DC", bg: "#1B1020", text: "#FFE9F0",
        surface: "#27162E", border: "#5E2E57", value: "#FFB3C9", good: "#9BE8B5", bad: "#FF7A8A", override: true, ambient: "petals", siteWide: true, configurable: true
    }
];

export function getTheme(id) {
    return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
}

//The theme with any colors the user edited for it laid over the top.
export function resolveTheme(id, colors) {
    const base = getTheme(id);
    const edited = colors?.[base.id];
    if (!edited) return base;
    const result = { ...base };
    for (const [key] of COLOR_FIELDS) if (isValidHex(edited[key])) result[key] = edited[key];
    return result;
}

function parseHex(hex) {
    const clean = String(hex).replace("#", "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

function toHex(rgb) {
    return "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}

export function isValidHex(hex) {
    return parseHex(hex) !== null;
}

function mixHex(hexA, hexB, amount) {
    const a = parseHex(hexA);
    const b = parseHex(hexB);
    if (!a || !b) return hexA;
    return toHex(a.map((channel, i) => channel + (b[i] - channel) * amount));
}

function readableOn(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return "#FFFFFF";
    const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.45 ? "#111111" : "#FFFFFF";
}

export function buildThemeCSS(theme, customAccent) {
    const useCustom = customAccent && isValidHex(customAccent);
    const accent = useCustom ? customAccent : theme.accent;
    const accent2 = useCustom ? mixHex(customAccent, "#FFFFFF", 0.35) : theme.accent2;
    const valueColor = theme.value ? (useCustom && theme.override ? accent2 : theme.value) : null;

    // Page-level colors used by the full trade page redesign. The stock theme gets a dark warm-brown page.
    const isOriginal = theme.id === "rovalk";
    const pageBg = isOriginal ? "#1A0F08" : theme.bg;
    const pageText = isOriginal ? "#FFF1E6" : theme.text;
    const cardBorder = isOriginal ? "#5A3214" : theme.border;
    let card = isOriginal ? "#2A1709" : theme.surface;
    if (!isOriginal && card.toLowerCase() === theme.bg.toLowerCase()) card = mixHex(theme.bg, accent, 0.08);

    let css = `:root{
  --rv-page-bg:${pageBg};
  --rv-page-text:${pageText};
  --rv-card:${card};
  --rv-card-border:${cardBorder};
  --rv-accent:${accent};
  --rv-accent-2:${accent2};
  --rv-on-accent:${readableOn(accent)};
  --rv-bg:${theme.bg};
  --rv-text:${theme.text};
  --rv-w-text:${theme.override ? theme.text : "inherit"};
  --rv-surface:${theme.surface};
  --rv-border:${theme.border};
  --rv-good:${theme.good};
  --rv-bad:${theme.bad};
  --rv-font:${theme.font ?? "inherit"};
}
`;

    // RoValk-drawn widgets (always themed through variables). The stock theme inherits Roblox's own text color.
    css += `
#rovalkInvToolbar{background:var(--rv-surface);color:var(--rv-w-text);border:1px solid var(--rv-border);border-radius:8px;font-family:var(--rv-font);box-sizing:border-box;}
.rv-btn{margin-top:8px;background:var(--rv-accent);color:var(--rv-on-accent);border:0;border-radius:6px;padding:5px 12px;font-size:14px;cursor:pointer;font-family:var(--rv-font);}
.rv-btn:hover{filter:brightness(1.12);}

/* ---------- win/loss orb (between the two offers) ---------- */
@keyframes rv-orb-draw{from{stroke-dashoffset:var(--rv-orb-c);}}
@keyframes rv-orb-in{from{opacity:0;transform:scale(.92);}to{opacity:1;transform:none;}}
@keyframes rv-orb-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--rv-v) 0%,transparent);}50%{box-shadow:0 0 22px 4px color-mix(in srgb,var(--rv-v) 45%,transparent);}}
html .trade-offer-divider.rv-orb-host[class]{border:0 !important;background:transparent !important;height:auto !important;min-height:0 !important;padding:0 !important;margin:12px 0 !important;overflow:visible !important;box-shadow:none !important;}
#rovalkOrb{--rv-v:var(--rv-accent);display:flex;align-items:center;width:100%;margin:8px 0;font-family:var(--rv-font);color:var(--rv-w-text);cursor:default;box-sizing:border-box;}
#rovalkOrb *{box-sizing:border-box;}
#rovalkOrb.rv-v-win,#rovalkOrb.rv-v-bigwin{--rv-v:var(--rv-good);}
#rovalkOrb.rv-v-loss,#rovalkOrb.rv-v-bigloss{--rv-v:var(--rv-bad);}
#rovalkOrb .rv-orb-line{flex:1;min-width:10px;height:0;border-top:2px dashed color-mix(in srgb,var(--rv-v) 55%,transparent);}
#rovalkOrb .rv-orb-capsule{display:flex;align-items:center;gap:12px;padding:6px 16px;border-radius:999px;background:var(--rv-surface);border:1px solid color-mix(in srgb,var(--rv-v) 50%,var(--rv-border));box-shadow:0 0 0 4px color-mix(in srgb,var(--rv-v) 10%,transparent),0 10px 28px rgba(0,0,0,.28);backdrop-filter:blur(10px);animation:rv-orb-in .35s ease both;}
#rovalkOrb .rv-orb{position:relative;flex:none;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--rv-v) 24%,transparent),transparent 68%);}
#rovalkOrb.rv-v-bigwin .rv-orb,#rovalkOrb.rv-v-bigloss .rv-orb{animation:rv-orb-pulse 2.6s ease-in-out infinite;}
#rovalkOrb .rv-orb-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible;}
#rovalkOrb .rv-orb-track{fill:none;stroke:color-mix(in srgb,currentColor 14%,transparent);stroke-width:7;}
#rovalkOrb .rv-orb-tick{stroke:currentColor;stroke-opacity:.28;stroke-width:1.6;stroke-linecap:round;}
#rovalkOrb .rv-orb-arc{fill:none;stroke:var(--rv-v);stroke-width:7;stroke-linecap:round;filter:drop-shadow(0 0 4px var(--rv-v));transform-origin:50px 50px;animation:rv-orb-draw 1s cubic-bezier(.2,.8,.2,1) both;}
#rovalkOrb .rv-orb-arc.rv-ccw{transform:scaleY(-1);}
#rovalkOrb .rv-orb-arc.rv-empty{stroke:transparent;filter:none;}
#rovalkOrb .rv-orb-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;}
#rovalkOrb .rv-orb-pct{font-size:19px;font-weight:800;color:var(--rv-v);font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
#rovalkOrb .rv-orb-verdict{margin-top:3px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.75;}
#rovalkOrb .rv-orb-pill{display:flex;flex-direction:column;align-items:center;min-width:118px;padding:2px 4px;}
#rovalkOrb .rv-orb-pill-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;opacity:.6;}
#rovalkOrb .rv-orb-pill-num{display:flex;align-items:center;gap:2px;font-size:21px;font-weight:800;line-height:1.25;font-variant-numeric:tabular-nums;}
#rovalkOrb .rv-up .rv-orb-pill-num{color:var(--rv-good);}
#rovalkOrb .rv-down .rv-orb-pill-num{color:var(--rv-bad);}
#rovalkOrb .rv-flat .rv-orb-pill-num{opacity:.8;}
#rovalkOrb .rv-orb-pill-sub{font-size:11px;opacity:.65;white-space:nowrap;font-variant-numeric:tabular-nums;}
#rovalkOrb{container-type:inline-size;}
#rovalkOrb .rv-orb-pct.rv-long{font-size:14px;}
@container (max-width:600px){#rovalkOrb .rv-orb-pill{min-width:0;}#rovalkOrb .rv-orb-pill-sub{display:none;}#rovalkOrb .rv-orb-capsule{gap:10px;padding:5px 12px;}#rovalkOrb .rv-orb-pill-num{font-size:18px;}}
@container (max-width:400px){#rovalkOrb .rv-orb{width:78px;height:78px;}#rovalkOrb .rv-orb-pct{font-size:15px;}#rovalkOrb .rv-orb-pct.rv-long{font-size:12px;}#rovalkOrb .rv-orb-pill-num{font-size:15px;}#rovalkOrb .rv-orb-capsule{gap:6px;padding:4px 8px;}}

/* ---------- trade breakdown panel ---------- */
#rovalkTradeTools{width:100%;margin:12px 0 6px;background:var(--rv-surface);color:var(--rv-w-text);border:1px solid var(--rv-border);border-radius:14px;font-family:var(--rv-font);box-sizing:border-box;overflow:hidden;cursor:default;clear:both;}
#rovalkTradeTools *{box-sizing:border-box;}
#rovalkTradeTools .rv-panel-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:9px 12px;border-bottom:1px solid var(--rv-border);background:linear-gradient(90deg,color-mix(in srgb,var(--rv-accent) 14%,transparent),transparent 70%);}
#rovalkTradeTools.rv-collapsed .rv-panel-head{border-bottom:0;}
#rovalkTradeTools.rv-collapsed .rv-panel-body{display:none;}
#rovalkTradeTools .rv-panel-title{display:flex;align-items:center;gap:8px;margin-right:auto;font-size:14px;font-weight:700;letter-spacing:.02em;}
#rovalkTradeTools .rv-panel-dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,var(--rv-accent),var(--rv-accent-2));box-shadow:0 0 8px var(--rv-accent);}
#rovalkTradeTools .rv-verdict-chip{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;color:var(--rv-chip);background:color-mix(in srgb,var(--rv-chip) 16%,transparent);border:1px solid color-mix(in srgb,var(--rv-chip) 45%,transparent);font-variant-numeric:tabular-nums;}
#rovalkTradeTools .rv-panel-actions{display:flex;gap:6px;}
#rovalkTradeTools .rv-icon-btn{background:transparent;color:inherit;border:1px solid var(--rv-border);border-radius:8px;padding:3px 11px;font-size:12px;font-weight:600;line-height:1.4;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s;}
#rovalkTradeTools .rv-icon-btn:hover{border-color:var(--rv-accent);background:color-mix(in srgb,var(--rv-accent) 16%,transparent);}
#rovalkTradeTools .rv-panel-body{display:flex;flex-direction:column;gap:14px;padding:12px;}
#rovalkTradeTools .rv-section-title{margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.65;}
#rovalkFairness .rv-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;font-size:15px;font-weight:700;}
#rovalkFairness .rv-meter-detail{opacity:.8;font-weight:600;font-variant-numeric:tabular-nums;}
#rovalkFairness .rv-track{position:relative;height:10px;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--rv-bad) 35%,transparent),color-mix(in srgb,currentColor 12%,transparent) 50%,color-mix(in srgb,var(--rv-good) 35%,transparent));}
#rovalkFairness .rv-fair-zone{position:absolute;top:0;bottom:0;left:45%;width:10%;background:color-mix(in srgb,var(--rv-accent) 35%,transparent);}
#rovalkFairness .rv-fill{position:absolute;top:0;bottom:0;border-radius:999px;opacity:.85;}
#rovalkFairness .rv-mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:currentColor;opacity:.5;}
#rovalkFairness .rv-knob{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--rv-knob);border:3px solid var(--rv-card);box-shadow:0 0 0 1px var(--rv-knob),0 0 12px var(--rv-knob);}
#rovalkFairness .rv-scale{display:flex;justify-content:space-between;margin-top:7px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.55;}
#rovalkTradeTools .rv-compare{display:grid;grid-template-columns:minmax(84px,1.2fr) repeat(3,minmax(0,1fr));border:1px solid var(--rv-border);border-radius:10px;overflow:hidden;font-size:13px;font-variant-numeric:tabular-nums;}
#rovalkTradeTools .rv-compare-row{display:contents;}
#rovalkTradeTools .rv-compare-row > span{padding:6px 10px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid color-mix(in srgb,var(--rv-border) 70%,transparent);}
#rovalkTradeTools .rv-compare-row > span:first-child{text-align:left;}
#rovalkTradeTools .rv-compare-head > span{border-top:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.75;background:color-mix(in srgb,var(--rv-accent) 12%,transparent);}
#rovalkTradeTools .rv-compare-row:not(.rv-compare-head):hover > span{background:color-mix(in srgb,var(--rv-accent) 7%,transparent);}
#rovalkTradeTools .rv-compare-label{font-weight:600;opacity:.85;}
#rovalkTradeTools .rv-diff{font-weight:700;}
#rovalkTradeTools .rv-pos{color:var(--rv-good);}
#rovalkTradeTools .rv-neg{color:var(--rv-bad);}
#rovalkTradeTools .rv-share-row{display:flex;align-items:center;gap:10px;margin-top:6px;}
#rovalkTradeTools .rv-share-label{flex:none;width:58px;font-size:12px;font-weight:600;opacity:.85;}
#rovalkTradeTools .rv-share-bar{flex:1;display:flex;gap:2px;height:22px;border-radius:7px;overflow:hidden;background:color-mix(in srgb,currentColor 10%,transparent);}
#rovalkTradeTools .rv-share-seg{flex-basis:0;min-width:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#111;transition:filter .15s;}
#rovalkTradeTools .rv-share-seg:hover{filter:brightness(1.15) saturate(1.1);}
#rovalkTradeTools .rv-share-legend{display:flex;flex-wrap:wrap;gap:3px 12px;margin:4px 0 2px 68px;font-size:11px;opacity:.85;}
#rovalkTradeTools .rv-share-legend span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;}
#rovalkTradeTools .rv-share-legend i{flex:none;width:8px;height:8px;border-radius:2px;background:var(--rv-sw);}
#rovalkTradeTools .rv-share-empty{padding:0 8px;font-size:11px;line-height:22px;opacity:.6;}
#rovalkTradeTools .rv-alerts{display:flex;flex-wrap:wrap;gap:6px;}
#rovalkTradeTools .rv-alert{--rv-tone:var(--rv-accent-2);display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.35;border:1px solid color-mix(in srgb,var(--rv-tone) 60%,transparent);background:color-mix(in srgb,var(--rv-tone) 13%,transparent);}
#rovalkTradeTools .rv-alert::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:var(--rv-tone);box-shadow:0 0 6px var(--rv-tone);}
#rovalkTradeTools .rv-alert.rv-bad{--rv-tone:var(--rv-bad);}
#rovalkTradeTools .rv-alert.rv-warn{--rv-tone:#F59E0B;}
#rovalkTradeTools .rv-alert.rv-good{--rv-tone:var(--rv-good);}
#rovalkOverpay{padding:8px 12px;font-size:13px;line-height:1.45;border-radius:10px;background:color-mix(in srgb,var(--rv-accent) 9%,transparent);border:1px dashed color-mix(in srgb,var(--rv-accent) 50%,transparent);}
#rovalkOverpay b{font-weight:800;box-shadow:inset 0 -2px 0 color-mix(in srgb,var(--rv-accent) 75%,transparent);}
#rovalkOverpay.rv-fair b{box-shadow:inset 0 -2px 0 var(--rv-good);}
@media (prefers-reduced-motion:reduce){#rovalkOrb *,#rovalkOrb .rv-orb-capsule{animation:none !important;}}
#rovalkInvToolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 10px;margin:8px 0;font-size:13px;}
#rovalkInvToolbar select{background:var(--rv-surface);color:inherit;border:1px solid var(--rv-border);border-radius:6px;padding:3px 6px;font-size:13px;}
#rovalkInvToolbar .rv-chip{background:transparent;color:inherit;border:1px solid var(--rv-border);border-radius:999px;padding:2px 10px;font-size:12px;cursor:pointer;font-family:inherit;}
#rovalkInvToolbar .rv-chip[aria-pressed="true"]{background:var(--rv-accent);color:var(--rv-on-accent);border-color:var(--rv-accent);}
.rv-stat{display:flex;flex-direction:column;min-width:78px;}
.rv-stat .rv-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.65;}
.rv-stat .rv-stat-value{font-size:18px;font-weight:700;color:var(--rv-accent);}
.rv-stat .rv-stat-sub{font-size:11px;opacity:.65;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* profile banner and inventory summary: one card, totals in a row split by thin lines, top item with its picture */
#rovalkProfileBanner,#rovalkInventorySummary{margin:12px 0;padding:12px 16px 14px;border-radius:14px;background:var(--rv-surface);color:var(--rv-w-text);border:1px solid var(--rv-border);font-family:var(--rv-font);box-sizing:border-box;cursor:default;font-size:13px;}
.rv-pb-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.rv-pb-brand{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--rv-accent);}
.rv-pb-link{font-size:12px;font-weight:700;color:var(--rv-accent-2) !important;opacity:.9;text-decoration:none !important;}
.rv-pb-link:hover{opacity:1;text-decoration:underline !important;}
.rv-pb-row{display:flex;flex-wrap:wrap;align-items:stretch;gap:10px 0;}
.rv-pb-stat,.rv-pb-top{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 18px;min-width:0;border-left:1px solid color-mix(in srgb,var(--rv-border) 85%,transparent);}
.rv-pb-row > :first-child{padding-left:0;border-left:0;}
.rv-pb-label{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.6;white-space:nowrap;}
.rv-pb-value{font-size:20px;font-weight:800;line-height:1.15;font-variant-numeric:tabular-nums;}
.rv-pb-accent{color:var(--rv-accent);}
.rv-pb-sub{font-size:11.5px;opacity:.6;white-space:nowrap;}
.rv-pb-top{flex-direction:row;align-items:center;gap:10px;margin-left:auto;border-left:1px solid color-mix(in srgb,var(--rv-border) 85%,transparent);}
.rv-pb-pic{width:44px;height:44px;flex:none;border-radius:10px;overflow:hidden;background:color-mix(in srgb,var(--rv-accent) 14%,transparent);}
.rv-pb-pic img{width:100%;height:100%;object-fit:cover;display:block;}
.rv-pb-toptext{display:flex;flex-direction:column;gap:1px;min-width:0;}
.rv-pb-topname{font-size:14px;font-weight:800;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
`;

    if (theme.override || useCustom) {
        css += `
.valueSpan{${valueColor ? `color:${valueColor} !important;` : ""}${theme.font ? `font-family:${theme.font} !important;` : ""}}
.icon-rolimons{filter:drop-shadow(0 0 2px var(--rv-accent));}
`;
    }

    if (theme.override) {
        css += `
`;
    }

    if (theme.robloxDefault) {
        //Roblox's own palette in both modes; html[data-rv-roblox-mode] is set from Roblox's page (see trackRobloxMode)
        css += `
html[data-rv-roblox-mode="dark"]{--rv-page-bg:#191B1D;--rv-page-text:#F7F7F8;--rv-card:#232527;--rv-card-border:#393B3D;--rv-bg:#191B1D;--rv-text:#F7F7F8;--rv-w-text:#F7F7F8;--rv-surface:#232527;--rv-border:#393B3D;}
html[data-rv-roblox-mode="light"]{--rv-page-bg:#F2F4F5;--rv-page-text:#393B3D;--rv-card:#FFFFFF;--rv-card-border:#D0D3D6;--rv-bg:#F2F4F5;--rv-text:#393B3D;--rv-w-text:#393B3D;--rv-surface:#FFFFFF;--rv-border:#D0D3D6;}
`;
    }
    return css;
}

export function applyTheme(themeId, customAccent, colors, effects) {
    const theme = resolveTheme(themeId, colors);
    //an accent edited for this specific theme wins over the global custom accent
    if (colors?.[theme.id]?.accent && isValidHex(colors[theme.id].accent)) customAccent = null;
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = buildThemeCSS(theme, customAccent);
    //the animated layer watches this to restart when colors are edited
    document.documentElement.setAttribute("data-rv-colors", `${customAccent && isValidHex(customAccent) ? customAccent : theme.accent}|${theme.accent2}`);
    const root = document.documentElement;
    //RGB effects were removed in 1.0.3: clear anything an older version left on the page
    root.removeAttribute("data-rv-rgb");
    for (const name of ["--rv-rgb-alpha", "--rv-rgb-period", "--rv-rgb-steps"]) root.style.removeProperty(name);
    root.setAttribute("data-rv-theme", theme.id);
    return theme;
}

export function loadThemeSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get([THEME_STORAGE_KEY, ACCENT_STORAGE_KEY, THEME_COLORS_KEY, EFFECTS_STORAGE_KEY], (result) => {
            resolve({
                themeId: result?.[THEME_STORAGE_KEY] ?? DEFAULT_THEME_ID,
                customAccent: result?.[ACCENT_STORAGE_KEY] ?? null,
                colors: result?.[THEME_COLORS_KEY] ?? {},
                effects: { ...DEFAULT_EFFECTS, ...(result?.[EFFECTS_STORAGE_KEY] ?? {}) }
            });
        });
    });
}

/*
Call once from the popup or a content script. Applies the saved theme right away and keeps it
updated whenever the user picks a different one.
*/
/*
Remembers whether Roblox is in dark or light mode (Roblox puts light-theme or dark-theme on #rbx-body) and mirrors it on
<html data-rv-roblox-mode>, which the Roblox Default theme uses. Outside Roblox (the popup) the last mode seen is used,
or the system setting if Roblox hasn't been opened yet.
*/
const ROBLOX_MODE_KEY = "RoTrade Roblox Mode";
function trackRobloxMode() {
    const root = document.documentElement;
    const setMode = (mode) => root.setAttribute("data-rv-roblox-mode", mode);
    if (!/(^|\.)roblox\.com$/.test(location.hostname)) {
        chrome.storage.local.get([ROBLOX_MODE_KEY], (result) => {
            setMode(result?.[ROBLOX_MODE_KEY] ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
        });
        return;
    }
    const read = () => {
        const body = document.getElementById("rbx-body");
        if (!body) return false;
        const mode = body.classList.contains("light-theme") ? "light" : "dark";
        if (root.getAttribute("data-rv-roblox-mode") !== mode) {
            setMode(mode);
            chrome.storage.local.get([ROBLOX_MODE_KEY], (result) => {
                if (result?.[ROBLOX_MODE_KEY] !== mode) chrome.storage.local.set({ [ROBLOX_MODE_KEY]: mode });
            });
        }
        return true;
    };
    if (!read()) {
        const waitForBody = new MutationObserver(() => { if (read()) waitForBody.disconnect(); });
        waitForBody.observe(root, { childList: true, subtree: true });
    }
    //Roblox can switch modes from its settings page without a reload
    const watch = () => {
        const body = document.getElementById("rbx-body");
        if (body) new MutationObserver(read).observe(body, { attributes: true, attributeFilter: ["class"] });
        else setTimeout(watch, 500);
    };
    watch();
}

export async function initTheme() {
    trackRobloxMode();
    const { themeId, customAccent, colors, effects } = await loadThemeSettings();
    applyTheme(themeId, customAccent, colors, effects);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (!(THEME_STORAGE_KEY in changes) && !(ACCENT_STORAGE_KEY in changes) && !(THEME_COLORS_KEY in changes) && !(EFFECTS_STORAGE_KEY in changes)) return;
        loadThemeSettings().then((settings) => applyTheme(settings.themeId, settings.customAccent, settings.colors, settings.effects));
    });
}
