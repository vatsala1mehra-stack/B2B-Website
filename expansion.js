// Scene pieces for the "Expand" and "Switch" stories:
// - two extra desks that rise out of the floor (expand: more desks)
// - an annex beside the office with its own branch of the red line (expand: second site)
// - grey lines from other providers that fade as Airtel takes over (switch)
import * as THREE from "three";
import { scene, office, renderer, M, material, block, group, desk, plant, blob, parts, onFrame, requestRender } from "./office.js";
import { line, createLine, buildPath, F, G } from "./line.js";
import { laptopUI, phoneUI, screenMaterial } from "./lighting.js";
import { people } from "./people.js";
import { tween } from "./anim.js";

const DURATION = 1.4;

// Tween a 0..1 value with an apply function; resolves false if aborted.
function animate(state, to, apply, { duration = DURATION, signal, instant = false } = {}) {
  const from = state.v;
  if (instant || from === to) { state.v = to; apply(to); return Promise.resolve(true); }
  return tween(duration, (k) => { state.v = from + (to - from) * k; apply(state.v); }, { signal });
}

/* ---------- Extra desks (inside the office, front-right) ---------- */
export const EXTRA_DESKS = [{ id: "deskE", x: 0.15, z: 1.35 }, { id: "deskF", x: 1.8, z: 1.35 }];
const extra = { v: 0, groups: [], screens: [] };

/* ---------- Annex: a small second site beside the office ---------- */
export const ANNEX = { x: 8.9, z: 1.0, w: 3.6, d: 3.2, h: 2.1 };
export const ANNEX_DESKS = [{ id: "annexA", x: 8.25, z: 0.55 }, { id: "annexB", x: 9.9, z: 0.55 }];
const annex = { v: 0, group: null, screens: [], lit: { v: 0 } };
export let annexLine = null;
export const annexBox = new THREE.Box3();

/* ---------- Grey lines: other providers (switch story) ---------- */
const GREY_ROUTES = [
  // phones provider: into the desk pod
  [[6.6, G, 1.9], [5.3, G, 1.9], [5.3, F, 1.9], [2.7, F, 0.55], [1.2, F, -0.45], [-0.3, F, -0.45]],
  // internet provider: up to the router
  [[6.6, G, -1.2], [5.3, G, -1.2], [5.3, F, -1.2], [4.3, F, -3.0], [3.55, F, -3.93], [3.55, 1.7, -3.93]],
  // customer-line provider: to the front desk
  [[6.6, G, 3.7], [5.3, G, 3.7], [5.3, F, 3.7], [-1.4, F, 2.5], [-2.85, F, 1.4]],
];
const grey = { v: [0, 0, 0], meshes: [] };

function buildAnnex() {
  const { x, z, w, d, h } = ANNEX;
  const g = group(scene, x, 0, z);
  annex.group = g;
  block(g, M.clay, w + 0.4, 0.32, d + 0.4, 0, -0.32, 0, 0.1);              // slab
  block(g, M.clay, w + 0.4, h, 0.2, 0, 0, -d / 2 - 0.1, 0);                 // back wall
  block(g, M.clay, 0.2, h, d + 0.4, -w / 2 - 0.1, 0, 0, 0);                 // side wall
  blob(g, 0, 0, w + 1.2, d + 1.2);
  for (const dk of ANNEX_DESKS) {
    desk(dk, g, { x, z });
    const mat = screenMaterial(laptopUI);
    parts[dk.id].screen.material = mat;
    annex.screens.push(mat);
  }
  plant(w / 2 - 0.35, -d / 2 + 0.35, 0.75, g);
  // small router on the back wall
  const r = group(g, 0.2, 1.4, -d / 2 + 0.05);
  block(r, M.wood, 0.5, 0.03, 0.2, 0, 0, 0.08, 0.01);
  block(r, M.clay, 0.3, 0.06, 0.16, 0, 0.03, 0.08, 0.02);
  g.scale.set(1, 0.001, 1);
  g.visible = false;
  annexBox.setFromObject(g);
  annexBox.max.y = h;
  annexBox.expandByPoint(new THREE.Vector3(x - w / 2 - 0.3, 0, z));
}

function buildExtraDesks() {
  for (const dk of EXTRA_DESKS) {
    const g = desk(dk);
    const mat = screenMaterial(laptopUI);
    parts[dk.id].screen.material = mat;
    extra.groups.push(g);
    extra.screens.push(mat);
    g.scale.set(1, 0.001, 1);
    g.visible = false;
  }
}

function buildGrey() {
  const mat = material(0x8e8b86, 0.85, { transparent: true, opacity: 0 });
  for (const route of GREY_ROUTES) {
    const path = buildPath(route.map(([a, b, c]) => new THREE.Vector3(a, b, c)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.ceil(path.getLength() * 10), 0.026, 6, false), mat.clone());
    m.material.onBeforeCompile = mat.onBeforeCompile;
    m.visible = false;
    scene.add(m);
    grey.meshes.push(m);
  }
}

if (renderer && line) {
  buildExtraDesks();
  buildAnnex();
  buildGrey();

  // The annex's branch of the red line: from the office floor, across the ground, to both annex desks
  const ax = ANNEX.x - ANNEX.w / 2 - 0.2;
  annexLine = createLine([
    [4.9, F, 2.2], [5.28, F, 2.2], [5.28, G, 2.2], [ax - 0.06, G, 2.2], [ax - 0.06, F, 2.2],
    [ax + 0.45, F, 2.2], [ax + 0.45, F, 1.42], [8.3, F, 1.42, "annexA"], [9.95, F, 1.42, "annex"],
  ], { color: line.color });

  // Annex screens wake up when its line arrives
  annexLine.onChange((p) => { annex.lit.target = p >= 0.98 ? 1 : 0; });
  onFrame((dt) => {
    const t = annex.lit.target ?? 0;
    if (annex.lit.v === t) return false;
    annex.lit.v = t > annex.lit.v ? Math.min(t, annex.lit.v + dt / DURATION) : Math.max(t, annex.lit.v - dt / DURATION);
    for (const m of annex.screens) m.uniforms.uOn.value = annex.lit.v;
    return true;
  });
}

/* ---------- New joiners' phones: dark until they're on the plan ---------- */
const hires = { v: 0, mats: [] };
if (renderer) for (const n of ["Isha", "Dev"]) {
  const m = screenMaterial(phoneUI);
  people[n].phoneScreen.material = m;
  hires.mats.push(m);
}
export function setHiresPhones(v, opts) {
  return animate(hires, v, (k) => { hires.mats.forEach((m) => (m.uniforms.uOn.value = k)); requestRender(); }, opts);
}

/* ---------- Public API used by story.js ---------- */
const rise = (g, v) => { g.visible = v > 0.001; g.scale.y = Math.max(0.001, v); };

export function setExtraDesks(v, opts) {
  return animate(extra, v, (k) => {
    extra.groups.forEach((g) => rise(g, k));
    extra.screens.forEach((m) => (m.uniforms.uOn.value = k));
    requestRender({ shadows: true });
  }, opts);
}

export function setAnnex(v, opts) {
  return animate(annex, v, (k) => { rise(annex.group, k); requestRender({ shadows: true }); }, opts);
}

export function setGrey(values, opts = {}) {
  return Promise.all(values.map((to, i) => {
    const st = { v: grey.v[i] };
    return animate(st, to, (k) => {
      grey.v[i] = k;
      const m = grey.meshes[i];
      m.visible = k > 0.01;
      m.material.opacity = k;
      requestRender();
    }, opts);
  }));
}

// Seats for people in the extra desks and the annex
export const seat = (id) => parts[id].seat;
