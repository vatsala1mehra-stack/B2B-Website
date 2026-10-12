// Everything on the page that comes from config.js: navigation, the story
// copy for the chosen path, the plan and buy link, and the "Why Airtel" proof.
// Also owns which path (set up / expand / switch) the visitor has chosen.
import { CONFIG } from "./config.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}
const byName = new Map(CONFIG.products.map((p) => [p.name, p]));
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const isPlaceholder = (s) => /^\[.*\]$/.test(String(s).trim());
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------- Links ---------- */
$$(".js-checkout").forEach((a) => (a.href = CONFIG.checkoutUrl));
$$(".js-advisor").forEach((a) => (a.href = CONFIG.advisorUrl || CONFIG.checkoutUrl));
$$(".js-support").forEach((a) => (a.href = CONFIG.links?.support || CONFIG.checkoutUrl));
$$(".js-privacy").forEach((a) => (a.href = CONFIG.links?.privacy || CONFIG.checkoutUrl));
$$(".js-terms").forEach((a) => (a.href = CONFIG.links?.terms || CONFIG.checkoutUrl));

/* ---------- Products menu and footer, grouped by category ---------- */
const categories = [...new Set(CONFIG.products.map((p) => p.category))];
$(".menu-products")?.replaceChildren(...categories.map((cat) =>
  el("div", { class: "menu-group" },
    el("p", { class: "menu-group-title", text: cat }),
    ...CONFIG.products.filter((p) => p.category === cat).map((p) =>
      el("a", { href: CONFIG.checkoutUrl, title: p.blurb || "" }, p.name)))));
$(".js-footer-products")?.replaceChildren(...categories.map((cat) => el("a", { href: "#plan" }, cat)));

/* ---------- Menus: dropdowns on desktop, a sheet on phones ---------- */
const triggers = $$(".menu-trigger");
function closeMenus(except) {
  triggers.forEach((t) => { if (t !== except) t.setAttribute("aria-expanded", "false"); });
}
triggers.forEach((t) => t.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = t.getAttribute("aria-expanded") === "true";
  closeMenus(t);
  t.setAttribute("aria-expanded", String(!open));
}));
document.addEventListener("click", (e) => { if (!e.target.closest(".menu-item")) closeMenus(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = triggers.find((t) => t.getAttribute("aria-expanded") === "true");
  closeMenus();
  open?.focus();
  if (!mobileMenu.hidden) toggleMobile(false);
});
const toggle = $(".menu-toggle");
const mobileMenu = $("#mobile-menu");
function toggleMobile(open) {
  mobileMenu.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.documentElement.classList.toggle("menu-open", open);
}
toggle?.addEventListener("click", () => toggleMobile(mobileMenu.hidden));
mobileMenu?.addEventListener("click", (e) => { if (e.target.closest("a")) toggleMobile(false); });

// The nav gets a quiet background once you leave the story
const nav = $(".nav");
new IntersectionObserver(([e]) => nav.classList.toggle("is-solid", !e.isIntersecting), { rootMargin: "-60px 0px 0px 0px" })
  .observe($(".story"));

/* ---------- The chosen path ---------- */
const listeners = new Set();
const fromHash = () => (location.hash.slice(1) in CONFIG.paths ? location.hash.slice(1) : null);
export const site = {
  path: fromHash() || "setup",
  onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  setPath(path, { scroll = true } = {}) {
    if (!(path in CONFIG.paths)) return;
    const changed = path !== site.path;
    site.path = path;
    history.replaceState(null, "", `#${path}`);
    render();
    if (changed) listeners.forEach((fn) => fn(path));
    if (scroll) $('.beat[data-step="1"]')?.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
  },
};

// Any element with data-path picks that path and jumps into its story
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-path]");
  if (!a) return;
  e.preventDefault();
  closeMenus();
  site.setPath(a.dataset.path);
});

function getLine(names) {
  if (!names.length) return null;
  const items = names.map((n) => {
    const p = byName.get(n);
    if (!p) console.warn(`config.js: "${n}" is not in products.`);
    return typeof p?.price === "number" ? `${n} (from ${inr.format(p.price)}/mo)` : n;
  });
  return el("p", { class: "get" }, el("span", { class: "get-label", text: "You get" }), items.join(" · "));
}

