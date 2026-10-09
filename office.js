// Isometric clay office, built entirely in code (no model files).
// Exports the scene core that line.js, lighting and the story build on.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { stepTweens } from "./anim.js";

export const container = document.querySelector(".scene");
const canvas = container.querySelector("canvas");

// Small or low-power devices get a lighter build.
export const LITE =
  Math.min(screen.width, screen.height) < 500 ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  navigator.connection?.saveData === true;
const SEG = LITE ? 2 : 3;          // rounded-box bevel segments
const CURVE = LITE ? 14 : 22;      // sphere/capsule/cylinder segments

/* ------------------------------------------------------------------ */
/*  Look: shared uniforms so later beats can warm and saturate the room */
/* ------------------------------------------------------------------ */
export const look = {
  saturation: { value: 0.45 }, // 1 = full colour; the office starts drained
};

const SAT_CHUNK = `#include <dithering_fragment>
  float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, uSaturation);`;

function satCompile(shader) {
  shader.uniforms.uSaturation = look.saturation;
  shader.fragmentShader = "uniform float uSaturation;\n" +
    shader.fragmentShader.replace("#include <dithering_fragment>", SAT_CHUNK);
}

export function material(color, roughness = 0.92, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  m.onBeforeCompile = satCompile;
  return m;
}

export const M = {
  clay: material(0xf1eee9),             // the one matte white clay
  wood: material(0xc29466, 0.78),       // the one warm wood
  dark: material(0x2b2c30, 0.45),       // device bodies, vents
  hair: material(0x3a2e28, 0.85),
};
export const SKIN = [0xc8916c, 0xa36d4d, 0xdba987, 0x8a5a3e]; // per-person materials so faces can brighten
export const CLOTH = {
  slate: material(0x7f8b99), sand: material(0xb9a78d), sage: material(0x8e9985),
  mauve: material(0x8a7f8c), ink: material(0x474b54), umber: material(0x5d534a),
  stone: material(0x6c6862), denim: material(0x4f5866),
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers (all geometry is cached and shared)               */
/* ------------------------------------------------------------------ */
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function rbox(w, h, d, r = 0.03) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return cached(`b${w},${h},${d},${rr}`, () =>
    rr > 0 ? new RoundedBoxGeometry(w, h, d, SEG, rr) : new THREE.BoxGeometry(w, h, d));
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

  block(office, M.clay, w + wall * 2, 0.32, d + wall * 2, 0, -0.32, 0, 0.1); // floor slab
  block(office, M.clay, w + wall * 2, h, wall, 0, 0, z0 - wall / 2, 0);       // back wall

  // Left wall in four sharp pieces around a wide window
  const lx = x0 - wall / 2, zA = z0 - wall, zB = d / 2 + wall;
  block(office, M.clay, wall, win.y1, zB - zA, lx, 0, (zA + zB) / 2, 0);
  block(office, M.clay, wall, h - win.y2, zB - zA, lx, win.y2, (zA + zB) / 2, 0);
  block(office, M.clay, wall, win.y2 - win.y1, win.z1 - zA, lx, win.y1, (zA + win.z1) / 2, 0);
  block(office, M.clay, wall, win.y2 - win.y1, zB - win.z2, lx, win.y1, (win.z2 + zB) / 2, 0);
  block(office, M.wood, wall + 0.08, 0.04, win.z2 - win.z1, lx + 0.04, win.y1, (win.z1 + win.z2) / 2, 0.015);
}

/* ------------------------------------------------------------------ */
/*  Furniture                                                          */
/* ------------------------------------------------------------------ */
export const SEAT_H = 0.46;

function chair(parent, x, z, rotY = 0) {
  const g = group(parent, x, 0, z, rotY);
  cylinder(g, M.clay, 0.24, 0.26, 0.04);
  cylinder(g, M.clay, 0.03, 0.03, SEAT_H - 0.12, 0, 0.04, 0);
  block(g, M.clay, 0.46, 0.08, 0.44, 0, SEAT_H - 0.08, 0, 0.035);
  block(g, M.clay, 0.42, 0.44, 0.06, 0, SEAT_H + 0.06, 0.22, 0.03);
  return g;
}

