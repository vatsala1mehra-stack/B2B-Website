# Design brief — Airtel Business for founders

This is the design brief every future change must follow. If a change conflicts with it, the brief wins; raise the conflict rather than working around it.

## Concept

- **"Your office. Taken care of."** A dim, empty office comes to life as a single red line (Airtel) runs through it, connecting the team, the internet, customers and security. One continuous line = one partner.
- **Light tells the story:** the office starts grey and dim; wherever the red line arrives, that area warms and lights up. At the end the office is fully lit.

## Story: 5 beats, then an ending

1. **"Monday. Nothing works yet."** Four people in a dim, quiet office.
2. **"Everyone, reachable."** The line reaches their phones; faces and screens light up.
3. **"Online. And staying that way."** The line reaches the router; desks and laptops glow.
4. **"Open for customers."** The front desk lights up; a call comes in.
5. **"Safe. Simple. One partner."** The line closes a loop around the office; fully lit.

**End: "Your office. Taken care of."** Camera pulls back, then buy online.

## Visual rules

- **Materials:** one matte white clay, one warm wood, red (`#e40000`) ONLY for the line and key accents. No other colours except subtle skin and clothing tones.
- **People:** simple figurine style. They express the story through posture (standing unsure → seated working → relaxed), never speech bubbles.
- No icons, emoji, badges or labels in the 3D scene.
- Soft shadows, gentle ambient light, slight warm shift as the story progresses.

## Motion rules

- One thing moves at a time. Changes take 1.2–1.6s with smooth easing (no bounce).
- The camera glides; it never cuts. It starts close on the team and only pulls back fully at the end.
- Nothing loops except a very faint pulse along the red line.
- Respect `prefers-reduced-motion`: show each beat's end state with a fade.

## Type & UI rules

- Headlines of 5 words or fewer; one short supporting sentence. No jargon until the final screen.
- One large centred headline per beat, lots of space. No cards, chips or checklists during the story.
- Progress: 5 small dots at the edge; the active dot is red.
- "Buy online" appears quietly in the nav, and as one confident call to action at the end.

## Mobile first

- Design for a 390px-wide phone first, then scale up.
- Text never overlaps the important part of the scene: on phones the scene sits in the top 60% and text in the bottom 40%.
- Touch: swipe or scroll to move between beats; tap targets at least 44px.
- **Performance budget:** 60fps on a mid-range Android phone, page interactive in under 3 seconds on 4G, no 3D model files (build everything in code).

## Project constraints (from the original setup)

- Plain HTML/CSS/JS, no build step; must work on GitHub Pages.
- Three.js 0.160 loaded from `cdn.jsdelivr.net` via the import map in `index.html`.
- `config.js` stays the single place the business team edits (checkout URL, lead endpoint, guide URL, product catalogue).
- Brand colours live as CSS variables; Manrope is a stand-in font.
- Never draw the Airtel logo. Keep the commented `BRAND SLOT` for the official file.
