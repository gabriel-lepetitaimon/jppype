import { Point, Rect } from './point';

interface AnimatorOptions<K extends string> {
  animations?: Record<K, Animation<AnimableTypes>>;
  duration?: number;
  freq?: number;
  skipMissedFrames?: boolean;
  onStart?: (animator: Animator<K>) => void;
  onPause?: (animator: Animator<K>) => void;
  onStop?: (animator: Animator<K>) => void;
}

export class Animator<K extends string> {
  public t = 0;
  protected animations?: Record<K, Animation<AnimableTypes>>;
  protected globalEasing: EasingFunction = 'linear';
  protected _duration = 750;
  protected _freq = 30;
  protected _skipMissedFrames = true;
  protected _startedTime = 0;
  protected dt;
  protected timer: ReturnType<typeof setInterval> | null = null;
  protected delayTimer: ReturnType<typeof setTimeout> | null = null;
  protected onStart?: (animator: Animator<K>) => void;
  protected onPause?: (animator: Animator<K>) => void;
  protected onStop?: (animator: Animator<K>) => void;

  constructor(
    protected callback: (t: Record<K, AnimableTypes>, context?: any) => void,
    opt?: AnimatorOptions<K>,
    public context?: any
  ) {
    if (opt) {
      this.animations = opt?.animations;
      this.onStart = opt.onStart;
      this.onPause = opt.onPause;
      this.onStop = opt.onStop;

      if (opt.duration !== undefined)
        this._duration = opt.duration;
      if (opt.freq !== undefined)
        this._freq = opt.freq;
      if (opt.skipMissedFrames !== undefined)
          this._skipMissedFrames = opt.skipMissedFrames;
    }

    this.dt = this._duration / this._freq;
  }

  get duration(): number {
    return this._duration;
  }

  set duration(d: number) {
    this.dt = d / this._freq;
    this._duration = d;
    if (this.timer !== null) {
      this.pause();
      this.start();
    }
  }

  get freq(): number {
    return this._freq;
  }

  set freq(f: number) {
    if (f <= 0) {
      throw RangeError(
        'Animator update frequency must be strictly greater than 0.'
      );
    }
    this.dt = this._duration / f;
    this._freq = f;
    if (this.timer !== null) {
      this.pause();
      this.start();
    }
  }

  run(
    animations: Record<K, Animation<AnimableTypes> | null>,
    duration?: number,
    delay?: number,
    globalEasing?: EasingFunction,
    initialCb = false,
    context?: any
  ): void {
    this.stop();
    this.animations = Object.fromEntries(
                        Object.entries(animations).filter(([k, v]) => v !== null)
                      ) as Record<K, Animation<AnimableTypes>>;
    if (duration) {
      this.duration = duration;
    }
    if (globalEasing) {
      this.globalEasing = globalEasing;
    }
    this.context = context;
    this.start(delay, initialCb);
  }

  get running(): boolean {
    return this.timer !== null || this.delayTimer !== null;
  }

  start(delay?: number, initialCb = false): void {
    if (this.running) {
      return;
    }
    if (delay) {
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.start();
      }, delay);
      return;
    }

    if (this.onStart) {
      this.onStart(this);
    }
    this._startedTime = Date.now();
    this.timer = setInterval(() => {
      if(this._skipMissedFrames) {
        this.t = Date.now() - this._startedTime;
      } else {
        this.t += this.dt;
      }

      if (this.t < this._duration) {
        this._callback();
      }
      if (this.t >= this._duration) {
        this.t = this._duration;
        this._callback();
        this.pause();
      }
    }, this.dt);
    if (initialCb) {
      this._callback();
    }
  }

  restart(initialCb = true): void {
    const ctx = this.context; 
    this.stop();
    this.context = ctx;
    this.start(0, initialCb);
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      if (this.onPause) {
        this.onPause(this);
      }
    } else if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    } else if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    this.context = undefined;
    if (this.onStop) {
      this.onStop(this);
    }
    this.t = 0;
  }

  protected _callback(): void {
    const y = {};
    const t = ease(this.t/this.duration, 0, 1, this.globalEasing);
    for (const k in this.animations) {
      Object.assign(y, {
        [k]: this.animations[k].compute(t),
      });
    }
    this.callback(y as Record<K, AnimableTypes>, this.context);
  }
}

type AnimableTypes = number | Point | Rect;

interface Keyframe<V extends AnimableTypes> {
  t: number;
  v: V;
  easing?: EasingFunction;
}

export class Animation<V extends AnimableTypes> {
  constructor(protected keyframes: Keyframe<V>[]) {}

  public compute(t: number): V {
    let i = Math.round(t * (this.keyframes.length - 2)); // Guess
    do {
      if (this.keyframes[i].t > t) {
        i--;
      } else if (this.keyframes[i + 1].t < t) {
        i++;
      } else {
        // We found the previous and next keyframes!
        const prevK = this.keyframes[i];
        const nextK = this.keyframes[i + 1];
        t = (t - prevK.t) / (nextK.t - prevK.t);
        return ease(t, prevK.v, nextK.v, prevK.easing);
      }
    } while (i >= 0 && i < this.keyframes.length - 1);
    if (i === -1) {
      return this.keyframes[0].v;
    } else {
      return this.keyframes[this.keyframes.length - 1].v;
    }
  }

  get firstKey(): Keyframe<V> {
    return this.keyframes[0];
  }

