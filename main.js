import { CONFIG } from "./config.js";

/* ---------- Nav ---------- */
for (const a of document.querySelectorAll(".js-checkout")) a.href = CONFIG.checkoutUrl;

/* ---------- Ending: spec list, price and the buy link ---------- */
const bundle = CONFIG.officeBundle;
const byName = new Map(CONFIG.products.map((p) => [p.name, p]));

const specs = document.querySelector(".specs");
if (specs && bundle) {
  specs.replaceChildren(...bundle.lines.map((line) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = line.area;
    dd.textContent = line.label;
    row.append(dt, dd);
    return row;
  }));

  const price = document.querySelector(".price");
  price.textContent = typeof bundle.price === "number"
    ? `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(bundle.price)} a month`
    : "Price shown at checkout";

  const skus = bundle.lines
    .flatMap((l) => l.products)
    .map((name) => {
      const p = byName.get(name);
      if (!p) console.warn(`config.js: officeBundle lists "${name}", which is not in products.`);
      return p?.sku;
    })
    .filter(Boolean);

  const url = new URL(CONFIG.checkoutUrl, location.href);
  url.searchParams.set("plan", bundle.plan);
  url.searchParams.set("items", skus.join(","));
  url.searchParams.set("utm_source", "office_story");
  document.querySelector(".js-buy").href = url.href;
}

const advisor = document.querySelector(".js-advisor");
if (advisor) advisor.href = CONFIG.advisorUrl || CONFIG.checkoutUrl;
