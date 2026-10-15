// The office, built entirely in code (no model files), in a stylised-realism look:
// real materials and believable furniture, simplified and calm.
// Exports the scene core that line.js, lighting and the story build on.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { stepTweens } from "./anim.js";
import { LITE, look, material, M, BOOKS, SKIN, CLOTH } from "./materials.js";

export { LITE, look, material, M, SKIN, CLOTH };

// The canvas fills the whole stage; the office is framed inside the .scene box
// (top 60% on phones), so nothing in 3D ever sits under the words.
export const container = document.querySelector(".stage");
const canvas = container.querySelector(".stage-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// The framing box: the content box of .scene (below the nav), in canvas pixels.
// The canvas fills the whole stage; the view is centred on this box.
const sceneEl = container.querySelector(".scene");
export function sceneRect() {
  const c = canvas.getBoundingClientRect();
  const r = sceneEl.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(sceneEl).paddingTop) || 0;
  return {
    x: r.left - c.left, y: r.top - c.top + pad,
    w: Math.max(1, r.width), h: Math.max(1, r.height - pad),
    W: c.width || 1, H: c.height || 1,
  };
}

const SEG = LITE ? 2 : 3;          // rounded-box bevel segments
export const CURVE = LITE ? 14 : 22;      // sphere/capsule/cylinder segments

/* ------------------------------------------------------------------ */
/*  Geometry helpers (all geometry is cached and shared)               */
/* ------------------------------------------------------------------ */
const geoCache = new Map();
export function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

// Box UVs in metres, projected along each face's main axis, so wood grain,
// concrete and weave keep a real-world scale on any size of box.
function boxUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}

function rbox(w, h, d, r = 0.03) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const seg = Math.min(w, h, d) < 0.06 ? 1 : SEG;   // small parts don't need smooth bevels
  return cached(`b${w},${h},${d},${rr}`, () =>
    boxUV(rr > 0 ? new RoundedBoxGeometry(w, h, d, seg, rr) : new THREE.BoxGeometry(w, h, d)));
}

