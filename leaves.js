// Trees outside the office, and a few leaves drifting down past it.
// Approved exception to "nothing loops" (see CLAUDE.md): gentle, sparse,
// warm wood tones only, and off for reduced motion.
import * as THREE from "three";
import { scene, renderer, material, M, group, cylinder, sphere, blob, onFrame, LITE } from "./office.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Clay trees: a wood trunk and a sculpted canopy, like the plants inside
const TREES = [
  { x: 6.9, z: -2.6, h: 2.4, s: 1.0 },
  { x: -2.6, z: -6.2, h: 2.8, s: 1.15 },
];

function tree({ x, z, h, s }) {
  const g = group(scene, x, -0.32, z);
  g.scale.setScalar(s);
  blob(g, 0, 0, 2.2, 2.2);
  cylinder(g, M.wood, 0.1, 0.17, h);
  const puffs = [
    [0, h + 0.55, 0, 0.85], [0.6, h + 0.25, 0.2, 0.6], [-0.55, h + 0.3, -0.15, 0.65],
    [0.2, h + 1.15, -0.25, 0.6], [-0.25, h + 0.05, 0.5, 0.5], [0.35, h + 0.2, -0.55, 0.5],
  ];
  for (const [px, py, pz, r] of puffs) sphere(g, M.clay, r, px, py, pz);
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
