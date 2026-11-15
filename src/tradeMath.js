/*
Pure trade math shared by the trade page tools, the background history tracker, and the popup.
Nothing in here touches the DOM or extension APIs, so it can be tested on its own.

Terms:
  "net" values count Robux the way a trade really works: Robux you give costs you the full amount,
  Robux you receive is reduced by Roblox's 30% fee (you keep 70%).
*/

export const KEEP_RATE = 0.7; //share of received Robux you actually get
export const FAIR_PERCENT = 5; //within +-5% counts as fair
export const BIG_PERCENT = 25; //beyond +-25% counts as a big win or loss

export function sideNet(value, robux, isReceiveSide) {
    const safeValue = Math.max(Number(value) || 0, 0);
    const safeRobux = Math.max(Number(robux) || 0, 0);
    return safeValue + (isReceiveSide ? Math.round(safeRobux * KEEP_RATE) : safeRobux);
}

export function percentDiff(giveTotal, receiveTotal) {
    const base = Math.max(giveTotal, 1);
    return Math.round(((receiveTotal - giveTotal) / base) * 1000) / 10;
}

//"bigwin" | "win" | "fair" | "loss" | "bigloss"
export function verdictKey(percent) {
    if (percent >= BIG_PERCENT) return "bigwin";
    if (percent > FAIR_PERCENT) return "win";
    if (percent >= -FAIR_PERCENT) return "fair";
    if (percent > -BIG_PERCENT) return "loss";
    return "bigloss";
}

export const VERDICT_TEXT = {
    bigwin: "Big win",
    win: "Win",
    fair: "Fair trade",
    loss: "Slight loss",
    bigloss: "Big loss"
};

/*
Overpay helper. giveNet and receiveNet are net totals (see top of file).
Returns { state, amount, robux, percent }:
  state "fair"   -> within the fair range, nothing to do
  state "behind" -> you are losing; ask them to add `robux` Robux (you would keep `amount` of it after the fee)
  state "ahead"  -> you are winning; adding `robux` Robux of your own would even things out
*/
export function overpayAdvice(giveNet, receiveNet) {
    const percent = percentDiff(giveNet, receiveNet);
    const gap = receiveNet - giveNet;
    if (Math.abs(percent) <= FAIR_PERCENT) {
        return { state: "fair", amount: 0, robux: 0, percent };
    }
    if (gap < 0) {
        const needed = -gap;
        return { state: "behind", amount: needed, robux: Math.ceil(needed / KEEP_RATE), percent };
    }
    return { state: "ahead", amount: gap, robux: gap, percent };
}

//Value tiers for item card borders. Returns "t1".."t5" or null when there is no usable value.
export const TIER_LIMITS = [
    { id: "t1", max: 5000 },
    { id: "t2", max: 25000 },
    { id: "t3", max: 100000 },
    { id: "t4", max: 500000 },
    { id: "t5", max: Infinity }
];
export function tierFor(value) {
    if (!(value > 0)) return null;
    return TIER_LIMITS.find((tier) => value < tier.max).id;
}

/*
rows: [{ time (ms), giveNet, receiveNet }]. Returns a summary object.
*/
export function summarize(rows) {
    let wins = 0;
    let losses = 0;
    let fair = 0;
    let net = 0;
    let volume = 0;
    let best = null;
    let worst = null;
    rows.forEach((row) => {
        const profit = row.receiveNet - row.giveNet;
        const key = verdictKey(percentDiff(row.giveNet, row.receiveNet));
        if (key === "bigwin" || key === "win") wins++;
        else if (key === "fair") fair++;
        else losses++;
        net += profit;
        volume += row.giveNet + row.receiveNet;
        if (!best || profit > best.profit) best = { ...row, profit };
        if (!worst || profit < worst.profit) worst = { ...row, profit };
    });
    const decided = wins + losses;
    return {
        count: rows.length,
        wins,
        losses,
        fair,
        net,
        volume,
        winRate: decided > 0 ? Math.round((wins / decided) * 100) : null,
        best,
        worst
    };
}

//Running total of profit over time, oldest first. Returns [{ time, total }].
export function cumulativeSeries(rows, windowStart) {
    const sorted = [...rows].sort((a, b) => a.time - b.time);
    let total = 0;
    const series = sorted.map((row) => {
        const profit = row.receiveNet - row.giveNet;
        total += profit;
        return { time: row.time, total, profit };
    });
    //a zero point at the start gives the line somewhere to begin and lets a window with a single trade still draw
    if (series.length) {
        const first = series[0].time;
        const start = windowStart !== undefined && windowStart < first ? windowStart : first - 86400000;
        series.unshift({ time: start, total: 0, baseline: true });
    }
    return series;
}

//Small helpers used by several screens.
//"+5.5%", "-12%", and ">+999%" once a percentage stops meaning much (a 1 Robux side against a big item).
export function formatPercent(percent) {
    if (percent > 999) return ">+999%";
    if (percent < -999) return "<-999%";
    return `${percent > 0 ? "+" : ""}${percent}%`;
}

export function formatSigned(number, commafy) {
    const text = commafy(Math.abs(number));
    if (number > 0) return "+" + text;
    if (number < 0) return "-" + text;
    return text;
}

/*
Simple, dependency-free item search (popup item pickers).
items: [{ id, type, name, acr }]. Ranks exact > prefix > word prefix > substring > acronym.
*/
export function searchItems(items, query, limit = 8) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 1) return [];
    const scored = [];
    for (const item of items) {
        const name = item.name.toLowerCase();
        const acr = (item.acr || "").toLowerCase();
        let score = -1;
        if (acr && acr === q) score = 100;
        else if (name === q) score = 95;
        else if (name.startsWith(q)) score = 80;
        else if (name.split(/[\s\-_]+/).some((word) => word.startsWith(q))) score = 65;
        else if (name.includes(q)) score = 50;
        else if (acr && acr.startsWith(q)) score = 40;
        if (score >= 0) scored.push({ item, score: score - name.length / 1000 });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((entry) => entry.item);
}
