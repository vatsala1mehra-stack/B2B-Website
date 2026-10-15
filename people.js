// The team. They tell the story through posture only:
// standing unsure → looking at glowing phones → seated working → relaxed.
import * as THREE from "three";
import { office, material, capsule, sphere, cylinder, mesh, group, block, plane, blob, blobMaterial, cached, keep, bake, CURVE, SKIN, CLOTH, M, parts, SEAT_H, requestRender, renderer } from "./office.js";
import { fabric } from "./materials.js";
import { tween } from "./anim.js";

const HIP_STAND = 0.9;
const HIP_SEAT = SEAT_H + 0.08;

// Arm presets: [upper x, upper z (outwards), forearm x, forearm y (inwards)]
const ARM = {
  side:   [0.04, 0.07, -0.12, 0],
  phoneSide: [0.05, 0.09, -0.55, 0],
  hold:   [-0.25, 0.12, -1.25, -0.4],
  type:   [-0.42, 0.1, -1.05, -0.3],
  lap:    [-0.38, 0.1, -0.55, -0.25],
  ear:    [-1.7, 0.05, -2.3, 0],   // solved so the phone rests at the ear
  rest:   [-0.3, 0.12, -1.0, -0.2],
};

// Pose builder. Poses are plain data so beats can be read at a glance.
const P = {
  unsure: (x, z, yaw, headYaw = 0) => ({ x, z, yaw, seated: false, lean: 0, head: [0.12, headYaw], armR: ARM.phoneSide, armL: ARM.side, phone: "side" }),
  looking: (x, z, yaw) => ({ x, z, yaw, seated: false, lean: 0.04, head: [0.55, 0], armR: ARM.hold, armL: ARM.hold, phone: "hold" }),
  typing: (seat) => ({ x: seat.x, z: seat.z, yaw: Math.PI, seated: true, lean: 0.1, head: [0.28, 0], armR: ARM.type, armL: ARM.type, phone: "none" }),
  relaxedChair: (seat, headYaw = 0.25) => ({ x: seat.x, z: seat.z, yaw: Math.PI, seated: true, lean: -0.24, head: [-0.08, headYaw], armR: ARM.lap, armL: ARM.lap, phone: "none" }),
  call: (seat) => ({ x: seat.x, z: seat.z, yaw: Math.PI / 2, seated: true, lean: 0.02, head: [0.05, 0.25], armR: ARM.ear, armL: ARM.rest, phone: "ear" }),
  deskPhone: (seat) => ({ x: seat.x, z: seat.z, yaw: Math.PI, seated: true, lean: 0.06, head: [0.5, 0], armR: ARM.hold, armL: ARM.hold, phone: "hold" }),
  frontDesk: (seat) => ({ x: seat.x, z: seat.z, yaw: Math.PI / 2, seated: true, lean: -0.1, head: [0.0, -0.2], armR: ARM.rest, armL: ARM.rest, phone: "none" }),
  sofa: (seat, headYaw) => ({ x: seat.x, z: seat.z, yaw: Math.PI / 2, seated: true, lean: -0.3, head: [-0.06, headYaw], armR: ARM.lap, armL: ARM.lap, phone: "none" }),
};

export const people = {};

