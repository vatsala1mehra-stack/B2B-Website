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

/* ---------- Fallback story (no WebGL / Three.js unavailable) ---------- */
// The 3D story lives in story.js. If it can't load, keep the words, dots and
// keyboard working over the static poster.
function fallbackStory() {
  const copies = [...document.querySelectorAll(".copy")];
  const dots = [...document.querySelectorAll(".dots button")];
  const beats = [...document.querySelectorAll(".beat")];
  const show = (i) => {
    copies.forEach((c, j) => c.classList.toggle("is-active", j === i));
    dots.forEach((d, j) => (j === i ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
    dots.forEach((d, j) => d.classList.toggle("is-active", j === i));
    document.querySelector(".dots").classList.toggle("is-hidden", i >= dots.length);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.beat)), { rootMargin: "-50% 0px -50% 0px" });
  beats.forEach((b) => io.observe(b));
  dots.forEach((d, j) => d.addEventListener("click", () => beats[j].scrollIntoView()));
}
// story.js may fail before or after this module runs
if (document.documentElement.classList.contains("story-failed")) fallbackStory();
else window.addEventListener("story-failed", fallbackStory, { once: true });
