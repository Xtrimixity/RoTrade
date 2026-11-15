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
