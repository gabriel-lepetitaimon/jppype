export class Point {
  constructor(public x = 0, public y = 0) {}

  static ORIGIN = Object.freeze(new Point(0, 0));

  add(f: number | Point): Point {
    return f instanceof Point
      ? new Point(this.x + f.x, this.y + f.y)
      : new Point(this.x + f, this.y + f);
  }

  subtract(f: number | Point): Point {
    return f instanceof Point
      ? new Point(this.x - f.x, this.y - f.y)
      : new Point(this.x - f, this.y - f);
  }

  divide(f: number | Point): Point {
    return f instanceof Point
      ? new Point(this.x / f.x, this.y / f.y)
      : new Point(this.x / f, this.y / f);
  }

  multiply(f: number | Point): Point {
    return f instanceof Point
      ? new Point(this.x * f.x, this.y * f.y)
      : new Point(this.x * f, this.y * f);
  }

  half(): Point {
    return new Point(this.x * .5, this.y * .5);
  }

  interpolate(to: Point, weight: number): Point {
    return new Point(
      this.x * (1 - weight) + to.x * weight,
      this.y * (1 - weight) + to.y * weight
    );
  }

  clip(r: Rect | Point): Point {
    if (r instanceof Point) {
      return new Point(Math.min(r.x, this.x), Math.min(r.y, this.y));
    } else {
      return new Point(
        Math.min(r.bottomRight.x, Math.max(r.topLeft.x, this.x)),
        Math.min(r.bottomRight.y, Math.max(r.topLeft.y, this.y))
      );
    }
  }

  clip_norm(r: number): Point {
    const f = r / Math.max(this.norm(), r);
    return f < 1 ? this.multiply(f) : this;
  }

  in(r: Rect | Point, strict = false): boolean {
    if (r instanceof Point) {
      return strict
        ? this.x < r.x && this.y < r.y
        : this.x <= r.x && this.y <= r.y;
    }
    if (strict) {
      return (
        r.topLeft.x < this.x &&
        this.x < r.bottomRight.x &&
        r.topLeft.y < this.y &&
        this.y < r.bottomRight.y
      );
    } else {
      return (
        r.topLeft.x <= this.x &&
        this.x <= r.bottomRight.x &&
        r.topLeft.y <= this.y &&
        this.y <= r.bottomRight.y
      );
    }
  }

  round(): Point {
    return new Point(Math.round(this.x), Math.round(this.y));
  }

  floor(): Point {
    return new Point(Math.floor(this.x), Math.floor(this.y));
  }

  ceil(): Point {
    return new Point(Math.ceil(this.x), Math.ceil(this.y));
  }

  neg(): Point {
    return new Point(-this.x, -this.y);
  }

  inv(): Point {
    return new Point(1 / this.x, 1 / this.y);
  }

  abs(): Point {
    return new Point(Math.abs(this.x), Math.abs(this.y));
  }

  min(): number {
    return Math.min(this.x, this.y);
  }

  max(): number {
    return Math.max(this.x, this.y);
  }

  norm(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  hasZero() {
      return this.x === 0 || this.y === 0;
  }

  isZero() {
      return this.x === 0 && this.y === 0;
  }

  equals(p: Point): boolean {
    return this.x === p.x && this.y === p.y;
  }
}

export const ORIGIN = Point.ORIGIN;

export class Rect {
  topLeft: Point;
  bottomRight: Point;

  constructor(topLeft: Point, bottomRight: Point);
  constructor(bottomRight: Point);
  constructor(p1: Point, p2?: Point) {
    if (p2 !== undefined) {
      this.topLeft = p1 as Point;
      this.bottomRight = p2 as Point;
    } else {
      this.topLeft = ORIGIN;
      this.bottomRight = p1 as Point;
    }
  }

  static EMPTY = Object.freeze(new Rect(ORIGIN, ORIGIN));

  static unitary(): Rect {
    return new Rect(new Point(1, 1));
  }

  static fromXY(x1: number, x2: number, y1: number, y2: number): Rect {
    return new Rect(new Point(Math.min(x1, x2), Math.min(y1, y2)),
                    new Point(Math.max(x1, x2), Math.max(y1, y2)));
  }

  static fromTuple(hwyx: number[]): Rect {
    let [h, w, y, x] = hwyx;
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }
    return new Rect(new Point(x, y), new Point(x + w, y + h));
  }

  static fromCenter(center: Point, size: Point): Rect {
    const halfSize = size.divide(2).abs();
    return new Rect(center.subtract(halfSize), center.add(halfSize));
  }

  static fromDOMRect(r: DOMRect): Rect {
    return new Rect(new Point(r.left, r.top), new Point(r.right, r.bottom));
  }

  get top(): number {
    return this.topLeft.y;
  }

  get left(): number {
    return this.topLeft.x;
  }

  get right(): number {
    return this.bottomRight.x;
  }

  get bottom(): number {
    return this.bottomRight.y;
  }

  get width(): number {
    return this.bottomRight.x - this.topLeft.x;
  }

  get height(): number {
    return this.bottomRight.y - this.topLeft.y;
  }

  get size(): Point {
    return this.bottomRight.subtract(this.topLeft);
  }

  get center(): Point {
    return this.bottomRight.add(this.topLeft).divide(2);
  }

  checkPositiveSize(): boolean {
    return this.width >= 0 && this.height >= 0;
  }

  isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  translate(f: number | Point): Rect {
    return new Rect(this.topLeft.add(f), this.bottomRight.add(f));
  }

  scale(s: number | Point): Rect {
    return new Rect(this.topLeft.multiply(s), this.bottomRight.multiply(s));
  }

  in(r: Rect, strict = false): boolean {
    return this.topLeft.in(r, strict) && this.bottomRight.in(r, strict);
  }

  intersection(r: Rect): Rect {
    return new Rect(this.topLeft.clip(r), this.bottomRight.clip(r));
  }

  union(r: Rect | Point): Rect {
    if (r instanceof Point) {
      return this.union(Rect.fromXY(this.center.x, r.x, this.center.y, r.y));
    } else {
      return Rect.fromXY( Math.min(this.left, r.left),
                        Math.max(this.right, r.right),
                        Math.min(this.top, r.top),
                        Math.max(this.bottom, r.bottom));
    }
  }

  pad(padding: Rect | Point | number, outward = false): Rect {
    let resultingRect: Rect;
    if (padding instanceof Rect) {
      if (outward) {
        padding = new Rect(
          ORIGIN.subtract(padding.topLeft),
          ORIGIN.subtract(padding.bottomRight)
        );
      }
      resultingRect = new Rect(
        this.topLeft.add(padding.topLeft),
        this.bottomRight.add(padding.bottomRight)
      );
    } else {
      if (outward) {
        padding = ORIGIN.subtract(padding);
      }
      resultingRect = new Rect(
        this.topLeft.add(padding),
        this.bottomRight.subtract(padding)
      );
    }
    if (resultingRect.checkPositiveSize()) {
      return resultingRect;
    } else {
      return Rect.fromCenter(resultingRect.center, ORIGIN);
    }
  }

  interpolate(to: Rect, weight: number): Rect {
    return new Rect(
      this.topLeft.interpolate(to.topLeft, weight),
      this.bottomRight.interpolate(to.bottomRight, weight)
    );
  }

  relativeTo(r: Rect): Rect {
    return new Rect(
      this.topLeft.subtract(r.topLeft).divide(r.size),
      this.bottomRight.subtract(r.topLeft).divide(r.size)
    );
  }
}