// Desk: the user sits on local +z and faces -z; the laptop faces them.
function desk({ id, x, z }) {
  const g = group(office, x, 0, z);
  const W = 1.55, D = 0.78, H = 0.74;
  block(g, M.wood, W, 0.05, D, 0, H - 0.05, 0, 0.02);
  for (const sx of [-1, 1]) block(g, M.clay, 0.05, H - 0.05, D - 0.08, sx * (W / 2 - 0.08), 0, 0, 0.02);
  block(g, M.clay, W - 0.2, 0.28, 0.03, 0, H - 0.36, -D / 2 + 0.06, 0.012); // modesty panel

  const lap = group(g, 0.1, H, 0.02);
  block(lap, M.clay, 0.42, 0.022, 0.3, 0, 0, 0, 0.01);
  const lid = group(lap, 0, 0.02, -0.14);
  lid.rotation.x = -0.32;
  block(lid, M.clay, 0.42, 0.29, 0.018, 0, 0, 0, 0.008);
  const screenMesh = plane(lid, M.dark, 0.37, 0.24, 0, 0.15, 0.0095);

  chair(g, 0.05, 0.62);
  parts[id] = { group: g, screen: screenMesh, seat: new THREE.Vector3(x + 0.05, SEAT_H, z + 0.62) };
}

function plant(x, z, size = 1) {
  const g = group(office, x, 0, z);
  g.scale.setScalar(size);
  cylinder(g, M.clay, 0.2, 0.15, 0.42);
  cylinder(g, M.wood, 0.012, 0.012, 0.35, 0, 0.42, 0);
  const leaves = [
    [0, 0.95, 0, 0.26], [0.17, 0.82, 0.06, 0.18], [-0.15, 0.85, -0.05, 0.2],
    [0.05, 1.15, -0.08, 0.17], [-0.06, 0.78, 0.15, 0.15],
  ];
  for (const [lx, ly, lz, r] of leaves) sphere(g, M.clay, r, lx, ly, lz);
}

function sofa({ x, z }) {
  // Faces +x, back against the left wall
  const g = group(office, x, 0, z, Math.PI / 2);
  const L = 2.0, D = 0.86;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cylinder(g, M.wood, 0.03, 0.025, 0.08, sx * (L / 2 - 0.12), 0, sz * (D / 2 - 0.12));
  block(g, M.clay, L, 0.24, D, 0, 0.08, 0, 0.06);
  for (const sx of [-1, 1]) block(g, M.clay, L / 2 - 0.2, 0.14, D - 0.26, sx * (L / 4 - 0.05), 0.32, 0.08, 0.06);
  block(g, M.clay, L, 0.52, 0.22, 0, 0.32, -D / 2 + 0.11, 0.08);
  for (const sx of [-1, 1]) block(g, M.clay, 0.2, 0.42, D, sx * (L / 2 - 0.1), 0.32, 0, 0.08);
  parts.sofa = { group: g, seats: [new THREE.Vector3(x + 0.12, SEAT_H, z - 0.45), new THREE.Vector3(x + 0.12, SEAT_H, z + 0.45)] };
}

function frontDesk({ x, z }) {
  // Reception counter; visitors approach from local +z (world +x)
  const g = group(office, x, 0, z, Math.PI / 2);
  block(g, M.clay, 2.0, 1.0, 0.56, 0, 0, 0.12, 0.06);
  block(g, M.wood, 2.08, 0.05, 0.34, 0, 1.0, 0.24, 0.02);
  block(g, M.clay, 2.0, 0.05, 0.62, 0, 0.72, -0.38, 0.02);
  block(g, M.clay, 0.05, 0.72, 0.56, -0.96, 0, -0.38, 0.02);
  block(g, M.clay, 0.05, 0.72, 0.56, 0.96, 0, -0.38, 0.02);

  const p = group(g, 0.45, 0.77, -0.4, 0.2);
  block(p, M.clay, 0.26, 0.06, 0.2, 0, 0, 0, 0.025).rotation.x = -0.18;
  const handset = capsule(p, M.clay, 0.03, 0.17, -0.06, 0.1, 0.01);
  handset.rotation.z = Math.PI / 2;
  const keys = plane(p, M.dark, 0.09, 0.08, 0.06, 0.075, 0.02);
  keys.rotation.x = -Math.PI / 2 - 0.18;

  // Slim table lamp; switches on in beat 4
  const lamp = group(g, -0.6, 0.77, -0.45);
  cylinder(lamp, M.clay, 0.07, 0.08, 0.02);
  cylinder(lamp, M.wood, 0.008, 0.008, 0.36, 0, 0.02, 0);
  const shade = cylinder(lamp, M.clay, 0.07, 0.11, 0.12, 0, 0.36, 0);

  chair(g, 0.1, -0.95, Math.PI);
  parts.frontDesk = {
    group: g, phoneKeys: keys, handset, lampShade: shade, lamp,
    seat: new THREE.Vector3(x - 0.95, SEAT_H, z - 0.1),
  };
}

