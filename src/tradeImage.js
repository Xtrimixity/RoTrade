/*
Draws a trade as a shareable PNG. Used by the trade page's Image button (features/shareImage.js) and by Discord
webhook notifications (webhook.js, in the background worker), so it only uses OffscreenCanvas + fetch and fixed
RoTrade colors, never the page's DOM or CSS.

trade = {
  title?: "Trade with Trade King",           partner?: "Trade King",
  give: { items: [{ id, name, value, rap, projected?, rare?, thumb? }], robux, total, rap },
  get:  { ...same }
}
Returns a PNG Blob.
*/

const C = {
    bg: "#0F0F12", bg2: "#17171C", card: "#1B1B21", cardHi: "#22222A", line: "#2C2C35",
    text: "#F4F4F6", muted: "#9C9CA8", accent: "#F97316", accent2: "#FB923C",
    good: "#22C55E", bad: "#EF4444", fair: "#F97316", purple: "#A855F7", tile: "#26262E"
};
const W = 1200;
const PAD = 40;
const MID = 150;           //space between the two cards for the verdict ring
const ROW = 86;
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const signed = (n) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmt(Math.abs(n))}`;

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function loadImage(url) {
    if (!url) return null;
    try {
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) return null;
        const blob = await response.blob();
        try {
            return await createImageBitmap(blob);
        } catch (e) {
            if (typeof Image === "undefined") return null; //background worker: no <img> fallback for SVG
            const objectUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.src = objectUrl;
            await image.decode();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
            return image;
        }
    } catch (e) {
        return null;
    }
}

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function fit(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
    return `${out}…`;
}

function pill(ctx, x, y, text, color, size = 12) {
    ctx.font = `700 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 14;
    rr(ctx, x, y, w, size + 10, (size + 10) / 2);
    ctx.fillStyle = `${color}2E`;
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 7, y + (size + 10) / 2 + 0.5);
    ctx.textBaseline = "alphabetic";
    return w;
}

function verdictOf(percent) {
    if (percent >= 25) return ["Big win", C.good];
    if (percent > 5) return ["Win", C.good];
    if (percent >= -5) return ["Fair", C.fair];
    if (percent > -25) return ["Loss", C.bad];
    return ["Big loss", C.bad];
}

