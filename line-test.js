// TEMPORARY: slider to test growing the line. Remove before the story is built.
import { line } from "./line.js";

const input = document.createElement("input");
Object.assign(input, { type: "range", min: 0, max: 1, step: 0.001, value: 0, className: "test-slider" });
input.setAttribute("aria-label", "Line progress (test)");
document.body.append(input);
input.addEventListener("input", () => line?.growTo(+input.value));
window.__line = line;