  get lastKey(): Keyframe<V> {
    return this.keyframes[this.keyframes.length - 1];
  }

  static simple<V extends AnimableTypes>(
    v0: V,
    v1: V,
    easing: EasingFunction = 'linear',
    t0 = 0,
    t1 = 1
  ): Animation<V> {
    return new Animation<V>([
      { t: t0, v: v0, easing: easing },
      { t: t1, v: v1 },
    ]);
  }
}

// Robert Penner's Easing Functions
export type _EasingFunction = (t: number) => number;

export const Easing: { [name: string]: _EasingFunction } = {
  linear: (t) => t,

  sinusoidalIn: (t) => -Math.cos((t * Math.PI) / 2) + 1,

  sinusoidalOut: (t) => Math.sin((t * Math.PI) / 2),

  sinusoidalInOut: (t) => -0.5 * (Math.cos(Math.PI * t) - 1),

  quadraticIn: (t) => t * t,

  quadraticOut: (t) => t * (2 - t),

  quadraticInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  cubicIn: (t) => Math.pow(t, 3),

  cubicOut: (t0) => {
    const t = t0 - 1;
    return Math.pow(t, 3) + 1;
  },

  cubicInOut: (t) =>
    t < 0.5 ? 4 * Math.pow(t, 3) : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  quarticIn: (t) => Math.pow(t, 4),

  quarticOut: (t0) => {
    const t = t0 - 1;
    return 1 - Math.pow(t, 4);
  },

  quarticInOut: (t0) => {
    let t = t0;
    if (t < 0.5) {
      return 8 * Math.pow(t, 4);
    }
    t -= 1;
    return 1 - 8 * Math.pow(t, 4);
  },

  quinticIn: (t) => Math.pow(t, 5),

  quinticOut: (t0) => {
    const t = t0 - 1;
    return 1 + Math.pow(t, 5);
  },

  quinticInOut: (t0) => {
    let t = t0;
    if (t < 0.5) {
      return 16 * Math.pow(t, 5);
    }
    t -= 1;
    return 1 + 16 * Math.pow(t, 5);
  },

  circularIn: (t) => -(Math.sqrt(1 - t * t) - 1),

  circularOut: (t0) => {
    const t = t0 - 1;
    return Math.sqrt(1 - t * t);
  },

  circularInOut: (t0) => {
    let t = t0 * 2;
    if (t < 1) {
      return -0.5 * (Math.sqrt(1 - t * t) - 1);
    }
    t -= 2;
    return 0.5 * (Math.sqrt(1 - t * t) + 1);
  },

  exponentialIn: (t) => 2 ** (10 * (t - 1)) - 0.001,

  exponentialOut: (t) => 1 - 2 ** (-10 * t),

  exponentialInOut: (t0) => {
    const t = t0 * 2;
    if (t < 1) {
      return 0.5 * 2 ** (10 * (t - 1));
    }
    return 0.5 * (2 - 2 ** (-10 * (t - 1)));
  },

  backIn: (t) => {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },

  backOut: (t0) => {
    const s = 1.70158;
    const t = t0 - 1;
    return t * t * ((s + 1) * t + s) + 1;
  },

  backInOut: (t0) => {
    const s = 1.70158 * 1.525;
    let t = t0 * 2;
    if (t < 1) {
      return 0.5 * (t * t * ((s + 1) * t - s));
    }
    t -= 2;
    return 0.5 * (t * t * ((s + 1) * t + s) + 2);
  },

  elasticIn: (t) => {
    if (t === 0) {
      return 0;
    }
    if (t === 1) {
      return 1;
    }

    return -(2 ** (10 * (t - 1))) * Math.sin((t - 1.1) * 5 * Math.PI);
  },

  elasticOut: (t) => {
    if (t === 0) {
      return 0;
    }
    if (t === 1) {
      return 1;
    }

    return 2 ** (-10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },

  elasticInOut: (t0) => {
    if (t0 === 0) {
      return 0;
    }
    if (t0 === 1) {
      return 1;
    }

    const t = t0 * 2;

    if (t < 1) {
      return -0.5 * 2 ** (10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    }

    return 0.5 * 2 ** (-10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI) + 1;
  },

  bounceIn: (t) => 1 - Easing.easingBounceOut(1 - t),

  bounceOut: (t0) => {
    let t = t0;
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    }
    if (t < 2 / 2.75) {
      t -= 1.5 / 2.75;
      return 7.5625 * t * t + 0.75;
    }
    if (t < 2.5 / 2.75) {
      t -= 2.25 / 2.75;
      return 7.5625 * t * t + 0.9375;
    }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },

  bounceInOut: (t) => {
    if (t < 0.5) {
      return Easing.easingBounceIn(t * 2) * 0.5;
    }
    return Easing.easingBounceOut(t * 2 - 1) * 0.5 + 0.5;
  },
};

export type EasingFunction = keyof typeof Easing | _EasingFunction;

function ease<K extends AnimableTypes>(
  t: number,
  start: K,
  stop: K,
  f?: EasingFunction
): K {
  if (f !== undefined) {
    if (typeof f === 'string' || typeof f === 'number') {
      f = Easing[f];
    }
    t = f(t);
  }
  if (typeof start === 'number') {
    return (t * (stop as number) + start * (1 - t)) as K;
  } else if (start instanceof Point) {
    return start.interpolate(stop as Point, t) as K;
  } else {
    // start is Rect
    return (start as Rect).interpolate(stop as Rect, t) as K;
  }
}
