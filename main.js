import { CONFIG } from "./config.js";

const products = CONFIG.products.map((p, i) => ({ ...p, key: p.sku || `item-${i}` }));
const selected = new Set(loadSelection());

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

/* ---------- Links from config ---------- */
for (const a of document.querySelectorAll(".js-checkout")) a.href = CONFIG.checkoutUrl;

const guide = document.querySelector(".js-guide");
if (CONFIG.guideUrl) {
  guide.href = CONFIG.guideUrl;
  guide.target = "_blank";
  guide.rel = "noopener";
  guide.hidden = false;
}

/* ---------- Catalogue ---------- */
const filtersEl = document.querySelector(".filters");
const listEl = document.querySelector(".catalogue");
const categories = ["All", ...new Set(products.map((p) => p.category))];
let activeCategory = "All";

function renderFilters() {
  filtersEl.replaceChildren(
    ...categories.map((cat) => {
      const btn = el("button", { type: "button", class: "chip", "aria-pressed": String(cat === activeCategory), text: cat });
      btn.addEventListener("click", () => {
        activeCategory = cat;
        renderFilters();
        renderCatalogue();
      });
      return btn;
    })
  );
}

function priceNode(price) {
  if (typeof price !== "number") return el("span", { class: "price muted", text: "Pricing on request" });
  return el("span", { class: "price" }, inr.format(price), el("small", { text: " /mo" }));
}

function renderCatalogue() {
  const visible = products.filter((p) => activeCategory === "All" || p.category === activeCategory);
  listEl.replaceChildren(
    ...visible.map((p) => {
      const isOn = selected.has(p.key);
      const btn = el("button", {
        type: "button",
        class: "add-btn",
        "aria-pressed": String(isOn),
        "aria-label": `${isOn ? "Remove" : "Add"} ${p.name} ${isOn ? "from" : "to"} plan`,
        text: isOn ? "Added ✓" : "Add to plan",
      });
      btn.addEventListener("click", () => toggle(p.key));
      return el(
        "li",
        { class: `product${isOn ? " is-selected" : ""}`, "data-sku": p.sku },
        el("span", { class: "product-cat", text: p.category }),
        el("h3", { text: p.name }),
        el("p", { text: p.blurb || "" }),
        el("div", { class: "product-foot" }, priceNode(p.price), btn)
      );
    })
  );
}

/* ---------- Plan (selected products) ---------- */
const planList = document.querySelector(".plan-list");

function renderPlan() {
  planList.replaceChildren(
    ...products
      .filter((p) => selected.has(p.key))
      .map((p) => {
        const rm = el("button", { type: "button", "aria-label": `Remove ${p.name}`, text: "Remove" });
        rm.addEventListener("click", () => toggle(p.key));
        return el("li", {}, el("span", { text: p.name }), rm);
      })
  );
}

function toggle(key) {
  selected.has(key) ? selected.delete(key) : selected.add(key);
  saveSelection();
  renderCatalogue();
  renderPlan();
}

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem("ab-plan") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveSelection() {
  try { localStorage.setItem("ab-plan", JSON.stringify([...selected])); } catch { /* storage unavailable */ }
}

/* ---------- Lead form ---------- */
const form = document.querySelector(".lead-form");
const statusEl = form.querySelector(".form-status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("is-error", isError);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  let firstInvalid = null;
  for (const field of form.elements) {
    if (!field.willValidate) continue;
    const ok = field.checkValidity();
    field.setAttribute("aria-invalid", String(!ok));
    if (!ok && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) {
    setStatus("Please check the highlighted fields.", true);
    firstInvalid.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const payload = {
    ...data,
    products: products.filter((p) => selected.has(p.key)).map(({ name, sku, category }) => ({ name, sku, category })),
    source: location.href,
    submittedAt: new Date().toISOString(),
  };

  if (!CONFIG.leadEndpoint) {
    // No endpoint configured yet: hand off to the main Airtel Business site.
    setStatus("Taking you to Airtel Business to complete your enquiry…");
    window.location.href = CONFIG.checkoutUrl;
    return;
  }

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  setStatus("Sending…");
  try {
    const res = await fetch(CONFIG.leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    form.reset();
    selected.clear();
    saveSelection();
    renderCatalogue();
    renderPlan();
    setStatus("Thanks — a specialist will call you shortly.");
  } catch (err) {
    console.error("Lead submission failed:", err);
    setStatus("Something went wrong. Please try again, or use “Get started” above.", true);
  } finally {
    submit.disabled = false;
  }
});

form.addEventListener("input", (e) => {
  if (e.target.getAttribute("aria-invalid") === "true" && e.target.checkValidity()) {
    e.target.setAttribute("aria-invalid", "false");
  }
});

renderFilters();
renderCatalogue();
renderPlan();