export function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Box whose y is its bottom face — easier to stack furniture.
export function block(parent, mat, w, h, d, x, y, z, r = 0.03) {
  return mesh(rbox(w, h, d, r), mat, parent, x, y + h / 2, z);
}
export function capsule(parent, mat, r, len, x = 0, y = 0, z = 0) {
  return mesh(cached(`c${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, CURVE)), mat, parent, x, y, z);
}
export function sphere(parent, mat, r, x = 0, y = 0, z = 0) {
  return mesh(cached(`s${r}`, () => new THREE.SphereGeometry(r, CURVE, Math.ceil(CURVE * 0.6))), mat, parent, x, y, z);
}
export function cylinder(parent, mat, rTop, rBottom, h, x = 0, y = 0, z = 0) {
  return mesh(cached(`y${rTop},${rBottom},${h}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, CURVE)), mat, parent, x, y + h / 2, z);
}
export function plane(parent, mat, w, h, x = 0, y = 0, z = 0) {
  return mesh(cached(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), mat, parent, x, y, z, false);
}
export function group(parent, x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

// Mark a mesh that lights up or changes on its own, so bake() leaves it separate.
export const keep = (m) => ((m.userData.keep = true), m);

// Merge the static meshes under root that share a material into one mesh each:
// all the furniture detail for a handful of draw calls. deep: false only merges
// root's own children (used for the jointed people).
export function bake(root, { deep = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const visit = (o) => {
    for (const c of o.children) {
      if (c.userData.keep) continue;
      if (c.isMesh && !c.isInstancedMesh && !c.children.length) {
        const key = `${c.material.uuid}|${c.castShadow}|${c.renderOrder}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      } else if (deep && !c.isMesh) visit(c);
    }
  };
  visit(root);
  const _m = new THREE.Matrix4();
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((c) => {
      const g = c.geometry.clone().applyMatrix4(_m.multiplyMatrices(inv, c.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      return g;
    });
    const first = meshes[0];
    const merged = new THREE.Mesh(mergeGeometries(geos), first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = true;
    merged.renderOrder = first.renderOrder;
    for (const c of meshes) c.removeFromParent();
    root.add(merged);
  }
  return root;
}

// Repeatable "random" numbers, so the office looks the same on every visit.
export function seeded(seed) {
  let s = seed % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

// Soft contact shadow under an object: grounds it like ambient occlusion.
const blobTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(40,32,26,0.55)");
  g.addColorStop(0.55, "rgba(40,32,26,0.22)");
  g.addColorStop(1, "rgba(40,32,26,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const BLOB_GEO = new THREE.PlaneGeometry(1, 1);
export const blobMaterial = (opacity = 1) =>
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -1 });
const BLOB_MAT = blobMaterial(0.9);
export function blob(parent, x, z, w, d, mat = BLOB_MAT) {
  const m = new THREE.Mesh(BLOB_GEO, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.004, z);
  m.scale.set(w, d, 1);
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ */
/*  Layout — one source of truth for where things are                  */
/* ------------------------------------------------------------------ */
export const ROOM = { w: 10, d: 8, h: 2.9, wall: 0.2 };
export const LAYOUT = {
  window: { z1: -3.4, z2: -1.0, y1: 1.05, y2: 2.25 },
  desks: [            // two rows facing the back wall, aisle between
    { id: "deskA", x: 0.15, z: -2.9 }, { id: "deskB", x: 1.8, z: -2.9 },
    { id: "deskC", x: 0.15, z: -1.25 }, { id: "deskD", x: 1.8, z: -1.25 },
  ],
  router: { x: 3.2, y: 1.85, z: -3.86 },
  frontDesk: { x: -3.55, z: 0.9 },
  server: { x: -4.55, z: 3.3 },
  sofa: { x: -4.42, z: -2.2 },
  plants: [[4.45, -3.5, 1.15], [-4.5, -3.75, 0.85], [-4.5, -0.6, 0.8], [4.5, 3.55, 0.8]],
};

export const office = new THREE.Group();
export const parts = {};   // named objects other modules light up

function buildRoom() {
  const { w, d, h, wall } = ROOM;
  const x0 = -w / 2, z0 = -d / 2;
  const win = LAYOUT.window;

  block(office, M.concrete, w + wall * 2, 0.32, d + wall * 2, 0, -0.32, 0, 0.05); // polished concrete slab
  block(office, M.plaster, w + wall * 2, h, wall, 0, 0, z0 - wall / 2, 0);        // back wall

  // Left wall in four sharp pieces around a wide window
  const lx = x0 - wall / 2, zA = z0 - wall, zB = d / 2 + wall;
  block(office, M.plaster, wall, win.y1, zB - zA, lx, 0, (zA + zB) / 2, 0);
  block(office, M.plaster, wall, h - win.y2, zB - zA, lx, win.y2, (zA + zB) / 2, 0);
  block(office, M.plaster, wall, win.y2 - win.y1, win.z1 - zA, lx, win.y1, (zA + win.z1) / 2, 0);
  block(office, M.plaster, wall, win.y2 - win.y1, zB - win.z2, lx, win.y1, (win.z2 + zB) / 2, 0);

  // Window: oak sill, slim black steel frame with one mullion, and glass
  const wz = (win.z1 + win.z2) / 2, wl = win.z2 - win.z1, wh = win.y2 - win.y1, fx = x0 - 0.06, T = 0.045;
  block(office, M.wood, wall + 0.1, 0.04, wl + 0.06, lx + 0.05, win.y1, wz, 0.012);
  block(office, M.metal, 0.06, T, wl, fx, win.y1 + 0.04, wz, 0.008);
  block(office, M.metal, 0.06, T, wl, fx, win.y2 - T, wz, 0.008);
  for (const z of [win.z1 + T / 2, win.z2 - T / 2]) block(office, M.metal, 0.06, wh, T, fx, win.y1, z, 0.008);
  block(office, M.metal, 0.05, wh, 0.03, fx, win.y1, wz, 0.006);
  keep(plane(office, M.glass, wl, wh, fx - 0.005, (win.y1 + win.y2) / 2, wz)).rotation.y = Math.PI / 2;

  // Painted skirting along both walls
  block(office, M.trim, w, 0.07, 0.012, 0, 0, z0 + 0.006, 0.004);
  block(office, M.trim, 0.012, 0.07, d, x0 + 0.006, 0, 0, 0.004);

  // Morning sky beyond the window; lighting.js warms it from dawn to day
  const sky = document.createElement("canvas");
  sky.width = 4; sky.height = 64;
  const ctx = sky.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#d9d2c8");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(sky);
  tex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x8f98a8 });
  const card = keep(mesh(new THREE.PlaneGeometry(wl + 1.2, wh + 1.0), skyMat, office, x0 - 0.9, (win.y1 + win.y2) / 2, wz, false));
  card.rotation.y = Math.PI / 2;
  card.receiveShadow = false;
  parts.sky = { material: skyMat };
}

// Oak wall shelf with books, and a framed print above the desks
function wallDetails() {
  const z0 = -ROOM.d / 2;
  const rnd = seeded(7);
  const s = group(office, -2.25, 1.42, z0);
  block(s, M.wood, 1.5, 0.035, 0.24, 0, 0, 0.12, 0.01);
  for (const sx of [-0.55, 0.55]) block(s, M.metal, 0.02, 0.1, 0.2, sx, -0.1, 0.1, 0.004);
  let x = -0.7;
  for (let i = 0; x < 0.25; i++) {
    const t = 0.024 + rnd() * 0.026, bh = 0.17 + rnd() * 0.09;
    block(s, BOOKS[Math.floor(rnd() * BOOKS.length)], t, bh, 0.15 + rnd() * 0.04, x + t / 2, 0.035, 0.11, 0.004);
    x += t + 0.003;
  }
  const lean = block(s, BOOKS[2], 0.03, 0.22, 0.16, x + 0.07, 0.035, 0.11, 0.004);
  lean.rotation.z = -0.32; lean.position.x += 0.02;
  for (let i = 0; i < 3; i++) block(s, BOOKS[(i * 3 + 1) % BOOKS.length], 0.2, 0.03, 0.15, 0.48, 0.035 + i * 0.03, 0.11, 0.004).rotation.y = (i - 1) * 0.12;
  cylinder(s, M.ceramic, 0.04, 0.035, 0.12, 0.5, 0.125, 0.12);

  // Framed print: calm abstract shapes in the room's own tones
  const art = document.createElement("canvas");
  art.width = 300; art.height = 200;
  const c = art.getContext("2d");
  c.fillStyle = "#ebe4da"; c.fillRect(0, 0, 300, 200);
  c.fillStyle = "#cdb596"; c.beginPath(); c.arc(112, 112, 62, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#8f9a86"; c.fillRect(168, 46, 74, 112);
  c.strokeStyle = "#3d3f45"; c.lineWidth = 5; c.beginPath(); c.arc(190, 150, 70, Math.PI, Math.PI * 1.6); c.stroke();
  const artTex = new THREE.CanvasTexture(art);
  artTex.colorSpace = THREE.SRGBColorSpace;
  const f = group(office, 1.0, 1.42, z0);
  block(f, M.metal, 0.92, 0.66, 0.03, 0, 0, 0.015, 0.006);
  plane(f, M.ceramic, 0.86, 0.6, 0, 0.33, 0.031);
  plane(f, material(0xffffff, 0.9, { map: artTex }), 0.6, 0.4, 0, 0.33, 0.032);
}

export const SEAT_H = 0.46;

// Task chair: five-star base on castors, gas lift, charcoal upholstery
export function chair(parent, x, z, rotY = 0) {
  const g = group(parent, x, 0, z, rotY);
  for (let i = 0; i < 5; i++) {
    const arm = group(g, 0, 0, 0, (i / 5) * Math.PI * 2);
    block(arm, M.metal, 0.035, 0.03, 0.27, 0, 0.05, 0.13, 0.008);
    sphere(arm, M.dark, 0.025, 0, 0.025, 0.25);
  }
  cylinder(g, M.metal, 0.035, 0.04, 0.06, 0, 0.05, 0);
  cylinder(g, M.steel, 0.02, 0.02, SEAT_H - 0.2, 0, 0.1, 0);
  block(g, M.metal, 0.22, 0.04, 0.2, 0, SEAT_H - 0.12, 0, 0.01);
  block(g, M.fabricDark, 0.48, 0.08, 0.46, 0, SEAT_H - 0.08, 0, 0.035);
  block(g, M.metal, 0.05, 0.3, 0.025, 0, SEAT_H - 0.12, 0.235, 0.008);
  const back = block(g, M.fabricDark, 0.44, 0.44, 0.06, 0, SEAT_H + 0.1, 0.25, 0.03);
  back.rotation.x = 0.08;
  return g;
}

// Small things that make each desk someone's
function deskThings(g, H, kind) {
  if (kind === 0) {           // mug
    cylinder(g, M.ceramic, 0.038, 0.034, 0.095, -0.5, H, 0.12);
  } else if (kind === 1) {    // notebook and pen
    block(g, BOOKS[3], 0.16, 0.012, 0.22, -0.48, H, 0.1, 0.004).rotation.y = 0.2;
    capsule(g, M.dark, 0.005, 0.12, -0.4, H + 0.018, 0.1).rotation.set(Math.PI / 2, 0, 0.5);
  } else if (kind === 2) {    // little plant
    block(g, M.ceramic, 0.09, 0.08, 0.09, -0.52, H, -0.15, 0.01);
    sphere(g, M.leaf, 0.06, -0.52, H + 0.12, -0.15);
  } else {                    // two books
    block(g, BOOKS[1], 0.17, 0.025, 0.23, -0.5, H, -0.12, 0.004);
    block(g, BOOKS[4], 0.15, 0.022, 0.21, -0.5, H + 0.025, -0.12, 0.004).rotation.y = -0.15;
  }
}

// Desk: oak top on a black steel frame; the user sits on local +z and faces -z.
export function desk({ id, x, z }, parent = office, origin = { x: 0, z: 0 }) {
  const g = group(parent, x - origin.x, 0, z - origin.z);
  const W = 1.55, D = 0.78, H = 0.74, T = 0.03;
  block(g, M.wood, W, T, D, 0, H - T, 0, 0.01);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) block(g, M.metal, 0.035, H - T, 0.035, sx * (W / 2 - 0.06), 0, sz * (D / 2 - 0.06), 0.006);
    block(g, M.metal, 0.03, 0.04, D - 0.12, sx * (W / 2 - 0.06), H - T - 0.04, 0, 0.006);
  }
  block(g, M.metal, W - 0.12, 0.04, 0.03, 0, H - T - 0.04, -D / 2 + 0.06, 0.006);

  // Monitor on a stand; its screen wakes up when the line arrives (lighting.js)
  const mon = group(g, 0.05, H, -0.2);
  block(mon, M.metal, 0.22, 0.012, 0.15, 0, 0, 0, 0.005);
  block(mon, M.metal, 0.045, 0.3, 0.02, 0, 0.012, -0.035, 0.006);
  block(mon, M.dark, 0.6, 0.37, 0.024, 0, 0.12, 0, 0.008);
  const screenMesh = keep(plane(mon, M.dark, 0.56, 0.33, 0, 0.315, 0.0125));
  block(g, M.steel, 0.38, 0.012, 0.12, 0.02, H, 0.15, 0.004);   // keyboard
  block(g, M.ceramic, 0.06, 0.022, 0.1, 0.34, H, 0.16, 0.012);   // mouse
  deskThings(g, H, [...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4);

  chair(g, 0.05, 0.62);
  blob(g, 0, 0.1, 2.0, 1.5);
  parts[id] = { group: g, screen: screenMesh, seat: new THREE.Vector3(x + 0.05, SEAT_H, z + 0.7) };
  return g;
}

// A curved, pointed leaf, base at the origin, tip along +y
export const leafGeo = () => cached("leaf", () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.09, 0.03, 0.12, 0.16, 0, 0.25);
  s.bezierCurveTo(-0.12, 0.16, -0.09, 0.03, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), ly = p.getY(i);
    p.setZ(i, 2.5 * lx * lx - 1.4 * (ly - 0.05) ** 2);   // cupped and arching
  }
  g.computeVertexNormals();
  return g;
});

// Potted plant: a ceramic pot and a leafy stem
export function plant(x, z, size = 1, parent = office) {
  const g = group(parent, x, 0, z);
  g.scale.setScalar(size);
  const rnd = seeded(Math.round((x + 11) * 100 + (z + 7) * 10));
  blob(g, 0, 0, 0.8, 0.8);
  cylinder(g, size > 1 ? M.charcoal : M.ceramic, 0.2, 0.15, 0.42);
  cylinder(g, M.soil, 0.18, 0.18, 0.02, 0, 0.385, 0);
  cylinder(g, M.wood, 0.012, 0.016, 0.8, 0, 0.4, 0);
  const n = LITE ? 15 : 24;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const holder = group(g, 0, 0.5 + t * 0.72, 0, i * 2.4 + rnd() * 0.5);
    const leaf = mesh(leafGeo(), rnd() > 0.45 ? M.leaf : M.leafLight, holder, 0, 0, 0.03 + (1 - t) * 0.05);
    leaf.rotation.x = 0.7 + (1 - t) * 0.65 + rnd() * 0.25;
    leaf.rotation.z = (rnd() - 0.5) * 0.5;
    leaf.scale.setScalar(0.9 + (1 - t) * 0.55);
  }
}

function sofa({ x, z }) {
  // Oatmeal fabric on slim steel legs; faces +x, back against the left wall
  const g = group(office, x, 0, z, Math.PI / 2);
  const L = 2.0, D = 0.86;
  blob(g, 0, 0, L + 0.6, D + 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    block(g, M.metal, 0.03, 0.12, 0.03, sx * (L / 2 - 0.12), 0, sz * (D / 2 - 0.12), 0.006);
  block(g, M.fabric, L, 0.2, D, 0, 0.12, 0, 0.05);
  for (const sx of [-1, 1]) block(g, M.fabric, L / 2 - 0.2, 0.15, D - 0.3, sx * (L / 4 - 0.05), 0.31, 0.1, 0.07);
  block(g, M.fabric, L, 0.44, 0.2, 0, 0.32, -D / 2 + 0.1, 0.07);
  for (const sx of [-1, 1]) {
    block(g, M.fabric, L / 2 - 0.22, 0.3, 0.14, sx * (L / 4 - 0.05), 0.42, -D / 2 + 0.17, 0.07).rotation.x = -0.1;
    block(g, M.fabric, 0.18, 0.34, D, sx * (L / 2 - 0.09), 0.32, 0, 0.07);
    const pillow = block(g, sx < 0 ? M.pillowA : M.pillowB, 0.26, 0.26, 0.1, sx * 0.7, 0.44, -0.2, 0.05);
    pillow.rotation.set(-0.3, 0, sx * 0.18);
  }
  parts.sofa = { group: g, seats: [new THREE.Vector3(x - 0.02, SEAT_H, z - 0.48), new THREE.Vector3(x - 0.02, SEAT_H, z + 0.48)] };

  // Rug and a round oak coffee table in front of it
  block(office, M.rugEdge, 1.9, 0.006, 2.6, x + 0.85, 0, z, 0.003);
  block(office, M.rug, 1.78, 0.012, 2.48, x + 0.85, 0, z, 0.004);
  const t = group(office, x + 1.05, 0, z);
  blob(t, 0, 0, 1.0, 1.0);
  cylinder(t, M.metal, 0.17, 0.19, 0.02, 0, 0.012, 0);
  cylinder(t, M.metal, 0.025, 0.025, 0.36, 0, 0.03, 0);
  cylinder(t, M.wood, 0.36, 0.36, 0.03, 0, 0.39, 0);
  block(t, BOOKS[0], 0.22, 0.03, 0.17, -0.08, 0.42, 0.05, 0.004).rotation.y = 0.3;
  block(t, BOOKS[6], 0.19, 0.025, 0.15, -0.08, 0.45, 0.05, 0.004).rotation.y = 0.1;
  cylinder(t, M.ceramic, 0.038, 0.034, 0.095, 0.13, 0.42, -0.1);
}

function frontDesk({ x, z }) {
  // Reception counter: plaster body with an oak-slatted front; visitors approach from local +z (world +x)
  const g = group(office, x, 0, z, Math.PI / 2);
  blob(g, 0, -0.1, 2.6, 1.6);
  block(g, M.plaster, 2.0, 1.0, 0.5, 0, 0, 0.12, 0.03);
  const n = LITE ? 16 : 24;
  for (let i = 0; i < n; i++) block(g, M.wood, 1.9 / n - 0.012, 0.96, 0.03, -0.95 + (i + 0.5) * (1.9 / n), 0.02, 0.385, 0.006);
  block(g, M.wood, 2.08, 0.04, 0.36, 0, 1.0, 0.24, 0.012);
  block(g, M.wood, 2.0, 0.04, 0.62, 0, 0.72, -0.38, 0.012);
  block(g, M.plaster, 0.05, 0.72, 0.56, -0.96, 0, -0.38, 0.02);
  block(g, M.plaster, 0.05, 0.72, 0.56, 0.96, 0, -0.38, 0.02);

  // Desk phone: black body, handset and a keypad that lights up
  const p = group(g, 0.45, 0.76, -0.4, 0.2);
  block(p, M.dark, 0.24, 0.05, 0.19, 0, 0, 0, 0.02).rotation.x = -0.18;
  const handset = keep(capsule(p, M.dark, 0.026, 0.16, -0.06, 0.085, 0.01));
  handset.rotation.z = Math.PI / 2;
  const keys = keep(plane(p, M.dark, 0.08, 0.07, 0.06, 0.066, 0.02));
  keys.rotation.x = -Math.PI / 2 - 0.18;

  // Table lamp: black steel stem, fabric shade; switches on in beat 4
  const lamp = group(g, -0.6, 0.76, -0.45);
  cylinder(lamp, M.metal, 0.065, 0.075, 0.018);
  cylinder(lamp, M.metal, 0.007, 0.007, 0.36, 0, 0.018, 0);
  const shade = keep(cylinder(lamp, M.fabric, 0.07, 0.11, 0.13, 0, 0.35, 0));
  block(g, BOOKS[3], 0.21, 0.012, 0.15, 0.0, 0.76, -0.42, 0.004).rotation.y = -0.1;

  chair(g, 0.1, -0.95, Math.PI);
  parts.frontDesk = {
    group: g, phoneKeys: keys, handset, lampShade: shade, lamp,
    seat: new THREE.Vector3(x - 1.02, SEAT_H, z - 0.1),
  };
}

function server({ x, z }) {
  // Network cabinet: black steel, a vented door, status lights
  const g = group(office, x, 0, z, Math.PI / 2); // front faces +x
  blob(g, 0, 0, 1.0, 1.0);
  block(g, M.cabinet, 0.58, 1.85, 0.6, 0, 0.03, 0, 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, M.dark, 0.05, 0.03, 0.05, sx * 0.24, 0, sz * 0.24, 0.006);
  block(g, M.dark, 0.5, 1.7, 0.012, 0, 0.1, 0.3, 0.004);
  for (let i = 0; i < 14; i++) block(g, M.metal, 0.4, 0.012, 0.006, 0, 1.08 + i * 0.045, 0.307, 0.002);
  block(g, M.steel, 0.02, 0.22, 0.02, 0.21, 0.82, 0.315, 0.006);
  const leds = [];
  for (let i = 0; i < 5; i++) leds.push(keep(plane(g, M.dark, 0.05, 0.016, -0.14 + i * 0.065, 0.95, 0.307)));
  parts.server = { group: g, leds };
}

function router({ x, y, z }) {
  const g = group(office, x, y, z);
  block(g, M.wood, 0.62, 0.035, 0.24, 0, 0, 0, 0.012);
  for (const sx of [-0.22, 0.22]) block(g, M.metal, 0.02, 0.08, 0.18, sx, -0.08, -0.02, 0.004);
  block(g, M.ceramic, 0.36, 0.06, 0.2, 0, 0.035, 0, 0.025);
  for (const sx of [-1, 1]) capsule(g, M.ceramic, 0.011, 0.16, sx * 0.14, 0.19, -0.06).rotation.z = sx * -0.18;
  const led = keep(sphere(g, M.dark, 0.012, 0.12, 0.065, 0.1));
  led.castShadow = false;
  parts.router = { group: g, led };
}

/* ------------------------------------------------------------------ */
/*  Compose                                                            */
/* ------------------------------------------------------------------ */
function buildOffice() {
  buildRoom();
  wallDetails();
  LAYOUT.desks.forEach((d) => desk(d));
  router(LAYOUT.router);
  server(LAYOUT.server);
  sofa(LAYOUT.sofa);
  frontDesk(LAYOUT.frontDesk);
  for (const [x, z, s] of LAYOUT.plants) plant(x, z, s);
  bake(office);
}

/* ------------------------------------------------------------------ */
/*  Renderer, lights, camera, loop                                     */
/* ------------------------------------------------------------------ */
export let renderer = null;
try {
  // Anti-aliasing happens in the composer's multisampled target, not the canvas
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
} catch (err) {
  console.warn("WebGL unavailable; showing the poster instead.", err);
  document.documentElement.classList.add("no-3d");
}

export const scene = new THREE.Scene();
// A real perspective camera (a gentle telephoto) so shots have depth, like film.
export const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
export const FOV = 30;
// Depth haze: thick in the dark at the start, gone in daylight (lighting.js sets amount)
export const atmosphere = { fog: 1 };
export const lights = {};

const frameCallbacks = new Set();
export const onFrame = (cb) => (frameCallbacks.add(cb), () => frameCallbacks.delete(cb));

let dirty = true;
export function requestRender({ shadows = false } = {}) {
  dirty = true;
  if (shadows && renderer) renderer.shadowMap.needsUpdate = true;
}

// Camera view: an isometric direction, a target point and a vertical half-size.
export const VIEW_DIR = new THREE.Vector3(1, 0.86, 1).normalize();
export const view = { target: new THREE.Vector3(), size: 5, dir: VIEW_DIR.clone() };

// Pointer parallax: a gentle turn of the isometric view towards the cursor.
export const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let camDistance = 20;
export function applyView() {
  const r = sceneRect();
  if (!r.W || !r.H) return;
  // Turn the view direction a little around the vertical axis and tilt it
  _dir.copy(view.dir).applyAxisAngle(_up, parallax.x * 0.1);
  _dir.y += parallax.y * 0.08;
  _dir.normalize();
  // Distance so that `size` (half-height at the target) fills the scene box
  const half = THREE.MathUtils.degToRad(FOV / 2);
  camDistance = (view.size * (r.H / r.h)) / Math.tan(half);
  camera.position.copy(view.target).addScaledVector(_dir, camDistance);
  camera.lookAt(view.target);
  camera.aspect = r.W / r.H;
  // Put the target at the centre of the scene box (it may be off-centre)
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  camera.setViewOffset(r.W, r.H, r.W / 2 - cx, r.H / 2 - cy, r.W, r.H);
  camera.updateProjectionMatrix();
  requestRender();
}

// Depth haze follows the light (thick in the dark, gone in daylight); updated every rendered frame
function updateFog() {
  if (!scene.fog) return;
  scene.fog.near = camDistance * 0.92;
  scene.fog.far = camDistance * (1.5 + 40 * (1 - atmosphere.fog) ** 2);
}

// Smallest view (for the current canvas aspect) that fits a box, with padding.
export function viewForBox(box, pad = 1.08, dir = VIEW_DIR) {
  const { w, h } = sceneRect();
  const aspect = w / h;
  const cam = new THREE.OrthographicCamera();
  const target = box.getCenter(new THREE.Vector3());
  cam.position.copy(target).addScaledVector(dir, 40);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  // Re-centre on the projected box (its 3D centre isn't the 2D centre)
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  target.addScaledVector(right, (minX + maxX) / 2).addScaledVector(up, (minY + maxY) / 2);
  const size = Math.max((maxY - minY) / 2, (maxX - minX) / 2 / aspect) * pad;
  return { target, size, dir: dir.clone() };
}

export const officeBox = new THREE.Box3();
export let composer = null;
export const export_bg = new THREE.Color();   // linear colour behind the scene (set by lighting.js)
let bloom = null, ao = null;

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // re-rendered only when something moves
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.52;     // dim: nobody has switched anything on

  // Soft studio light from a procedural room
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  // The page colour is composited behind the scene in post (see BackgroundPass),
  // so the background never blooms.
  export_bg.copy(new THREE.Color(0x16181d));
  scene.fog = new THREE.Fog(export_bg, 10, 40);
  scene.fog.color = export_bg;   // same Color object: the haze always matches the page

  buildOffice();
  scene.add(office);
  officeBox.setFromObject(office);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.07 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  lights.hemi = new THREE.HemisphereLight(0xe3e7ee, 0xa9a6a1, 0.75);
  scene.add(lights.hemi);

  const sun = new THREE.DirectionalLight(0xeef0f4, 1.6);
  sun.position.set(-5, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(LITE ? 1024 : 2048);
  sun.shadow.radius = 7;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.06;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  scene.add(sun);
  lights.sun = sun;

  lights.fill = new THREE.DirectionalLight(0xdfe4ec, 0.35);
  lights.fill.position.set(8, 4, 9);
  scene.add(lights.fill);

  Object.assign(view, viewForBox(officeBox, LITE ? 1.02 : 1.08));

  // Post: bloom makes the line, screens, lamp and lights actually glow.
  // 1. scene on a transparent background  2. page colour behind it (alpha kept)
  // 3. bloom only where there is something (alpha) and it is brighter than white
  // 4. tone mapping + sRGB
  // Multisampled anti-aliasing; skipped on dense phone screens, where it costs the most and shows the least
  const samples = !LITE ? 4 : devicePixelRatio >= 2 ? 0 : 2;
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples }));
  composer.addPass(new RenderPass(scene, camera));
  // Ambient occlusion (desktop): soft contact darkening where things meet, the
  // biggest single step from "toy" to "real". Rendered at half resolution on dense screens.
  if (!LITE) {
    ao = new GTAOPass(scene, camera, 1, 1);
    ao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 1.2, scale: 1.25, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    ao.blendIntensity = 0.9;
    const setSize = ao.setSize.bind(ao);
    ao.setSize = (w, h) => { const k = renderer.getPixelRatio() > 1.4 ? 0.5 : 1; setSize(Math.round(w * k), Math.round(h * k)); };
    composer.addPass(ao);
  }
  const bgPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uBg: { value: export_bg } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uBg; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(uBg * (1.0 - c.a) + c.rgb, c.a); }`,
  });
  bgPass.uniforms.uBg.value = export_bg;   // ShaderPass clones uniforms; re-link so lighting.js updates reach it
  composer.addPass(bgPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 1.6);
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader
    .replace("float v = dot( texel.xyz, luma );", "float v = max(max(texel.r, texel.g), texel.b);")   // red can glow too
    .replace("gl_FragColor = mix( outputColor, texel, alpha );", "alpha *= step(0.5, texel.a); gl_FragColor = mix( outputColor, texel, alpha );");
  hp.needsUpdate = true;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let running = true;
  const clock = new THREE.Clock();
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    let busy = stepTweens(dt);
    for (const cb of frameCallbacks) busy = cb(dt) || busy;
    // Ease the parallax towards the pointer
    const px = parallax.tx - parallax.x, py = parallax.ty - parallax.y;
    if (Math.abs(px) > 1e-4 || Math.abs(py) > 1e-4) {
      const k = 1 - Math.exp(-dt * 3);
      parallax.x += px * k; parallax.y += py * k;
      applyView();
      busy = true;
    }
    if (busy) dirty = true;
    if (dirty) {
      dirty = false;
      updateFog();
      composer.render();
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    const scale = LITE ? 0.25 : 0.5;
    bloom.resolution.set(w * scale, h * scale);
    container.dispatchEvent(new CustomEvent("resize-scene"));
    applyView();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  renderer.shadowMap.needsUpdate = true;
  requestAnimationFrame(loop);
  container.classList.add("is-ready");

  // Only render while the scene is on screen and the tab is visible.
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    if (on) { clock.getDelta(); dirty = true; requestAnimationFrame(loop); }
  };
  // Pointer parallax (fine pointers only; off for reduced motion)
  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      if (reduceMotion.matches) return;
      parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!running) return;
      dirty = true;
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { parallax.tx = 0; parallax.ty = 0; });
  }

  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(onScreen && !document.hidden); }).observe(container);
  document.addEventListener("visibilitychange", () => setRunning(onScreen && !document.hidden));
}
