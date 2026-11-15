# RoTrade

A Roblox trading companion for Chrome: live Rolimons values, Roblox market data, trade breakdowns, Discord alerts and automatic Rolimons trade ads.
RoTrade is based on [RoValk](https://github.com/KDJDEV/RoValk) by KDJDEV (MIT licence).

## Features (v1.0.0)
- Win/loss badge between the two sides of every trade, plus a breakdown panel (give vs get, where the value is, warnings)
- Market data from Roblox sales: up/down arrows, best price, RAP after the next sale, price history
- Hover card on any limited across roblox.com
- Inventory totals card on profiles and inventory pages (value, RAP, limiteds, top item)
- Trade list grades, best-to-worst sorting, expiry timers
- Even-it-out suggestions, good deal finder, partner card, serial numbers, demand badges, wishlist stars
- Trade pictures to share (Image button) and Discord webhook notifications with a picture of each trade
- Rolimons trade ad builder that auto-posts every 15.5 minutes
- Tools: wishlist, value changes, goal planner, compare offers, portfolio, expiring trades
- Themes: RoTrade Orange, Roblox Default (follows Roblox dark/light), Cherry Blossom, RGB Flow

## Build
```
yarn install
yarn build
```
Load the `dist` folder at chrome://extensions (Developer mode → Load unpacked).

## Privacy
See [PRIVACY.md](PRIVACY.md).

---
# Development history (before 1.0, as RoValk+)

## What's new in 3.15.3
- Trade pictures no longer have the "Values: Rolimons..." note in the bottom corner.

## What's new in 3.15.2
- Trade pictures (Image button and Discord): the value and RAP differences under the win/loss ring are now separate bubbles, green when you gain, red when you lose, grey when even.

## What's new in 3.15.1
- **Discord notifications now include a picture of the trade**: both sides with item pictures, values, RAP, projected / rare tags, totals and the win/loss ring, attached to the message.
- **New trade picture** for the Image button: a cleaner dark card layout in RoTrade orange with real item thumbnails, a win/loss ring between the two sides, value and RAP totals and a verdict badge. It's drawn by the background worker so thumbnails always load.
- Game tiles: the title and the likes line no longer touch or get clipped by the ring at the corner; tile content sits a few pixels inside it.
- The small Rolimons value icon next to item values is blue again.
- New permission: Roblox's image CDN (*.rbxcdn.com), so RoTrade can put item pictures into trade images.

## What's new in 3.15.0
- **Renamed to RoTrade.** New name everywhere you see it (popup, notifications, images, Chrome's extension list), with "based on RoValk" in faint text under the name. The icon is the RoValk icon recoloured orange, and the small mark next to item values is orange too.
- **RoTrade Orange** replaces RoValk Violet as the default theme, and every leftover violet colour is now orange.
- **New Roblox Default theme**: leaves Roblox looking exactly like normal (no trade page redesign, no site repaint) and RoTrade's own panels follow your Roblox dark / light mode, switching live if you change it in Roblox settings.
- **Discord webhook notifications** (optional): Settings → Discord webhook. Paste a webhook URL, pick what to send (new / accepted / declined trades with both sides and values, trade ad posted or failed, value changes on your items) and press Send test. Discord access is asked for only when you switch it on.
- **Continue row fixed**: each game shows one ring. Roblox wraps tiles inside other tile elements there, and both were getting a ring; now only the innermost tile is styled and every wrapper around a single tile is see-through.
- **No more tab to rovalk.com** on install or update.
- **Removed** price alerts and wishlist trade notifications (the wishlist itself and its stars stay).
- Removed leftover unused files (old flag images, Discord invite widget, promo images).

## What's new in 3.14.1
- **RAP after sale fixed.** Market lookups now run in the extension's background worker (with your Roblox login and RoValk's own permission for roblox.com) instead of from the page, where the browser could block them and leave the hover card blank. The cheapest listing now comes from Roblox's catalog details first, with the resellers list only as a fallback, and each source is tried on its own, so one broken Roblox endpoint no longer empties everything. When Roblox really doesn't answer, the hover card and Market table say "couldn't load" and the tooltip names which lookups failed; failures are retried after a minute. The browser console (F12) also logs a "RoValk market" line per item that had a problem.
- **Game tiles**: removed the second, offset frame behind every tile (the list item around each tile was being painted as a card too).
- **Server cards**: removed Roblox's square inner box so each server shows as one rounded card.
- Section headers like "Recommended For You" no longer get a panel background.
- **Removed the shortcut keys** feature.

## What's new in 3.14.0
**A cleaner, smoother popup**
- Rebuilt from scratch: slim header with a **Trade Ad** button, one tab bar (Settings, Trade Ads, Tools, Stats, Themes) with a sliding highlight, and pages that fade in.
- **Settings** replaces the long Options list: grouped cards you can fold away (Look & feel, Trade page, Trade list, Items, Profiles & catalog, Tracking, Notifications), a plain-English name and one-line description on every setting, smooth switches, an "x/y on" count per group, and a search box.
- **Trade Ads builder** picks items from tiles with their Roblox thumbnails; click a tile to add it, click again to take it out. Picked items and requests show as chips with thumbnails.
- The wishlist shows item thumbnails. Every switch in the popup uses the same style.

**Hover cards always show RAP after sale**: the card now has "RAP after sale" (with how much it moves) and "Best price" right in its main grid, filled in as soon as Roblox's listings load, and says so plainly when nothing is listed.

**Removed** (to cut clutter): the trade calculator (tab, Calculator button, O shortcut), the Connect tab (Discord / review / donation links), the fairness meter and overpay helper in the breakdown panel (the win/loss badge and Even-it-out cover them), the trade page style picker (Glass is used), the custom accent color (themes with a gear still let you edit colors), theme animations, the compact trade layout and the mobile trade items button. Their saved settings are cleared on update.

## What's new in 3.13.1
- **Every item always shows going up or going down.** The arrow on item cards, in the Market table and on the hover card never shows a flat dash any more. It uses the best signal available (this week's sale prices, then this month's, then cheapest listing vs RAP, last sale vs RAP, Rolimons trend, value vs RAP) and the tooltip says which one it used. Small moves show one decimal (▲ +0.4%). Bundles and items without sales get an arrow too.
- **Trade ad builder is easier to find**: a **Trade Ad** button in the popup header, the Trade Ads tab moved right after Options with a green dot when auto-post is on, a Trade Ads card at the top of Options, and a **Trade ad** button above your trade list on roblox.com/trades.
- **Notification when a trade ad posts** (or can't post because your Rolimons login expired, etc.): switch it on in the Trade Ads tab or Options → Trade Ad Posted Notifications.
- **Game tiles**: every game tile now has the same clear ring all the time (it used to look good only while hovered and thin and flickery otherwise). Hovering just lifts the tile a little. The RGB ring only shifts color and no longer rotates in steps, and the site-wide repaint no longer touches anything inside tiles.
- **No more random rainbow text**: headings and titles stay the normal theme text color everywhere (rainbow text was applied by class name, so some titles changed and others next to them didn't). Buttons and bars keep their gradients.
- **Matching item icons**: value (V), RAP-only (R), rare (★) and projected (P) are now the same round badge style everywhere, stacked in the corner so they never cover the price arrow.
- **Sort trades best to worst**: the bar above the trade list has Newest / Best trade first / Worst trade first (J / K shortcuts follow it). Trade history gets "Best trade first (%)" and "Worst trade first (%)" sorts too.

## What's new in 3.13.0
**Market data (Roblox sales)**
- **Market pulse**: every item in a trade gets a small arrow with its 7-day price change. The breakdown panel has a Market table: best price (cheapest copy for sale), RAP and what RAP becomes if that copy sells, 7 and 30 day change, a 60-day price line and sales per day, plus "RAP if the cheapest copies sell next" totals for each side. Item names open the full sale list on Rolimons.
- **Might-be-projected check**: warns when an item's RAP sits well above what it has actually been selling for, even before Rolimons marks it projected. Also warns when the cheapest copy is far under RAP (RAP about to drop) and when an item is rising or falling fast.
- **Hover card on every Roblox page**: rest the mouse on any limited to see value, RAP, demand, trend, flags, best price, RAP after the next sale and a price line, with a star to add it to your wishlist.
- **Good deal finder** (send / counter page): marks items in their inventory that are worth asking for: "Underrated" (sells above its Rolimons value), "Rising" (price up 10%+ this week) or Rolimons trend Raising.

**Trade page**
- **Even it out**: on the send / counter page, when a trade isn't fair it suggests 1-2 items from their inventory to ask for (or yours to add) and shows the resulting percentage.
- **Trade partner card**: avatar, account age, last online, Rolimons value / RAP / rank / badges and the trades you've already done with them.
- **Serial numbers** on trade cards, with gold badges for special serials (#1-100, 1337, 222, 1234, palindromes).
- **Demand badges** on item cards, and new warnings for low-demand, lowering-trend and hyped items you'd receive.
- **Wishlist highlights**: starred items get a gold star and glow anywhere they show up in trades.
- **Image** button: saves the trade as a PNG (and copies it) to share in Discord.
- **Calculator** button: opens the trade in the popup calculator so you can try swapping items.
- **Shortcut keys**: J / K next and previous trade, C copy, I image, O calculator, H hide panel, ? help. Accept / decline / send never get shortcuts.
- **Trade list**: each row gets a win/loss ring and percentage, a "hide trades worse than..." filter, and how long the trade has left before it expires.

**Popup**
- **Trade Ads tab**: build a Rolimons trade ad (up to 4 offered items from your inventory, up to 4 requests made of items and tags) and switch on auto-posting every 15.5 minutes, capped at Rolimons' 55 a day. Shows last / next post, today's count and a log. Uses your own Rolimons login in this browser, so sign in at rolimons.com and verify first; posts only happen while Chrome is open.
- **Tools tab**: Wishlist, Price alerts (notify when the cheapest copy hits your price), Value changes (every Rolimons value change, yours first, with optional notifications), Goal planner (which of your items add up to an item you want), Compare offers (inbound trades asking for the same item, side by side), Portfolio (inventory breakdown donut, projected / RAP-only / rare share, value over time) and Expiring trades.
- **Stats / history**: Export CSV, and a hindsight line on each trade (how the items you gave and got have moved since) plus a Hindsight total.

**Notifications (off by default, turn on in Options)**: Wishlist Trade Notifications, Value Change Notifications, Price Alert Notifications.

**Fixes**: rare / hyped flags now read the right Rolimons column (detected from the data itself); clicking a trade notification opens your trades again; trade expiry is now cached; a content-script crash risk from importing background code is avoided.

**Permissions**: host access widened to `*.roblox.com` (market data, inventories, trade data) and `api.rolimons.com` (trade ad posting). Chrome may ask you to accept this when the update installs.

## What's new in 3.12.0
- **Win/loss orb**: the RAP and value boxes between "Items you will give" and "Items you will receive" are now one round badge of their own. A ring in the middle fills with how far the trade leans (a full ring is 50% or more) and turns green, accent or red for win, fair or loss; the RAP pill sits on the left and the value pill on the right, each with the before → after totals. Big wins and losses pulse gently. It shrinks to fit the narrower send / counter column.
- **Trade breakdown panel** under the offers, with a header verdict chip, a Copy button and a Hide/Show toggle that is remembered:
  - Fairness meter with a marker, a shaded "fair" zone and a -50% to +50% scale.
  - Give vs get table: items, value, RAP, Robux and what each side is worth after Roblox's 30% fee, with the difference column colored.
  - "Where the value is": a bar per side showing how much of it each item makes up, with a legend.
  - Warnings: projected items you'd receive, rare items you'd give, items with no Rolimons value or not tracked at all, upgrades / downgrades, value and RAP disagreeing, and Robux after the fee.
  - Shorter overpay helper line.
- Give and get sides get a red / green edge, and the total rows are a soft footer bar.
- Copied trade summaries now include RAP and rare / projected tags.
- Removed: Trade Notes (and their search on the history page), the separate "Post-Tax Trade Value" box (the after-fee numbers are in the breakdown now) and the "Disable Win/Loss Stats RAP" switch. Old notes and settings for these are cleared on update.
- New switches under Trade Tools: Trade Breakdown and Trade Warnings.
- Fixes: items Rolimons does not track no longer subtract 1 from totals; the Robux box no longer stacks duplicate listeners; the background script no longer imports a missing default export; removed the unused legacy csMain.js.

## What's new in 3.11.0
- Only three themes now: RoValk Violet (default), Cherry Blossom and RGB Flow. A theme you had picked that no longer exists falls back to the default.
- Lighter animation: the petals draw at most 30 frames a second at normal pixel density, there are far fewer of them, and they stop entirely while the tab is hidden. The RGB color changes about twice a second instead of every frame, and the grey-panel repaint now reads a batch before writing it, so Roblox pages stay smooth.
- Cooler RGB: rainbow borders that slowly rotate around every panel and item card, a flowing rainbow strip across the top of the page and under the header, gradient headings, buttons and progress bars, a three-corner color wash, glowing scrollbars and selection. It also tints every grey panel the site-wide repaint finds, so it reaches nearly everything on www.roblox.com.
- Fixed the total rows (Robux, RAP and Rolimons value) spilling past the bottom border of the trade box.
- The Rolimons quick link now shows on every item in trades, including items Rolimons does not track, items already placed in a trade and cards drawn later; one odd card can no longer stop the others from getting theirs.

## What's new in 3.10.8
- Much stronger RGB glow: brighter glowing borders with an inner glow, a bigger three-corner color wash and glowing headings. Strength now runs 1-10 up to a vivid maximum (default 5), and cycle time 10-300 seconds.
- New standalone theme: RGB Flow. The accent colors, borders and page glow all drift through the rainbow together, on the whole Roblox site. Always on; strength and speed are in its gear editor.
- The hue moves in 360 small steps, so the page restyles a few times a second instead of every frame.

## What's new in 3.10.7
- Cherry Blossom: a visible RGB button on the theme card turns the soft RGB glow on or off (strength and speed are in the gear editor).
- Site-wide theme now repaints any leftover grey Roblox panels, grey borders and the white selected-tab underline automatically, even when Roblox changes its class names.

## What's new in 3.10.6
- Clicking a rare, projected, value or RAP icon on an item opens that item's Rolimons page in a new tab (bundles open the Rolimons bundle page).

## What's new in 3.10.5
- Cherry Blossom site theme now also covers server cards, the left menu, settings menus and user dropdowns, and Roblox's newer utility-styled panels.
- Soft RGB glow for Cherry Blossom (gear button in the Themes tab): a very light, very slow, transparent color drift on borders and page edges. Off by default; adjustable strength and cycle time.

## What's new in 3.10.4
- Cherry Blossom now themes the whole www.roblox.com site (page, header, menus, cards, buttons, fields, scrollbars) with drifting petals on every page. Turn it off in Options -> Appearance -> Site-Wide Theme.
- Cherry Blossom has a gear button in the corner of its card in the Themes tab: edit 9 colors (accent, accent 2, background, text, panels, borders, value numbers, win, loss). Changes apply instantly everywhere, petals follow the colors, and there is a reset button.

## What's new in 3.10.3
- Trade page redesign: items sit closer together on one row (small gap, never touching).
- Running profit chart: hover (or tap) to see the date and your running profit at that point.
- Stats and history: pick a time window (All time, 30 days, 6 months, 1 year, This year, or a custom from/to date; leave the end empty for today). It applies to the stats, the chart and the trade list.

## What's new in 3.10.2
- Trade page redesign: items now stay inside their boxes (border-box sizing, tighter padding, no double framing, item rows wrap).
- "Open full history" now opens the real popup page even when the build renames it.

## What's new in 3.10.1

- Fixed a build failure in 3.10.0 (`getExtensionTitle`, `getColorMode` and other helpers were missing from `utilities.js`).

## What's new in 3.10.0

- **6 animated themes**: Snowfall (falling snow), Starry Night (twinkling sky with the odd shooting star), Cherry Blossom (drifting petals), Digital Rain, Rainy Night (rain with a distant, soft lightning pulse) and Firefly Meadow. They show an "Animated" badge in the Themes tab and play on Roblox pages and in the popup. Turn them off with **Options -> Appearance -> Ambient Particles**. Nothing animates if your system asks for reduced motion.
- **Valued vs RAP-only icons fixed**: an item only gets the gold V when Rolimons has set a value for it (like the Legit hat). Items priced only by RAP (like Frosting Flyers) get the blue R.
- **Item badges are smaller** and sit inside the thumbnail corner.

## What's new in 3.9.0

- **Overpay Helper** under the fairness meter: how many Robux would make a trade fair (counts Roblox's 30% fee).
- **Inventory Sort & Filter** on the send/counter window: sort by value, RAP or name; show only rare, projected, valued or RAP-only items.
- **Trade Notes**: write why you made a trade; saved per trade and shown in the history.
- **Value icons**: new "has a Rolimons value" and "RAP only" icons next to the existing rare and projected ones.
- **Value Tier Borders**: item cards get a coloured border by value (under 5K, 5K, 25K, 100K, 500K+).
- **Trade History** (background tracker) with a **Stats** tab: wins, losses, win rate, net profit, volume, a profit chart, and a full searchable history page. Profit can use current prices (updates as values change) or the values saved when the trade was recorded.
- **Calculator** tab: search items by name and compare two sides without opening Roblox.
- **Profile Value Banner** and **Inventory Summary**: total value, RAP, counts, rares and top item.
- **Theme Animations**: a different animated effect for each theme (trade page redesign must be on; respects reduced-motion).
- **Compact Trade Layout**: tighter trades page.

New code: `tradeMath.js`, `tradeHistory.js` (background), `history.js`, `calculator.js`, `pageEffects.js`, `tradeId.js`, and files in `src/features/`.

## What's new in 3.8.1

- The Trade Fairness Meter now also shows on completed, declined and expired trades (under the offers, marked "final"). It uses current values.

## What's new in 3.8.0

- **Full trade page redesign** (Options -> Appearance -> Trade Page Redesign). Restyles the whole Roblox trades page with the active theme: background glow, panels, trade list, offers, item cards, buttons, tabs, inputs, modals and scrollbars. Pick a **Glass**, **Soft** or **Sharp** style in the Themes tab. All 10 themes work with it.
- The redesign lives in `src/tradeRedesign.js`, grouped by page area, so fixing it after a Roblox page update is a one-file job.
- `yarn build` now works on Windows.

## What's new in 3.7.0

- **10 themes** (RoValk Violet, Midnight Aurora, Synthwave, Ocean Depths, Forest Canopy, Sunset Ember, Rose Quartz, Mono Ink, Golden Hour, Neon Terminal) chosen from the new **Themes** tab. A theme restyles the popup and everything RoValk draws on Roblox pages (values, win/loss boxes, tax reminder, flags).
- **Custom accent color** that overrides the selected theme's accent.
- **Trade Fairness Meter**: a bar on trade detail and send/counter pages showing how much you win or lose, using Rolimons value (RAP when there is no value) plus Robux.
- **Copy Trade Summary**: one click copies a text summary of both sides with values, totals and the verdict.
- **Compact Value Numbers**: shows large values as 1.25M / 48.5K.

New code lives in `src/themes.js` and `src/features/tradeTools.js`.


RoValk is a browser extension for Roblox traders. It adds item values, RAP and
trade calculations, item flags, profile information, trade notifications, and
other quality-of-life features to supported Roblox pages.

## Requirements

- Node.js
- Yarn 3 (the repository uses Yarn `3.6.1`)

## Build

Install dependencies and create a production build:

```bash
yarn install
yarn build
```

The compiled extension is written to `dist/`. Source maps are disabled in the
production build.

For development, run Parcel in watch mode:

```bash
yarn start
```

To load a local build in Chromium-based browsers, open the extensions page,
enable developer mode, choose **Load unpacked**, and select the generated
`dist/` directory.

## Permissions and Data

RoValk runs only on matching Roblox trade, catalog, profile, and inventory
pages. It stores feature settings, cached item data, and (when trade features
are enabled) cached trade data in the browser's local extension storage.

The extension requests data from Roblox APIs and from the Rolimons API. It
uses the signed-in Roblox session for features that read trades, inventories,
profiles, or trade status. Notification permission is optional and is only
needed for trade notifications. Review the source and the permissions in
`src/manifest.json` before installing an unofficial build.

RoValk is not affiliated with Roblox Corporation or Rolimons.

## Contributing

Pull requests are welcome for bug fixes, new features, and enhancements. Please keep changes focused, describe how you
tested them, and do not include credentials, cookies, generated builds, or
personal data in commits.

## License

RoValk is available under the [MIT License](LICENSE).
