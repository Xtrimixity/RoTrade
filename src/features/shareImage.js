/*
Image button on the trade page: the background worker draws the open trade with tradeImage.js, downloads it as a PNG and also copies it to
the clipboard when the browser allows.
*/
function renderInBackground(trade) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ title: "renderTradeImage", trade }, (response) => {
            chrome.runtime.lastError;
            if (!response?.ok) return reject(new Error(response?.message ?? "no answer"));
            fetch(response.dataUrl).then((r) => r.blob()).then(resolve, reject);
        });
    });
}

//The panel's side data ({ items, robux, value, rap, total }) as tradeImage.js expects it.
function asImageSide(side) {
    return {
        items: side.items.map((item) => ({ id: item.id, name: item.name, value: item.value, rap: item.rap, projected: item.projected, rare: item.rare, thumb: item.thumb })),
        robux: side.robux,
        total: side.total,
        rap: side.rap + side.robux
    };
}

export async function shareTradeImage(give, get, button) {
    const original = button?.textContent;
    if (button) button.textContent = "Drawing...";
    try {
        const partner = document.querySelector("#rovalkPartnerCard .rv-pc-name")?.textContent?.trim();
        const blob = await renderInBackground({ partner, give: asImageSide(give), get: asImageSide(get) });
        if (!blob) throw new Error("no image");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `trade-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        let copied = false;
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            copied = true;
        } catch (e) { /* clipboard images can be blocked; the download still happened */ }
        if (button) button.textContent = copied ? "Saved + copied" : "Saved";
    } catch (e) {
        if (button) button.textContent = "Failed";
    }
    if (button) setTimeout(() => { button.textContent = original; }, 1800);
}