// Stylised but believable proportions: a shaped torso, neck, hands and shoes.
// Joint pivots stay where the poses expect them.
// A limb that tapers from r1 at the joint (y = 0) to r2 at length len, with rounded ends.
function limbGeo(r1, r2, len) {
  return cached(`limb${r1},${r2},${len}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r2 * Math.cos(a), -len + r2 * Math.sin(a))); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r1 * Math.cos(a) + 1e-4, r1 * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, CURVE);
  });
}

const TORSO = [[0, -0.08], [0.152, -0.07], [0.166, 0.02], [0.157, 0.16], [0.17, 0.3], [0.2, 0.41], [0.222, 0.47], [0.2, 0.53], [0.12, 0.58], [0.05, 0.6], [0, 0.6]];

function figure(name, { skin, top, bottom, hair, hairColor = 0x2e2520, shoes, sleeves = "long" }) {
  // Per-person materials so each figure can fade on its own
  const mats = {
    skin: material(skin, 0.62, { transparent: true }),
    top: fabric(top.color.getHex(), { transparent: true }),
    bottom: fabric(bottom.color.getHex(), { transparent: true }),
    hair: material(hairColor, 0.55, { transparent: true }),
    shoes: material(shoes, 0.5, { transparent: true }),
    phone: material(M.dark.color.getHex(), 0.4, { transparent: true }),
  };

  const root = group(office);
  root.name = name;
  const shadowMat = blobMaterial(0.9);
  blob(root, 0, 0.05, 0.75, 0.75, shadowMat);
  const hips = group(root, 0, HIP_STAND, 0);
  sphere(hips, mats.bottom, 0.145, 0, -0.01, 0).scale.set(1.0, 0.7, 0.68);

  const legs = [-1, 1].map((sx) => {
    const thigh = group(hips, sx * 0.095, 0, 0);
    mesh(limbGeo(0.086, 0.068, 0.41), mats.bottom, thigh);
    const knee = group(thigh, 0, -0.41, 0);
    mesh(limbGeo(0.067, 0.05, 0.4), mats.bottom, knee);
    block(knee, mats.shoes, 0.1, 0.075, 0.24, 0, -0.49, 0.045, 0.035);
    return { thigh, knee };
  });

  const torso = group(hips, 0, 0, 0);
  mesh(cached("torso", () => new THREE.LatheGeometry(TORSO.map(([r, y]) => new THREE.Vector2(r, y)), CURVE)), mats.top, torso).scale.set(1, 1, 0.7);
  cylinder(torso, mats.skin, 0.046, 0.05, 0.12, 0, 0.55, 0.005);

  const head = group(torso, 0, 0.76, 0.01);
  sphere(head, mats.skin, 0.135).scale.set(0.9, 1.08, 0.98);
  sphere(head, mats.skin, 0.022, 0, -0.012, 0.128).scale.set(0.8, 1, 1.1);
  for (const sx of [-1, 1]) sphere(head, mats.skin, 0.03, sx * 0.118, -0.005, -0.005).scale.set(0.45, 1, 0.75);
  const cap = mesh(cached("hair", () => new THREE.SphereGeometry(0.14, CURVE, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)), mats.hair, head, 0, 0.014, -0.01);
  cap.scale.set(0.94, 1.1, 1.02);
  cap.rotation.x = -0.38;
  if (hair === "long") capsule(head, mats.hair, 0.105, 0.16, 0, -0.12, -0.07).scale.set(1, 1, 0.55);
  else if (hair === "bun") sphere(head, mats.hair, 0.062, 0, 0.11, -0.12);

  const arms = [1, -1].map((side) => {
    const shoulder = group(torso, side * 0.232, 0.465, 0);
    mesh(limbGeo(0.06, 0.047, 0.3), mats.top, shoulder);
    const elbow = group(shoulder, 0, -0.3, 0);
    mesh(limbGeo(0.046, 0.034, 0.2), sleeves === "long" ? mats.top : mats.skin, elbow);
    sphere(elbow, mats.skin, 0.044, 0, -0.245, 0.005).scale.set(0.72, 1.08, 0.52);
    return { side, shoulder, elbow };
  });

  // Phone lives in the right hand; its screen is lit by lighting.js
  const phone = group(arms[0].elbow, 0, -0.27, 0.03);
  block(phone, mats.phone, 0.08, 0.16, 0.012, 0, -0.08, 0, 0.012);
  const phoneScreen = keep(plane(phone, M.dark, 0.068, 0.145, 0, 0, 0.0065));

  // Fewer draw calls: merge each body part's pieces by material (joints stay separate)
  for (const j of [hips, torso, head, ...legs.flatMap((l) => [l.thigh, l.knee]), ...arms.flatMap((a) => [a.shoulder, a.elbow])]) bake(j, { deep: false });

  const meshes = [];
  root.traverse((o) => o.isMesh && o.material !== shadowMat && meshes.push(o));

  const p = { name, root, hips, torso, head, legs, arms, phone, phoneScreen, skin: mats.skin, mats, meshes, shadowMat, pose: null };
  people[name] = p;
  return p;
}

function applyPose(p, pose) {
  p.pose = pose;
  p.root.position.set(pose.x, 0, pose.z);
  p.root.rotation.y = pose.yaw;
  p.hips.position.y = pose.seated ? HIP_SEAT : HIP_STAND;
  for (const { thigh, knee } of p.legs) {
    thigh.rotation.x = pose.seated ? -Math.PI / 2 : 0;
    knee.rotation.x = pose.seated ? Math.PI / 2 : 0;
  }
  p.torso.rotation.x = pose.lean;
  p.head.rotation.set(pose.head[0], pose.head[1], 0);
  for (const a of p.arms) {
    const [ux, uz, fx, fy] = a.side === 1 ? pose.armR : pose.armL;
    a.shoulder.rotation.set(ux, 0, a.side * uz);
    a.elbow.rotation.set(fx, a.side * fy, 0);
  }
  p.phone.visible = pose.phone !== "none";
  if (pose.phone === "hold") { p.phone.position.set(-0.06, -0.27, 0.03); p.phone.rotation.set(0, 0, 0); }
  else if (pose.phone === "ear") { p.phone.position.set(-0.02, -0.27, 0.0); p.phone.rotation.set(0, 0, 0); }
  else { p.phone.position.set(0, -0.27, 0.03); p.phone.rotation.set(0, 0, 0); }
}

function setOpacity(p, k) {
  for (const m of Object.values(p.mats)) m.opacity = k;
  p.phoneScreen.material.transparent = true;
  p.phoneScreen.material.opacity = k;
  p.shadowMat.opacity = 0.9 * k;
  const cast = k > 0.98;
  for (const m of p.meshes) m.castShadow = cast;
}

/* ---------- Cast ---------- */
const cast = [
  ["Riya",  { skin: SKIN[2], top: CLOTH.sage,  bottom: CLOTH.ink,   hair: "long",  hairColor: 0x3b2a20, shoes: 0xeeeae4, sleeves: "short" }],
  ["Arjun", { skin: SKIN[0], top: CLOTH.slate, bottom: CLOTH.umber, hair: "short", hairColor: 0x1f1b19, shoes: 0x3a302a }],
  ["Meera", { skin: SKIN[1], top: CLOTH.mauve, bottom: CLOTH.denim, hair: "bun",   hairColor: 0x221c19, shoes: 0x2c2b2d }],
  ["Kabir", { skin: SKIN[3], top: CLOTH.sand,  bottom: CLOTH.stone, hair: "short", hairColor: 0x181514, shoes: 0xeeeae4, sleeves: "short" }],
  // New joiners in the "Grow" story
  ["Isha",  { skin: SKIN[0], top: CLOTH.stone, bottom: CLOTH.ink,   hair: "long",  hairColor: 0x4a3426, shoes: 0x3a302a }],
  ["Dev",   { skin: SKIN[2], top: CLOTH.denim, bottom: CLOTH.umber, hair: "short", hairColor: 0x2a211c, shoes: 0xeeeae4, sleeves: "short" }],
];

// Where everyone stands at the start (also used for light pools under them)
export const SPOTS = {
  Riya: [2.05, 1.05, 0.35], Arjun: [1.1, 1.55, 0.95], Meera: [2.95, 1.6, -0.25], Kabir: [2.0, 2.35, 0.6],
};

// Poses for each path and step. Steps: 0 = the opening question, 1-5 = the
// beats, 6 = the ending (same as beat 5). null = not in the scene.
export function posesFor(path, step) {
  const desk = (id) => parts[id].seat;
  const sofa = parts.sofa.seats;
  const fd = parts.frontDesk.seat;
  const s = SPOTS;
  const b = Math.max(1, Math.min(step, 5));
  const working = { Riya: P.typing(desk("deskC")), Arjun: P.typing(desk("deskA")), Meera: P.typing(desk("deskB")), Kabir: P.typing(desk("deskD")) };
  const ending = { Riya: P.relaxedChair(desk("deskC")), Arjun: P.sofa(sofa[1], -0.5), Meera: P.sofa(sofa[0], 0.5), Kabir: P.frontDesk(fd) };
  const none = { Isha: null, Dev: null };

  if (path === "expand" && step > 0) {
    const door = { Isha: [4.3, 2.85, -2.25], Dev: [3.7, 3.45, -2.55] };
    return [
      null,
      { ...working, Isha: P.unsure(...door.Isha, 0.3), Dev: P.unsure(...door.Dev, -0.3) },
      { ...working, Isha: P.looking(...door.Isha), Dev: P.looking(...door.Dev) },
      { ...working, Isha: P.typing(desk("deskE")), Dev: P.typing(desk("deskF")) },
      { ...working, Kabir: P.typing(desk("annexA")), Isha: P.typing(desk("deskE")), Dev: P.typing(desk("annexB")) },
      { ...ending, Kabir: P.typing(desk("annexA")), Isha: P.typing(desk("deskE")), Dev: P.relaxedChair(desk("annexB")) },
    ][b];
  }
  if (path === "shift" && step > 0) {
    return [
      null,
      { ...working, Riya: P.looking(1.0, 0.0, Math.PI * 0.85), ...none },
      { Riya: P.deskPhone(desk("deskC")), Arjun: P.deskPhone(desk("deskA")), Meera: P.deskPhone(desk("deskB")), Kabir: P.deskPhone(desk("deskD")), ...none },
      { ...working, ...none },
      { ...working, Riya: P.relaxedChair(desk("deskC")), Kabir: P.call(fd), ...none },
      { ...ending, ...none },
    ][b];
  }
  // Set up (and the opening question)
  return [
    { Riya: P.unsure(...s.Riya, 0.5), Arjun: P.unsure(...s.Arjun, -0.4), Meera: P.unsure(...s.Meera, -0.6), Kabir: P.unsure(...s.Kabir, -0.7), ...none },
    { Riya: P.looking(...s.Riya), Arjun: P.looking(...s.Arjun), Meera: P.looking(...s.Meera), Kabir: P.looking(...s.Kabir), ...none },
    { ...working, ...none },
    { ...working, Riya: P.relaxedChair(desk("deskC")), Kabir: P.call(fd), ...none },
    { ...ending, ...none },
  ][b - 1];
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

if (renderer) {
  for (const [name, look] of cast) figure(name, look);
  const start = posesFor("setup", 0);
  for (const name in people) {
    if (start[name]) applyPose(people[name], start[name]);
    else { people[name].pose = null; people[name].root.visible = false; setOpacity(people[name], 0); }
  }
  requestRender({ shadows: true });
}

// Move everyone to a step's poses. Changed figures fade out, re-pose, fade in;
// people leaving the scene fade out, people joining fade in.
export async function posePeople(path, step, { duration = 1.2, signal, instant = false } = {}) {
  const target = posesFor(path, step);
  const changing = Object.values(people).filter((p) => !same(p.pose, target[p.name] ?? null));
  if (!changing.length) return true;
  const finish = () => {
    for (const p of changing) {
      const t = target[p.name] ?? null;
      if (t) { applyPose(p, t); p.root.visible = true; setOpacity(p, 1); }
      else { p.pose = null; p.root.visible = false; setOpacity(p, 0); }
    }
    requestRender({ shadows: true });
  };
  if (instant) { finish(); return true; }
  const from = changing.map((p) => (p.root.visible ? p.mats.skin.opacity : 0));
  const out = await tween(duration / 2, (k) => changing.forEach((p, i) => setOpacity(p, from[i] * (1 - k))), { signal });
  if (!out) { finish(); return false; }
  for (const p of changing) {
    const t = target[p.name] ?? null;
    if (t) { applyPose(p, t); p.root.visible = true; } else { p.pose = null; p.root.visible = false; }
  }
  requestRender({ shadows: true });
  const joining = changing.filter((p) => p.pose);
  const ok = await tween(duration / 2, (k) => joining.forEach((p) => setOpacity(p, k)), { signal });
  if (!ok) finish();
  requestRender({ shadows: true });
  return ok;
}
