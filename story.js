// The five-beat story. Scrolling (or a dot, or an arrow key) picks a beat;
// each beat plays as a calm sequence: camera glides → line grows and the
// area lights up → people change posture → the words fade in.
import * as THREE from "three";
import { renderer, view, applyView, viewForBox, officeBox, requestRender, container } from "./office.js";
import { line } from "./line.js";
import { snap as snapLights } from "./lighting.js";
import { poseBeat } from "./people.js";
import { tween, wait } from "./anim.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const copies = [...document.querySelectorAll(".copy")];
const dots = [...document.querySelectorAll(".dots button")];
const beatEls = [...document.querySelectorAll(".beat")];

const box = (x1, y1, z1, x2, y2, z2) => new THREE.Box3(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2));

// What each beat frames and how far the line has travelled. Portrait screens
// get a tighter box around the part of the room that matters in that beat.
const portrait = () => container.clientWidth / Math.max(1, container.clientHeight) < 1;
const BEATS = [
  { wide: [box(0.6, 0, 0.6, 3.5, 1.8, 2.8), 1.3],    tall: [box(0.8, 0.2, 0.8, 3.3, 1.8, 2.6), 1.12], line: () => 0 },
  { wide: [box(0.6, 0, 0.4, 5.3, 1.8, 3.3), 1.12],   tall: [box(0.6, 0, 0.5, 4.6, 1.8, 3.2), 1.04],   line: () => line.marks.Meera },
  { wide: [box(-1.1, 0, -4.0, 3.9, 2.2, 0.4), 1.08], tall: [box(-0.8, 0, -4.0, 3.7, 2.1, -0.3), 1.0], line: () => line.marks.deskD },
  { wide: [box(-4.4, 0, -1.3, 1.3, 1.2, 2.3), 1.08], tall: [box(-4.4, 0, -1.0, 0.9, 1.3, 2.1), 1.0],  line: () => line.marks.frontDesk },
  { wide: [officeBox, 1.05],                         tall: [officeBox, 0.98],                         line: () => 1 },
  // The ending: the camera rises over the fully lit office
  { wide: [officeBox, 1.16], tall: [officeBox, 1.04], dir: new THREE.Vector3(1, 1.55, 1).normalize(), line: () => 1 },
];
for (const b of BEATS) b.frame = () => viewForBox(...(portrait() ? b.tall : b.wide), b.dir);
const dotsNav = document.querySelector(".dots");

let current = -1;
let ctrl = null;

function showCopy(i) {
  copies.forEach((c, j) => c.classList.toggle("is-active", j === i));
}
function setDots(i) {
  dotsNav.classList.toggle("is-hidden", i >= dots.length);
  dots.forEach((d, j) => {
    d.classList.toggle("is-active", j === i);
    if (j === i) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
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

export async function goTo(i) {
  if (i === current) return;
  if (!renderer) { current = i; setDots(i); showCopy(i); return; }
  const prev = current;
  current = i;
  ctrl?.abort();
  ctrl = new AbortController();
  const { signal } = ctrl;
  const beat = BEATS[i];
  setDots(i);
  showCopy(-1);

  if (reduceMotion.matches || prev === -1) {
    // End state, revealed with a fade
    if (prev !== -1) { container.classList.add("is-fading"); await wait(0.35, signal); if (signal.aborted) return; }
    setView(beat.frame());
    line.set(beat.line());
    snapLights();
    await poseBeat(i, { instant: true });
    container.classList.remove("is-fading");
    showCopy(i);
    return;
  }

  if (i === prev + 1) {
    // One thing at a time
    if (!(await glide(beat.frame(), i === BEATS.length - 1 ? 1.6 : 1.3, signal))) return;
    if (!(await line.growTo(beat.line(), { duration: 1.5, signal }))) return;
    if (!(await wait(0.15, signal))) return;
    if (!(await poseBeat(i, { duration: 1.2, signal }))) return;
  } else {
    // A jump: everything settles together, once
    const results = await Promise.all([
      glide(beat.frame(), 1.4, signal),
      line.growTo(beat.line(), { duration: 1.4, signal }),
      poseBeat(i, { duration: 1.2, signal }),
    ]);
    if (results.includes(false)) return;
  }
  if (!signal.aborted) showCopy(i);
}

/* ---------- Scroll, dots and keys pick the beat ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) goTo(+e.target.dataset.beat);
}, { rootMargin: "-50% 0px -50% 0px" });
beatEls.forEach((el) => io.observe(el));

dots.forEach((d, j) => d.addEventListener("click", () => {
  beatEls[j].scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
}));

// Arrow and Page keys step exactly one beat while in the story
const story = document.querySelector(".story");
window.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  const dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (!dir) return;
  const rect = story.getBoundingClientRect();
  if (rect.bottom <= 1 || rect.top >= window.innerHeight - 1) return; // not in the story
  const next = current + dir;
  if (next < 0) return;
  e.preventDefault();
  const target = next < beatEls.length ? beatEls[next] : story.nextElementSibling;
  target?.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
});

// Keep framing right when the screen size or orientation changes
container.addEventListener("resize-scene", () => {
  if (current >= 0 && !ctrl?.signal.aborted) setView(BEATS[current].frame());
});

goTo(0);