function server({ x, z }) {
  const g = group(office, x, 0, z, Math.PI / 2); // front faces +x
  block(g, M.clay, 0.58, 1.85, 0.62, 0, 0, 0, 0.04);
  for (let i = 0; i < 6; i++) block(g, M.dark, 0.34, 0.012, 0.01, -0.04, 1.2 + i * 0.07, 0.312, 0.004);
  const leds = [];
  for (let i = 0; i < 5; i++) leds.push(plane(g, M.dark, 0.05, 0.016, -0.12 + i * 0.07, 0.95, 0.315));
  parts.server = { group: g, leds };
}

function router({ x, y, z }) {
  const g = group(office, x, y, z);
  block(g, M.wood, 0.62, 0.035, 0.24, 0, 0, 0, 0.012);
  block(g, M.clay, 0.36, 0.07, 0.2, 0, 0.035, 0, 0.025);
  for (const sx of [-1, 1]) capsule(g, M.clay, 0.012, 0.16, sx * 0.14, 0.2, -0.06).rotation.z = sx * -0.18;
  const led = sphere(g, M.dark, 0.012, 0.12, 0.07, 0.1);
  led.castShadow = false;
  parts.router = { group: g, led };
}

/* ------------------------------------------------------------------ */
/*  People — simple figurines; posture carries the story               */
/* ------------------------------------------------------------------ */
export const people = {};

