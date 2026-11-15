# Chrome Web Store listing (draft)

**Name:** RoTrade - Roblox Trading Addon
**Category:** Tools (or Fun)
**Short description (132 chars max):**
Trade smarter on Roblox: live values, win/loss badges, market data, trade pictures, Discord alerts and Rolimons ad posting.

**Full description:**
RoTrade adds everything a Roblox limited trader needs right into the Roblox website.

• Win/loss badge on every trade, with value and RAP differences
• Breakdown panel: give vs get, where the value is, warnings for projected or low-demand items
• Market data from real Roblox sales: up/down arrows, best price, RAP after the next sale
• Hover any limited to see its value, RAP, demand and trend
• Trade list grades with best-to-worst sorting and expiry timers
• Share a picture of any trade, or get Discord notifications with trade pictures
• Build a Rolimons trade ad and let RoTrade post it every 15.5 minutes
• Wishlist, value change tracking, goal planner, portfolio and trade history stats
• Themes: RoTrade Orange, Roblox Default, Cherry Blossom, RGB Flow

Values come from Rolimons. RoTrade is based on the open-source RoValk extension and is not affiliated with Roblox or Rolimons.

**Single purpose (for the review form):**
Helps users evaluate and manage Roblox limited item trades by showing item values and trade tools on roblox.com.

**Permission justifications:**
- storage: saves settings, trade history, wishlist and the user's trade ad locally.
- alarms: periodic trade checks, value change checks and scheduled Rolimons ad posting.
- notifications (optional): trade and value alerts the user switches on.
- *.roblox.com: shows values and tools on Roblox pages and reads the user's trades, inventory and market data with their own login.
- *.rbxcdn.com: loads item pictures for trade images.
- api.rolimons.com: item values, player info and posting the user's own trade ad.
- discord.com webhooks (optional): sends notifications to the webhook URL the user adds.

**Remote code:** No. All code is inside the package.
**Data usage:** Handles authentication info (uses the user's existing Roblox/Rolimons logins in the browser) and website content; nothing is sold, transferred to third parties beyond the user's own choices (Rolimons ads, their Discord webhook), or used for unrelated purposes.
