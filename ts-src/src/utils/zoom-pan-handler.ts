import {
  Dispatch,
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import useResizeObserver from "@react-hook/resize-observer";
import { Observable } from "rxjs";
import { Animation, Animator, EasingFunction } from "./animator";
import { ORIGIN, Point, Rect } from "./point";

export interface Transform {
  center: Point;
  coord?: "scene" | "relative";
  zoom: number;
}

function isSameTransform(t1: Transform, t2: Transform): boolean {
  return t1.center.equals(t2.center) && t1.zoom === t2.zoom;
}

export type Coord = "view" | "scene" | "relative";

// =========================================================================
//          --- ZOOM STATE ---
// =========================================================================

class ZoomAreaState {
  protected _viewSize: Point;
  protected _maxZoom?: number;
  protected _minScale?: number;
  protected _minZoom?: number;
  protected _defaultScale?: number;
  protected _relativeSceneBoundaries?: Rect;

  constructor(
    protected _ref: RefObject<HTMLElement>,
    protected _sceneRect: Rect,
    protected _maxScale: number,
    protected _sceneDefaultRect?: Rect | null
  ) {}

  // === Zoom Area Properties ===
  public get node(): HTMLElement | null {
    return this._ref.current;
  }

  public getViewBoundingRect(): Rect {
    return this._ref.current
      ? Rect.fromDOMRect(this._ref.current.getBoundingClientRect())
      : Rect.fromCenter(ORIGIN, ORIGIN);
  }

  public get viewSize(): Point {
    if (!this._viewSize) {
      this._viewSize = this.getViewBoundingRect().size;
    }
    return this._viewSize;
  }

  public set viewSize(s: Point) {
    this._viewSize = s;
    this.invalidatedScaleConstants();
  }

  public get sceneRect(): Rect {
    return this._sceneRect;
  }

  public set sceneRect(p: Rect) {
    this._sceneRect = p;
    this.invalidatedScaleConstants();
  }

  public get sceneMainDomain(): Rect {
    return this._sceneDefaultRect && !this._sceneDefaultRect.isEmpty()
      ? this._sceneDefaultRect
      : this.sceneRect;
  }

  public set sceneMainDomain(p: Rect | null) {
    this._sceneDefaultRect = p;
    this.invalidatedScaleConstants();
  }

  protected invalidatedScaleConstants() {
    this._minScale = undefined;
    this._minZoom = undefined;
    this._defaultScale = undefined;
    this._maxZoom = undefined;
    this._relativeSceneBoundaries = undefined;
  }

  public get minScale(): number {
    if (this._minScale === undefined) {
      if (this.sceneRect.isEmpty()) {
        return 1;
      }
      this._minScale = Math.min(
        this.viewSize.divide(this.sceneRect.size).min() + 1e-8,
        this.maxScale
      );
    }
    return this._minScale;
  }

  public get minZoom(): number {
    if (this._minZoom === undefined) {
      if (this.sceneRect.isEmpty()) {
        return 0;
      }
      this._minZoom = this.scale2zoom(this.minScale);
    }
    return this._minZoom;
  }

  public get maxScale(): number {
    return this._maxScale;
  }

  public get defaultScale(): number {
    if (this._defaultScale === undefined) {
      if (this.sceneMainDomain.isEmpty() || this.viewSize.hasZero()) {
        return 1;
      } else {
        this._defaultScale =
          this.viewSize.divide(this.sceneMainDomain.size).min() + 1e-8;
      }
    }
    return this._defaultScale;
  }

  public get relativeSceneBoundaries(): Rect {
    // sceneRect in relative coordinates (i.e. relative to sceneDefaultRect)
    if (this._relativeSceneBoundaries === undefined) {
      this._relativeSceneBoundaries = this.sceneRect
        .translate(this.sceneMainDomain.topLeft.neg())
        .scale(this.sceneMainDomain.size.inv());
    }
    return this._relativeSceneBoundaries;
  }

  public get maxZoom(): number {
    if (this._maxZoom === undefined) {
      this._maxZoom = this.scale2zoom(this.maxScale);
    }
    return this._maxZoom;
  }

  // === Conversions ===
  public scale2zoom(s: number): number {
    return Math.log2(s / this.defaultScale);
  }

  public zoom2scale(z: number): number {
    return Math.pow(2, z) * this.defaultScale;
  }

  public scene2relative(p: Point): Point;
  public scene2relative(p: Rect): Rect;
  public scene2relative(p: unknown): unknown {
    if (p instanceof Point) {
      return this.sceneMainDomain.isEmpty()
        ? new Point(0.5, 0.5)
        : p
            .subtract(this.sceneMainDomain.topLeft)
            .divide(this.sceneMainDomain.size);
    } else if (p instanceof Rect) {
      return this.sceneMainDomain.isEmpty()
        ? Rect.unitary()
        : p
            .translate(this.sceneMainDomain.topLeft.neg())
            .scale(this.sceneMainDomain.size.inv());
    }
  }

  public relative2scene(p: Point): Point;
  public relative2scene(p: Rect): Rect;
  public relative2scene(p: unknown): unknown {
    if (p instanceof Point) {
      return p
        .multiply(this.sceneMainDomain.size)
        .add(this.sceneMainDomain.topLeft);
    } else if (p instanceof Rect) {
      return p
        .scale(this.sceneMainDomain.size)
        .translate(this.sceneMainDomain.topLeft);
    }
  }

  public centerInSceneCoord(t: Transform): Point {
    return t.coord === "relative" ? this.relative2scene(t.center) : t.center;
  }

  public centerInRelativeCoord(t: Transform): Point {
    return t.coord === "relative" ? t.center : this.scene2relative(t.center);
  }

  public relativeTransform(t: Transform): Transform {
    return t.coord === "relative"
      ? t
      : {
          zoom: t.zoom,
          center: this.scene2relative(t.center),
          coord: "relative",
        };
  }

  public toRelativeCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toRelativeCoord(p: Rect, t: Transform, coord?: Coord): Rect;

  public toRelativeCoord(
    p: Point | Rect,
    t: Transform,
    coord?: Coord
  ): unknown {
    if (p instanceof Point) {
      switch (coord) {
        case "view":
          if (this.sceneMainDomain.isEmpty()) return new Point(0.5, 0.5);

          return p
            .subtract(this.viewSize.divide(2)) // Center on the view center
            .divide(this.zoom2scale(t.zoom)) // Scale to scene coordinate
            .divide(this.sceneMainDomain.size) // Scale to relative coordinate (relative to sceneDefaultRect)
            .add(this.centerInRelativeCoord(t)); // Translate accordingly to the scene center

        case "relative":
          return p;

        default: // case 'scene'
          return this.scene2relative(p);
      }
    } else {
      return new Rect(
        this.toRelativeCoord(p.topLeft, t, coord) as Point,
        this.toRelativeCoord(p.bottomRight, t, coord) as Point
      );
    }
  }

  public toSceneCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toSceneCoord(p: Rect, t: Transform, coord?: Coord): Rect;
  public toSceneCoord(p: Point | Rect, t: Transform, coord?: Coord): unknown {
    if (p instanceof Point) {
      switch (coord) {
        case "view":
          return p
            .subtract(this.viewSize.divide(2)) // Center on the view center
            .divide(this.zoom2scale(t.zoom)) // Scale to scene coordinate
            .add(this.centerInSceneCoord(t)); // Translate accordingly to the scene center
        case "relative":
          return this.relative2scene(p);
        default: // case 'scene'
          return p;
      }
    } else {
      return new Rect(
        this.toSceneCoord(p.topLeft, t, coord) as Point,
        this.toSceneCoord(p.bottomRight, t, coord) as Point
      );
    }
  }

  public toViewCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toViewCoord(p: Rect, t: Transform, coord?: Coord): Rect;
  public toViewCoord(p: Point | Rect, t: Transform, coord?: Coord): unknown {
    if (p instanceof Point) {
      if (coord === "view") return p;

      if (coord === "relative")
        p = this.toSceneCoord(p, t, "relative") as Point; // ensure p is in scene coordinates
      return (p as Point)
        .subtract(this.centerInSceneCoord(t)) // Center on the scene center
        .multiply(this.zoom2scale(t.zoom)) // Scale to view coordinate
        .add(this.viewSize.divide(2)); // Translate accordingly to the view center
    } else {
      return new Rect(
        this.toViewCoord(p.topLeft, t, coord) as Point,
        this.toViewCoord(p.bottomRight, t, coord) as Point
      );
    }
  }

  public transform2VisibleArea(t: Transform): Rect {
    return Rect.fromCenter(
      this.centerInSceneCoord(t),
      this.viewSize.divide(this.zoom2scale(t.zoom))
    );
  }

  public visibleArea2Transform(
    visibleArea: Rect,
    coord?: "scene" | "relative"
  ): Transform {
    let center = visibleArea.center;
    let visibleSize = visibleArea.size;
    if (coord === "relative")
      // If visibleArea is in relative coordinates
      visibleSize = visibleSize.multiply(this.sceneMainDomain.size);
    // Cast visibleSize to scene coordinates
    // If visibleArea is in scene coordinates
    else center = this.scene2relative(center); // Cast center to relative coordinates

    return {
      zoom: this.scale2zoom(this.viewSize.divide(visibleSize).min()),
      center: center,
      coord: "relative",
    };
  }

  // === Constraint Safeguards ===
  public constraintZoom(zoom: number): number {
    return Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
  }

  public constraintCenter(transform: Transform, previousCenter?: Point): Transform {
    const center = transform.center;
    if (
      isNaN(transform.center.x) ||
      isNaN(transform.center.y) ||
      this.sceneRect.isEmpty()
    ) {
      return { ...transform, center: ORIGIN };
    }
    const scale = this.zoom2scale(transform.zoom);
    const pad = this.viewSize.divide(2 * scale).clip(this.sceneRect.size.divide(2));
    let centerBoundaries =
      transform.coord === "relative"
        ? this.relativeSceneBoundaries.pad(pad.divide(this.sceneMainDomain.size))
        : this.sceneRect.pad(pad);
    if (previousCenter)
      centerBoundaries = centerBoundaries.union(previousCenter);
    return { ...transform, center: center.clip(centerBoundaries) };
  }

  public constraintTransform(t: Transform): Transform {
    const zoom = this.constraintZoom(t.zoom);
    return this.constraintCenter({ ...t, zoom: zoom });
  }

  public applyZoom(
    t: Transform,
    dZoom: number,
    zoomCenter?: Point,
    coord?: Coord
  ): Transform {
    const newZoom = this.constraintZoom(t.zoom + dZoom);
    dZoom = newZoom - t.zoom;
    if (dZoom === 0) {
      return t;
    }

    // If the zoom center is different from the view center, we need to translate the scene.
    if (zoomCenter) {
      let center = this.centerInSceneCoord(t);
      let dCenter: Point; // Translation value
      if (coord === "view") {
        dCenter = zoomCenter
          .subtract(this.viewSize.divide(2)) // Center on the view center
          .multiply(1 / this.zoom2scale(t.zoom) - 1 / this.zoom2scale(newZoom)); // Scale translation according to the zoom delta
      } else {
        if (coord === "relative") zoomCenter = this.relative2scene(zoomCenter); // Cast zoomCenter to scene coordinates

        dCenter = zoomCenter
          .subtract(center) // Center on the view center (in scene coordinates)
          .multiply(1 - Math.pow(2, -dZoom)); // Scale translation according to the zoom delta
      }

      return {
        center: center.add(dCenter),
        zoom: newZoom,
      };
    } else {
      return this.constraintCenter({ ...t, zoom: newZoom });
    }
  }
}

export class ZoomTransform {
  public dispatch: ZoomDispatch;
  public animator: Animator<"center" | "zoom">;
  public animationTarget?: Transform;
  protected _scale: number;
  protected _t: Transform;
  public syncTransform?: [Observable<Transform>, (t: Transform) => void];

  constructor(public areaState: ZoomAreaState, transform: Transform) {
    this.animator = new Animator<"center" | "zoom">(
      (t, ctx) => {
        if (ctx?.zoomCenter && ctx?.initialTransform ) {
          this.dispatch({
            animStep: this.areaState.applyZoom(
              ctx.initialTransform,
              (t["zoom"] as number)-ctx.initialTransform.zoom,
              ctx.zoomCenter,
              "relative",
            )
          });
        } else {
          this.dispatch({
            animStep: {
              center: t["center"] as Point,
              zoom: t["zoom"] as number,
              coord: "relative",
            },
          });
        }
      },
      { onStop: () => {
        this.animationTarget = undefined;
      } }
    );
    this.transform = transform;
  }

  public get transform(): Transform {
    return this._t;
  }

  public set transform(t: Transform) {
    this._t = t;
    this._scale = this.areaState.zoom2scale(t.zoom);
  }

  toSceneCoord(p: Point, coord?: Coord): Point;
  toSceneCoord(p: Rect, coord?: Coord): Rect;
  toSceneCoord(p: Point | Rect, coord?: Coord): unknown {
    // @ts-ignore
    return this.areaState.toSceneCoord(p, this._t, coord);
  }

  toViewCoord(p: Point, coord?: Coord): Point;
  toViewCoord(p: Rect, coord?: Coord): Rect;
  toViewCoord(p: Point | Rect, coord?: Coord): unknown {
    // @ts-ignore
    return this.areaState.toViewCoord(p, this._t, coord);
  }

  toRelativeCoord(p: Point, coord?: Coord): Point;
  toRelativeCoord(p: Rect, coord?: Coord): Rect;
  toRelativeCoord(p: Point | Rect, coord?: Coord): unknown {
    // @ts-ignore
    return this.areaState.toRelativeCoord(p, this._t, coord);
  }

  view2scene(p: Point): Point {
    return p
      .subtract(this.areaState.viewSize.divide(2))
      .divide(this.scale)
      .add(this.center);
  }

  scene2view(p: Point): Point {
    return p
      .subtract(this.center)
      .multiply(this.scale)
      .add(this.areaState.viewSize.divide(2));
  }

  get scale(): number {
    return this._scale;
  }

  get center(): Point {
    return this.areaState.centerInSceneCoord(this._t);
  }

  get viewOffset(): Point {
    return this.areaState
      .centerInSceneCoord(this._t)
      .multiply(this.scale)
      .subtract(this.areaState.viewSize.divide(2));
  }

  get visibleArea(): Rect {
    return Rect.fromCenter(
      this.transform.center,
      this.areaState.viewSize.divide(this.transform.zoom)
    );
  }

  get sceneDomain(): Rect {
    return this.areaState.sceneMainDomain;
  }

  get sceneRect(): Rect {
    return this.areaState.sceneRect;
  }
}

export function useZoomTransform(
  ref: RefObject<HTMLElement>,
  sceneRect: Rect,
  maxScale: number,
  sceneDefaultRect?: Rect,
  syncTransform?: [Observable<Transform>, (t: Transform) => void]
): ZoomTransform {
  // --- Initialization ---
  const iniAreaState: ZoomAreaState = new ZoomAreaState(
    ref,
    sceneRect,
    maxScale,
    sceneDefaultRect
  );

  // --- States ---
  const iniTransform: Transform = {
    center: new Point(0.5, 0.5),
    zoom: 0,
    coord: "relative",
  };

  const [[zoomTransform], dispatch] = useReducer(
    (
      zoomState: [ZoomTransform, Transform],
      action: ZoomAction
    ): [ZoomTransform, Transform] => {
      const [zoomTransform, prevTr] = zoomState;
      let tr = prevTr;
      const state = zoomTransform.areaState;
      let newTr = tr;

      // --- Apply action ---
      if ("syncTransform" in action) {
        newTr = {
          ...action.syncTransform,
          zoom: state.constraintZoom(action.syncTransform.zoom)
        };
        zoomTransform.transform = newTr;
        zoomTransform.animator.stop();
        return [zoomTransform, newTr];
      } else if ("animStep" in action) {
        newTr = action.animStep;
      } else {
        if (zoomTransform.animator.running) {
          if (zoomTransform.animationTarget) {
            tr = zoomTransform.animationTarget;
            newTr = tr;
          }
          zoomTransform.animator.stop();
        }

        if ("transform" in action) {
          newTr = state.constraintTransform(action.transform);
        } else if ("center" in action) {
          const center = state.toSceneCoord(action.center, tr, action.coord);
          newTr = state.constraintCenter({
            ...tr,
            center: center,
            coord: "scene",
          });
        } else if ("zoom" in action) {
          newTr = state.applyZoom(
            tr,
            action.zoom,
            action.zoomCenter,
            action.zoomCenterCoord
          );
        } else if ("pan" in action) {
          let dCenter = action.pan;
          if (action.coord === "relative") {
            dCenter = dCenter.multiply(state.sceneMainDomain.size);
          } else if (action.coord === "view") {
            dCenter = dCenter.multiply(zoomTransform.scale);
          }
          newTr = state.constraintCenter({
            zoom: tr.zoom,
            center: state.centerInSceneCoord(tr).add(dCenter),
          }, state.centerInSceneCoord(tr));
        } else if ("ensureVisible" in action) {
          newTr = state.visibleArea2Transform(action.ensureVisible);
        } else if ("sceneRect" in action) {
          zoomTransform.areaState.sceneRect = action.sceneRect;
          newTr = zoomTransform.areaState.constraintTransform(tr);
        } else if ("sceneDefaultRect" in action) {
          const relativeTransform = state.relativeTransform(tr);
          zoomTransform.areaState.sceneMainDomain = action.sceneDefaultRect;
          newTr =
            zoomTransform.areaState.constraintTransform(relativeTransform);
        } else if ("viewSize" in action) {
          zoomTransform.areaState.viewSize = action.viewSize;
          newTr = zoomTransform.areaState.constraintTransform(tr);
        }

        if ("animation" in action) {
          // Setup animation if required
          let easing: EasingFunction = action.animation?.easing || 'linear';
          let centerAnim: Animation<Point> | null | undefined = action.animation?.centerAnim;
          const c0 = state.centerInRelativeCoord(prevTr);
          const c1 = state.centerInRelativeCoord(newTr);

          if (centerAnim) {
            centerAnim.firstKey.v = c0;
            centerAnim.lastKey.v = c1;
          }

          let zoomAnim = action.animation?.scaleAnim;
          if (zoomAnim) {
            zoomAnim.firstKey.v = prevTr.zoom;
            zoomAnim.lastKey.v = newTr.zoom;
          } else {
            if (newTr.zoom < prevTr.zoom) {
              // Zoom out
              zoomAnim = Animation.simple(
                prevTr.zoom,
                newTr.zoom,
                'cubicOut'
              );
            } else if (
              newTr.zoom - prevTr.zoom < -0.5 || // Small zoom in
              state
                .centerInSceneCoord(tr)
                .subtract(state.centerInSceneCoord(newTr))
                .norm() *
                zoomTransform.scale <
                state.viewSize.max() / 2 // or moving to a close target
            ) {
              // Small Zoom in displacement
              zoomAnim = Animation.simple(
                prevTr.zoom,
                newTr.zoom,
                'cubicInOut'
              );
            } else {
              // Large Zoom in displacement
              const zoomOut = Math.sqrt(prevTr.zoom + 1) - 1;
              zoomAnim = new Animation([
                { t: 0, v: prevTr.zoom, easing: "cubicOut" },
                { t: 0.3, v: zoomOut, easing: "cubicInOut" },
                { t: 1, v: newTr.zoom },
              ]);
              if (!centerAnim) {
                centerAnim = new Animation([
                  { t: 0, v: c0, easing: "cubicInOut" },
                  { t: 0.9, v: c1 },
                ]);
              }
            }
          }
          
          let animatorCtx: any = undefined;
          if (!centerAnim) {
            if ('zoomCenter' in action && action?.zoomCenter){
              animatorCtx = {
                zoomCenter: zoomTransform.toRelativeCoord(action.zoomCenter, action.zoomCenterCoord),
                initialTransform: prevTr,
              } 
              centerAnim = null;
            } else {
              centerAnim = Animation.simple(c0, c1);
            }
          }

          zoomTransform.animator.run(
            {
              center: centerAnim,
              zoom: zoomAnim,
            },
            action.animation?.duration || 750,
            0, 
            easing,
            false,
            animatorCtx
          );

          if (action.animation?.cancelable === false) {
            zoomTransform.animationTarget = newTr;
          }

          return [zoomTransform, tr];
        }
      }

      // --- Update transform ---
      if (zoomTransform.syncTransform && !isSameTransform(newTr, prevTr)) {
        zoomTransform.syncTransform[1](
          zoomTransform.areaState.relativeTransform(newTr)
        );
      }
      zoomTransform.transform = newTr;
      return [zoomTransform, newTr];
    },
    [new ZoomTransform(iniAreaState, iniTransform), iniTransform]
  );

  // --- Observers ---
  useLayoutEffect(() => {
    dispatch({ sceneDefaultRect: sceneDefaultRect ?? null });
  }, [
    sceneDefaultRect?.left,
    sceneDefaultRect?.top,
    sceneDefaultRect?.width,
    sceneDefaultRect?.height,
  ]);

  useLayoutEffect(() => {
    dispatch({ sceneRect: sceneRect });
  }, [sceneRect.left, sceneRect.top, sceneRect.width, sceneRect.height]);

  useLayoutEffect(() => {
    zoomTransform.syncTransform = syncTransform;
    if (!syncTransform) {
      return;
    }
    const sub = syncTransform[0].subscribe((t: Transform) =>
      dispatch({ syncTransform: t })
    );
    return () => {
      sub.unsubscribe();
    };
  }, [syncTransform, zoomTransform]);

  useResizeObserver(ref, (entry) => {
    const { width, height } = entry.contentRect;
    const viewSize = new Point(width, height);
    if (viewSize !== zoomTransform.areaState.viewSize) {
      dispatch({ viewSize: viewSize });
    }
  });

  if (zoomTransform.dispatch !== dispatch) {
    zoomTransform.dispatch = dispatch;
  }

  return zoomTransform;
}

// =========================================================================
//          --- SCENE MOUSE EVENT ---
// =========================================================================

export interface SceneMouseEvent {
  cursor: Point;
  viewCursor: Point;
  movement: Point;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  button: number;
  buttons: number;
}

function createSceneMouseEvent(
  ev: MouseEvent,
  cursor: Point,
  viewCursor: Point,
  movement: Point
): SceneMouseEvent {
  return {
    cursor: cursor,
    viewCursor: viewCursor,
    movement: movement,
    altKey: ev.altKey,
    ctrlKey: ev.ctrlKey,
    shiftKey: ev.shiftKey,
    metaKey: ev.metaKey,
    button: ev.button,
    buttons: ev.buttons,
  };
}

export interface SceneWheelEvent {
  cursor: Point;
  viewCursor: Point;
  deltaX: number;
  deltaY: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  button: number;
  buttons: number;
}

function createSceneWheelEvent(
  ev: WheelEvent,
  cursor: Point,
  viewCursor: Point
): SceneWheelEvent {
  // TODO: Convert deltaX and deltaY depending on ev.deltaMode
  return {
    cursor: cursor,
    viewCursor: viewCursor,
    deltaX: ev.deltaX / 100,
    deltaY: ev.deltaY / 100,
    altKey: ev.altKey,
    ctrlKey: ev.ctrlKey,
    shiftKey: ev.shiftKey,
    metaKey: ev.metaKey,
    button: ev.button,
    buttons: ev.buttons,
  };
}

class ZoomControls {
  public panning = false;
  public initialEvent: SceneMouseEvent | undefined = undefined;
  public lastEvent: SceneMouseEvent | undefined = undefined;

  constructor(protected zoomTransform: ZoomTransform) {}

  startPan(ev: SceneMouseEvent): void {
    this.zoomTransform.areaState.node?.requestPointerLock();
    this.panning = true;
    this.lastEvent = ev;
    this.initialEvent = ev;
  }

  endPan(): void {
    document.exitPointerLock();
    this.panning = false;
    this.lastEvent = undefined;
    this.initialEvent = undefined;
  }

  pan(translate: Point): void {
    if (!translate.isZero()) {
      this.zoomTransform.dispatch({ pan: translate });
    }
  }

  zoom(factor: number, center?: Point): void {
    this.zoomTransform.dispatch({ zoom: factor, zoomCenter: center });
  }
}

export interface MouseEventsListener {
  onMouseDown?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  withMouseDownOrClick?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseUp?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseMove?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseEnter?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseLeave?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onClick?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onWheel?: (ev: SceneWheelEvent, ctrls: ZoomControls) => void;
}

type Timeout = ReturnType<typeof setTimeout>;

interface ClickTimer {
  timeout: Timeout;
  startPos: Point;
  lastPos: Point;
  mouseDownEvent: SceneMouseEvent;
}

export function useSceneMouseEventListener(
  zoomTransform: ZoomTransform,
  userEvents?: MouseEventsListener,
  hoverEvents = true,
  syncCursorPos?: [Observable<Point | null>, (p: Point | null) => void]
) {
  const [cursorPos, setCursorPosState] = useState<Point | null>(null);
  const setCursorPos = syncCursorPos
                       ? (p: Point | null) => {
                          syncCursorPos[1](p); 
                          setCursorPosState(p);
                        } 
                       : setCursorPosState;
  useLayoutEffect(() => {
    if (syncCursorPos) {
      const sub = syncCursorPos[0].subscribe((p) => setCursorPosState(p));
      return () => {
        sub.unsubscribe();
      };
    }
  }, [syncCursorPos]);

  // --- Default Zoom events Handlers ---
  const events = useMemo(() => {
    const events: MouseEventsListener = {};

    if (userEvents?.onMouseDown === undefined) {
      events.onMouseDown = (ev, ctrls) => {
        if (ev.button === 0 || ev.button === 1) {
          ctrls.startPan(ev);
          setCursorPos(null);
        }
        userEvents?.withMouseDownOrClick &&
          userEvents.withMouseDownOrClick(ev, ctrls);
      };
    } else {
      events.onMouseDown = (ev, ctrls) => {
        userEvents?.onMouseDown && userEvents.onMouseDown(ev, ctrls);
        userEvents?.withMouseDownOrClick &&
          userEvents.withMouseDownOrClick(ev, ctrls);
      };
    }

    events.onMouseMove = (ev, ctrls) => {
      if (ctrls.panning && ctrls.lastEvent) {
        ctrls.pan(ev.movement.neg());
      } else {
        userEvents?.onMouseMove && userEvents.onMouseMove(ev, ctrls);
        if (hoverEvents) {
          setCursorPos(ev.cursor.floor());
        }
      }
      ctrls.lastEvent = ev;
    };
    events.onMouseUp = (ev, ctrls) => {
      if (ctrls.panning && ev.button === ctrls.initialEvent?.button) {
        ctrls.endPan();
        setCursorPos(ev.cursor.floor());
      } else if (userEvents?.onMouseUp) {
        userEvents.onMouseUp(ev, ctrls);
      }
    };
    events.onMouseEnter = (ev, ctrls) => {
      userEvents?.onMouseEnter && userEvents.onMouseEnter(ev, ctrls);
      if (hoverEvents) {
        setCursorPos(ev.cursor.floor());
      }
    };
    events.onMouseLeave = (ev, ctrls) => {
      if (ctrls.panning) {
        ctrls.endPan();
      }

      userEvents?.onMouseLeave && userEvents.onMouseLeave(ev, ctrls);

      if (hoverEvents) {
        setCursorPos(null);
      }
    };
    events.onClick = (ev, ctrls) => {
      if (ctrls.panning && ev.button === ctrls.initialEvent?.button) {
        ctrls.endPan();
      } else {
        userEvents?.onClick && userEvents.onClick(ev, ctrls);
      }
      userEvents?.withMouseDownOrClick &&
        userEvents.withMouseDownOrClick(ev, ctrls);
    };

    if (!userEvents?.onWheel) {
      events.onWheel = (ev) => {
        let zoomAction: ZoomAction = {
          zoom: -ev.deltaY,
          zoomCenter: ev.viewCursor,
          zoomCenterCoord: "view",
        };
        if(zoomTransform.transform.zoom == zoomTransform.areaState.minZoom && ev.deltaY > 0){
          const panVector = zoomTransform.toRelativeCoord(zoomTransform.transform.center, zoomTransform.transform.coord)
                                         .subtract(new Point(0.5, 0.5))
                                         .clip_norm(0.5 * ev.deltaY);                                         
          zoomAction = {
            pan: panVector.neg(),
            coord: "relative",
          };
        }

        if (Math.abs(ev.deltaY) > 1) {
          zoomTransform.dispatch({
            ...zoomAction,
            animation: { duration: 200, cancelable: false },
          });
        } else {
          zoomTransform.dispatch(zoomAction);
        }
      };
    }

    return events;
  }, [userEvents]);

  // --- Interactions Functions ---
  useEffect(() => {
    const node = zoomTransform.areaState.node;
    if (!node) {
      return;
    }

    const zoomCtrls = new ZoomControls(zoomTransform);

    // Wheel events
    const wheelEL = (ev: WheelEvent) => {
      if (!events?.onWheel) {
        return;
      }
      ev.preventDefault();
      const bounds = Rect.fromDOMRect(node.getBoundingClientRect());
      const viewPos = new Point(ev.clientX, ev.clientY).subtract(
        bounds.topLeft
      );
      const sceneWheelEvent = createSceneWheelEvent(
        ev,
        zoomTransform.view2scene(viewPos),
        viewPos
      );
      events?.onWheel(sceneWheelEvent, zoomCtrls);
    };

    // Mouse events
    const clickTimers: { [id: number]: ClickTimer | null } = {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
    };

    const mouseEL = (ev: MouseEvent) => {
      ev.preventDefault();
      const bounds = Rect.fromDOMRect(node.getBoundingClientRect());
      const viewPos = new Point(ev.clientX, ev.clientY).subtract(
        bounds.topLeft
      );
      const sceneMouseEvent = createSceneMouseEvent(
        ev,
        zoomTransform.view2scene(viewPos),
        viewPos,
        new Point(ev.movementX, ev.movementY).divide(zoomTransform.scale)
      );

      const clickTimer = clickTimers[ev.button];
      if (ev.type === "mousemove") {
        if (clickTimer) {
          if (viewPos.subtract(clickTimer.startPos).norm() < 5) {
            clickTimer.lastPos = viewPos;
            return;
          }
          clearTimeout(clickTimer.timeout);
          clickTimers[ev.button] = null;
          events?.onMouseDown &&
            events.onMouseDown(clickTimer.mouseDownEvent, zoomCtrls);

          // Compute mouse movement from ignored event during timer
          const delta = clickTimer.lastPos
            .subtract(clickTimer.startPos)
            .divide(zoomTransform.scale);
          sceneMouseEvent.movement = sceneMouseEvent.movement.add(delta);
          sceneMouseEvent.cursor = sceneMouseEvent.cursor.add(delta);
        }
        events?.onMouseMove && events.onMouseMove(sceneMouseEvent, zoomCtrls);
      } else if (ev.type === "mousedown") {
        if (clickTimer) {
          clearTimeout(clickTimer.timeout);
        }
        clickTimers[ev.button] = {
          startPos: viewPos,
          lastPos: viewPos,
          mouseDownEvent: sceneMouseEvent,
          timeout: setTimeout(() => {
            const c = clickTimers[ev.button];
            if (c) {
              clickTimers[ev.button] = null;
              events?.onMouseDown &&
                events.onMouseDown(c.mouseDownEvent, zoomCtrls);

              // Compute mouse movement from ignored event during timer
              const delta = c.lastPos
                .subtract(c.startPos)
                .divide(zoomTransform.scale);
              sceneMouseEvent.movement = delta;
              sceneMouseEvent.cursor = sceneMouseEvent.cursor.add(delta);
              events?.onMouseMove &&
                events.onMouseMove(sceneMouseEvent, zoomCtrls);
            }
          }, 750),
        };
      } else if (ev.type === "mouseup") {
        if (clickTimer) {
          clearTimeout(clickTimer.timeout);
          clickTimers[ev.button] = null;
          events?.onClick && events.onClick(sceneMouseEvent, zoomCtrls);
        } else {
          events?.onMouseUp && events.onMouseUp(sceneMouseEvent, zoomCtrls);
        }
      } else if (ev.type === "mouseenter") {
        events?.onMouseEnter && events.onMouseEnter(sceneMouseEvent, zoomCtrls);
      } else if (ev.type === "mouseleave") {
        events?.onMouseLeave && events.onMouseLeave(sceneMouseEvent, zoomCtrls);
      }
    };

    node.addEventListener("wheel", wheelEL);
    node.addEventListener("mousemove", mouseEL);
    node.addEventListener("mousedown", mouseEL);
    node.addEventListener("mouseup", mouseEL);
    node.addEventListener("mouseenter", mouseEL);
    node.addEventListener("mouseleave", mouseEL);

    return () => {
      node.removeEventListener("wheel", wheelEL);
      node.removeEventListener("mousemove", mouseEL);
      node.removeEventListener("mousedown", mouseEL);
      node.removeEventListener("mouseup", mouseEL);
      node.removeEventListener("mouseenter", mouseEL);
      node.removeEventListener("mouseleave", mouseEL);
    };
  }, [zoomTransform, zoomTransform.areaState.node]);


  return cursorPos;
}

// Actions
interface ZoomAnimation {
  duration?: number;
  centerAnim?: Animation<Point>;
  scaleAnim?: Animation<number>;
  easing?: EasingFunction;
  cancelable?: boolean;
}

interface SetTransform {
  transform: Transform;
  animation?: ZoomAnimation;
}

interface SetCenter {
  center: Point;
  coord?: Coord;
  animation?: ZoomAnimation;
}

interface Zoom {
  zoom: number;
  zoomCenter?: Point;
  zoomCenterCoord?: Coord;
  animation?: ZoomAnimation;
}

interface Pan {
  pan: Point;
  coord?: Coord;
  animation?: ZoomAnimation;
}

interface EnsureVisible {
  ensureVisible: Rect;
  animation?: ZoomAnimation;
}

interface SetSceneRect {
  sceneRect: Rect;
}

interface SetSceneDefaultRect {
  sceneDefaultRect: Rect | null;
}

interface SetViewSize {
  viewSize: Point;
}

interface AnimStep {
  animStep: Transform;
}

interface SyncTransform {
  syncTransform: Transform;
}

export type TransformAction =
  | SetTransform
  | SetCenter
  | Zoom
  | Pan
  | EnsureVisible;
export type ZoomAction =
  | SetSceneRect
  | SetSceneDefaultRect
  | SetViewSize
  | AnimStep
  | TransformAction
  | SyncTransform;
export type ZoomDispatch = Dispatch<ZoomAction>;
