import { CONFIG } from "./config.js";

for (const a of document.querySelectorAll(".js-checkout")) a.href = CONFIG.checkoutUrl;