function render() {
  const path = CONFIG.paths[site.path];

  // Story copy, steps 1-5
  const copies = $(".copies");
  $$(".copy:not(.copy-intro)", copies).forEach((c) => c.remove());
  path.beats.forEach((b, i) => {
    const c = el("div", { class: "copy", "data-step": String(i + 1) },
      el("p", { class: "eyebrow", text: `${path.short} · ${i + 1} of 5` }),
      el("h2", { text: b.title }),
      el("p", { class: "lede", text: b.text }));
    const get = getLine(b.get || []);
    if (get) c.append(get);
    copies.append(c);
  });
  $$(".move").forEach((m) => m.setAttribute("aria-pressed", String(m.dataset.path === site.path)));
  $$(".dots button").forEach((d, i) => d.setAttribute("aria-label", `${path.short}, step ${i + 1}: ${path.beats[i].title}`));

  // The plan
  const plan = path.plan;
  $(".js-plan-name").textContent = `Your plan: ${plan.name}`;
  $(".specs").replaceChildren(...plan.lines.map((l) => el("div", {}, el("dt", { text: l.area }), el("dd", { text: l.label }))));
  $(".price").textContent = typeof plan.price === "number" ? `${inr.format(plan.price)} a month` : "Price shown at checkout";
  const skus = plan.lines.flatMap((l) => l.products).map((n) => byName.get(n)?.sku).filter(Boolean);
  const url = new URL(CONFIG.checkoutUrl, location.href);
  url.searchParams.set("plan", plan.name);
  url.searchParams.set("items", skus.join(","));
  url.searchParams.set("utm_source", "office_story");
  url.searchParams.set("utm_content", site.path);
  $(".js-buy").href = url.href;
  const others = Object.entries(CONFIG.paths).filter(([k]) => k !== site.path);
  $(".js-other-paths").replaceChildren(...others.flatMap(([k, p], i) => [
    ...(i ? [document.createTextNode(" or ")] : []),
    el("a", { href: "#move", "data-path": k }, p.label.toLowerCase()),
  ]));
}

/* ---------- Why Airtel: credibility from config (placeholders until verified) ---------- */
function renderProof() {
  const proof = CONFIG.proof;
  if (!proof) return;
  $(".js-proof-headline").textContent = proof.headline;
  $(".js-stats").replaceChildren(...proof.stats.map((s) =>
    el("li", { class: isPlaceholder(s.value) ? "is-placeholder" : "" }, el("strong", { text: s.value }), el("span", { text: s.label }))));
  $(".js-logos").replaceChildren(...Array.from({ length: proof.clientLogos || 0 }, (_, i) =>
    // LOGO SLOT: replace with the client's official logo file (with permission)
    el("div", { class: "logo-slot", "aria-label": `Client logo ${i + 1} (placeholder)` }, "Client logo")));
  const q = proof.quote;
  $(".js-quote").replaceChildren(
    el("blockquote", { class: isPlaceholder(q.text) ? "is-placeholder" : "" }, el("p", { text: q.text })),
    el("figcaption", {}, el("strong", { text: q.name }), " ", el("span", { text: q.role })));
  $(".js-badges").replaceChildren(...proof.badges.map((b) => el("li", { class: isPlaceholder(b) ? "is-placeholder" : "", text: b })));
}

render();
renderProof();

/* ---------- Fallback story (no WebGL / Three.js unavailable) ---------- */
function fallbackStory() {
  const dots = $$(".dots button");
  const beats = $$(".beat");
  const show = (step) => {
    $$(".copy").forEach((c) => c.classList.toggle("is-active", +c.dataset.step === step));
    dots.forEach((d, j) => {
      d.classList.toggle("is-active", j === step - 1);
      if (j === step - 1) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
    $(".dots").classList.toggle("is-hidden", step < 1 || step > 5);
  };
  let current = 0;
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(current = +e.target.dataset.step)), { rootMargin: "-50% 0px -50% 0px" });
  beats.forEach((b) => io.observe(b));
  dots.forEach((d, j) => d.addEventListener("click", () => beats[j + 1].scrollIntoView()));
  site.onChange(() => show(current));
}
// story.js may fail before or after this module runs
if (document.documentElement.classList.contains("story-failed")) fallbackStory();
else window.addEventListener("story-failed", fallbackStory, { once: true });
