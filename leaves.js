// Trees outside the office, and a few leaves drifting down past it.
// Approved exception to "nothing loops" (see CLAUDE.md): gentle, sparse,
// warm wood tones only, and off for reduced motion.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { scene, renderer, material, M, group, cylinder, mesh, blob, bake, cached, seeded, leafGeo, onFrame, LITE } from "./office.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Autumn trees: an oak trunk with two limbs and a lumpy canopy in warm wood tones,
// the same tones as the leaves that drift down from them
const TREES = [
  { x: 7.1, z: -4.3, h: 2.4, s: 1.0, seed: 3 },
  { x: -2.6, z: -6.2, h: 2.8, s: 1.15, seed: 8 },
];
const CORE = material(0x6b4f33, 0.95);   // shadowed inside of the canopy
const LEAF_MAT = material(0xffffff, 0.8, { side: THREE.DoubleSide });
const TONES = [0xc39a63, 0xb08452, 0xd2b07e, 0xa97a4f].map((c) => new THREE.Color(c));

// A soft, clumpy blob of foliage: a sphere pushed out in a few random lobes
function canopyGeometry(seed) {
  const rnd = seeded(seed * 97);
  let g = new THREE.IcosahedronGeometry(1, LITE ? 2 : 3);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  const lobes = Array.from({ length: 14 }, () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize());
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 0.84 + 0.05 * Math.sin(13 * v.x + seed) * Math.sin(11 * v.y) * Math.sin(12 * v.z + seed);   // leafy bumps
    for (const l of lobes) d += 0.16 * Math.max(0, v.dot(l)) ** 9;
    v.multiplyScalar(d);
    if (v.y < 0) v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  g.computeVertexNormals();
  return g;
}

function tree({ x, z, h, s, seed }) {
  const g = group(scene, x, -0.32, z);
  g.scale.setScalar(s);
  blob(g, 0, 0, 2.2, 2.2);
  cylinder(g, M.wood, 0.09, 0.16, h);
  for (const [a, tilt, len] of [[0.4, 0.55, 1.0], [2.6, 0.6, 0.9]]) {
    const limb = group(group(g, 0, h * 0.62, 0, a));
    limb.rotation.z = -tilt;
    cylinder(limb, M.wood, 0.035, 0.06, len);
  }
  // A dense, dark core for body, then hundreds of leaves around it to break up the outline
  const rnd = seeded(seed * 31);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    const m = mesh(cached(`canopy${i}`, () => canopyGeometry(i + 1)), CORE, g, Math.cos(a) * 0.32, h + 0.45 + (i % 2) * 0.35, Math.sin(a) * 0.32);
    m.scale.setScalar(0.5);
  }
  const n = LITE ? 280 : 560;
  const leaves = new THREE.InstancedMesh(leafGeo(), LEAF_MAT, n);
  const d = new THREE.Object3D(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.75 + rnd() * 0.4);
    d.position.set(v.x * 1.05, h + 0.6 + v.y * 0.8, v.z * 1.05);
    d.rotation.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2);
    d.scale.setScalar(1.0 + rnd() * 0.5);
    d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix);
    leaves.setColorAt(i, TONES[Math.floor(rnd() * TONES.length)]);
  }
  leaves.castShadow = leaves.receiveShadow = true;
  g.add(leaves);
  bake(g);
  return { x, z, top: -0.32 + (h + 1.2) * s, spread: 0.9 * s };
}

function leafGeometry() {
  // A small almond-shaped leaf
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.1);
  shape.quadraticCurveTo(0.075, 0, 0, 0.1);
  shape.quadraticCurveTo(-0.075, 0, 0, -0.1);
  return new THREE.ShapeGeometry(shape, 4);
}

if (renderer) {
  const trees = TREES.map(tree);
  const COUNT = LITE ? 22 : 40;
  const mat = material(0xffffff, 0.8, { side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(leafGeometry(), mat, COUNT);
  leaves.frustumCulled = false;
  const tones = [0xc29466, 0xd6b083, 0xa97a4f, 0xe2c9a6].map((c) => new THREE.Color(c));

  const state = [];
  const dummy = new THREE.Object3D();
  function spawn(l, anywhere) {
    const t = trees[Math.floor(Math.random() * trees.length)];
    l.x = t.x + (Math.random() - 0.5) * t.spread * 2;
    l.z = t.z + (Math.random() - 0.5) * t.spread * 2;
    l.y = anywhere ? -0.3 + Math.random() * (t.top + 0.3) : t.top - Math.random() * 0.6;
    l.speed = 0.22 + Math.random() * 0.18;
    l.phase = Math.random() * Math.PI * 2;
    l.spin = (Math.random() - 0.5) * 2.2;
    l.rx = Math.random() * Math.PI; l.ry = Math.random() * Math.PI;
  }
  for (let i = 0; i < COUNT; i++) {
    const l = {};
    spawn(l, true);
    state.push(l);
    leaves.setColorAt(i, tones[i % tones.length]);
  }
  scene.add(leaves);

  let time = 0;
  onFrame((dt) => {
    if (reduceMotion.matches) { leaves.visible = false; return false; }
    leaves.visible = true;
    time += dt;
    for (let i = 0; i < COUNT; i++) {
      const l = state[i];
      l.y -= l.speed * dt;
      l.x += (Math.sin(time * 0.9 + l.phase) * 0.18 - 0.08) * dt;   // sway, a light breeze
      l.z += Math.cos(time * 0.7 + l.phase) * 0.08 * dt;
      l.rx += l.spin * dt; l.ry += l.spin * 0.6 * dt;
      // Rest on the floor inside the office, the ground outside it
      const inside = Math.abs(l.x) < 5.2 && Math.abs(l.z) < 4.2;
      const floor = inside ? 0.01 : -0.31;
      if (l.y < floor) spawn(l, false);
      const fade = Math.min(1, (l.y - floor) / 0.25);
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(l.rx, l.ry, 0);
      dummy.scale.setScalar(Math.max(0.001, fade));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
    return true;
  });
}
