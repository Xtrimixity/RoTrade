/*
Styles for the newer things RoValk draws on Roblox pages: market badges and table, demand / wishlist / serial / deal
marks on item cards, the partner card, even-it-out suggestions, trade list grades and the hover card.
Colors come from the theme variables in themes.js, so every theme styles them. Injected once per page.
*/
const STYLE_ID = "rovalk-feature-style";

const css = `
/* ---------- marks on item cards ---------- */
/* item flags: one badge style for value (V), RAP-only (R), rare (star) and projected (P) */
.rv-flagbox{position:absolute;top:4px;left:4px;z-index:4;display:flex;flex-direction:column;gap:3px;max-width:22px;background:none !important;border:0 !important;padding:0 !important;}
.rv-flagbox-right{left:auto;right:4px;}
.rv-flag{width:19px;height:19px;flex:none;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:900 11px/1 Arial,Helvetica,sans-serif;color:#fff !important;-webkit-text-fill-color:currentColor !important;box-shadow:0 0 0 1.5px rgba(255,255,255,.92),0 1px 4px rgba(0,0,0,.5);cursor:pointer;user-select:none;transition:transform .12s ease;}
.rv-flag:hover{transform:scale(1.15);}
.rv-flag-value{background:#E8A500;color:#1d1400 !important;}
.rv-flag-rap{background:#2F80ED;}
.rv-flag-rare{background:#9B51E0;font-size:12px;}
.rv-flag-projected{background:#EB3B3B;}
.rv-mkt-badge,.rv-demand,.rv-deal,.rv-wish-star{position:absolute;z-index:3;pointer-events:auto;font-family:var(--rv-font,inherit);line-height:1;cursor:default;}
.rv-mkt-badge{right:4px;top:4px;padding:3px 6px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(10,8,16,.78);color:#e5e7eb;border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(4px);font-variant-numeric:tabular-nums;}
.rv-mkt-badge.rv-up{color:#4ade80;border-color:#4ade8066;}
.rv-mkt-badge.rv-down{color:#f87171;border-color:#f8717166;}
.rv-mkt-badge.rv-weak{opacity:.85;}
#rovalkTradeTools .rv-dir{font-size:10px;margin-right:4px;}
#rovalkTradeTools .rv-dir.rv-up{color:var(--rv-good);}
#rovalkTradeTools .rv-dir.rv-down{color:var(--rv-bad);}
#rovalkHoverCard .rv-hc-move{font-weight:800;margin-bottom:4px;}
.rv-demand{left:4px;bottom:4px;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.02em;background:rgba(10,8,16,.78);color:#e5e7eb;}
.rv-demand.rv-d0{color:#f87171;}.rv-demand.rv-d1{color:#fb923c;}.rv-demand.rv-d2{color:#e5e7eb;}.rv-demand.rv-d3{color:#4ade80;}.rv-demand.rv-d4{color:#facc15;}
.rv-wish-star{top:4px;right:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(10,8,16,.7);color:#facc15;font-size:13px;}
[data-rv-wish] .rv-mkt-badge,[data-rv-wish] .rv-deal{top:28px;}
[data-rv-wish]{box-shadow:0 0 0 2px #facc15,0 0 14px #facc1588 !important;}
.rv-deal{right:4px;top:4px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(10,8,16,.8);color:#4ade80;border:1px solid #4ade8077;}
.rv-serial{display:inline-block;margin:2px 0 1px;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:700;background:color-mix(in srgb,var(--rv-accent,#F97316) 18%,transparent);color:inherit;font-variant-numeric:tabular-nums;cursor:default;}
.rv-serial-special{background:linear-gradient(90deg,#facc15,#fb923c);color:#1a1205;}

/* ---------- shared bits inside the breakdown panel ---------- */
#rovalkTradeTools .rv-muted{opacity:.6;}
#rovalkTradeTools small{font-size:11px;font-weight:600;}

/* ---------- market table ---------- */
#rovalkTradeTools .rv-market{container-type:inline-size;}
.rv-card-rap{font-size:12px;line-height:16px;opacity:.7;font-weight:500;padding-left:25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#rotradeQueueBar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:14px;max-width:min(860px,calc(100vw - 24px));padding:10px 14px;border-radius:14px;background:#17120E;color:#F5F1EC;border:1px solid #EA580C;box-shadow:0 12px 34px rgba(0,0,0,.45);font:500 13px/1.4 "Builder Sans",Arial,sans-serif;}
#rotradeQueueBar[data-tone="ready"]{border-color:#22C55E;}
#rotradeQueueBar[data-tone="warn"]{border-color:#F59E0B;}
#rotradeQueueBar .rv-qbar-main{display:flex;flex-direction:column;gap:2px;min-width:0;}
#rotradeQueueBar .rv-qbar-title{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#FB923C;}
#rotradeQueueBar .rv-qbar-buttons{display:flex;gap:6px;flex:none;}
#rotradeQueueBar .rv-qbar-btn{padding:6px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;font:700 12px Arial,sans-serif;cursor:pointer;}
#rotradeQueueBar .rv-qbar-btn:hover{border-color:#FB923C;}
#rotradeQueueBar .rv-qbar-primary{background:#EA580C;border-color:#EA580C;color:#fff;}
#rovalkTradeTools.rv-wide{margin:16px 0 0 !important;width:100% !important;max-width:none !important;flex:0 0 100% !important;grid-column:1 / -1 !important;clear:both;float:none !important;box-sizing:border-box;order:9999;}
#rovalkTradeTools .rv-even-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 16px;}
#rovalkTradeTools .rv-even-sub{font-size:12px;font-weight:700;opacity:.8;margin:2px 0 6px;}
#rovalkTradeTools .rv-even-col{min-width:0;}
#rovalkTradeTools .rv-market-loading,#rovalkTradeTools .rv-even-body{font-size:13px;opacity:.75;}
#rovalkTradeTools .rv-market-table{display:grid;grid-template-columns:minmax(110px,1.6fr) minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,.6fr) minmax(0,.6fr) 92px minmax(52px,.7fr);border:1px solid var(--rv-border);border-radius:10px;overflow:hidden;font-size:12px;font-variant-numeric:tabular-nums;}
#rovalkTradeTools .rv-market-row{display:contents;}
#rovalkTradeTools .rv-market-row > span{padding:6px 8px;border-top:1px solid color-mix(in srgb,var(--rv-border) 70%,transparent);display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0;}
#rovalkTradeTools .rv-market-head > span{border-top:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.75;background:color-mix(in srgb,var(--rv-accent) 12%,transparent);}
#rovalkTradeTools .rv-market-group{grid-column:1 / -1;padding:5px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;border-top:1px solid var(--rv-border);background:color-mix(in srgb,currentColor 5%,transparent);}
#rovalkTradeTools .rv-market-name a{color:inherit !important;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
#rovalkTradeTools .rv-market-name a:hover{text-decoration:underline;}
#rovalkTradeTools .rv-spark{display:block;}
#rovalkTradeTools .rv-market-totals{margin-top:8px;font-size:12px;line-height:1.5;}
#rovalkTradeTools .rv-market .rv-alerts{margin-top:8px;}
#rovalkTradeTools .rv-market-foot{margin-top:6px;font-size:11px;opacity:.5;}
@container (max-width:560px){
  #rovalkTradeTools .rv-market-table{grid-template-columns:minmax(90px,1.5fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,.6fr);}
  #rovalkTradeTools .rv-market-row > span:nth-child(n+5){display:none;}
}

/* ---------- even it out ---------- */
#rovalkTradeTools .rv-even-body{display:flex;flex-direction:column;gap:5px;}
#rovalkTradeTools .rv-even-row{display:flex;justify-content:space-between;gap:10px;padding:6px 10px;border-radius:8px;font-size:13px;opacity:1;background:color-mix(in srgb,var(--rv-accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--rv-accent) 25%,transparent);}
#rovalkTradeTools .rv-even-result{font-weight:800;white-space:nowrap;}

/* ---------- partner card ---------- */
#rovalkPartnerCard{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;margin:0 0 12px;padding:10px 14px;border-radius:14px;background:var(--rv-surface);color:var(--rv-w-text);border:1px solid var(--rv-border);font-family:var(--rv-font);box-sizing:border-box;width:100%;}
#rovalkPartnerCard .rv-pc-avatar{width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,currentColor 10%,transparent);flex:none;}
#rovalkPartnerCard .rv-pc-who{min-width:0;flex:1 1 160px;}
#rovalkPartnerCard .rv-pc-name{font-weight:800;font-size:15px;color:inherit !important;}
#rovalkPartnerCard .rv-pc-sub{font-size:12px;opacity:.7;}
#rovalkPartnerCard .rv-pc-flag{margin-top:3px;font-size:12px;font-weight:700;color:var(--rv-bad);}
#rovalkPartnerCard .rv-pc-stats{display:flex;flex-wrap:wrap;gap:4px 16px;}
#rovalkPartnerCard .rv-pc-stat{display:flex;flex-direction:column;}
#rovalkPartnerCard .rv-pc-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.6;font-weight:700;}
#rovalkPartnerCard .rv-pc-value{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;}
#rovalkPartnerCard .rv-pos{color:var(--rv-good);}
#rovalkPartnerCard .rv-neg{color:var(--rv-bad);}
#rovalkPartnerCard .rv-pc-link{font-size:12px;font-weight:700;color:var(--rv-accent-2) !important;}

/* ---------- trade list ---------- */
.rv-tlv{position:absolute;right:6px;bottom:6px;display:flex;align-items:center;gap:8px;padding:3px 8px;border-radius:10px;background:color-mix(in srgb,var(--rv-card,#111) 85%,transparent);border:1px solid var(--rv-border,rgba(127,127,127,.35));font-family:var(--rv-font,inherit);font-size:12px;line-height:1.2;z-index:1;}
.rv-tl-grade{display:flex;align-items:center;gap:4px;font-weight:800;font-variant-numeric:tabular-nums;}
.rv-tl-ring{width:22px;height:22px;transform:rotate(-90deg);}
.rv-tl-track{fill:none;stroke:color-mix(in srgb,currentColor 18%,transparent);stroke-width:5;}
.rv-tl-arc{fill:none;stroke:var(--rv-accent,#F97316);stroke-width:5;stroke-linecap:round;}
.rv-tlv.rv-v-win .rv-tl-arc,.rv-tlv.rv-v-bigwin .rv-tl-arc{stroke:var(--rv-good,#22c55e);}
.rv-tlv.rv-v-loss .rv-tl-arc,.rv-tlv.rv-v-bigloss .rv-tl-arc{stroke:var(--rv-bad,#ef4444);}
.rv-tlv.rv-v-win .rv-tl-pct,.rv-tlv.rv-v-bigwin .rv-tl-pct{color:var(--rv-good,#22c55e);}
.rv-tlv.rv-v-loss .rv-tl-pct,.rv-tlv.rv-v-bigloss .rv-tl-pct{color:var(--rv-bad,#ef4444);}
.rv-tl-values{display:flex;flex-direction:column;align-items:flex-end;font-weight:700;font-variant-numeric:tabular-nums;}
.rv-tl-give{opacity:.7;}
.rv-tl-exp{padding:2px 6px;border-radius:999px;font-size:10px;font-weight:800;background:color-mix(in srgb,currentColor 12%,transparent);}
.rv-tl-exp.rv-urgent{background:var(--rv-bad,#ef4444);color:#fff;}
#rovalkListFilter{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:6px 0;font-family:var(--rv-font,inherit);font-size:12px;}
#rovalkListFilter select{background:var(--rv-surface,transparent);color:inherit;border:1px solid var(--rv-border,rgba(127,127,127,.4));border-radius:8px;padding:3px 6px;font-size:12px;}
#rovalkListFilter .rv-tl-hidden{opacity:.65;}
#rovalkListFilter .rv-tl-ad{margin-left:auto;padding:4px 12px;border-radius:999px;border:0;background:linear-gradient(135deg,var(--rv-accent,#F97316),var(--rv-accent-2,#FDBA74));color:var(--rv-on-accent,#fff);font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}
#rovalkListFilter .rv-tl-ad:hover{filter:brightness(1.12);}

/* ---------- hover card ---------- */
#rovalkHoverCard{position:fixed;z-index:2147483646;width:280px;padding:12px 14px;border-radius:14px;background:var(--rv-card,#2A1709);color:var(--rv-page-text,#eee);border:1px solid var(--rv-card-border,#5A3214);box-shadow:0 18px 50px rgba(0,0,0,.45);font-family:var(--rv-font,"Segoe UI",Arial,sans-serif);font-size:12px;line-height:1.35;pointer-events:auto;box-sizing:border-box;animation:rv-hc-in .14s ease both;}
@keyframes rv-hc-in{from{opacity:0;transform:translateY(4px);}}
#rovalkHoverCard *{box-sizing:border-box;}
#rovalkHoverCard .rv-hc-head{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;}
#rovalkHoverCard .rv-hc-name{flex:1;font-size:14px;font-weight:800;line-height:1.2;}
#rovalkHoverCard .rv-hc-acr{opacity:.55;font-weight:700;font-size:11px;}
#rovalkHoverCard .rv-hc-star{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid var(--rv-card-border,#5A3214);background:transparent;color:inherit;font-size:14px;cursor:pointer;line-height:1;}
#rovalkHoverCard .rv-hc-star[aria-pressed="true"]{color:#facc15;border-color:#facc15;background:#facc1522;}
#rovalkHoverCard .rv-hc-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;}
#rovalkHoverCard .rv-hc-v small{font-size:11px;font-weight:700;}
#rovalkHoverCard .rv-hc-after{color:var(--rv-accent-2,#FDBA74);}
#rovalkHoverCard .rv-hc-k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.55;}
#rovalkHoverCard .rv-hc-v{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;}
#rovalkHoverCard .rv-hc-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;}
#rovalkHoverCard .rv-hc-tag{padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;background:color-mix(in srgb,currentColor 12%,transparent);}
#rovalkHoverCard .rv-hc-tag.rv-bad{background:#ef444433;color:#fca5a5;}
#rovalkHoverCard .rv-hc-tag.rv-good{background:#22c55e33;color:#86efac;}
#rovalkHoverCard .rv-hc-tag.rv-warn{background:#f59e0b33;color:#fcd34d;}
#rovalkHoverCard .rv-hc-market{margin-top:10px;padding-top:8px;border-top:1px solid var(--rv-card-border,#5A3214);}
#rovalkHoverCard .rv-hc-mrow{display:flex;align-items:center;justify-content:space-between;gap:8px;}
#rovalkHoverCard .rv-pos{color:#4ade80;}
#rovalkHoverCard .rv-neg{color:#f87171;}
#rovalkHoverCard .rv-muted{opacity:.6;}
#rovalkHoverCard .rv-hc-links{display:flex;gap:10px;margin-top:8px;font-size:11px;font-weight:700;}
#rovalkHoverCard .rv-hc-links a{color:var(--rv-accent-2,#FDBA74) !important;}
`;

export function injectFeatureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
}
