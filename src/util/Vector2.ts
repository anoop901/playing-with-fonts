import lerp from "./lerp";

export class Vector2 {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(that: Vector2): Vector2 {
    return new Vector2(this.x + that.x, this.y + that.y);
  }

  times(k: number): Vector2 {
    return new Vector2(k * this.x, k * this.y);
  }

  neg(): Vector2 {
    return this.times(-1);
  }

  subtract(that: Vector2): Vector2 {
    return this.add(that.neg());
  }

  rotate(angle: number) {
    return new Vector2(
      Math.cos(angle) * this.x - Math.sin(angle) * this.y,
      Math.sin(angle) * this.x + Math.cos(angle) * this.y,
    );
  }

  rotateClockwise(angle: number) {
    return this.rotate(-angle);
  }

  lerp(that: Vector2, t: number) {
    return new Vector2(lerp(this.x, that.x, t), lerp(this.y, that.y, t));
  }

  midpoint(that: Vector2) {
    return this.lerp(that, 0.5);
  }

  static up(distance: number = 1) {
    return new Vector2(0, distance);
  }
  static down(distance: number = 1) {
    return new Vector2(0, -distance);
  }
  static left(distance: number = 1) {
    return new Vector2(-distance, 0);
  }
  static right(distance: number = 1) {
    return new Vector2(distance, 0);
  }

  static ZERO = new Vector2(0, 0);
}
