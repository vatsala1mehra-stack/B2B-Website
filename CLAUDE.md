# Design brief — Airtel Business for founders

This is the design brief every future change must follow. If a change conflicts with it, the brief wins; raise the conflict rather than working around it.

## Concept

- **"Your office. Taken care of."** A clay office comes to life as a single red line (Airtel) runs through it, connecting the team, the internet, customers and security. One continuous line = one partner.
- **Experience the service, don't hear a pitch.** A visitor sees exactly what changes in their office, what they would buy, and why to trust Airtel, before talking to anyone.
- **Light tells the story:** wherever the red line arrives, that area warms and lights up.

## Story: choose a move, then 5 beats, then the plan

The visitor starts with one question, **"What's your move?"**, and three choices. Each choice is its own five-beat story in the same clay world; the visitor can switch path at any time.

1. **Set up a new office**: an empty, dim office comes to life (phones → internet → customers → security).
2. **Expand my office**: a lit office for four grows: new joiners, new desks, a leased line, a second site joining the same network.
3. **Switch to Airtel**: a working office tangled in grey lines from several providers; the red line replaces them one by one.

**End: "Your office. Taken care of."** The camera rises over the fully lit office, then the path's plan (from `config.js`) with Buy online.

All story copy lives in `config.js` (`paths`), so the business team can edit it.

## Copy rules

- **Concrete, never vague:** each beat names a real problem or outcome a founder recognises ("Three providers. Three bills."), not a mood.
- Headlines of 5 words or fewer; one sentence that says *how*, in plain words.
- **"You get"**: one quiet line under the sentence naming the products that make it happen (catalogue names from `config.js`). This is the only place product names appear during the story.
- **No invented facts.** Stats, customers, quotes, certifications and time or uptime promises come only from Airtel. Until then they are visible [placeholders] in `config.js`.

## Credibility

- A **"Why Airtel"** section after the plan: key stats, client logo slots, one customer quote, certifications/SLA. All values come from `config.js` (`proof`).

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
- **Approved exceptions (owner request):** a few leaves drift down from clay trees outside the office (warm wood tones only, sparse, slow), and the isometric view turns gently towards the cursor (fine pointers only). Both are ambient, never compete with a beat's change, and switch off for reduced motion.

## Rendering

- Clay-render look: soft image-based studio light, soft shadows plus contact shadows under every object.
- Bloom only on true light sources (screens, lamp, LEDs); the background never blooms.
- The red line stays exactly `#e40000` after tone mapping (its colour is pre-compensated), with a soft halo.
- The canvas background is solved to match the page colour exactly, so there is never a visible edge.

## Type & UI rules

- One large centred headline per beat, lots of space. No cards, chips or checklists during the story.
- Progress: 5 small dots at the edge; the active dot is red.
- **Navigation like a real B2B site:** brand slot, Solutions (the three paths), Products (the catalogue), Why Airtel, Support, "Talk to sales", and "Buy online" (quiet in the nav, one confident call to action at the end). Phones get a menu button.
- The words sit directly on the scene: no panels, bands, fades or overlays behind them. Each beat frames its important area away from the text.

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
