/*
Sort and filter for the inventories on the trade send / counter window.
It never moves or removes Roblox's elements: sorting uses the CSS "order" property and filtering uses display:none,
so Roblox's own scripts keep working with the same DOM.
*/
import * as utilities from "../utilities";

const SORTS = [
    { id: "default", label: "Default order" },
    { id: "value-desc", label: "Value: high to low" },
    { id: "value-asc", label: "Value: low to high" },
    { id: "rap-desc", label: "RAP: high to low" },
    { id: "name", label: "Name: A to Z" }
];
const FILTERS = [
    { id: "rare", label: "Rare", test: (info) => info.rare },
    { id: "projected", label: "Projected", test: (info) => info.projected },
    { id: "valued", label: "Has value", test: (info) => info.hasValue },
    { id: "rap", label: "RAP only", test: (info) => !info.hasValue }
];

const state = { sort: "default", filters: new Set() };

function getCardInfo(card) {
    const textDiv = card.querySelector(".item-card-price");
    const link = textDiv?.parentElement?.querySelector(":scope > a") || textDiv?.parentElement?.parentElement;
    if (!link?.pathname) return null;
    const path = utilities.removeTwoLetterPath(link.pathname);
    const id = utilities.getItemIdFromPath(path);
    const type = utilities.getItemTypeFromPath(path);
    const info = utilities.getItemInfo(id, type);
    return { id, type, info, name: info?.name ?? card.querySelector(".item-card-name")?.textContent?.trim() ?? "" };
}

function sortKey(entry, sort) {
    const info = entry.info;
    switch (sort) {
        case "value-desc": return -(info?.value ?? -1);
        case "value-asc": return info?.value ?? Number.MAX_SAFE_INTEGER;
        case "rap-desc": return -(info?.rap ?? -1);
        default: return 0;
    }
}

function applyToHolder(holder) {
    for (const list of holder.querySelectorAll(".hlist")) {
        if (!list.dataset.rvFlex) {
            list.dataset.rvFlex = "1";
            list.style.setProperty("display", "flex", "important");
            list.style.setProperty("flex-wrap", "wrap", "important");
        }
        const entries = [];
        for (const card of list.querySelectorAll(".item-card-container")) {
            const wrapper = card.closest("li") || card.parentElement;
            const details = getCardInfo(card);
            if (!wrapper || !details) continue;
            entries.push({ wrapper, ...details });
        }

        //filter: show an item if it matches ANY selected filter (or all items when none are selected)
        const activeFilters = FILTERS.filter((filter) => state.filters.has(filter.id));
        for (const entry of entries) {
            const visible = activeFilters.length === 0 || (entry.info && activeFilters.some((filter) => filter.test(entry.info)));
            entry.wrapper.style.display = visible ? "" : "none";
        }

        //sort
        if (state.sort === "default") {
            entries.forEach((entry) => entry.wrapper.style.removeProperty("order"));
            continue;
        }
        const ordered = [...entries].sort((a, b) => {
            if (state.sort === "name") return a.name.localeCompare(b.name);
            return sortKey(a, state.sort) - sortKey(b, state.sort);
        });
        ordered.forEach((entry, index) => {
            entry.wrapper.style.order = String(index);
        });
    }
}

function resetHolder(holder) {
    for (const list of holder.querySelectorAll(".hlist")) {
        if (list.dataset.rvFlex) {
            delete list.dataset.rvFlex;
            list.style.removeProperty("display");
            list.style.removeProperty("flex-wrap");
        }
        for (const wrapper of list.children) {
            wrapper.style.removeProperty("order");
            wrapper.style.display = "";
        }
    }
}

function buildToolbar(holder) {
    const toolbar = document.createElement("div");
    toolbar.id = "rovalkInvToolbar";

    const sortLabel = document.createElement("span");
    sortLabel.textContent = "Sort:";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Sort inventory");
    SORTS.forEach((sort) => {
        const option = document.createElement("option");
        option.value = sort.id;
        option.textContent = sort.label;
        select.appendChild(option);
    });
    select.value = state.sort;
    select.addEventListener("change", () => {
        state.sort = select.value;
        applyToHolder(holder);
    });

    const filterLabel = document.createElement("span");
    filterLabel.textContent = "Show only:";
    toolbar.append(sortLabel, select, filterLabel);

    FILTERS.forEach((filter) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "rv-chip";
        chip.textContent = filter.label;
        chip.setAttribute("aria-pressed", String(state.filters.has(filter.id)));
        chip.addEventListener("click", () => {
            if (state.filters.has(filter.id)) state.filters.delete(filter.id);
            else state.filters.add(filter.id);
            chip.setAttribute("aria-pressed", String(state.filters.has(filter.id)));
            applyToHolder(holder);
        });
        toolbar.appendChild(chip);
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "rv-chip";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => {
        state.sort = "default";
        state.filters.clear();
        select.value = "default";
        toolbar.querySelectorAll("[aria-pressed]").forEach((chip) => chip.setAttribute("aria-pressed", "false"));
        applyToHolder(holder);
    });
    toolbar.appendChild(reset);
    return toolbar;
}

async function updateInventoryTools() {
    const holder = document.querySelector(".inventory-panel-holder");
    const enabled = await utilities.getOption("Inventory Sort & Filter");
    if (utilities.getPageType() !== "sendOrCounter" || !enabled) {
        document.getElementById("rovalkInvToolbar")?.remove();
        if (holder) resetHolder(holder);
        return;
    }
    if (!holder) return;
    const existing = document.getElementById("rovalkInvToolbar");
    if (existing && existing.nextElementSibling !== holder) existing.remove(); //Roblox re-rendered the panel; rebuild so the controls point at the new one
    if (!document.getElementById("rovalkInvToolbar")) {
        holder.parentElement.insertBefore(buildToolbar(holder), holder);
    }
    applyToHolder(holder); //re-applies after Roblox loads more items
}

export default updateInventoryTools;
