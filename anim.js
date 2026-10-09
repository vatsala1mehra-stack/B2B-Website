// Tiny tween helper. One easing for the whole site: smooth, no bounce.
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const active = new Set();

// Tweens are stepped from the render loop (see office.js) so they stop when it pauses.
export function tween(duration, onUpdate, { easing = ease, signal } = {}) {
  return new Promise((resolve) => {
    if (duration <= 0) { onUpdate(1); resolve(true); return; }
    const t = { elapsed: 0, duration, onUpdate, easing, resolve, signal };
    active.add(t);
    signal?.addEventListener("abort", () => { active.delete(t); resolve(false); }, { once: true });
  });
}

export function stepTweens(dt) {
  for (const t of active) {
    t.elapsed += dt;
    const k = Math.min(t.elapsed / t.duration, 1);
    t.onUpdate(t.easing(k));
    if (k >= 1) { active.delete(t); t.resolve(true); }
  }
  return active.size > 0;
}

export const wait = (s, signal) => tween(s, () => {}, { signal });
