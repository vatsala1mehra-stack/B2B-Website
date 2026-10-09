// Isometric clay office, built entirely in code (no model files).
// State for now: beat 1 — a dim, desaturated office, four people standing together, unsure.
// Red (#e40000) is reserved for the line, which arrives in later beats.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const container = document.querySelector(".scene");
const canvas = container.querySelector("canvas");

/* ------------------------------------------------------------------ */
/*  Look: shared uniforms so later beats can warm and saturate the room */
/* ------------------------------------------------------------------ */
const look = {
  saturation: { value: 0.45 }, // 1 = full colour; office starts drained
};

function material(color, roughness = 0.92) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSaturation = look.saturation;
    shader.fragmentShader =
      "uniform float uSaturation;\n" +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, uSaturation);`
      );
  };
  return m;
}

const M = {
  clay: material(0xf1eee9),             // the one matte white clay
  wood: material(0xc29466, 0.78),       // the one warm wood
  screen: material(0x2b2c30, 0.45),     // screens and phones, switched off
  hair: material(0x3a2e28, 0.85),
};
const SKIN = [0xc8916c, 0xa36d4d, 0xdba987, 0x8a5a3e].map((c) => material(c, 0.8));
const CLOTH = {
  slate: material(0x7f8b99), sand: material(0xb9a78d), sage: material(0x8e9985),
  mauve: material(0x8a7f8c), ink: material(0x474b54), umber: material(0x5d534a),
  stone: material(0x6c6862), denim: material(0x4f5866),
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */
const geoCache = new Map();
function rbox(w, h, d, r = 0.03) {
  const key = `b${w},${h},${d},${r}`;
  if (!geoCache.has(key)) {
    const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    geoCache.set(key, rr > 0 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(key);
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Box whose y is its bottom face — easier to stack furniture.
function block(parent, mat, w, h, d, x, y, z, r = 0.03) {
  return mesh(rbox(w, h, d, r), mat, parent, x, y + h / 2, z);
}

function capsule(parent, mat, r, len, x = 0, y = 0, z = 0) {
  return mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat, parent, x, y, z);
}

function sphere(parent, mat, r, x = 0, y = 0, z = 0) {
  return mesh(new THREE.SphereGeometry(r, 24, 16), mat, parent, x, y, z);
}

function cylinder(parent, mat, rTop, rBottom, h, x = 0, y = 0, z = 0, seg = 32) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat, parent, x, y + h / 2, z);
}

function group(parent, x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Room                                                               */
/* ------------------------------------------------------------------ */
const ROOM = { w: 10, d: 8, h: 2.9, wall: 0.2 };
const office = new THREE.Group();

function buildRoom() {
  const { w, d, h, wall } = ROOM;
  const x0 = -w / 2, z0 = -d / 2;

  // Floor slab
  block(office, M.clay, w + wall * 2, 0.32, d + wall * 2, 0, -0.32, 0, 0.1);

  // Back wall
  block(office, M.clay, w + wall * 2, h, wall, 0, 0, z0 - wall / 2, 0);

  // Left wall, with one wide window above the sofa
  const lx = x0 - wall / 2;
  const win = { z1: -1.7, z2: 0.9, y1: 1.05, y2: 2.25 };
  const zStart = z0 - wall, zEnd = d / 2 + wall;
  block(office, M.clay, wall, win.y1, zEnd - zStart, lx, 0, (zStart + zEnd) / 2, 0);
  block(office, M.clay, wall, h - win.y2, zEnd - zStart, lx, win.y2, (zStart + zEnd) / 2, 0);
  block(office, M.clay, wall, win.y2 - win.y1, win.z1 - zStart, lx, win.y1, (zStart + win.z1) / 2, 0);
  block(office, M.clay, wall, win.y2 - win.y1, zEnd - win.z2, lx, win.y1, (win.z2 + zEnd) / 2, 0);
  // Thin wood sill
  block(office, M.wood, wall + 0.08, 0.04, win.z2 - win.z1, lx + 0.04, win.y1, (win.z1 + win.z2) / 2, 0.015);
}

/* ------------------------------------------------------------------ */
/*  Furniture                                                          */
/* ------------------------------------------------------------------ */
const screens = []; // laptop + phone screens; later beats light these

// Desk group: the user sits on local +z, laptop faces them.
function desk(x, z, rotY) {
  const g = group(office, x, 0, z, rotY);
  const W = 1.55, D = 0.78, H = 0.74;
  block(g, M.wood, W, 0.05, D, 0, H - 0.05, 0, 0.02);
  for (const sx of [-1, 1]) block(g, M.clay, 0.05, H - 0.05, D - 0.08, sx * (W / 2 - 0.08), 0, 0, 0.02);
  block(g, M.clay, W - 0.2, 0.28, 0.03, 0, H - 0.36, -D / 2 + 0.06, 0.012); // modesty panel

  // Laptop
  const lap = group(g, 0.12, H, 0.02);
  block(lap, M.clay, 0.42, 0.022, 0.3, 0, 0, 0, 0.01);
  const lid = group(lap, 0, 0.02, -0.14);
  lid.rotation.x = -0.32;
  block(lid, M.clay, 0.42, 0.29, 0.018, 0, 0, 0, 0.008);
  const scr = mesh(new THREE.PlaneGeometry(0.37, 0.24), M.screen, lid, 0, 0.15, 0.0095);
  scr.castShadow = false;
  screens.push(scr);

  // Chair, tucked in on the user side
  chair(g, 0.05, 0.62, 0.15);
  return g;
}

function chair(parent, x, z, rotY = 0) {
  const g = group(parent, x, 0, z, rotY);
  cylinder(g, M.clay, 0.24, 0.26, 0.04, 0, 0, 0);
  cylinder(g, M.clay, 0.03, 0.03, 0.4, 0, 0.04, 0, 12);
  block(g, M.clay, 0.46, 0.08, 0.44, 0, 0.42, 0, 0.035);
  block(g, M.clay, 0.42, 0.44, 0.06, 0, 0.54, 0.22, 0.03);
  return g;
}

function plant(x, z, size = 1) {
  const g = group(office, x, 0, z);
  g.scale.setScalar(size);
  cylinder(g, M.clay, 0.2, 0.15, 0.42, 0, 0, 0);
  cylinder(g, M.wood, 0.012, 0.012, 0.35, 0, 0.42, 0, 8);
  // Sculpted clay foliage: a loose cluster of spheres
  const leaves = [
    [0, 0.95, 0, 0.26], [0.17, 0.82, 0.06, 0.18], [-0.15, 0.85, -0.05, 0.2],
    [0.05, 1.15, -0.08, 0.17], [-0.06, 0.78, 0.15, 0.15],
  ];
  for (const [lx, ly, lz, r] of leaves) sphere(g, M.clay, r, lx, ly, lz);
  return g;
}

function sofa(x, z, rotY) {
  const g = group(office, x, 0, z, rotY);
  const L = 2.0, D = 0.86;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cylinder(g, M.wood, 0.03, 0.025, 0.08, sx * (L / 2 - 0.12), 0, sz * (D / 2 - 0.12), 10);
  }
  block(g, M.clay, L, 0.24, D, 0, 0.08, 0, 0.06);
  for (const sx of [-1, 1]) block(g, M.clay, L / 2 - 0.2, 0.14, D - 0.26, sx * (L / 4 - 0.05), 0.32, 0.08, 0.06);
  block(g, M.clay, L, 0.52, 0.22, 0, 0.32, -D / 2 + 0.11, 0.08);
  for (const sx of [-1, 1]) block(g, M.clay, 0.2, 0.42, D, sx * (L / 2 - 0.1), 0.32, 0, 0.08);
  return g;
}

function sideTable(x, z) {
  const g = group(office, x, 0, z);
  cylinder(g, M.clay, 0.05, 0.09, 0.36, 0, 0, 0, 16);
  cylinder(g, M.wood, 0.34, 0.34, 0.04, 0, 0.36, 0, 40);
  return g;
}

function frontDesk(x, z, rotY) {
  // Reception counter; visitors approach from local +z
  const g = group(office, x, 0, z, rotY);
  block(g, M.clay, 2.0, 1.0, 0.56, 0, 0, 0.12, 0.06);
  block(g, M.wood, 2.08, 0.05, 0.34, 0, 1.0, 0.24, 0.02);    // raised wood ledge
  block(g, M.clay, 2.0, 0.05, 0.62, 0, 0.72, -0.38, 0.02);   // work surface behind
  block(g, M.clay, 0.05, 0.72, 0.56, -0.96, 0, -0.38, 0.02);
  block(g, M.clay, 0.05, 0.72, 0.56, 0.96, 0, -0.38, 0.02);

  // Desk phone on the work surface
  const p = group(g, 0.45, 0.77, -0.4, 0.2);
  const base = block(p, M.clay, 0.26, 0.06, 0.2, 0, 0, 0, 0.025);
  base.rotation.x = -0.18;
  capsule(p, M.clay, 0.03, 0.17, -0.06, 0.1, 0.01).rotation.z = Math.PI / 2;
  const keys = mesh(new THREE.PlaneGeometry(0.09, 0.08), M.screen, p, 0.06, 0.075, 0.02);
  keys.rotation.x = -Math.PI / 2 - 0.18;
  keys.castShadow = false;
  screens.push(keys);

  chair(g, 0.1, -0.95, Math.PI + 0.25);
  return g;
}

function server(x, z) {
  const g = group(office, x, 0, z);
  block(g, M.clay, 0.58, 1.85, 0.62, 0, 0, 0, 0.04);
  // Door seam and vent slots, quietly recessed
  for (let i = 0; i < 6; i++) block(g, M.screen, 0.34, 0.012, 0.01, -0.04, 1.2 + i * 0.07, 0.312, 0.004);
  block(g, M.screen, 0.01, 1.6, 0.01, 0.22, 0.12, 0.312, 0.004);
  return g;
}

function router(x, y, z) {
  const g = group(office, x, y, z);
  block(g, M.wood, 0.62, 0.035, 0.24, 0, 0, 0, 0.012);                 // wall shelf
  block(g, M.clay, 0.36, 0.07, 0.2, 0, 0.035, 0, 0.025);              // router body
  for (const sx of [-1, 1]) {
    const a = capsule(g, M.clay, 0.012, 0.16, sx * 0.14, 0.2, -0.06);
    a.rotation.z = sx * -0.18;
  }
  const led = sphere(g, M.screen, 0.012, 0.12, 0.07, 0.1);
  led.castShadow = false;
  return g;
}

/* ------------------------------------------------------------------ */
/*  People — simple figurines; posture carries the story               */
/* ------------------------------------------------------------------ */
const people = {};

function person(name, { x, z, yaw, skin, top, bottom, hair = "short", headTilt = 0.45, headYaw = 0, phone = "both" }) {
  const g = group(office, x, 0, z, yaw);
  g.name = name;

  // Legs
  for (const sx of [-1, 1]) capsule(g, bottom, 0.075, 0.6, sx * 0.09, 0.375, 0);
  // Torso
  capsule(g, top, 0.19, 0.36, 0, 1.1, 0);

  // Head
  const head = group(g, 0, 1.6, 0.01);
  head.rotation.set(headTilt, headYaw, 0);
  sphere(head, skin, 0.15, 0, 0, 0);
  const cap = mesh(new THREE.SphereGeometry(0.158, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), M.hair, head, 0, 0.01, -0.02);
  cap.rotation.x = -0.6;
  if (hair === "long") {
    const back = capsule(head, M.hair, 0.13, 0.16, 0, -0.1, -0.06);
    back.scale.set(1, 1, 0.7);
  } else if (hair === "bun") {
    sphere(head, M.hair, 0.07, 0, 0.12, -0.13);
  }

  // Arms: shoulder → elbow → hand. Negative x-rotation swings forward.
  function arm(side, upperX, upperZ, foreX, foreY = 0) {
    const sh = group(g, side * 0.24, 1.35, 0);
    sh.rotation.set(upperX, 0, side * upperZ);
    capsule(sh, top, 0.055, 0.2, 0, -0.14, 0);
    const el = group(sh, 0, -0.3, 0);
    el.rotation.set(foreX, foreY * side, 0);
    capsule(el, top, 0.048, 0.14, 0, -0.1, 0);
    sphere(el, skin, 0.048, 0, -0.24, 0);
    const hand = group(el, 0, -0.26, 0);
    return hand;
  }

  let phoneHand;
  if (phone === "both") {
    phoneHand = arm(1, -0.25, 0.12, -1.25, -0.35);
    arm(-1, -0.25, 0.12, -1.25, -0.35);
  } else if (phone === "right") {
    phoneHand = arm(1, -0.2, 0.08, -1.2, -0.25);
    arm(-1, 0.04, 0.06, -0.12);
  } else {
    // Phone lowered at their side
    phoneHand = arm(1, 0.05, 0.08, -0.5);
    arm(-1, 0.04, 0.06, -0.15);
  }

  // Phone sits at the hand, screen tilted towards the face.
  g.updateMatrixWorld(true);
  const p = phoneHand.getWorldPosition(new THREE.Vector3());
  g.worldToLocal(p);
  const ph = group(g, phone === "both" ? 0 : p.x, p.y + 0.02, p.z + 0.01);
  ph.rotation.x = phone === "side" ? -0.3 : -1.15;
  block(ph, M.screen, 0.085, 0.16, 0.014, 0, -0.08, 0, 0.012);
  const s = mesh(new THREE.PlaneGeometry(0.07, 0.14), M.screen, ph, 0, 0, 0.0075);
  s.castShadow = false;
  screens.push(s);

  people[name] = g;
  return g;
}

/* ------------------------------------------------------------------ */
/*  Compose                                                            */
/* ------------------------------------------------------------------ */
function buildOffice() {
  buildRoom();

  // Desk pod: back row faces the room, front row faces the wall
  desk(0.15, -2.45, Math.PI);
  desk(1.8, -2.45, Math.PI);
  desk(0.15, -1.6, 0);
  desk(1.8, -1.6, 0);

  router(1.0, 1.85, -3.86);
  server(-4.5, -3.5);
  sofa(-4.42, -0.4, Math.PI / 2);
  sideTable(-3.55, 0.95);
  frontDesk(-3.55, 2.65, Math.PI / 2);

  plant(4.45, -3.5, 1.15);
  plant(-4.5, -2.25, 0.9);
  plant(4.5, 3.5, 0.8);

  // The team, gathered in the open floor, unsure where to start
  person("Riya",  { x: 2.05, z: 1.05, yaw: 0.35, skin: SKIN[2], top: CLOTH.sage,  bottom: CLOTH.ink,   hair: "long", headTilt: 0.5 });
  person("Arjun", { x: 1.1,  z: 1.55, yaw: 0.95, skin: SKIN[0], top: CLOTH.slate, bottom: CLOTH.umber, hair: "short", headTilt: 0.42, phone: "right" });
  person("Meera", { x: 2.95, z: 1.6,  yaw: -0.25, skin: SKIN[1], top: CLOTH.mauve, bottom: CLOTH.denim, hair: "bun", headTilt: 0.55 });
  person("Kabir", { x: 2.0,  z: 2.35, yaw: 0.6, skin: SKIN[3], top: CLOTH.sand,  bottom: CLOTH.stone, hair: "short", headTilt: 0.05, headYaw: -0.55, phone: "side" });
}

/* ------------------------------------------------------------------ */
/*  Renderer, lights, camera                                           */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (err) {
  console.warn("WebGL unavailable; showing the page without the office scene.", err);
}

if (renderer) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78; // dim: nobody has switched anything on

  const scene = new THREE.Scene();
  buildOffice();
  scene.add(office);

  // Soft shadow catcher under the slab
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cool, flat daylight: the room is lit only by the window and the sky.
  const hemi = new THREE.HemisphereLight(0xe3e7ee, 0xa9a6a1, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xeef0f4, 1.6);
  sun.position.set(-5, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048);
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xdfe4ec, 0.35);
  fill.position.set(8, 4, 9);
  scene.add(fill);

  // Orthographic isometric camera, framed to the room
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const bounds = new THREE.Box3().setFromObject(office);
  const target = bounds.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(1, 0.86, 1).normalize();
  camera.position.copy(target).addScaledVector(dir, 40);
  camera.lookAt(target);

  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));

  function render() {
    renderer.render(scene, camera);
  }

  function fit() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);

    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      const v = c.clone().applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const pad = w < 600 ? 1.02 : 1.08;
    let halfW = ((maxX - minX) / 2) * pad;
    let halfH = ((maxY - minY) / 2) * pad;
    const aspect = w / h;
    if (halfW / halfH > aspect) halfH = halfW / aspect;
    else halfW = halfH * aspect;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    Object.assign(camera, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
    camera.updateProjectionMatrix();
    render();
  }

  // Nothing moves yet, so render only when the size changes.
  new ResizeObserver(fit).observe(container);
  fit();
  container.classList.add("is-ready");
}

export { office, people, screens, look };
