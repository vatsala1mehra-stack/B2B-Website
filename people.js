// Four figurines. They tell the story through posture only:
// standing unsure → looking at glowing phones → seated working → relaxed.
import * as THREE from "three";
import { office, material, capsule, sphere, mesh, group, block, plane, cached, CURVE, SKIN, CLOTH, M, parts, SEAT_H, requestRender, renderer } from "./office.js";
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
  frontDesk: (seat) => ({ x: seat.x, z: seat.z, yaw: Math.PI / 2, seated: true, lean: -0.1, head: [0.0, -0.2], armR: ARM.rest, armL: ARM.rest, phone: "none" }),
  sofa: (seat, headYaw) => ({ x: seat.x, z: seat.z, yaw: Math.PI / 2, seated: true, lean: -0.3, head: [-0.06, headYaw], armR: ARM.lap, armL: ARM.lap, phone: "none" }),
};

export const people = {};

function figure(name, { skin, top, bottom, hair }) {
  // Per-person materials so each figure can fade on its own
  const mats = {
    skin: material(skin, 0.8, { transparent: true }),
    top: material(top.color.getHex(), 0.92, { transparent: true }),
    bottom: material(bottom.color.getHex(), 0.92, { transparent: true }),
    hair: material(M.hair.color.getHex(), 0.85, { transparent: true }),
    phone: material(M.dark.color.getHex(), 0.45, { transparent: true }),
  };

  const root = group(office);
  root.name = name;
  const hips = group(root, 0, HIP_STAND, 0);

  const legs = [-1, 1].map((sx) => {
    const thigh = group(hips, sx * 0.095, 0, 0);
    capsule(thigh, mats.bottom, 0.078, 0.3, 0, -0.2, 0);
    const knee = group(thigh, 0, -0.41, 0);
    capsule(knee, mats.bottom, 0.072, 0.3, 0, -0.21, 0);
    return { thigh, knee };
  });

  const torso = group(hips, 0, 0, 0);
  capsule(torso, mats.top, 0.19, 0.34, 0, 0.3, 0);

  const head = group(torso, 0, 0.76, 0.01);
  sphere(head, mats.skin, 0.15);
  const cap = mesh(cached("hair", () => new THREE.SphereGeometry(0.158, CURVE, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), mats.hair, head, 0, 0.01, -0.02);
  cap.rotation.x = -0.6;
  if (hair === "long") capsule(head, mats.hair, 0.13, 0.16, 0, -0.1, -0.06).scale.set(1, 1, 0.7);
  else if (hair === "bun") sphere(head, mats.hair, 0.07, 0, 0.12, -0.13);

  const arms = [1, -1].map((side) => {
    const shoulder = group(torso, side * 0.245, 0.47, 0);
    capsule(shoulder, mats.top, 0.055, 0.2, 0, -0.14, 0);
    const elbow = group(shoulder, 0, -0.3, 0);
    capsule(elbow, mats.top, 0.048, 0.14, 0, -0.1, 0);
    sphere(elbow, mats.skin, 0.048, 0, -0.24, 0);
    return { side, shoulder, elbow };
  });

  // Phone lives in the right hand; its screen is lit by lighting.js
  const phone = group(arms[0].elbow, 0, -0.27, 0.03);
  block(phone, mats.phone, 0.085, 0.16, 0.014, 0, -0.08, 0, 0.012);
  const phoneScreen = plane(phone, M.dark, 0.07, 0.14, 0, 0, 0.0075);

  const meshes = [];
  root.traverse((o) => o.isMesh && meshes.push(o));

  const p = { name, root, hips, torso, head, legs, arms, phone, phoneScreen, skin: mats.skin, mats, meshes, pose: null };
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
  const cast = k > 0.98;
  for (const m of p.meshes) m.castShadow = cast;
}

/* ---------- Cast ---------- */
const cast = [
  ["Riya",  { skin: SKIN[2], top: CLOTH.sage,  bottom: CLOTH.ink,   hair: "long" }],
  ["Arjun", { skin: SKIN[0], top: CLOTH.slate, bottom: CLOTH.umber, hair: "short" }],
  ["Meera", { skin: SKIN[1], top: CLOTH.mauve, bottom: CLOTH.denim, hair: "bun" }],
  ["Kabir", { skin: SKIN[3], top: CLOTH.sand,  bottom: CLOTH.stone, hair: "short" }],
];

// Where everyone stands at the start (also used for light pools under them)
export const SPOTS = {
  Riya: [2.05, 1.05, 0.35], Arjun: [1.1, 1.55, 0.95], Meera: [2.95, 1.6, -0.25], Kabir: [2.0, 2.35, 0.6],
};

// Poses per beat (index 0..4). Only people whose pose changes will fade.
export function posesForBeat(beat) {
  const desk = (id) => parts[id].seat;
  const sofa = parts.sofa.seats;
  const fd = parts.frontDesk.seat;
  const s = SPOTS;
  const all = [
    { Riya: P.unsure(...s.Riya, 0.5), Arjun: P.unsure(...s.Arjun, -0.4), Meera: P.unsure(...s.Meera, -0.6), Kabir: P.unsure(...s.Kabir, -0.7) },
    { Riya: P.looking(...s.Riya), Arjun: P.looking(...s.Arjun), Meera: P.looking(...s.Meera), Kabir: P.looking(...s.Kabir) },
    { Riya: P.typing(desk("deskC")), Arjun: P.typing(desk("deskA")), Meera: P.typing(desk("deskB")), Kabir: P.typing(desk("deskD")) },
    { Riya: P.relaxedChair(desk("deskC")), Arjun: P.typing(desk("deskA")), Meera: P.typing(desk("deskB")), Kabir: P.call(fd) },
    { Riya: P.relaxedChair(desk("deskC")), Arjun: P.sofa(sofa[1], -0.5), Meera: P.sofa(sofa[0], 0.5), Kabir: P.frontDesk(fd) },
  ];
  return all[Math.min(beat, all.length - 1)];
}

if (renderer) {
  for (const [name, look] of cast) figure(name, look);
  const start = posesForBeat(0);
  for (const name in people) applyPose(people[name], start[name]);
  requestRender({ shadows: true });
}

// Move everyone to a beat's poses. Changed figures fade out, re-pose, fade in.
export async function poseBeat(beat, { duration = 1.2, signal, instant = false } = {}) {
  const target = posesForBeat(beat);
  const changing = Object.values(people).filter((p) => p.pose !== target[p.name] && JSON.stringify(p.pose) !== JSON.stringify(target[p.name]));
  if (!changing.length) return true;
  if (instant) {
    for (const p of changing) { applyPose(p, target[p.name]); setOpacity(p, 1); }
    requestRender({ shadows: true });
    return true;
  }
  const from = changing.map((p) => p.mats.skin.opacity);
  const out = await tween(duration / 2, (k) => changing.forEach((p, i) => setOpacity(p, from[i] * (1 - k))), { signal });
  for (const p of changing) applyPose(p, target[p.name]);
  requestRender({ shadows: true });
  if (!out) { changing.forEach((p) => setOpacity(p, 1)); requestRender({ shadows: true }); return false; }
  const ok = await tween(duration / 2, (k) => changing.forEach((p) => setOpacity(p, k)), { signal });
  if (!ok) changing.forEach((p) => setOpacity(p, 1));
  requestRender({ shadows: true });
  return ok;
}
