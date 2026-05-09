import clamp from "./clamp";

const clampFunction = clamp;

export default function lerp(
  a: number,
  b: number,
  t: number,
  clamp: boolean = true,
) {
  if (clamp) {
    t = clampFunction(t, 0, 1);
  }
  return a + (b - a) * t;
}

export function lerp_inverse(
  a: number,
  b: number,
  x: number,
  clamp: boolean = true,
) {
  let t = (x - a) / (b - a);
  if (clamp) {
    t = clampFunction(t, 0, 1);
  }
  return t;
}
