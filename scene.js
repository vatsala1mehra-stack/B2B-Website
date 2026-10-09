// Hero background: a slowly rotating globe of connected nodes, suggesting a network.
// Decorative only. If WebGL or the CDN fails, the CSS gradient behind it stays visible.
import * as THREE from "three";

const canvas = document.querySelector(".hero-canvas");
const hero = document.querySelector(".hero");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    console.warn("WebGL unavailable, skipping hero scene.", err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const red = new THREE.Color(cssVar("--brand-red") || "#e40000");
  const white = new THREE.Color("#ffffff");

  // Nodes: points spread evenly over a sphere (Fibonacci lattice).
  const COUNT = 260;
  const RADIUS = 3.2;
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    nodes.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS));
  }

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  nodes.forEach((v, i) => {
    v.toArray(positions, i * 3);
    // Roughly one node in eight is a red "hub".
    (i % 8 === 0 ? red : white).toArray(colors, i * 3);
  });
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    pointGeo,
    new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true })
  );

  // Links between nearby nodes.
  const MAX_DIST = 0.85;
  const linePos = [];
  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      if (nodes[i].distanceTo(nodes[j]) < MAX_DIST) {
        linePos.push(...nodes[i].toArray(), ...nodes[j].toArray());
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: red, transparent: true, opacity: 0.22 })
  );

  const globe = new THREE.Group();
  globe.add(points, lines);
  globe.rotation.x = 0.35;
  scene.add(globe);

  // Layout: sit the globe to the right on wide screens, centred and dimmer on narrow ones.
  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w > 860;
    globe.position.set(wide ? 3.2 : 0, wide ? 0 : -1.2, 0);
    lines.material.opacity = wide ? 0.22 : 0.12;
    points.material.opacity = wide ? 0.9 : 0.5;
  }
  new ResizeObserver(resize).observe(hero);
  resize();

  // Gentle pointer parallax.
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Only animate while the hero is on screen and the tab is visible.
  let onScreen = true;
  let frame = 0;
  const clock = new THREE.Clock();

  function render() {
    renderer.render(scene, camera);
  }

  function tick() {
    frame = 0;
    const dt = Math.min(clock.getDelta(), 0.05);
    globe.rotation.y += dt * 0.08;
    globe.rotation.x += (0.35 + pointer.y * 0.12 - globe.rotation.x) * 0.04;
    globe.rotation.z += (pointer.x * -0.08 - globe.rotation.z) * 0.04;
    render();
    schedule();
  }

  function schedule() {
    if (!frame && onScreen && !document.hidden && !reducedMotion.matches) {
      frame = requestAnimationFrame(tick);
    }
  }

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) { clock.getDelta(); schedule(); }
  }).observe(hero);

  document.addEventListener("visibilitychange", () => { clock.getDelta(); schedule(); });
  reducedMotion.addEventListener("change", () => { render(); schedule(); });

  render(); // draw one static frame (all that's shown with reduced motion)
  schedule();
}

init();
