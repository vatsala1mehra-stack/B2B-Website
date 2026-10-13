// The story: "What's your move?" then five beats for the chosen path
// (set up, expand or switch), then the ending. Scrolling, the dots or the
// arrow keys pick a step; each beat plays as a calm sequence:
// camera glides → the scene changes (one thing at a time) → people change
// posture → the words fade in. Switching path fades to the new state.
import * as THREE from "three";
import { renderer, view, applyView, viewForBox, officeBox, container, sceneRect } from "./office.js";
import { line } from "./line.js";
import { snap as snapLights, setBaseline } from "./lighting.js";
import { posePeople } from "./people.js";
import { annexLine, annexBox, setAnnex, setExtraDesks, setGrey, setHiresPhones } from "./expansion.js";
import { site } from "./main.js";
import { tween, wait } from "./anim.js";
import "./leaves.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const beatEls = [...document.querySelectorAll(".beat")];
const dotsNav = document.querySelector(".dots");
const dots = [...dotsNav.querySelectorAll("button")];
const LAST = beatEls.length - 1;   // the ending step

const box = (x1, y1, z1, x2, y2, z2) => new THREE.Box3(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2));
const RISE = new THREE.Vector3(1, 1.55, 1).normalize();
// Camera directions: lower, varied angles for close-ups, higher for wide shots
const D = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
// Close-ups look in from the open right side, so the space left of the subject (where the
// words are on desktop) is the dark night beyond the floor's edge, not lit walls.
const ANG = {
  low: D(1, 0.42, 0.32), front: D(1, 0.5, 0.22), side: D(1, 0.55, 0.2), threeQ: D(1, 0.5, 0.38),
  wide: D(1, 0.75, 1), high: D(1, 0.62, 0.42),
};
const portrait = () => { const r = sceneRect(); return r.w / r.h < 1; };
const frame = (wide, tall, dir) => () => viewForBox(...(portrait() ? tall : wide), dir);
const world = (path) => (path === "expand" ? officeBox.clone().union(annexBox) : officeBox.clone());

// Scene state per path and step. Anything left out is "off".
// line / annexLine: how far each red line has travelled; base: how lit the office already is;
// grey: the three other-provider lines (phones, internet, customer lines).
const T = {
  team:     frame([box(0.6, 0, 0.6, 3.5, 1.8, 2.8), 1.25],   [box(0.8, 0.2, 0.8, 3.3, 1.8, 2.6), 1.1], ANG.low),
  entry:    frame([box(0.6, 0, 0.4, 5.3, 1.8, 3.3), 1.1],    [box(0.6, 0, 0.5, 4.6, 1.8, 3.2), 1.04], ANG.threeQ),
  desks:    frame([box(-1.1, 0, -4.0, 3.9, 2.2, 0.4), 1.05], [box(-0.8, 0, -4.0, 3.7, 2.1, -0.3), 1.0], ANG.side),
  front:    frame([box(-4.4, 0, -1.3, 1.3, 1.2, 2.3), 1.05], [box(-4.4, 0, -1.0, 0.9, 1.3, 2.1), 1.08], ANG.front),
  office:   () => viewForBox(officeBox, portrait() ? 1.0 : 1.04, ANG.wide),
  // Expand
  arrivals: frame([box(-1.2, 0, -4.2, 5.4, 2.4, 3.8), 1.02],  [box(0.2, 0, -1.0, 5.0, 2.0, 3.8), 1.04], ANG.high),
  joiners:  frame([box(2.6, 0, 1.6, 5.0, 1.9, 4.0), 1.25],    [box(2.8, 0.2, 2.0, 4.8, 1.9, 3.9), 1.12], ANG.low),
  grow:     frame([box(-1.1, 0, -4.0, 3.9, 2.2, 2.4), 1.04],  [box(-0.8, 0, -3.0, 3.4, 2.0, 2.4), 1.02], ANG.side),
  site:     frame([box(1.5, 0, -2.6, 10.9, 2.4, 3.4), 1.02],  [box(4.2, 0, -1.2, 10.9, 2.2, 3.0), 1.0], ANG.high),
  wide:     () => viewForBox(world("expand"), portrait() ? 1.0 : 1.04, ANG.wide),
  // Switch
  tangled:  () => viewForBox(officeBox.clone().union(box(5, -0.3, -1.5, 6.6, 0, 3.9)), portrait() ? 1.0 : 1.04, ANG.wide),
  numbers:  frame([box(-1.0, 0, -3.4, 5.6, 1.9, 3.3), 1.04],  [box(-0.6, 0, -3.2, 4.4, 1.9, 3.0), 1.0], ANG.threeQ),
};

