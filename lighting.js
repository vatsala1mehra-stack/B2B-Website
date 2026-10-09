// "Light up" system: wherever the red line arrives, that part of the office warms.
// Each zone listens to the line's progress; when the line passes its mark the zone
// eases from 0 to 1 over ~1.4s (and back if the line retracts). The whole room's
// colour, exposure and warmth follow the zones, reaching full warm light at the end.
import * as THREE from "three";
import { scene, renderer, lights, look, parts, people, onFrame, requestRender, LAYOUT, material } from "./office.js";
import { line } from "./line.js";
import { ease } from "./anim.js";

const DURATION = 1.4;
const WARM = new THREE.Color(0xffe7c9);
const OFF = new THREE.Color(0x2b2c30);

/* ---------- Canvas textures: screen UIs and soft light pools ---------- */
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rr(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// A calm, simple workspace app: sidebar, title, three cards, one gentle chart.
const laptopUI = canvasTexture(512, 336, (ctx, w, h) => {
  rr(ctx, 0, 0, w, h, 0, "#fbfaf8");
  rr(ctx, 0, 0, 112, h, 0, "#f1efeb");
  for (let i = 0; i < 5; i++) rr(ctx, 18, 40 + i * 30, i === 0 ? 70 : 56, 10, 5, i === 0 ? "#cfcac3" : "#e0dcd6");
  rr(ctx, 12, 38, 4, 14, 2, "#e40000");
  rr(ctx, 136, 34, 170, 18, 9, "#3b3c41");
  rr(ctx, 136, 62, 110, 9, 5, "#d7d3cd");
  for (let i = 0; i < 3; i++) {
    const x = 136 + i * 122;
    rr(ctx, x, 92, 110, 74, 12, "#f0eee9");
    rr(ctx, x + 14, 108, 46, 9, 5, "#cfcac3");
    rr(ctx, x + 14, 128, 70, 16, 8, "#9e9993");
  }
  rr(ctx, 136, 184, 354, 128, 14, "#f0eee9");
  ctx.strokeStyle = "#a9a49d"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  [[156, 286], [206, 266], [256, 274], [306, 244], [356, 252], [406, 222], [466, 206]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.fillStyle = "#e40000"; ctx.beginPath(); ctx.arc(466, 206, 6, 0, Math.PI * 2); ctx.fill();
});

const phoneUI = canvasTexture(128, 256, (ctx, w, h) => {
  rr(ctx, 0, 0, w, h, 0, "#fbfaf8");
  rr(ctx, 16, 22, 52, 10, 5, "#3b3c41");
  ctx.fillStyle = "#e40000"; ctx.beginPath(); ctx.arc(106, 27, 5, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    rr(ctx, 16, 54 + i * 44, 96, 34, 9, "#f0eee9");
    ctx.fillStyle = "#cfcac3"; ctx.beginPath(); ctx.arc(32, 71 + i * 44, 8, 0, Math.PI * 2); ctx.fill();
    rr(ctx, 48, 66 + i * 44, 50, 8, 4, "#cfcac3");
  }
  rr(ctx, 16, 226, 96, 14, 7, "#e0dcd6");
});

const poolTex = canvasTexture(128, 128, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, "rgba(255,214,160,1)");
  g.addColorStop(0.45, "rgba(255,214,160,0.45)");
  g.addColorStop(1, "rgba(255,214,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
});

/* ---------- Light-able materials ---------- */
const SCREEN_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SCREEN_FRAG = `
  uniform sampler2D uMap; uniform vec3 uOff; uniform float uOn;
  varying vec2 vUv;
  void main(){
    vec3 on = texture2D(uMap, vUv).rgb * 1.02;
    gl_FragColor = vec4(mix(uOff, on, uOn), 1.0);
    #include <colorspace_fragment>
  }`;

function screenMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uOff: { value: OFF.clone() }, uOn: { value: 0 } },
    vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, toneMapped: false,
  });
}

function glowMaterial(color) {
  return new THREE.MeshBasicMaterial({ color: OFF.clone(), toneMapped: false, userData: { on: new THREE.Color(color) } });
}

function pool(x, y, z, r, { wall = false } = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  m.position.set(x, y, z);
  if (!wall) m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  scene.add(m);
  return m;
}

/* ---------- Zones ---------- */
const zones = [];
function zone(mark, weight, apply) {
  zones.push({ mark, weight, apply, level: 0, from: 0, to: 0, t: 1 });
}

const setScreen = (mat, k) => (mat.uniforms.uOn.value = k);
const setGlow = (mat, k) => mat.color.copy(OFF).lerp(mat.userData.on, k);