function person(name, { x, z, yaw, skin: skinColor, top, bottom, hair = "short", headTilt = 0.45, headYaw = 0, phone = "both" }) {
  const g = group(office, x, 0, z, yaw);
  g.name = name;
  const skin = material(skinColor, 0.8);
  for (const sx of [-1, 1]) capsule(g, bottom, 0.075, 0.6, sx * 0.09, 0.375, 0);
  capsule(g, top, 0.19, 0.36, 0, 1.1, 0);

  const head = group(g, 0, 1.6, 0.01);
  head.rotation.set(headTilt, headYaw, 0);
  sphere(head, skin, 0.15);
  const cap = mesh(cached("hair", () => new THREE.SphereGeometry(0.158, CURVE, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), M.hair, head, 0, 0.01, -0.02);
  cap.rotation.x = -0.6;
  if (hair === "long") capsule(head, M.hair, 0.13, 0.16, 0, -0.1, -0.06).scale.set(1, 1, 0.7);
  else if (hair === "bun") sphere(head, M.hair, 0.07, 0, 0.12, -0.13);

  function arm(side, upperX, upperZ, foreX, foreY = 0) {
    const sh = group(g, side * 0.24, 1.35, 0);
    sh.rotation.set(upperX, 0, side * upperZ);
    capsule(sh, top, 0.055, 0.2, 0, -0.14, 0);
    const el = group(sh, 0, -0.3, 0);
    el.rotation.set(foreX, foreY * side, 0);
    capsule(el, top, 0.048, 0.14, 0, -0.1, 0);
    sphere(el, skin, 0.048, 0, -0.24, 0);
    return group(el, 0, -0.26, 0);
  }

  let hand;
  if (phone === "both") { hand = arm(1, -0.25, 0.12, -1.25, -0.35); arm(-1, -0.25, 0.12, -1.25, -0.35); }
  else if (phone === "right") { hand = arm(1, -0.2, 0.08, -1.2, -0.25); arm(-1, 0.04, 0.06, -0.12); }
  else { hand = arm(1, 0.05, 0.08, -0.5); arm(-1, 0.04, 0.06, -0.15); }

  g.updateMatrixWorld(true);
  const p = g.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
  const ph = group(g, phone === "both" ? 0 : p.x, p.y + 0.02, p.z + 0.01);
  ph.rotation.x = phone === "side" ? -0.3 : -1.15;
  block(ph, M.dark, 0.085, 0.16, 0.014, 0, -0.08, 0, 0.012);
  const scr = plane(ph, M.dark, 0.07, 0.14, 0, 0, 0.0075);

  people[name] = { group: g, head, phoneScreen: scr, skin };
}

/* ------------------------------------------------------------------ */
/*  Compose                                                            */
/* ------------------------------------------------------------------ */
function buildOffice() {
  buildRoom();
  LAYOUT.desks.forEach(desk);
  router(LAYOUT.router);
  server(LAYOUT.server);
  sofa(LAYOUT.sofa);
  frontDesk(LAYOUT.frontDesk);
  for (const [x, z, s] of LAYOUT.plants) plant(x, z, s);

  person("Riya",  { x: 2.05, z: 1.05, yaw: 0.35, skin: SKIN[2], top: CLOTH.sage,  bottom: CLOTH.ink,   hair: "long", headTilt: 0.5 });
  person("Arjun", { x: 1.1,  z: 1.55, yaw: 0.95, skin: SKIN[0], top: CLOTH.slate, bottom: CLOTH.umber, headTilt: 0.42, phone: "right" });
  person("Meera", { x: 2.95, z: 1.6,  yaw: -0.25, skin: SKIN[1], top: CLOTH.mauve, bottom: CLOTH.denim, hair: "bun", headTilt: 0.55 });
  person("Kabir", { x: 2.0,  z: 2.35, yaw: 0.6, skin: SKIN[3], top: CLOTH.sand,  bottom: CLOTH.stone, headTilt: 0.05, headYaw: -0.55, phone: "side" });
}

/* ------------------------------------------------------------------ */
/*  Renderer, lights, camera, loop                                     */
/* ------------------------------------------------------------------ */
export let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE || devicePixelRatio < 2, alpha: true, powerPreference: "high-performance" });
} catch (err) {
  console.warn("WebGL unavailable; showing the page without the office scene.", err);
}

export const scene = new THREE.Scene();
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
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

export function applyView() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  const aspect = w / h;
  camera.position.copy(view.target).addScaledVector(view.dir, 40);
  camera.lookAt(view.target);
  Object.assign(camera, { left: -view.size * aspect, right: view.size * aspect, top: view.size, bottom: -view.size });
  camera.updateProjectionMatrix();
  requestRender();
}

// Smallest view (for the current canvas aspect) that fits a box, with padding.
export function viewForBox(box, pad = 1.08, dir = VIEW_DIR) {
  const w = container.clientWidth || 1, h = container.clientHeight || 1;
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

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // re-rendered only when something moves
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;     // dim: nobody has switched anything on

  buildOffice();
  scene.add(office);
  officeBox.setFromObject(office);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  lights.hemi = new THREE.HemisphereLight(0xe3e7ee, 0xa9a6a1, 1.25);
  scene.add(lights.hemi);

  const sun = new THREE.DirectionalLight(0xeef0f4, 1.6);
  sun.position.set(-5, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(LITE ? 1024 : 2048);
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  scene.add(sun);
  lights.sun = sun;

  lights.fill = new THREE.DirectionalLight(0xdfe4ec, 0.35);
  lights.fill.position.set(8, 4, 9);
  scene.add(lights.fill);

  Object.assign(view, viewForBox(officeBox, LITE ? 1.02 : 1.08));

  let running = true;
  const clock = new THREE.Clock();
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    let busy = stepTweens(dt);
    for (const cb of frameCallbacks) busy = cb(dt) || busy;
    if (busy) dirty = true;
    if (dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    container.dispatchEvent(new CustomEvent("resize-scene"));
    applyView();
  }
  new ResizeObserver(resize).observe(container);
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
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(onScreen && !document.hidden); }).observe(container);
  document.addEventListener("visibilitychange", () => setRunning(onScreen && !document.hidden));
}
