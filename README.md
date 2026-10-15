# Airtel Business — "Your office. Taken care of."

A scroll story for new-age B2B founders in India: a dim, empty office comes to
life as one red line (Airtel) runs through it, connecting the team, the
internet, customers and security, then ends with a calm "Buy online" screen.

Plain HTML, CSS and JavaScript. No build step, no 3D model files: everything is
built in code with Three.js 0.160, loaded from cdn.jsdelivr.net via the import
map in `office.html`. Runs as-is on GitHub Pages.

**Every change must follow the design brief in [`CLAUDE.md`](CLAUDE.md).**

## Files

| File | What it is | Who edits it |
| --- | --- | --- |
| `config.js` | **The single place to change content**: links, the three stories (`paths`: copy for every beat, "You get" products, the plan per path), the credibility block (`proof`, all placeholders until verified) and the product catalogue (name, category, SKU, price). | Business team |
| `office.html` | The page: nav with the **BRAND SLOT**, the five beats' headlines (real HTML text), progress dots and the ending section. | Web / marketing |
| `index.html` | Redirects the site root to `office.html`. | — |
| `styles.css` | All styling. Colours, font and spacing are CSS variables at the top. Mobile-first: scene top 60%, words bottom 40%. | Web |
| `main.js` | Renders everything from `config.js`: nav menus, the story copy for the chosen path, the plan and Buy online URL, the "Why Airtel" proof and footer. Owns the chosen path. Runs a simple fallback story if 3D can't load. | Web |
| `office.js` | The clay office: materials, furniture, layout, renderer (studio light, bloom, tone-matched background), camera, cursor parallax and the render loop (paused off screen / in hidden tabs). | Web |
| `line.js` | The red line: one path through named waypoints, `growTo(t)` with smooth easing, and a faint pulse. | Web |
| `lighting.js` | The light-up system: each area warms over ~1.4s when the line reaches it; the whole room warms with progress. | Web |
| `people.js` | The four figurines (Riya, Arjun, Meera, Kabir) and their poses for each beat. | Web |
| `story.js` | "What does your office need?" → five beats for the chosen path (set up / grow / switch) → ending. Scroll, dots or arrow keys pick a step; words first, then camera, line and light move together. | Web |
| `expansion.js` | Scene pieces for the other paths: extra desks, the second-site annex and its line, the grey other-provider lines. | Web |
| `leaves.js` | Clay trees outside the office and a few drifting leaves (approved exception in `CLAUDE.md`). | Web |
| `anim.js` | Tiny tween helper and the site's one easing curve. | Web |
| `assets/office-poster.jpg` | Static image of the finished office, shown if WebGL or Three.js is unavailable. | — |
| `CLAUDE.md` | The design brief. | Design |

## Editing `config.js`

- **paths.setup / expand / shift**: `label` (the choice button), `beats` (exactly five: `title` of 5 words or fewer, one-sentence `text`, `get` = catalogue product names shown as "You get"), and `plan` (`name`, `price`, `lines`). The 3D scene for each beat is fixed in `story.js`.
- **proof**: stats, client logo slots, quote, certifications. **Everything is a placeholder**; values in [brackets] show as grey placeholders until Airtel supplies verified facts.
- **products**: `name`, `category`, `sku`, `price` (INR per month or `null`). SKUs are placeholders (`SKU-TBD-…`). A number shows as "from ₹X/mo" in "You get" lines.
- **checkoutUrl**: Buy online adds `?plan=…&items=SKU1,SKU2&utm_source=office_story&utm_content=<path>`.
- **advisorUrl**, **links**: Talk to sales, Support, Privacy and Terms.

Keep the commas and quotes; a syntax error stops the page loading. Open the page after editing.

Deep links: `office.html#setup`, `#expand` or `#shift` open with that path chosen.

## Brand

- Airtel red `#e40000` (`--brand-red`) is used only for the line and key accents.
- **Manrope** is a stand-in typeface. To switch, change the font link in `office.html` and `--font-sans` in `styles.css`.
- **The Airtel logo is intentionally not drawn.** Put the official file in the `BRAND SLOT` in `office.html`.

## Running locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying to GitHub Pages

Settings → Pages → Deploy from a branch → pick the branch and `/ (root)` → Save.
All paths are relative, so it works at `https://<user>.github.io/<repo>/`.