if (renderer && line) {
  // Phones: screens glow, faces brighten
  for (const name of ["Kabir", "Arjun", "Riya", "Meera"]) {
    const p = people[name];
    const mat = screenMaterial(phoneUI);
    p.phoneScreen.material = mat;
    const skinColor = p.skin.color.clone();
    const pos = p.group.position;
    const halo = pool(pos.x, 0.006, pos.z, 0.75);
    zone(name, 0.05, (k) => {
      setScreen(mat, k);
      p.skin.emissive.copy(skinColor).multiplyScalar(0.28 * k);
      halo.material.opacity = 0.35 * k;
    });
  }

  // Router: a small red status light and a soft wash on the wall
  {
    const led = parts.router.led;
    led.material = glowMaterial(0xe40000);
    const { x, y, z } = LAYOUT.router;
    const wash = pool(x, y + 0.1, -3.99, 0.8, { wall: true });
    zone("router", 0.08, (k) => { setGlow(led.material, k); wash.material.opacity = 0.4 * k; });
  }

  // Desks: laptops wake up with a simple app
  for (const d of LAYOUT.desks) {
    const part = parts[d.id];
    const mat = screenMaterial(laptopUI);
    part.screen.material = mat;
    const glow = pool(d.x + 0.05, 0.006, d.z + 0.3, 1.0);
    zone(d.id, 0.06, (k) => { setScreen(mat, k); glow.material.opacity = 0.32 * k; });
  }

  // Front desk: phone keys glow, the lamp switches on
  {
    const fd = parts.frontDesk;
    fd.phoneKeys.material = glowMaterial(0xfff1dc);
    const shade = material(0xf1eee9, 0.6);
    fd.lampShade.material = shade;
    const { x, z } = LAYOUT.frontDesk;
    const lampPool = pool(x - 0.2, 0.006, z - 0.4, 1.5);
    const counterGlow = pool(x - 0.45, 0.80, z - 0.55, 0.55);
    zone("frontDesk", 0.12, (k) => {
      setGlow(fd.phoneKeys.material, k);
      shade.emissive.copy(WARM).multiplyScalar(0.9 * k);
      lampPool.material.opacity = 0.42 * k;
      counterGlow.material.opacity = 0.5 * k;
    });
  }

  // Server: a calm row of lights, coming on one after another
  {
    const leds = parts.server.leds;
    leds.forEach((l) => (l.material = glowMaterial(0xfff4e2)));
    const { x, z } = LAYOUT.server;
    const glow = pool(x + 0.5, 0.006, z, 0.9);
    zone("server", 0.1, (k) => {
      leds.forEach((l, i) => setGlow(l.material, THREE.MathUtils.clamp(k * leds.length - i, 0, 1)));
      glow.material.opacity = 0.3 * k;
    });
  }

  // The loop closes: the room reaches full warm brightness
  zone("loop", 0.3, () => {});
}

/* ---------- Whole-room warmth ---------- */
const COOL_SKY = new THREE.Color(0xe3e7ee), WARM_SKY = new THREE.Color(0xfff3e4);
const COOL_GROUND = new THREE.Color(0xa9a6a1), WARM_GROUND = new THREE.Color(0xc9b8a4);
const COOL_SUN = new THREE.Color(0xeef0f4), WARM_SUN = new THREE.Color(0xfff0dc);
const BG_DIM = new THREE.Color("#d3d4d7"), BG_WARM = new THREE.Color("#f4efe9");
const totalWeight = zones.reduce((s, z) => s + z.weight, 0);

export let warmth = 0;
function applyRoom() {
  warmth = zones.reduce((s, z) => s + z.level * z.weight, 0) / (totalWeight || 1);
  const g = warmth;
  look.saturation.value = 0.45 + 0.55 * g;
  if (renderer) renderer.toneMappingExposure = 0.78 + 0.3 * g;
  if (lights.hemi) {
    lights.hemi.color.copy(COOL_SKY).lerp(WARM_SKY, g);
    lights.hemi.groundColor.copy(COOL_GROUND).lerp(WARM_GROUND, g);
    lights.hemi.intensity = 1.25 + 0.35 * g;
    lights.sun.color.copy(COOL_SUN).lerp(WARM_SUN, g);
    lights.sun.intensity = 1.6 + 0.5 * g;
  }
  const bg = BG_DIM.clone().lerp(BG_WARM, g);
  document.documentElement.style.setProperty("--bg", `#${bg.getHexString()}`);
}

/* ---------- Link to the line ---------- */
function retarget(progress) {
  for (const z of zones) {
    const to = progress >= line.marks[z.mark] - 1e-4 ? 1 : 0;
    if (to !== z.to) { z.from = z.level; z.to = to; z.t = 0; }
  }
}

// Jump every zone to the line's current state (used for reduced motion and jumps).
export function snap() {
  if (!line) return;
  retarget(line.progress);
  for (const z of zones) { z.level = z.to; z.t = 1; z.apply(z.level); }
  applyRoom();
  requestRender();
}

if (renderer && line) {
  line.onChange(retarget);
  onFrame((dt) => {
    let busy = false;
    for (const z of zones) {
      if (z.t >= 1) continue;
      z.t = Math.min(1, z.t + dt / DURATION);
      z.level = z.from + (z.to - z.from) * ease(z.t);
      z.apply(z.level);
      busy = true;
    }
    if (busy) applyRoom();
    return busy;
  });
  snap();
}
