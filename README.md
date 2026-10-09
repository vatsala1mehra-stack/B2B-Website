# Airtel Business — Founders site

A static marketing site for Airtel Business aimed at new-age B2B founders in India.
Plain HTML, CSS and JavaScript — no build step, no dependencies to install.
It runs as-is on GitHub Pages or any static host.

## Files

| File | What it is | Who edits it |
| --- | --- | --- |
| `config.js` | **The single place to change site content**: checkout link, lead form endpoint, guide link and the product catalogue. | Business team |
| `index.html` | Page structure and copy (hero, solutions, why Airtel, contact form). Holds the Three.js import map and the **BRAND SLOT** for the official logo. | Web / marketing |
| `styles.css` | All styling. Brand colours, font and spacing are CSS variables at the top (`:root`). | Web |
| `main.js` | Reads `config.js`, renders the product catalogue and category filters, manages the “Your plan” selection, and submits the lead form. | Web |
| `scene.js` | The decorative 3D network globe in the hero, built with Three.js 0.160. | Web |
| `.nojekyll` | Tells GitHub Pages to serve files as-is without Jekyll processing. | — |

## Editing `config.js`

```js
export const CONFIG = {
  checkoutUrl: "https://www.airtel.in/business/", // where "Get started" buttons go
  leadEndpoint: "",   // URL that receives the lead form as JSON (POST)
  guideUrl: "",       // founder's guide download; empty hides the button
  products: [
    { name: "Business Postpaid", category: "Mobility", sku: "SKU-TBD-POSTPAID", price: null, blurb: "…" },
    // …
  ],
};
```

- **price** — a number in INR per month (e.g. `499`), shown as “₹499 /mo”. Use `null` to show “Pricing on request”.
- **category** — products are grouped into filter chips by category. Spell each category identically across products.
- **sku** — the SKUs in the file are placeholders (`SKU-TBD-…`). Replace them with real codes; they are sent with every lead.
- **blurb** — one-line description shown on the product card.
- To add or remove a product, add or delete a `{ … },` line. Keep the commas and quotes — a syntax error stops the page from loading. Open the page after editing to check.

### Lead form behaviour

- **`leadEndpoint` set:** the form POSTs JSON to that URL:
  ```json
  {
    "name": "…", "company": "…", "email": "…", "phone": "…",
    "teamSize": "11-50", "notes": "…",
    "products": [{ "name": "Business Postpaid", "sku": "SKU-TBD-POSTPAID", "category": "Mobility" }],
    "source": "https://…", "submittedAt": "2026-10-09T10:00:00.000Z"
  }
  ```
  Any 2xx response counts as success. The endpoint must allow cross-origin requests (CORS) from the site’s domain.
- **`leadEndpoint` empty:** after validation the visitor is sent to `checkoutUrl` to complete their enquiry there.

## Brand

- Accent colour is Airtel red `#e40000` (`--brand-red` in `styles.css`). All colours are CSS variables; the site also follows the visitor’s light/dark preference.
- **Manrope** (Google Fonts) is a stand-in typeface. To switch, change the font link in `index.html` and `--font-sans` in `styles.css`.
- **The Airtel logo is intentionally not drawn.** Look for the `BRAND SLOT` comment in `index.html` header: drop in the official file supplied by the brand team (e.g. `assets/airtel-business-logo.svg`) and remove the placeholder text wordmark.

## Three.js

Three.js **0.160.0** is loaded from `cdn.jsdelivr.net` via the import map in `index.html`:

```html
<script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
```

The hero animation pauses when off-screen or in a background tab, shows a still frame for visitors who prefer reduced motion, and falls back to the CSS gradient if WebGL or the CDN is unavailable.

## Running locally

ES modules don’t load from `file://`, so serve the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

1. Push to GitHub.
2. In the repository go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch (e.g. `main`) and folder `/ (root)`, and save.

All asset paths are relative, so the site works at `https://<user>.github.io/<repo>/` as well as on a custom domain.