const STEPS = {
  setup: [
    { frame: T.team },
    { frame: T.entry,  line: () => line.marks.Meera },
    { frame: T.desks,  line: () => line.marks.deskD },
    { frame: T.front,  line: () => line.marks.frontDesk },
    { frame: T.office, line: () => 1 },
  ],
  expand: [
    { frame: T.arrivals, line: () => 1, base: 1 },
    { frame: T.joiners,  line: () => 1, base: 1, hires: 1 },
    { frame: T.grow,     line: () => 1, base: 1, hires: 1, extra: 1 },
    { frame: T.site,     line: () => 1, base: 1, hires: 1, extra: 1, annex: 1, annexLine: 1 },
    { frame: T.wide,     line: () => 1, base: 1, hires: 1, extra: 1, annex: 1, annexLine: 1 },
  ],
  shift: [
    { frame: T.tangled, base: 0.5, grey: [1, 1, 1] },
    { frame: T.numbers, base: 0.5, grey: [0, 1, 1], line: () => line.marks.Meera },
    { frame: T.desks,   base: 0.5, grey: [0, 0, 1], line: () => line.marks.deskD },
    { frame: T.front,   base: 0.5, grey: [0, 0, 0], line: () => line.marks.frontDesk },
    { frame: T.office,  base: 0.5, grey: [0, 0, 0], line: () => 1 },
  ],
};

function stateFor(path, step) {
  if (step === 0) return { frame: () => viewForBox(officeBox, portrait() ? 1.0 : 1.02, ANG.wide) };
  if (step === LAST) {
    const s = STEPS[path][4];
    return { ...s, frame: () => viewForBox(world(path), portrait() ? 1.04 : 1.16, RISE) };
  }
  return STEPS[path][step - 1];
}

let current = -1;
let shownPath = null;
let ctrl = null;

function showCopy(step) {
  document.querySelectorAll(".copy").forEach((c) => c.classList.toggle("is-active", +c.dataset.step === step));
}
function setDots(step) {
  dotsNav.classList.toggle("is-hidden", step < 1 || step > 5);
  dots.forEach((d, j) => {
    d.classList.toggle("is-active", j === step - 1);
    if (j === step - 1) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
  });
}

function glide(to, duration, signal) {
  const from = { target: view.target.clone(), size: view.size, dir: view.dir.clone() };
  return tween(duration, (k) => {
    view.target.lerpVectors(from.target, to.target, k);
    view.size = from.size + (to.size - from.size) * k;
    view.dir.lerpVectors(from.dir, to.dir, k).normalize();
    applyView();
  }, { signal });
}
function setView(v) {
  view.target.copy(v.target);
  view.size = v.size;
  view.dir.copy(v.dir);
  applyView();
}

// Put the whole scene into a state at once (jumps, path switches, reduced motion)
async function applyInstant(path, step, s) {
  setView(s.frame());
  setBaseline(s.base ?? 0, { instant: true });
  line.set(s.line?.() ?? 0);
  annexLine.set(s.annexLine ?? 0);
  snapLights();
  await Promise.all([
    setAnnex(s.annex ?? 0, { instant: true }),
    setExtraDesks(s.extra ?? 0, { instant: true }),
    setGrey(s.grey ?? [0, 0, 0], { instant: true }),
    setHiresPhones(s.hires ?? 0, { instant: true }),
    posePeople(path, step, { instant: true }),
  ]);
}

