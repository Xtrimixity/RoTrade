/*
Animated theme layer: a transparent canvas over the page that draws drifting cherry blossom petals while the Cherry
Blossom theme is active (see "ambient" in themes.js).
It is built to be cheap: it draws at most 30 frames a second, uses a small number of petals, renders at 1x pixel
density, stops completely while the tab is hidden or the window is minimised, and ignores the mouse. It stops when the
theme changes or the "Ambient Particles" option is off, and does not run at all if the system asks for reduced motion.
*/
import { getTheme } from "./themes";

export const AMBIENT_OPTION = "Ambient Particles";
const CANVAS_ID = "rovalk-ambient-canvas";
const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 30;
const rand = (min, max) => min + Math.random() * (max - min);

function mixColor(a, b, amount) {
    const parse = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
    const x = parse(a), y = parse(b);
    if (!x || !y) return a;
    return "#" + x.map((c, i) => Math.round(c + (y[i] - c) * amount).toString(16).padStart(2, "0")).join("");
}

function petals(w, h, theme = {}) {
    //petal colors follow the theme (so they change when the user edits the Cherry Blossom colors)
    const base = theme.accent2 || "#FFD1DC";
    const deep = theme.accent || "#FF8FB1";
    const colors = [base, deep, mixColor(base, deep, 0.5), mixColor(base, "#FFFFFF", 0.3)];
    const make = (initial) => ({ x: rand(0, w), y: initial ? rand(0, h) : rand(-40, -5), s: rand(4, 8), rot: rand(0, TAU), vr: rand(-2, 2), v: rand(28, 64), ph: rand(0, TAU), sway: rand(20, 50), a: rand(0.55, 0.9), flip: rand(0, TAU), color: colors[Math.floor(Math.random() * colors.length)] });
    const count = () => Math.round(Math.min(34, Math.max(14, (w * h) / 40000)));
    let list = Array.from({ length: count() }, () => make(true));
    let t = 0;
    return {
        resize(nw, nh) { w = nw; h = nh; list = Array.from({ length: count() }, () => make(true)); },
        step(dt, ctx) {
            t += dt;
            for (const p of list) {
                p.y += p.v * dt;
                p.x += Math.sin(t * 0.7 + p.ph) * p.sway * dt + 14 * dt;
                p.rot += p.vr * dt;
                if (p.y > h + 20 || p.x > w + 20) Object.assign(p, make(false));
                const squash = 0.45 + 0.55 * Math.abs(Math.cos(t * 1.4 + p.flip)); //tumbling
                const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
                ctx.setTransform(cos, sin, -sin * squash, cos * squash, p.x, p.y);
                ctx.globalAlpha = p.a;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.s, p.s * 0.58, 0, 0, TAU);
                ctx.fill();
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
        },
        stats: () => ({ count: list.length })
    };
}

const EFFECTS = { petals };
export const AMBIENT_EFFECTS = Object.keys(EFFECTS);

/* ---------------------------------- runner ---------------------------------- */
let canvas = null;
let context = null;
let effect = null;
let frame = 0;
let lastTime = 0;
let lastDraw = 0;
let size = { w: 0, h: 0 };
let started = false;

function themeColors() {
    const style = getComputedStyle(document.documentElement);
    return { accent: style.getPropertyValue("--rv-accent").trim() || "#FF8FB1", accent2: style.getPropertyValue("--rv-accent-2").trim() || "" };
}

function fitCanvas() {
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w; //1x density: petals are soft shapes, so the sharper canvas is not worth the extra pixels to fill
    canvas.height = h;
    size = { w, h };
    effect?.resize(w, h);
}

function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    effect = null;
    canvas?.remove();
    canvas = null;
    context = null;
}

function loop(now) {
    if (!effect) return;
    frame = requestAnimationFrame(loop);
    if (now - lastDraw < FRAME_MS - 2) return; //30 frames a second is plenty for slow petals
    const dt = Math.min(0.08, (now - lastTime) / 1000 || 0);
    lastTime = now;
    lastDraw = now;
    context.clearRect(0, 0, size.w, size.h);
    effect.step(dt, context);
}

function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
}
function resume() {
    if (!effect || frame) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(loop);
}

function start(effectName) {
    stop();
    if (!EFFECTS[effectName]) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2;contain:strict;";
    (document.body || document.documentElement).appendChild(canvas);
    context = canvas.getContext("2d", { alpha: true });
    size = { w: window.innerWidth, h: window.innerHeight };
    canvas.width = size.w;
    canvas.height = size.h;
    effect = EFFECTS[effectName](size.w, size.h, themeColors());
    lastTime = performance.now();
    lastDraw = 0;
    if (!document.hidden) frame = requestAnimationFrame(loop);
}

function sync() {
    chrome.storage.local.get([AMBIENT_OPTION], (result) => {
        const enabled = result?.[AMBIENT_OPTION] !== false;
        const themeId = document.documentElement.getAttribute("data-rv-theme");
        const wanted = enabled && themeId ? getTheme(themeId).ambient : null;
        if (!wanted) return stop();
        const colors = document.documentElement.getAttribute("data-rv-colors") ?? "";
        if (effect && canvas?.dataset.effect === wanted && canvas?.dataset.colors === colors) return;
        start(wanted);
        if (canvas) { canvas.dataset.effect = wanted; canvas.dataset.colors = colors; }
    });
}

/*
Call once (after initTheme). Watches the theme and the option, so picking a theme in the popup starts its effect
straight away on every open Roblox tab.
*/
export function initAmbient() {
    if (started) return;
    started = true;
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-rv-theme", "data-rv-colors"] });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && AMBIENT_OPTION in changes) sync();
    });
    window.addEventListener("resize", fitCanvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
    sync();
}