export async function renderTradeImage(trade) {
    const sides = [["YOU GIVE", trade.give, C.bad], ["YOU GET", trade.get, C.good]];
    const rowsPer = sides.map(([, side]) => Math.max(side.items.length + (side.robux > 0 ? 1 : 0), 1));
    const cardH = 64 + Math.max(...rowsPer) * ROW + 96;
    const top = PAD + 108;
    const H = top + cardH + 72;
    const scale = 2;
    const canvas = makeCanvas(W * scale, H * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    //background: dark with a warm glow in the top left and a faint one bottom right
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(160, -40, 10, 160, -40, 760);
    glow.addColorStop(0, "rgba(249,115,22,0.30)");
    glow.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(W, H, 10, W, H, 640);
    glow2.addColorStop(0, "rgba(251,146,60,0.12)");
    glow2.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    const giveTotal = trade.give.total;
    const getTotal = trade.get.total;
    const percent = giveTotal > 0 ? Math.round(((getTotal - giveTotal) / giveTotal) * 1000) / 10 : (getTotal > 0 ? 100 : 0);
    const [verdict, vColor] = verdictOf(percent);

    //header
    ctx.fillStyle = C.accent;
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText("ROTRADE · TRADE CHECK", PAD, PAD + 14);
    ctx.fillStyle = C.text;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(fit(ctx, trade.title ?? (trade.partner ? `Trade with ${trade.partner}` : "Trade check"), W - PAD * 2 - 260), PAD, PAD + 54);
    ctx.fillStyle = C.muted;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(`${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · values from Rolimons`, PAD, PAD + 82);
    //verdict badge, top right
    ctx.font = `800 22px ${FONT}`;
    const badgeText = `${verdict}  ${percent > 0 ? "+" : ""}${percent > 999 ? ">999" : percent}%`;
    const bw = ctx.measureText(badgeText).width + 36;
    rr(ctx, W - PAD - bw, PAD + 18, bw, 48, 24);
    ctx.fillStyle = `${vColor}26`;
    ctx.fill();
    ctx.strokeStyle = `${vColor}99`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = vColor;
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, W - PAD - bw + 18, PAD + 43);
    ctx.textBaseline = "alphabetic";

    //thumbnails
    const thumbs = await Promise.all(sides.map(([, side]) => Promise.all(side.items.map((item) => loadImage(item.thumb)))));

    const colW = (W - PAD * 2 - MID) / 2;
    sides.forEach(([label, side, edge], s) => {
        const x = s === 0 ? PAD : PAD + colW + MID;
        //card with a colored top edge
        ctx.save();
        rr(ctx, x, top, colW, cardH, 20);
        ctx.fillStyle = C.card;
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.fill();
        ctx.restore();
        ctx.save();
        rr(ctx, x, top, colW, cardH, 20);
        ctx.clip();
        ctx.fillStyle = edge;
        ctx.fillRect(x, top, colW, 4);
        ctx.restore();
        rr(ctx, x, top, colW, cardH, 20);
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = C.muted;
        ctx.font = `800 13px ${FONT}`;
        ctx.fillText(label, x + 24, top + 38);
        ctx.textAlign = "right";
        ctx.fillText(`${side.items.length} item${side.items.length === 1 ? "" : "s"}${side.robux > 0 ? " + Robux" : ""}`, x + colW - 24, top + 38);
        ctx.textAlign = "left";

        side.items.forEach((item, i) => {
            const y = top + 58 + i * ROW;
            if (i % 2 === 1) {
                rr(ctx, x + 12, y - 4, colW - 24, ROW - 4, 14);
                ctx.fillStyle = "rgba(255,255,255,0.025)";
                ctx.fill();
            }
            rr(ctx, x + 22, y + 4, 66, 66, 14);
            ctx.fillStyle = C.tile;
            ctx.fill();
            const image = thumbs[s][i];
            if (image) {
                ctx.save();
                rr(ctx, x + 22, y + 4, 66, 66, 14);
                ctx.clip();
                ctx.drawImage(image, x + 22, y + 4, 66, 66);
                ctx.restore();
            } else {
                ctx.fillStyle = C.accent2;
                ctx.font = `800 26px ${FONT}`;
                ctx.textAlign = "center";
                ctx.fillText((item.name || "?").charAt(0).toUpperCase(), x + 55, y + 47);
                ctx.textAlign = "left";
            }
            ctx.fillStyle = C.text;
            ctx.font = `700 18px ${FONT}`;
            ctx.fillText(fit(ctx, item.name, colW - 260), x + 104, y + 32);
            let px = x + 104;
            ctx.fillStyle = C.muted;
            ctx.font = `500 13px ${FONT}`;
            const rapText = `RAP ${fmt(item.rap)}`;
            ctx.fillText(rapText, px, y + 56);
            px += ctx.measureText(rapText).width + 10;
            if (item.projected) px += pill(ctx, px, y + 43, "Projected", C.bad, 11) + 6;
            if (item.rare) pill(ctx, px, y + 43, "Rare", C.purple, 11);
            ctx.fillStyle = C.text;
            ctx.font = `800 21px ${FONT}`;
            ctx.textAlign = "right";
            ctx.fillText(fmt(item.value), x + colW - 24, y + 44);
            ctx.textAlign = "left";
        });
        if (side.robux > 0) {
            const y = top + 58 + side.items.length * ROW;
            ctx.beginPath();
            ctx.arc(x + 55, y + 37, 26, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(34,197,94,0.16)";
            ctx.fill();
            ctx.fillStyle = C.good;
            ctx.font = `800 17px ${FONT}`;
            ctx.textAlign = "center";
            ctx.fillText("R$", x + 55, y + 43);
            ctx.textAlign = "left";
            ctx.fillStyle = C.text;
            ctx.font = `700 18px ${FONT}`;
            ctx.fillText("Robux", x + 104, y + 32);
            ctx.fillStyle = C.muted;
            ctx.font = `500 13px ${FONT}`;
            ctx.fillText(s === 1 ? `${fmt(side.robux * 0.7)} after Roblox's 30% fee` : "you pay the full amount", x + 104, y + 56);
            ctx.fillStyle = C.text;
            ctx.font = `800 21px ${FONT}`;
            ctx.textAlign = "right";
            ctx.fillText(fmt(side.robux), x + colW - 24, y + 44);
            ctx.textAlign = "left";
        }
        if (!side.items.length && !(side.robux > 0)) {
            ctx.fillStyle = C.muted;
            ctx.font = `500 16px ${FONT}`;
            ctx.fillText("Nothing", x + 24, top + 100);
        }

        //totals footer
        const fy = top + cardH - 84;
        ctx.strokeStyle = C.line;
        ctx.beginPath();
        ctx.moveTo(x + 24, fy);
        ctx.lineTo(x + colW - 24, fy);
        ctx.stroke();
        ctx.fillStyle = C.muted;
        ctx.font = `700 13px ${FONT}`;
        ctx.fillText("TOTAL VALUE", x + 24, fy + 34);
        ctx.font = `500 14px ${FONT}`;
        ctx.fillText(`RAP ${fmt(side.rap)}`, x + 24, fy + 60);
        ctx.fillStyle = C.text;
        ctx.font = `800 34px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(fmt(side.total), x + colW - 24, fy + 58);
        ctx.textAlign = "left";
    });

    //verdict ring between the cards
    const cx = W / 2;
    const cy = top + cardH / 2;
    const r = 50;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fillStyle = C.bg2;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const fraction = Math.min(Math.abs(percent), 50) / 50;
    if (fraction > 0) {
        ctx.strokeStyle = vColor;
        ctx.lineCap = "round";
        ctx.shadowColor = vColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        if (percent >= 0) ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
        else ctx.arc(cx, cy, r, -Math.PI / 2 - fraction * Math.PI * 2, -Math.PI / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineCap = "butt";
    }
    ctx.textAlign = "center";
    ctx.fillStyle = vColor;
    ctx.font = `800 ${Math.abs(percent) >= 100 ? 17 : 21}px ${FONT}`;
    ctx.fillText(`${percent > 0 ? "+" : ""}${percent > 999 ? ">999" : percent}%`, cx, cy + 2);
    ctx.fillStyle = C.muted;
    ctx.font = `800 10px ${FONT}`;
    ctx.fillText(verdict.toUpperCase(), cx, cy + 20);
    ctx.textAlign = "left";
    //value and RAP differences, each in its own bubble: green when you gain, red when you lose, grey when even
    const bubble = (diff, label, y) => {
        const color = diff > 0 ? C.good : diff < 0 ? C.bad : C.muted;
        const text = `${signed(diff)} ${label}`;
        ctx.font = `800 14px ${FONT}`;
        const w = ctx.measureText(text).width + 24;
        const h = 28;
        rr(ctx, cx - w / 2, y, w, h, h / 2);
        ctx.fillStyle = diff > 0 ? "rgba(34,197,94,0.16)" : diff < 0 ? "rgba(239,68,68,0.16)" : "rgba(156,156,168,0.14)";
        ctx.fill();
        ctx.strokeStyle = diff > 0 ? "rgba(34,197,94,0.55)" : diff < 0 ? "rgba(239,68,68,0.55)" : "rgba(156,156,168,0.4)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cx, y + h / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
    };
    bubble(getTotal - giveTotal, "value", cy + r + 26);
    bubble(trade.get.rap - trade.give.rap, "RAP", cy + r + 62);

    //footer
    ctx.fillStyle = C.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText("Made with RoTrade · based on RoValk", PAD, H - 30);

    if (canvas.convertToBlob) return canvas.convertToBlob({ type: "image/png" });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
