/*
Full trade page redesign.
When the "Trade Page Redesign" option is on, this restyles the whole Roblox trades page (background, panels, trade list,
item cards, buttons, tabs, modals, scrollbars) using the active theme's colors from themes.js.
Everything is scoped under html[data-rv-trade="on"], so turning the option off removes the look instantly.

Roblox owns the page markup and changes it now and then. If a part of the page looks wrong after a Roblox update,
this file is the only place that needs to change: the selectors are grouped by area below.
*/

export const REDESIGN_OPTION = "Trade Page Redesign";
export const STYLE_STORAGE_KEY = "RoValk Trade Style";
export const DEFAULT_STYLE = "glass";
export const TRADE_STYLES = [
    { id: "glass", name: "Glass", tagline: "Frosted panels over a soft glow" },
    { id: "soft", name: "Soft", tagline: "Rounded, solid, easy on the eyes" },
    { id: "sharp", name: "Sharp", tagline: "Flat, squared-off, high contrast" }
];

const STYLE_ELEMENT_ID = "rovalk-trade-redesign-style";
const T = 'html[data-rv-trade="on"]';

function buildRedesignCSS() {
    return `
/* ---------- style variants ---------- */
html[data-rv-style="glass"]{--rv-radius:16px;--rv-blur:14px;--rv-panel:color-mix(in srgb,var(--rv-card) 70%,transparent);--rv-shadow:0 8px 30px rgba(0,0,0,.28);--rv-border-w:1px;--rv-caps:none;}
html[data-rv-style="soft"]{--rv-radius:22px;--rv-blur:0px;--rv-panel:var(--rv-card);--rv-shadow:0 6px 18px rgba(0,0,0,.16);--rv-border-w:1px;--rv-caps:none;}
html[data-rv-style="sharp"]{--rv-radius:3px;--rv-blur:0px;--rv-panel:var(--rv-card);--rv-shadow:none;--rv-border-w:2px;--rv-caps:uppercase;}

/* ---------- page background ---------- */
${T} body,${T} #rbx-body,${T} .content,${T} #content{background:transparent !important;color:var(--rv-page-text) !important;}
${T}{background-color:var(--rv-page-bg);}
${T} body{
  background:
    radial-gradient(900px 500px at 12% -8%,color-mix(in srgb,var(--rv-accent) 30%,transparent),transparent 70%),
    radial-gradient(800px 480px at 95% 8%,color-mix(in srgb,var(--rv-accent-2) 22%,transparent),transparent 70%),
    var(--rv-page-bg) !important;
  background-attachment:fixed !important;
}
${T} .container-main,${T} .container-main > .content{background:transparent !important;box-shadow:none !important;border:0 !important;}

/* ---------- top navigation (light touch) ---------- */
${T} .rbx-header,${T} #header,${T} .navbar-fixed-top,${T} .rbx-left-col,${T} #navigation{background:color-mix(in srgb,var(--rv-card) 82%,transparent) !important;backdrop-filter:blur(var(--rv-blur));border-color:var(--rv-card-border) !important;color:var(--rv-page-text) !important;}
${T} .rbx-header a,${T} #navigation a,${T} .rbx-left-col a{color:var(--rv-page-text) !important;}

/* ---------- main panels ---------- */
/* Everything below uses border-box sizing so borders and padding never make a box wider than the space Roblox gave it. */
${T} .trades-container,${T} .trades-list,${T} .trades-list-detail,${T} .trade-list-detail,${T} .trade-request-window,${T} .trades-header,
${T} .trade-list-detail-offer,${T} .trade-request-window-offer,${T} .trade-inventory-panel,${T} .inventory-panel-holder,
${T} .item-card-container,${T} .trade-request-item{box-sizing:border-box !important;max-width:100%;min-width:0;}
${T} .trades-container,${T} .trade-request-window,${T} .trades-header{
  background:var(--rv-panel) !important;
  color:var(--rv-page-text) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:var(--rv-radius) !important;
  box-shadow:var(--rv-shadow) !important;
  backdrop-filter:blur(var(--rv-blur));
}
${T} .trades-container{padding:10px !important;}
/* inner panels share the outer frame instead of drawing their own, which used to shrink the room for items */
${T} .trades-list,${T} .trades-list-detail,${T} .trade-list-detail{background:transparent !important;color:var(--rv-page-text) !important;border:0 !important;box-shadow:none !important;padding:0 !important;margin-bottom:10px;}
${T} .trades-container .trades-container,${T} .trades-container .trade-request-window{box-shadow:none !important;backdrop-filter:none;}

/* headings and text */
${T} .trades-container h1,${T} .trades-container h2,${T} .trades-container h3,${T} .trades-container h4,
${T} .font-header-1,${T} .font-header-2,${T} .text-title{color:var(--rv-page-text) !important;text-transform:var(--rv-caps);letter-spacing:.01em;}
${T} .trades-container .text-label,${T} .trades-container .text-lead,${T} .trades-container .text-secondary,
${T} .trades-container .text-description,${T} .trades-container label,${T} .trades-container p,${T} .trades-container span{color:inherit;}
${T} .trades-container .text-secondary,${T} .trades-container .text-description{opacity:.72;}
${T} .trades-container a,${T} .text-link{color:var(--rv-accent-2) !important;}
${T} .trades-container a:hover{filter:brightness(1.15);text-decoration:none;}

/* ---------- tabs and dropdowns ---------- */
${T} .rbx-tabs-horizontal .rbx-tab-heading,${T} .nav-tabs > li > a,${T} .rbx-tab{background:transparent !important;color:var(--rv-page-text) !important;border:0 !important;opacity:.78;transition:opacity .15s,box-shadow .15s;}
${T} .rbx-tabs-horizontal .rbx-tab.active .rbx-tab-heading,${T} .nav-tabs > li.active > a,${T} .rbx-tab.active{opacity:1;box-shadow:inset 0 -3px 0 var(--rv-accent);}
${T} .dropdown-menu,${T} .select-group,${T} .input-dropdown-btn{background:var(--rv-card) !important;color:var(--rv-page-text) !important;border:var(--rv-border-w) solid var(--rv-card-border) !important;border-radius:calc(var(--rv-radius) * .6) !important;}
${T} .dropdown-menu > li > a{color:var(--rv-page-text) !important;}
${T} .dropdown-menu > li > a:hover{background:color-mix(in srgb,var(--rv-accent) 25%,transparent) !important;}

/* ---------- trade list (left side) ---------- */
${T} .trade-row,${T} .trades-list .list-item,${T} .trade-list-item{
  background:transparent !important;
  border:var(--rv-border-w) solid transparent !important;
  border-radius:calc(var(--rv-radius) * .7) !important;
  margin:4px 0;transition:background .15s,border-color .15s,transform .15s;
}
${T} .trade-row:hover,${T} .trades-list .list-item:hover{background:color-mix(in srgb,var(--rv-accent) 14%,transparent) !important;border-color:var(--rv-card-border) !important;transform:translateX(2px);}
${T} .trade-row.selected,${T} .trade-row.active,${T} .trades-list .list-item.selected,${T} .trades-list .list-item.active{background:color-mix(in srgb,var(--rv-accent) 24%,transparent) !important;border-color:var(--rv-accent) !important;box-shadow:inset 3px 0 0 var(--rv-accent);}
${T} .trade-row .avatar-card-image,${T} .trade-row .avatar-headshot-md,${T} .trade-row img{border-radius:50%;}
${T} .trade-row .text-label,${T} .trade-row .trade-row-date{opacity:.9;}

/* ---------- trade detail and offers ---------- */
${T} .trade-list-detail-offer,${T} .trade-request-window-offer,${T} .trade-inventory-panel,${T} .inventory-panel-holder{
  background:color-mix(in srgb,var(--rv-card) 60%,transparent) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:var(--rv-radius) !important;
  padding:8px !important;
  margin-bottom:10px;
  overflow:visible;
}
/* the total rows (Robux, RAP and the added Rolimons value) grow the box instead of spilling past its bottom border */
${T} .trade-list-detail-offer,${T} .trade-request-window-offer{height:auto !important;min-height:0 !important;display:flow-root;overflow:visible;}
${T} .trade-list-detail-offer .robux-line,${T} .trade-request-window-offer .robux-line{height:auto !important;min-height:0 !important;overflow:visible;display:flex !important;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:2px 12px;margin:0 !important;padding:3px 0 !important;}
${T} .robux-line-amount{height:auto !important;min-height:0 !important;overflow:visible !important;text-align:right;line-height:1.35;}
/* item rows wrap inside the offer box instead of running past its edge */
${T} .trade-list-detail-offer .hlist,${T} .trade-request-window-offer .hlist{display:flex !important;flex-wrap:wrap;gap:5px;margin:0 !important;padding:0 !important;width:100%;max-width:100%;}
${T} .trade-list-detail-offer .hlist > li,${T} .trade-request-window-offer .hlist > li{float:none !important;margin:0 !important;padding:0 !important;width:auto !important;min-width:0;flex:0 1 auto;max-width:100%;}
${T} .trade-list-detail-offer + .trade-list-detail-offer,${T} .trade-request-window-offer + .trade-request-window-offer{margin-top:12px;}
${T} .trade-offer-divider{border-top:2px dashed color-mix(in srgb,var(--rv-accent) 55%,transparent) !important;margin:14px 0 !important;}
${T} .trade-list-detail-offer .robux-line,${T} .trade-request-window-offer .robux-line,${T} .robux-line{
  border-top:var(--rv-border-w) solid var(--rv-card-border) !important;padding-top:8px;
}
${T} .text-robux,${T} .text-robux-lg{color:var(--rv-accent-2) !important;}
/* give / get sides get a colored edge so the two halves read apart at a glance (tradeTools.js marks them) */
${T} [data-rv-side="give"]{border-left:4px solid color-mix(in srgb,var(--rv-bad) 75%,transparent) !important;}
${T} [data-rv-side="get"]{border-left:4px solid color-mix(in srgb,var(--rv-good) 75%,transparent) !important;}
/* total rows become a soft footer bar instead of a bare line */
${T} .trade-list-detail-offer .robux-line,${T} .trade-request-window-offer .robux-line{
  margin-top:8px !important;padding:6px 10px !important;border-top:0 !important;
  background:color-mix(in srgb,var(--rv-accent) 9%,transparent) !important;
  border-radius:calc(var(--rv-radius) * .5) !important;
}
${T} .robux-line .text-label,${T} .robux-line-label{font-weight:700;letter-spacing:.02em;}
${T} .valueSpan{font-weight:700;}

/* ---------- item cards ---------- */
${T} .item-card-container{
  background:color-mix(in srgb,var(--rv-card) 85%,transparent) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:calc(var(--rv-radius) * .75) !important;
  padding:3px !important;
  overflow:visible;
  transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;
}
${T} .item-card-thumb-container{max-width:100%;}
${T} .item-card-thumb-container img{max-width:100%;height:auto;}
${T} .item-card-container:hover{transform:translateY(-3px);border-color:var(--rv-accent) !important;box-shadow:0 8px 20px color-mix(in srgb,var(--rv-accent) 35%,transparent);}
${T} .item-card-thumb-container,${T} .item-card-thumb-container img,${T} .item-card-thumb-container .thumbnail-2d-container{border-radius:calc(var(--rv-radius) * .6) !important;background:color-mix(in srgb,var(--rv-page-bg) 50%,transparent) !important;}
${T} .item-card-name,${T} .item-card-caption{color:var(--rv-page-text) !important;}
${T} .item-card-price,${T} .item-card-price .text-label{color:var(--rv-page-text) !important;}
${T} .trade-request-item{background:color-mix(in srgb,var(--rv-card) 85%,transparent) !important;border:var(--rv-border-w) solid var(--rv-card-border) !important;border-radius:calc(var(--rv-radius) * .75) !important;color:var(--rv-page-text) !important;}
${T} .item-selected,${T} .item-card-container.selected{border-color:var(--rv-accent) !important;box-shadow:0 0 0 2px var(--rv-accent);}

/* ---------- buttons ---------- */
${T} .btn-primary-md,${T} .btn-primary-lg,${T} .btn-primary-sm,${T} .btn-cta-md,${T} .btn-secondary-md.btn-primary{
  background:linear-gradient(135deg,var(--rv-accent),var(--rv-accent-2)) !important;
  color:var(--rv-on-accent) !important;border:0 !important;
  border-radius:calc(var(--rv-radius) * .6) !important;text-transform:var(--rv-caps);font-weight:700;
  transition:filter .15s,transform .15s,box-shadow .15s;
}
${T} .btn-primary-md:hover,${T} .btn-primary-lg:hover,${T} .btn-cta-md:hover{filter:brightness(1.12);transform:translateY(-1px);box-shadow:0 6px 16px color-mix(in srgb,var(--rv-accent) 45%,transparent);}
${T} .btn-secondary-md,${T} .btn-secondary-lg,${T} .btn-control-md,${T} .btn-control-sm,${T} .btn-secondary-sm{
  background:transparent !important;color:var(--rv-page-text) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:calc(var(--rv-radius) * .6) !important;text-transform:var(--rv-caps);
  transition:border-color .15s,background .15s;
}
${T} .btn-secondary-md:hover,${T} .btn-control-md:hover,${T} .btn-secondary-lg:hover{border-color:var(--rv-accent) !important;background:color-mix(in srgb,var(--rv-accent) 16%,transparent) !important;}
${T} .btn-alert-md,${T} .btn-negative-md,${T} .btn-alert-lg{background:transparent !important;color:var(--rv-bad) !important;border:var(--rv-border-w) solid var(--rv-bad) !important;border-radius:calc(var(--rv-radius) * .6) !important;}
${T} .btn-alert-md:hover,${T} .btn-negative-md:hover{background:color-mix(in srgb,var(--rv-bad) 18%,transparent) !important;}
${T} .btn-primary-md:disabled,${T} .btn-primary-md.disabled,${T} .btn-secondary-md:disabled{opacity:.45;filter:grayscale(.4);transform:none;box-shadow:none;}
${T} .trade-buttons{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}

/* ---------- inputs ---------- */
${T} input[type="text"],${T} input[type="number"],${T} input[type="search"],${T} textarea,${T} .form-control,${T} .input-field{
  background:color-mix(in srgb,var(--rv-page-bg) 55%,var(--rv-card)) !important;
  color:var(--rv-page-text) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:calc(var(--rv-radius) * .6) !important;
}
${T} input:focus,${T} textarea:focus,${T} .form-control:focus{border-color:var(--rv-accent) !important;box-shadow:0 0 0 3px color-mix(in srgb,var(--rv-accent) 30%,transparent) !important;outline:0;}
${T} ::placeholder{color:var(--rv-page-text);opacity:.5;}

/* ---------- modals ---------- */
${T} .modal-backdrop{background:#000 !important;}
${T} .modal-content,${T} .modal-dialog .modal-content{background:var(--rv-card) !important;color:var(--rv-page-text) !important;border:var(--rv-border-w) solid var(--rv-card-border) !important;border-radius:var(--rv-radius) !important;box-shadow:0 20px 60px rgba(0,0,0,.5) !important;}
${T} .modal-header,${T} .modal-footer{border-color:var(--rv-card-border) !important;}
${T} .modal-title,${T} .modal-body{color:var(--rv-page-text) !important;}

/* ---------- RoValk widgets match the redesign ---------- */
${T} #rovalkTradeTools,${T} #rovalkInvToolbar{
  background:color-mix(in srgb,var(--rv-card) 90%,transparent) !important;
  color:var(--rv-page-text) !important;
  border:var(--rv-border-w) solid var(--rv-card-border) !important;
  border-radius:calc(var(--rv-radius) * .7) !important;
}
${T} #rovalkOrb .rv-orb-capsule{background:color-mix(in srgb,var(--rv-card) 92%,transparent);color:var(--rv-page-text);}
${T} #rovalkInvToolbar select{background:var(--rv-card) !important;color:var(--rv-page-text) !important;}

/* ---------- scrollbars and details ---------- */
${T} *{scrollbar-width:thin;scrollbar-color:var(--rv-accent) transparent;}
${T} *::-webkit-scrollbar{width:10px;height:10px;}
${T} *::-webkit-scrollbar-thumb{background:var(--rv-accent);border-radius:10px;border:2px solid transparent;background-clip:content-box;}
${T} *::-webkit-scrollbar-track{background:transparent;}
${T} hr,${T} .rbx-divider{border-color:var(--rv-card-border) !important;}
${T} ::selection{background:var(--rv-accent);color:var(--rv-on-accent);}

@media (prefers-reduced-motion:reduce){
  ${T} *{transition:none !important;animation:none !important;}
}
`;
}

function readSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get([REDESIGN_OPTION, STYLE_STORAGE_KEY, "RoValk Theme"], (result) => {
            resolve({
                //the Roblox Default theme keeps Roblox's own trade page
                enabled: result?.[REDESIGN_OPTION] !== false && result?.["RoValk Theme"] !== "roblox",
                style: DEFAULT_STYLE //the style picker was removed in 3.14.0; everyone gets the Glass look
            });
        });
    });
}

function apply({ enabled, style }) {
    const root = document.documentElement;
    let styleElement = document.getElementById(STYLE_ELEMENT_ID);
    if (!enabled) {
        root.removeAttribute("data-rv-trade");
        root.removeAttribute("data-rv-style");
        styleElement?.remove();
        return;
    }
    if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = STYLE_ELEMENT_ID;
        styleElement.textContent = buildRedesignCSS();
        (document.head || root).appendChild(styleElement);
    }
    root.setAttribute("data-rv-trade", "on");
    root.setAttribute("data-rv-style", style);
}

/*
Call once from the trade content script (after initTheme, which provides the color variables).
Applies the redesign and keeps it in sync with the popup.
*/
export async function initTradeRedesign() {
    apply(await readSettings());
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (!(REDESIGN_OPTION in changes) && !(STYLE_STORAGE_KEY in changes) && !("RoValk Theme" in changes)) return;
        readSettings().then(apply);
    });
}
