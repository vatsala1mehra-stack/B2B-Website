// The red line: one continuous, softly glowing tube that is Airtel.
// It enters from the street and runs along floor edges and walls to every
// part of the office, finishing with a loop around the whole room.
import * as THREE from "three";
import { scene, renderer, onFrame, requestRender, LITE } from "./office.js";
import { tween } from "./anim.js";

const F = 0.04;          // floor height for the tube centre
const G = -0.285;        // street (ground) height
const TOP = 2.94;        // along the top of the walls

// Waypoints. Named ones become marks other modules can react to.
const ROUTE = [
  [8.6, G, 3.0, "street"], [5.25, G, 3.0], [5.25, F, 3.0], [4.85, F, 3.0],
  // Phones: past each person's feet
  [2.1, F, 2.85, "Kabir"], [0.85, F, 1.95, "Arjun"], [1.85, F, 0.75, "Riya"], [3.3, F, 1.25, "Meera"],
  // Router: along the right, up the back wall and down again
  [3.75, F, 0.9], [3.75, F, -3.96], [3.3, F, -3.96], [3.3, 1.82, -3.96, "router"], [3.1, 1.82, -3.96], [3.1, F, -3.96],
  // Desks: behind the back row, then along the aisle in front of it
  [1.8, F, -3.96, "deskB"], [0.15, F, -3.96, "deskA"], [-0.95, F, -3.96], [-0.95, F, -1.85],
  [0.15, F, -1.85, "deskC"], [1.8, F, -1.85, "deskD"], [2.85, F, -1.85], [2.85, F, 0.1],
  // Front desk, then the server by the entrance corner
  [-2.75, F, 0.1], [-2.75, F, 0.9, "frontDesk"], [-2.75, F, 3.3], [-4.1, F, 3.3, "server"],
  // Final loop: front edge, right edge, along the wall tops, and back down
  [-4.1, F, 4.12], [5.12, F, 4.12], [5.12, F, -3.965], [5.12, TOP, -3.965], [5.12, TOP, -4.1],
  [-5.1, TOP, -4.1], [-5.1, TOP, 4.12], [-4.965, TOP, 4.12], [-4.965, F, 4.12], [-4.0, F, 4.12, "loop"],
];

const RADIUS = 0.025;
const CORNER = 0.22;

function buildPath(pts) {
  const path = new THREE.CurvePath();
  let prev = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const r = Math.min(CORNER, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p1 = b.clone().addScaledVector(a.clone().sub(b).normalize(), r);
    const p2 = b.clone().addScaledVector(c.clone().sub(b).normalize(), r);
    if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, pts[pts.length - 1].clone()));
  return path;
}

const VERT = /* glsl */ `
  varying float vU;
  varying float vFacing;
  void main() {
    vU = uv.x;
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(n.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDrawn, uPulse, uLen, uPulseAmt, uGlow;
  varying float vU;
  varying float vFacing;
  void main() {
    if (vU > uDrawn) discard;
    float d = (vU - uPulse) * uLen;
    float p = exp(-d * d * 1.2) * uPulseAmt;
    vec3 col = mix(uColor, vec3(1.0, 0.42, 0.36), p);
    float a = uGlow > 0.5 ? (0.16 + 0.22 * p) * pow(vFacing, 1.6) : 1.0;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

export function createLine() {
  const pts = ROUTE.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = buildPath(pts);
  const length = path.getLength();
  const segments = Math.ceil(length * (LITE ? 14 : 22));
  const radial = LITE ? 6 : 8;

  const uniforms = {
    uColor: { value: new THREE.Color("#e40000") },
    uDrawn: { value: 0 },
    uPulse: { value: -1 },
    uLen: { value: length },
    uPulseAmt: { value: 0.38 },   // very faint
  };
  const makeMat = (glow) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uGlow: { value: glow ? 1 : 0 } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: glow, depthWrite: !glow, toneMapped: false,
  });

  const coreGeo = new THREE.TubeGeometry(path, segments, RADIUS, radial, false);
  const glowGeo = new THREE.TubeGeometry(path, segments, RADIUS * 3.2, radial, false);
  const core = new THREE.Mesh(coreGeo, makeMat(false));
  const glow = new THREE.Mesh(glowGeo, makeMat(true));
  glow.renderOrder = 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 12, 8), new THREE.MeshBasicMaterial({ color: "#e40000", toneMapped: false }));
  for (const m of [core, glow, tip]) { m.frustumCulled = false; scene.add(m); }

  // Marks: where each named waypoint sits along the line (0..1)
  const samples = 1600;
  const sampled = Array.from({ length: samples + 1 }, (_, i) => path.getPointAt(i / samples));
  const marks = {};
  ROUTE.forEach(([x, y, z, name], i) => {
    if (!name) return;
    const p = pts[i];
    let best = 0, bestD = Infinity;
    sampled.forEach((s, j) => { const d = s.distanceToSquared(p); if (d < bestD) { bestD = d; best = j; } });
    marks[name] = best / samples;
  });
  marks.street = 0;
  marks.loop = 1;

  let drawn = 0;
  const listeners = new Set();
  function set(t) {
    drawn = THREE.MathUtils.clamp(t, 0, 1);
    uniforms.uDrawn.value = drawn;
    const count = Math.ceil(drawn * segments) * radial * 6;
    coreGeo.setDrawRange(0, count);
    glowGeo.setDrawRange(0, count);
    tip.visible = drawn > 0.0005 && drawn < 0.9995;
    if (tip.visible) path.getPointAt(drawn, tip.position);
    for (const fn of listeners) fn(drawn);
    requestRender();
  }
  set(0);

  let ctrl = null;
  // Grow (or shrink) to any point along the path, with smooth easing.
  function growTo(t, { duration = 1.4 } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    const from = drawn;
    return tween(duration, (k) => set(from + (t - from) * k), { signal: ctrl.signal });
  }

  // A very faint pulse travelling along the drawn part, then a rest.
  const SPEED = 2.2;   // world units per second
  let pulseAt = 0;
  onFrame((dt) => {
    if (drawn <= 0) return false;
    const drawnLen = drawn * length;
    pulseAt += dt * SPEED;
    if (pulseAt > drawnLen + 6) pulseAt = 0;   // pause between pulses
    uniforms.uPulse.value = pulseAt / length;
    return true;
  });

  return {
    path, length, marks, growTo, set,
    get progress() { return drawn; },
    onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  };
}

export const line = renderer ? createLine() : null;
