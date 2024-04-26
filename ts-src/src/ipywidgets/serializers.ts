import { Transform } from '../utils/zoom-pan-handler';
import {Point, Rect} from '../utils/point';

export const byte_serializer = {
  deserialize: (value: DataView) => {
    const decoder = new TextDecoder('ascii');
    return decoder.decode(value);
  },
};

export const transform_serializer = {
  deserialize: (t: Array<number>): Transform => {
    return { center: new Point(t[0], t[1]), zoom: t[2] };
  },
  serialize: (t: Transform): Array<number> => {
      return [t.center.x, t.center.y, t.zoom];
  },
};

export const point_serializer = {
  deserialize: (p: Array<number>): Point => new Point(p[0], p[1]),
  serialize: (p: Point): Array<number> => [p.x, p.y],
};

export const rect_serializer = (nullable=false) => {
  return {
    deserialize: (p: Array<number> | null): Rect | null => {
      if (p === null) {
          return nullable ? null : Rect.EMPTY;
      }
      switch (p.length) {
          case 2:
              return new Rect(new Point(p[1], p[0]));
          case 4:
              const r = Rect.fromTuple(p);
              return r;
      }
      return Rect.EMPTY;
    },
    serialize: (p: Rect | null): Array<number> | null => {
      if (p === null) {
          return nullable ? null : [0, 0, 0, 0];
      } else {
        return [p.top, p.left, p.height, p.width];
      }
    }
  }
};

