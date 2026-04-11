export default function clamp(x: number, low: number, high: number) {
  x = Math.max(x, low);
  x = Math.min(x, high);
  return x;
}
