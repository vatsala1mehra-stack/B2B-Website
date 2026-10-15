// Materials for the stylised-realism office, all made in code (no image or model files).
// A small, calm palette: warm plaster, light concrete, oak, oatmeal and charcoal fabric,
// black metal, glass and muted greens. Red (#e40000) stays reserved for the line.
import * as THREE from "three";

// Small or low-power devices get a lighter build (smaller textures, simpler shading).
export const LITE =
  Math.min(screen.width, screen.height) < 500 ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  navigator.connection?.saveData === true;

/* ------------------------------------------------------------------ */
/*  Look: shared uniforms so later beats can warm and saturate the room */
/* ------------------------------------------------------------------ */
export const look = {
  saturation: { value: 0.3 }, // 1 = full colour; the office starts drained
};

const SAT_CHUNK = `#include <dithering_fragment>
  float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, uSaturation);`;

export function satCompile(shader) {
  shader.uniforms.uSaturation = look.saturation;
  shader.fragmentShader = "uniform float uSaturation;\n" +
    shader.fragmentShader.replace("#include <dithering_fragment>", SAT_CHUNK);
}

/* ------------------------------------------------------------------ */
/*  Procedural textures (tileable)                                      */
/* ------------------------------------------------------------------ */
const SIZE = LITE ? 256 : 512;
const smooth = (t) => t * t * (3 - 2 * t);

// Value noise that wraps every cx × cy lattice cells, summed over octaves; 0..1.
function noise(size, cx, cy, octaves = 4, seed = 1) {
  let s = (seed * 7919) % 233280;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++, cx *= 2, cy *= 2, amp *= 0.5) {
    const lat = Float32Array.from({ length: cx * cy }, rand);
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cy, iy = Math.floor(fy), ty = smooth(fy - iy);
      const r0 = (iy % cy) * cx, r1 = ((iy + 1) % cy) * cx;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cx, ix = Math.floor(fx), tx = smooth(fx - ix);
        const c0 = ix % cx, c1 = (ix + 1) % cx;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
        out[y * size + x] += amp * (a + (b - a) * ty);
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Paint a texture pixel by pixel. fn(x, y, i) returns [r, g, b] in 0..1.
function paint(size, fn, { srgb = true, metres = 1 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
    const [r, g, b] = fn(x, y, i);
    img.data[i * 4] = r * 255; img.data[i * 4 + 1] = g * 255; img.data[i * 4 + 2] = b * 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.setScalar(1 / metres);   // geometry UVs are in metres (see boxUV in office.js)
  t.anisotropy = LITE ? 2 : 8;
  return t;
}

// Normal map from a tileable height field.
function normalMap(size, h, strength, metres) {
  return paint(size, (x, y) => {
    const at = (dx, dy) => h[((y + dy + size) % size) * size + ((x + dx + size) % size)];
    const nx = (at(-1, 0) - at(1, 0)) * strength, ny = (at(0, 1) - at(0, -1)) * strength;
    const l = Math.hypot(nx, ny, 1);
    return [nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5];
  }, { srgb: false, metres });
}

const mix = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Oak: long wavy grain along u, fine fibres; a 0.6 m tile.
const tex = {};
{
  const bands = noise(SIZE, 2, 16, 3, 3), fibres = noise(SIZE, 4, 128, 2, 7);
  const light = rgb(0xd6b088), dark = rgb(0xa67850);
  const grain = new Float32Array(SIZE * SIZE);
  tex.oak = paint(SIZE, (x, y, i) => {
    const ring = 0.5 + 0.5 * Math.sin((y / SIZE) * Math.PI * 2 * 7 + bands[i] * 16);
    const t = Math.min(1, ring ** 3 * 0.6 + fibres[i] * 0.5);
    grain[i] = t;
    return lerp3(light, dark, t);
  }, { metres: 0.6 });
  tex.oakRough = paint(SIZE, (x, y, i) => { const v = 0.5 + grain[i] * 0.25; return [v, v, v]; }, { srgb: false, metres: 0.6 });
}

// Polished concrete: soft mottling, fine aggregate, saw-cut joints every 2 m.
{
  const n = noise(SIZE, 3, 3, 5, 11);
  let s = 12345;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const speck = Float32Array.from({ length: SIZE * SIZE }, rand);
  const base = rgb(0xd5cfc6);
  const joint = (x, y) => x < 1 || y < 1 ? 0.84 : 1;
  tex.concrete = paint(SIZE, (x, y, i) => {
    const v = (0.93 + (n[i] - 0.5) * 0.16 - (speck[i] > 0.992 ? 0.1 : 0) + (speck[i] < 0.004 ? 0.05 : 0)) * joint(x, y);
    return [base[0] * v, base[1] * v, base[2] * v];
  }, { metres: 2 });
  tex.concreteRough = paint(SIZE, (x, y, i) => { const v = 0.4 + n[i] * 0.38; return [v, v, v]; }, { srgb: false, metres: 2 });
}

// Plaster: the faintest hand-trowelled relief; a 1.5 m tile.
tex.plaster = normalMap(SIZE, noise(SIZE, 12, 12, 4, 5), 2.2, 1.5);

// Fabric: a plain weave, 2.5 cm tile.
{
  const N = 64, threads = 8, cell = N / threads;
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cxI = Math.floor(x / cell), cyI = Math.floor(y / cell);
    const over = (cxI + cyI) % 2 === 0;
    const u = (x % cell) / cell, v = (y % cell) / cell;
    h[y * N + x] = over ? Math.sin(v * Math.PI) * (0.6 + 0.4 * Math.sin(u * Math.PI)) : Math.sin(u * Math.PI) * 0.8;
  }
  tex.weave = normalMap(N, h, 1.6, 0.025);
  tex.weave.anisotropy = 4;
}

/* ------------------------------------------------------------------ */
/*  Materials                                                           */
/* ------------------------------------------------------------------ */
export function material(color, roughness = 0.92, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.3, ...extra });
  m.onBeforeCompile = satCompile;
  return m;
}

