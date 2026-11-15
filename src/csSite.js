/*
Content script that runs on every page of www.roblox.com. It applies the saved theme, the site-wide version of themes
that support it (Cherry Blossom, RGB Flow), the animated layer, and the item hover card. Trade features live in the
other content scripts.
*/
import { initTheme } from "./themes";
import { initSiteTheme } from "./siteTheme";
import { initAmbient } from "./ambient";
import { injectFeatureStyles } from "./featureStyles";
import { initHoverCard } from "./features/hoverCard";

initTheme();
initSiteTheme();
initAmbient();
injectFeatureStyles();
initHoverCard();
