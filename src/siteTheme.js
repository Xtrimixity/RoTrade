/*
Site-wide theming: while a theme marked "siteWide" (Cherry Blossom) is selected, its colors are painted over the whole
Roblox website, not only the pages RoValk adds features to. Everything is scoped to html[data-rv-site="on"], so turning
the option off (or picking another theme) removes the look immediately.
Roblox changes its page markup from time to time; these rules cover the long-standing class names, and anything they
miss simply keeps Roblox's normal look.
*/
import { getTheme } from "./themes";

export const SITE_OPTION = "Site-Wide Theme";
const STYLE_ID = "rovalk-site-style";
const S = 'html[data-rv-site="on"]';

const css = `
${S}{color-scheme:dark;background:var(--rv-page-bg) !important;}
${S} body,${S} #wrap,${S} .wrap,${S} .container-main,${S} .content,${S} #content,${S} .rbx-body,${S} .dark-theme,${S} .light-theme{background-color:var(--rv-page-bg) !important;color:var(--rv-page-text) !important;}

/* top bar and left menu */
${S} #header,${S} .rbx-header,${S} .navbar-fixed-top,${S} .navbar-default,${S} .rbx-navbar,${S} .rbx-left-col,${S} #navigation,${S} .rbx-upgrade-now,${S} .notification-stream-popover,${S} .dropdown-menu,${S} .popover,${S} .popover-content,${S} .modal-content,${S} .modal-dialog .modal-content{background:var(--rv-surface) !important;color:var(--rv-page-text) !important;border-color:var(--rv-border) !important;}
${S} #header,${S} .rbx-header{border-bottom:1px solid var(--rv-border) !important;box-shadow:0 2px 14px color-mix(in srgb,var(--rv-accent) 18%,transparent) !important;}
${S} .rbx-left-col{border-right:1px solid var(--rv-border) !important;}
${S} .navbar-search .form-control,${S} #navbar-universal-search input{background:var(--rv-page-bg) !important;color:var(--rv-page-text) !important;border:1px solid var(--rv-border) !important;}
${S} .rbx-menu-item,${S} .nav-menu-title,${S} .menu-option-content,${S} .font-header-2,${S} .rbx-menu-item .font-header-2{color:var(--rv-page-text) !important;}
${S} .rbx-menu-item:hover,${S} .rbx-menu-item.active,${S} .menu-option:hover,${S} .dropdown-menu li:hover,${S} .dropdown-menu li.active{background:color-mix(in srgb,var(--rv-accent) 22%,transparent) !important;}
${S} #header [class*="icon-nav"],${S} .rbx-left-col [class*="icon-nav"],${S} .rbx-header [class*="icon-nav"]{filter:invert(.85) sepia(.4) saturate(2.4) hue-rotate(300deg);}

/* sections, cards and tiles */
${S} .section,${S} .section-content,${S} .section-content-off,${S} .container-header,${S} .rbx-tabs-horizontal,${S} .tab-content,${S} .card,${S} .game-card-container,${S} .game-card-info,${S} .game-card-link,${S} .list-item,${S} .rbx-tab-content,${S} .profile-container,${S} .profile-about-content,${S} .shopping-cart,${S} .asset-details,${S} .item-details,${S} .item-card-caption,${S} .catalog-item-container,${S} .thumbnail-2d-container,${S} .game-container,${S} .shelf-container,${S} .tab-pane,${S} .chat-main,${S} .friend-tile-dropdown{background-color:color-mix(in srgb,var(--rv-card) 92%,transparent) !important;color:var(--rv-page-text) !important;border-color:var(--rv-card-border) !important;}
${S} .section-content,${S} .game-card-container,${S} .card{border:1px solid var(--rv-card-border) !important;border-radius:10px !important;}
/* game tiles keep the same clear accent ring all the time (it used to appear only on hover); hovering just lifts them */
${S} :is(.game-card-container,.game-tile):not(:has(.game-card-container,.game-tile)){border:0 !important;padding:4px 4px 7px !important;overflow:hidden !important;border-radius:12px !important;box-shadow:0 0 0 2px var(--rv-accent),0 6px 20px color-mix(in srgb,var(--rv-accent) 22%,transparent) !important;transition:transform .15s ease,box-shadow .15s ease !important;}
${S} :is(.game-card-container,.game-tile):not(:has(.game-card-container,.game-tile)) :is(.game-card-thumb-container,.thumbnail-2d-container,img){border-radius:9px !important;}
${S} :is(.game-card-container,.game-tile):not(:has(.game-card-container,.game-tile)) :is(.game-card-info,.game-card-name){padding-left:4px !important;padding-right:4px !important;}
${S} :is(.game-card-container,.game-tile):not(:has(.game-card-container,.game-tile)):hover{transform:translateY(-2px);box-shadow:0 0 0 2px var(--rv-accent),0 10px 26px color-mix(in srgb,var(--rv-accent) 40%,transparent) !important;}
${S} :is(.game-card-container,.game-tile):has(.game-card-container,.game-tile),${S} [data-rv-tile-wrap][data-rv-tile-wrap]{background:transparent !important;border:0 !important;box-shadow:none !important;outline:0 !important;transform:none !important;}
${S} .list-item:hover > .game-card-link{box-shadow:none !important;}
/* only the tile itself is a card: the list item around it and the link / info inside it stay see-through, otherwise the
   wrapper (a little wider than the tile) showed up as a second, offset frame behind every game */
${S} .list-item:has(.game-card-container),${S} li.game-card,${S} .game-card,${S} .game-card-link,${S} .game-card-info,${S} .game-card-container .thumbnail-2d-container,${S} .game-card-container .game-card-thumb-container{background:transparent !important;border:0 !important;box-shadow:none !important;}
/* section headers are titles, not panels */
${S} .container-header,${S} .container-header h2,${S} .container-header h3{background:transparent !important;border:0 !important;box-shadow:none !important;}
/* server cards: Roblox draws its own square box inside each one; drop it so only the rounded card shows */
${S} :is(.rbx-game-server-item,.rbx-public-game-server-item,.rbx-friends-game-server-item,.rbx-private-game-server-item) :is(.card-item,.section-content,.game-server-item,.rbx-game-server-details,.game-server-details){background:transparent !important;border:0 !important;box-shadow:none !important;outline:0 !important;}
${S} :is(.rbx-game-server-item,.rbx-public-game-server-item,.rbx-friends-game-server-item,.rbx-private-game-server-item){border-radius:12px !important;overflow:hidden;}

/* text */
${S} h1,${S} h2,${S} h3,${S} h4,${S} h5,${S} h6,${S} p,${S} label,${S} li,${S} td,${S} th,${S} .text-label,${S} .text-lead,${S} .text-body,${S} .text-name,${S} .text-emphasis,${S} .text-description,${S} .font-header-1,${S} .font-header-2,${S} .font-body,${S} .font-caption-header,${S} .game-card-name,${S} .item-card-name,${S} .item-card-price,${S} .rbx-tab-heading .text-lead{color:var(--rv-page-text) !important;}
${S} .text-secondary,${S} .text-secondary-light,${S} .font-caption-body,${S} .text-footer,${S} .game-card-info .info-label,${S} .rbx-tab-subtitle{color:color-mix(in srgb,var(--rv-page-text) 66%,transparent) !important;}
${S} a,${S} .text-link,${S} a.text-link{color:var(--rv-accent-2) !important;}
${S} a:hover,${S} .text-link:hover{color:var(--rv-accent) !important;}
${S} .rbx-tab.active .rbx-tab-heading,${S} .rbx-tab-heading:hover{border-bottom-color:var(--rv-accent) !important;}

/* buttons and fields */
${S} .btn-primary-md,${S} .btn-primary-lg,${S} .btn-primary-sm,${S} .btn-growth-md,${S} .btn-growth-lg,${S} .btn-cta-md,${S} .btn-cta-lg,${S} .btn-common-play-game-lg{background-color:var(--rv-accent) !important;border-color:var(--rv-accent) !important;color:var(--rv-on-accent) !important;}
${S} .btn-primary-md:hover,${S} .btn-growth-md:hover,${S} .btn-cta-md:hover{filter:brightness(1.1);}
${S} .btn-secondary-md,${S} .btn-secondary-lg,${S} .btn-secondary-sm,${S} .btn-control-md,${S} .btn-control-sm,${S} .btn-control-xs,${S} .btn-generic-more-sm{background-color:color-mix(in srgb,var(--rv-accent) 18%,var(--rv-surface)) !important;border:1px solid var(--rv-border) !important;color:var(--rv-page-text) !important;}
${S} input[type="text"],${S} input[type="search"],${S} input[type="password"],${S} input[type="email"],${S} input[type="number"],${S} textarea,${S} select,${S} .form-control,${S} .input-field{background-color:var(--rv-surface) !important;color:var(--rv-page-text) !important;border:1px solid var(--rv-border) !important;}
${S} input:focus,${S} textarea:focus,${S} select:focus{outline:2px solid var(--rv-accent) !important;outline-offset:0;}
${S} hr,${S} .rbx-divider,${S} .border-top,${S} .border-bottom{border-color:var(--rv-border) !important;background-color:var(--rv-border);}

/* newer Roblox pages: server cards, the left menu, settings menus, dropdowns and the "foundation" utility classes */
${S} .rbx-game-server-item,${S} .rbx-public-game-server-item,${S} .rbx-friends-game-server-item,${S} .rbx-private-game-server-item,${S} .rbx-game-server-details,${S} .rbx-game-server-status,${S} .rbx-game-server-join,${S} .game-server-item,${S} #left-navigation-container,${S} .left-col-list,${S} .nav-container,${S} .menu-vertical,${S} .menu-vertical > li,${S} .menu-vertical .menu-option,${S} .settings-container,${S} .setting-section,${S} [role="menu"],${S} [role="listbox"],${S} [role="dialog"],${S} [role="tooltip"],${S} [class*="popover"],${S} [class*="dropdown-menu"],${S} [class*="left-nav"],${S} [class*="LeftNav"],${S} [class*="settings-menu"],${S} [class*="bg-surface-100"],${S} [class*="bg-surface-200"],${S} [class*="bg-surface-300"],${S} [class*="bg-shift"],${S} [class*="bg-over-media"]{background-color:var(--rv-surface) !important;color:var(--rv-page-text) !important;border-color:var(--rv-border) !important;}
${S} [class*="bg-surface-0"],${S} [class*="bg-surface-default"]{background-color:var(--rv-page-bg) !important;}
${S} .rbx-game-server-item,${S} .rbx-public-game-server-item,${S} .rbx-friends-game-server-item,${S} .rbx-private-game-server-item{background-color:color-mix(in srgb,var(--rv-card) 92%,transparent) !important;border:1px solid var(--rv-card-border) !important;border-radius:10px !important;}
${S} .rbx-game-server-join,${S} .rbx-game-server-item .btn-full-width,${S} .rbx-game-server-item .btn-secondary-md{background-color:color-mix(in srgb,var(--rv-accent) 30%,var(--rv-surface)) !important;color:var(--rv-page-text) !important;border:1px solid var(--rv-border) !important;}
${S} .menu-vertical .menu-option,${S} .menu-vertical li a,${S} [role="menuitem"],${S} [role="option"],${S} [role="tab"]{color:var(--rv-page-text) !important;}
${S} .menu-vertical .menu-option:hover,${S} .menu-vertical .menu-option.active,${S} .menu-vertical li.active,${S} [role="menuitem"]:hover,${S} [role="option"]:hover,${S} [role="menuitem"][aria-selected="true"]{background-color:color-mix(in srgb,var(--rv-accent) 22%,transparent) !important;}
${S} .menu-vertical .menu-option.active,${S} .menu-vertical li.active{box-shadow:inset 3px 0 0 var(--rv-accent);}
${S} .progress-bar,${S} .rbx-game-server-item .progress,${S} [role="progressbar"]{background-color:var(--rv-border) !important;}
${S} .progress-bar .bar,${S} .progress-bar > div,${S} [role="progressbar"] > div{background-color:var(--rv-accent) !important;}
${S} [class*="text-default"],${S} [class*="content-default"],${S} [class*="text-emphasis"]{color:var(--rv-page-text) !important;}
${S} [class*="text-muted"],${S} [class*="content-muted"]{color:color-mix(in srgb,var(--rv-page-text) 66%,transparent) !important;}
${S} [class*="stroke-default"],${S} [class*="stroke-muted"]{border-color:var(--rv-border) !important;}
${S} [class*="bg-action-standard"],${S} [class*="bg-action-emphasis"]{background-color:var(--rv-accent) !important;color:var(--rv-on-accent) !important;}

/* surfaces found by the repaint pass below (Roblox's grey panels whose class names change) */
${S} [data-rv-gray="bg"]{background-color:var(--rv-page-bg) !important;}
${S} [data-rv-gray="surface"]{background-color:var(--rv-surface) !important;}
${S} [data-rv-gray="thin"]{background-color:var(--rv-border) !important;}
${S} [data-rv-gborder]{border-color:var(--rv-border) !important;}
${S} [data-rv-gul]{border-bottom-color:var(--rv-accent) !important;}

/* footer, scrollbars, selection */
${S} .footer,${S} #footer-container,${S} .footer-container{background:var(--rv-surface) !important;color:var(--rv-page-text) !important;border-top:1px solid var(--rv-border) !important;}
${S} ::selection{background:var(--rv-accent);color:var(--rv-on-accent);}
${S} ::-webkit-scrollbar{width:11px;height:11px;}
${S} ::-webkit-scrollbar-track{background:var(--rv-page-bg);}
${S} ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--rv-accent) 70%,var(--rv-page-bg));border-radius:6px;border:2px solid var(--rv-page-bg);}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
}

/*
Repaint pass: Roblox keeps changing the class names of its newer panels, so instead of chasing them this looks at what
is actually drawn. Any plain grey (neutral, darker than mid-grey) background becomes the theme's color, grey borders
become the theme's border color, and thin bright underlines (the selected tab) take the accent. It never touches images,
gradients, see-through elements or RoValk's own widgets.
*/
const SKIP_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "PICTURE", "IFRAME", "SCRIPT", "STYLE", "LINK", "META", "PATH", "USE", "HEAD", "BR", "INPUT", "TEXTAREA", "SELECT"]);
const OWN = ".game-card-container,.game-tile,.game-card,.list-item:has(.game-card-container),.rbx-game-server-item,.rbx-public-game-server-item,.rbx-friends-game-server-item,.rbx-private-game-server-item,#rovalkTradeTools,#rovalkOrb,.rv-orb-host,#rovalkPartnerCard,#rovalkHoverCard,#rovalkListFilter,#rovalkShortcutHelp,.rv-tlv,#rovalkInvToolbar,#rovalkProfileBanner,#rovalkInventorySummary,.flagBox,#rovalk-ambient-canvas,.valueSpan";
const ATTRS = ["data-rv-gray", "data-rv-gborder", "data-rv-gul"];
let repaintObserver = null;
let queue = new Set();
let scheduled = false;

function channels(color) {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return null;
    const parts = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
const isNeutral = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 14;
const lum = (c) => (c.r + c.g + c.b) / 3;

//Reads what an element looks like and returns the attributes it should get (nothing is written here, so a batch can
//be read first and written afterwards without forcing the browser to recalculate layout between elements).
export function classifyElement(el) {
    if (SKIP_TAGS.has(el.tagName?.toUpperCase()) || el.closest?.(OWN)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;
    const out = [];
    const bg = channels(cs.backgroundColor);
    if (bg && bg.a >= 0.6 && cs.backgroundImage === "none" && isNeutral(bg)) {
        const l = lum(bg);
        if (l < 100) {
            const height = parseFloat(cs.height);
            out.push(["data-rv-gray", height > 0 && height <= 10 ? "thin" : l < 26 ? "bg" : "surface"]);
        }
    }
    const width = parseFloat(cs.borderTopWidth) || 0;
    if (width > 0) {
        const border = channels(cs.borderTopColor);
        if (border && border.a > 0.2 && isNeutral(border) && lum(border) >= 30 && lum(border) <= 140) out.push(["data-rv-gborder", ""]);
    }
    const bottomWidth = parseFloat(cs.borderBottomWidth) || 0;
    const bottom = channels(cs.borderBottomColor);
    if (bottomWidth >= 2 && bottom && bottom.a > 0.5 && isNeutral(bottom) && lum(bottom) > 200) out.push(["data-rv-gul", ""]);
    return out;
}

function flush(deadline) {
    scheduled = false;
    //read a batch...
    const batch = [];
    const results = [];
    for (const el of queue) {
        batch.push(el);
        queue.delete(el);
        if (batch.length >= 300) break;
    }
    for (const el of batch) results.push(el.isConnected ? classifyElement(el) : null);
    //...then write it
    batch.forEach((el, i) => results[i]?.forEach(([name, value]) => el.setAttribute(name, value)));
    if (queue.size) schedule();
}
function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestIdleCallback || ((fn) => setTimeout(() => fn({}), 50)))(flush, { timeout: 400 });
}
function enqueueTree(root) {
    if (root.nodeType !== 1) return;
    queue.add(root);
    for (const el of root.querySelectorAll("*")) queue.add(el);
    schedule();
}

/*
Game tile wrappers: Roblox wraps each game tile in a few layers (list items, grid cells, links). If any of those gets a
background or border, it shows up as a second frame around the tile. Every ancestor up to three levels above a tile
that contains only that one tile is marked data-rv-tile-wrap, and the theme CSS makes marked elements see-through.
*/
const TILE = ".game-card-container,.game-tile";
let tileTimer = null;
function markTileWrappers() {
    tileTimer = null;
    for (const tile of document.querySelectorAll(TILE)) {
        if (tile.querySelector(TILE)) continue; //only start from the innermost tile element
        let node = tile.parentElement;
        for (let depth = 0; node && depth < 3 && node !== document.body; depth++, node = node.parentElement) {
            const innermost = [...node.querySelectorAll(TILE)].filter((el) => !el.querySelector(TILE)).length;
            if (innermost > 1) break; //this element holds a whole row of games, not one tile
            if (!node.hasAttribute("data-rv-tile-wrap")) node.setAttribute("data-rv-tile-wrap", "");
        }
    }
}
function scheduleTileMarking() {
    if (!tileTimer) tileTimer = setTimeout(markTileWrappers, 250);
}

function startRepaint() {
    if (repaintObserver || !document.body) return;
    enqueueTree(document.body);
    scheduleTileMarking();
    repaintObserver = new MutationObserver((mutations) => {
        scheduleTileMarking();
        for (const m of mutations) {
            if (m.type === "childList") m.addedNodes.forEach(enqueueTree);
            else if (m.type === "attributes" && m.target.nodeType === 1) {
                for (const a of ATTRS) m.target.removeAttribute(a); //its classes changed, so judge it again
                queue.add(m.target);
                schedule();
            }
        }
    });
    repaintObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}
function stopRepaint() {
    repaintObserver?.disconnect();
    repaintObserver = null;
    queue = new Set();
    document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => ATTRS.forEach((a) => el.removeAttribute(a)));
}

function sync() {
    chrome.storage.local.get([SITE_OPTION], (result) => {
        const enabled = result?.[SITE_OPTION] !== false;
        const themeId = document.documentElement.getAttribute("data-rv-theme");
        const on = enabled && !!themeId && !!getTheme(themeId).siteWide;
        if (on) ensureStyle();
        document.documentElement.setAttribute("data-rv-site", on ? "on" : "off");
        if (on) {
            //the page body may not exist yet when this script runs at document_start
            if (document.body) startRepaint(); else document.addEventListener("DOMContentLoaded", startRepaint, { once: true });
        } else stopRepaint();
    });
}

//Call once, after initTheme. Reacts to theme changes and to the option being switched.
export function initSiteTheme() {
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-rv-theme"] });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && SITE_OPTION in changes) sync();
    });
    sync();
}