// Soft fabric: velvet-like sheen at grazing angles (desktop), woven relief.
export function fabric(color, extra = {}) {
  const opts = { color, roughness: 0.95, envMapIntensity: 0.3, normalMap: tex.weave, normalScale: new THREE.Vector2(0.6, 0.6), ...extra };
  const m = LITE
    ? new THREE.MeshStandardMaterial(opts)
    : new THREE.MeshPhysicalMaterial({ ...opts, sheen: 1, sheenRoughness: 0.75, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) });
  m.onBeforeCompile = satCompile;
  return m;
}

const metal = (color, roughness, env = 0.7) => material(color, roughness, { metalness: 0.85, envMapIntensity: env });

export const M = {
  plaster: material(0xf0ece6, 0.95, { normalMap: tex.plaster, normalScale: new THREE.Vector2(0.35, 0.35) }),
  concrete: material(0xffffff, 1, { map: tex.concrete, roughnessMap: tex.concreteRough, envMapIntensity: 0.45 }),
  wood: material(0xffffff, 1, { map: tex.oak, roughnessMap: tex.oakRough, envMapIntensity: 0.4 }),
  fabric: fabric(0xd9cfc1),        // oatmeal: sofa, rug
  fabricDark: fabric(0x55524f),    // charcoal: task chairs
  rug: fabric(0xcbbfae),
  rugEdge: fabric(0x8f8577),
  pillowA: fabric(0x8e9985),       // sage
  pillowB: fabric(0xc4b294),       // sand
  metal: metal(0x232326, 0.42, 0.5),   // black powder-coated steel
  steel: metal(0xc8c8cb, 0.32),        // brushed aluminium
  cabinet: metal(0x3c3d42, 0.5, 0.45), // network cabinet: dark grey steel
  ceramic: material(0xf4f2ee, 0.38, { envMapIntensity: 0.45 }),
  trim: material(0xe9e4dd, 0.55),      // painted skirting
  charcoal: material(0x3a3a3c, 0.6),   // charcoal ceramic, soil-dark parts
  soil: material(0x3d342c, 1),
  dark: material(0x1f2023, 0.4, { envMapIntensity: 0.5 }),   // device bodies, bezels
  glass: new THREE.MeshStandardMaterial({ color: 0xdfe7ec, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.2, depthWrite: false }),
  leaf: material(0x627b50, 0.62, { side: THREE.DoubleSide }),
  leafLight: material(0x7a9466, 0.62, { side: THREE.DoubleSide }),
};
M.glass.onBeforeCompile = satCompile;

// Book spines and small objects: muted, never red.
export const BOOKS = [0xd9cbb4, 0x8a9a8c, 0x5b6470, 0xb8a58a, 0x3d3f45, 0xe9e4da, 0x9c8f7d, 0x6f7a6a].map((c) => material(c, 0.8));

export const SKIN = [0xc8916c, 0xa36d4d, 0xdba987, 0x8a5a3e]; // per-person materials so faces can brighten
export const CLOTH = {
  slate: material(0x7f8b99), sand: material(0xb9a78d), sage: material(0x8e9985),
  mauve: material(0x8a7f8c), ink: material(0x474b54), umber: material(0x5d534a),
  stone: material(0x6c6862), denim: material(0x4f5866),
};