export async function goTo(step, { force = false } = {}) {
  const path = site.path;
  if (step === current && path === shownPath && !force) return;
  const prev = current, prevPath = shownPath;
  current = step;
  shownPath = path;
  setDots(step);
  if (!renderer) { showCopy(step); return; }
  ctrl?.abort();
  ctrl = new AbortController();
  const { signal } = ctrl;
  const s = stateFor(path, step);
  if (prev !== -1) showCopy(-1);   // the opening words are already on screen at load

  const sequential = step === prev + 1 && (path === prevPath || prev === 0) && !(prev === 0 && path !== "setup");
  if (reduceMotion.matches || prev === -1 || (!sequential && path !== prevPath)) {
    // Fade to the new state (path switch, first load, reduced motion)
    if (prev !== -1) { container.classList.add("is-fading"); if (!(await wait(0.35, signal))) return; }
    await applyInstant(path, step, s);
    container.classList.remove("is-fading");
    if (!signal.aborted) showCopy(step);
    return;
  }

  const opts = { signal };
  if (sequential) {
    // One thing at a time
    if (!(await glide(s.frame(), step === LAST ? 1.5 : 1.2, signal))) return;
    setBaseline(s.base ?? 0);
    if (!(await setAnnex(s.annex ?? 0, opts))) return;
    if (!(await setHiresPhones(s.hires ?? 0, opts))) return;
    const lineDone = await Promise.all([
      line.growTo(s.line?.() ?? 0, { duration: 1.4, signal }),
      setGrey(s.grey ?? [0, 0, 0], opts),                 // other providers fade as Airtel arrives
    ]);
    if (lineDone.includes(false) || lineDone[1].includes?.(false)) return;
    if (!(await annexLine.growTo(s.annexLine ?? 0, { duration: (s.annexLine ?? 0) > 0 ? 1.4 : 0, signal }))) return;
    if (!(await setExtraDesks(s.extra ?? 0, opts))) return;
    if (!(await wait(0.1, signal))) return;
    if (!(await posePeople(path, step, { duration: 1.2, signal }))) return;
  } else {
    // A jump within the same path: everything settles together, once
    setBaseline(s.base ?? 0);
    const results = await Promise.all([
      glide(s.frame(), 1.4, signal),
      line.growTo(s.line?.() ?? 0, { duration: 1.4, signal }),
      annexLine.growTo(s.annexLine ?? 0, { duration: 1.4, signal }),
      setAnnex(s.annex ?? 0, opts),
      setExtraDesks(s.extra ?? 0, opts),
      setGrey(s.grey ?? [0, 0, 0], opts),
      setHiresPhones(s.hires ?? 0, opts),
      posePeople(path, step, { duration: 1.2, signal }),
    ]);
    if (results.flat().includes(false)) return;
  }
  if (!signal.aborted) showCopy(step);
}

/* ---------- Scroll, dots, keys and path changes pick the step ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) goTo(+e.target.dataset.step);
}, { rootMargin: "-50% 0px -50% 0px" });
beatEls.forEach((el) => io.observe(el));

dots.forEach((d, j) => d.addEventListener("click", () => {
  beatEls[j + 1].scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
}));

site.onChange(() => { if (current >= 1) goTo(current, { force: true }); });

const story = document.querySelector(".story");
window.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable], .menu, .mobile-menu")) return;
  const dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (!dir) return;
  const rect = story.getBoundingClientRect();
  if (rect.bottom <= 1 || rect.top >= window.innerHeight - 1) return;
  const next = current + dir;
  if (next < 0) return;
  e.preventDefault();
  const target = next <= LAST ? beatEls[next] : document.querySelector(".ending");
  target?.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
});

container.addEventListener("resize-scene", () => {
  if (current >= 0 && !ctrl?.signal.aborted) setView(stateFor(shownPath, current).frame());
});

goTo(0);
