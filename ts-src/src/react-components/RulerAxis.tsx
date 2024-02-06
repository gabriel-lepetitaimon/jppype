import {CSSProperties, useMemo, useRef, useState } from 'react';
import useSize from '../utils/size-context';
import '../../css/RulerAxis.css';
import {useEventListener, captureMouseEvents} from '../utils/event-listener';
import {
  inInterval,
  Interval,
  linspace,
  optiLog10Step,
  validNumber,
} from '../utils/math';
import {Point, Rect} from '../utils/point';

interface AxisRulerProps {
  orientation: 'horizontal' | 'vertical';
  thickness?: number;
  center?: number;
  onPanCenter?: (delta: number) => void;
  onSetCenter?: (center: number) => void;
  cursorPos?: number;
  scale: number;
  axisInterval: Interval;
  style?: CSSProperties;
}


export default function RulerAxis(props: AxisRulerProps): JSX.Element {
    const hor = props.orientation === 'horizontal';
    const thickness = props.thickness ?? 20;
    const style = props.style ?? {};
    const ref = useRef<HTMLDivElement | null>(null);
    const size = useSize(ref);
    const axisSize = hor ? size.x : size.y;
    let highlightArea: Interval | null = null;

    const [forceOverview, setForceOverview] = useState(false);

    let preEmptyArea, postEmptyArea, preShadowArea, postShadowArea, ticks;
    let borderRadius = `${thickness / 2} px`;
    let labels, minDomainLabel, maxDomainLabel;
    let cursorTick;

    const domainMin = validNumber(props.axisInterval.start, 0);
    const domainMax = validNumber(props.axisInterval.end, 1);


    let scale = validNumber(props.scale, 1);
    let center = validNumber(props.center, (domainMin + domainMax)  / 2);
    if (forceOverview) {
        const halfRange = axisSize / scale / 2;
        highlightArea = {start: Math.round(center-halfRange), end: Math.round(center+halfRange)};
        // Force axis to show the entire domain
        scale = axisSize / (domainMax - domainMin);
        center = (domainMin + domainMax) / 2;
    }

    const axisRange = axisSize / scale;
    const rangeMin = center - axisRange / 2;
    const rangeMax = center + axisRange / 2;

    const highlightMin = highlightArea?.start;
    const highlightMax = highlightArea?.end;


    const cursorPos = props.cursorPos ?? null;

    if (cursorPos !== null) {
      const cursorTickPos = (cursorPos - rangeMin + 0.5) * scale;
      cursorTick = (
        <g
          transform={translateAlong(cursorTickPos, hor)}
          className={'cursorTick'}
        >
          <rect
            x={hor ? -18 : 0}
            y={hor ? 0 : -18}
            width={hor ? 36 : thickness}
            height={hor ? thickness : 36}
            rx={thickness / 5}
            ry={thickness / 5}
          />
          <TickLabel
            length={thickness}
            horizontal={hor}
            label={cursorPos.toString()}
          />
        </g>
      );
    }

    // --- Label Ticks ---
    const preEmptyAreaSize = Math.max(0, (domainMin - rangeMin) * scale - 1);
    const postEmptyAreaSize = Math.max(0, (rangeMax - domainMax) * scale - 1);
    [preEmptyArea, postEmptyArea, minDomainLabel, maxDomainLabel, labels, ticks, borderRadius] =
      useMemo(() => {

          const textWidth = ( text: string | number, pad=3) => {
              if (typeof text == 'number') {
                  text = text.toString();
              }
              return text.toString().length * thickness / 2.5 + pad;
          };


        const preEmptyArea = (
          <rect
            className={'out-of-domain'}
            x={0}
            y={0}
            height={hor ? thickness : preEmptyAreaSize}
            width={!hor ? thickness : preEmptyAreaSize}
          />
        );

        const postEmptyArea = (
          <rect
            className={'out-of-domain'}
            x={hor ? axisSize - postEmptyAreaSize : 0}
            y={!hor ? axisSize - postEmptyAreaSize : 0}
            height={hor ? thickness : postEmptyAreaSize}
            width={!hor ? thickness : postEmptyAreaSize}
          />
        );

        const skipIntervals = new Array<Interval>();

        const firstTickPos = (domainMin-rangeMin) * scale;
        const firstLabel = (
            <TickLabel
              className={'BoundariesLabelTick'}
              length={thickness}
              tickLength={1}
              horizontal={hor}
              label={domainMin.toString()}
              labelAnchor={'after'}
              pos={firstTickPos}
            />
        );
        const firstTickInterval = {
          start: firstTickPos,
          end: firstTickPos + textWidth(domainMin),
        };
        if (firstTickInterval.end >= 0) {
          skipIntervals.push(firstTickInterval);
        }

        const endTickPos = (domainMax - rangeMin) * scale;
        const endLabel = (
            <TickLabel
              className={'BoundariesLabelTick'}
              length={thickness}
              tickLength={1}
              horizontal={hor}
              label={domainMax.toString()}
              labelAnchor={'before'}
              pos={endTickPos}
            />
        );
        const endTickInterval = {
          start:
            endTickPos - textWidth(domainMax),
          end: endTickPos,
        };
        if (endTickInterval.start <= axisSize) {
          skipIntervals.push(endTickInterval);
        }

        // --- Labels Ticks ---
        const labelStep = optiLog10Step(scale, 80);
        const tickStep = optiLog10Step(scale, 12);
        const tickMin = Math.max(domainMin, rangeMin);
        const tickMax = Math.min(domainMax, rangeMax);

        labels = linspace(tickMin, tickMax, labelStep, true).map(
          (pos, i, { length }) => {
            const tickPos = (pos - rangeMin + 0.5) * scale;

            // Skip if in previous intervals
            if (
              skipIntervals.findIndex((v) => inInterval(tickPos, v, 10)) >= 0
            ) {
              return;
            }

            // Render label tick
            return (
                <TickLabel
                  key={pos}
                  className={'BoundariesLabelTick'}
                  length={thickness}
                  horizontal={hor}
                  label={Math.round(pos).toString()}
                  pos={tickPos}
                />
            );
          }
        );

        // --- Ticks ---
        ticks = linspace(tickMin, tickMax, tickStep, true, labelStep).map(
          (pos, i, { length }) => {
            const tickPos = (pos - rangeMin + 0.5) * scale;

            // Skip if in previous intervals
            if (
              skipIntervals.findIndex((v) => inInterval(tickPos, v, 2)) >= 0
            ) {
              return;
            }

            return (
              <g transform={translateAlong(tickPos, hor)} key={pos}>
                <Tick length={thickness} tickLength={.15} horizontal={hor} />
              </g>
            );
          }
        );

        const minRadius = Math.min((tickMin-domainMin) * scale, thickness / 2);
        const maxRadius = Math.min(
          (domainMax - tickMax) * scale,
          thickness / 2
        );
        const borderRadius: string = hor
          ? `${minRadius}px ${maxRadius}px ${maxRadius}px ${minRadius}px`
          : `${minRadius}px ${minRadius}px ${maxRadius}px ${maxRadius}px`;

        return [
          preEmptyArea,
          postEmptyArea,
          firstLabel,
          endLabel,
          labels,
          ticks,
          borderRadius,
        ];
      }, [axisSize, domainMin, domainMax, center, scale]) as [
        JSX.Element, // preEmptyArea
        JSX.Element, // postEmptyArea
        JSX.Element, // minDomainLabel
        JSX.Element, // endLabel
        JSX.Element[], // labels
        JSX.Element[], // ticks
        string // borderRadius
      ];

    [preShadowArea, postShadowArea] = useMemo(() => {
        const highlightAreaSize = highlightArea ? (highlightArea.end - highlightArea.start) * scale : 0;
        const preShadowAreaSize = highlightMin ? Math.max(0, (highlightMin - rangeMin) * scale - 1) : 0;
        const labelInside = highlightAreaSize > thickness * 5;
        const preShadowArea = highlightAreaSize ? (
            <g transform={translateAlong(preEmptyAreaSize, hor)}>
                <rect
                    className={'shadow'}
                    x={0}
                    y={0}
                    height={hor ? thickness : preShadowAreaSize}
                    width={!hor ? thickness : preShadowAreaSize}
                />
                <TickLabel
                  className={'BoundariesLabelTick HighlightLabelTick'}
                  length={thickness}
                  tickLength={1}
                  horizontal={hor}
                  label={highlightMin?.toString() ?? ''}
                  labelAnchor={labelInside ? 'after' : 'before'}
                  pos={preShadowAreaSize}
                  labelBackground={labelInside ? 'light' : 'dark'}
                />
            </g>
        ) : (<g/>);

        const postShadowAreaSize = highlightMax ? Math.max(0, (rangeMax - highlightMax) * scale - 1) : 0;
        const postShadowArea = highlightAreaSize ? (
            <g transform={translateAlong(axisSize - postEmptyAreaSize - postShadowAreaSize, hor)}>
                <rect
                    className={'shadow'}
                    x={0}
                    y={0}
                    height={hor ? thickness : postShadowAreaSize}
                    width={!hor ? thickness : postShadowAreaSize}
                />
                <TickLabel
                  className={'BoundariesLabelTick HighlightLabelTick'}
                  length={thickness}
                  tickLength={1}
                  horizontal={hor}
                  label={highlightMax?.toString() ?? ''}
                  labelAnchor={labelInside ? 'before' : 'after'}
                  labelBackground={labelInside ? 'light' : 'dark'}
                />
            </g>
        ) : (<g/>);
        return [
          preShadowArea,
          postShadowArea,
        ]
    }, [axisSize, domainMin, domainMax, center, scale, highlightMin, highlightMax]) as [
        JSX.Element, // preShadowArea
        JSX.Element, // postShadowArea
    ];


    // --- Mouse Events ---

    const mouseDown = useRef(false);
    useEventListener(ref, 'wheel', (e) => {
      if (props.onPanCenter === undefined)
        return;
      e.preventDefault();
      props.onPanCenter(e.deltaY / scale);
    });

    useEventListener(ref, 'mouseenter', (e) => {
        const isDomainOutOfRange = domainMin - rangeMin < 0 || domainMax - rangeMax > 0;
        if (props.onSetCenter === undefined || !isDomainOutOfRange)
            return;
        e.preventDefault();

        if (!mouseDown.current)
            setForceOverview(true);
    });

    useEventListener(ref, 'mouseleave', (e) => {
        if (props.onSetCenter === undefined)
            return;
        e.preventDefault();

        if (!mouseDown.current)
            setForceOverview(false);
    });



    useEventListener(ref, 'mousedown', (e) => {
        if (ref.current === null || props.onSetCenter === undefined || !forceOverview)
            return;

        let startPos: number | undefined =
            ( (hor ? e.clientX : e.clientY) - ref.current.getBoundingClientRect()[hor ? 'left' : 'top']
            + rangeMin) / scale;
        const startCenter = props.center ?? center;

        if(!highlightArea || !inInterval(startPos, highlightArea))
            startPos = undefined;


        const onMouseMove = (e: MouseEvent) => {
            if (ref.current === null || props.onSetCenter === undefined)
                return;
            const c =
                ((hor ? e.clientX : e.clientY) - ref.current.getBoundingClientRect()[hor ? 'left' : 'top']
                + rangeMin) / scale;
            if(startPos === undefined){
                props.onSetCenter(c);
            } else {
                props.onSetCenter(startCenter + c - startPos);
            }
        }

        const onMouseUp = (e: MouseEvent) => {
            mouseDown.current = false;

            if (ref.current === null)
                return;
            const cursorPos = new Point(e.clientX, e.clientY);
            const rect = Rect.fromDOMRect(ref.current.getBoundingClientRect());
            if(!cursorPos.in(rect))
                setForceOverview(false);
        }

        mouseDown.current =true;
        if (startPos === undefined) {
            onMouseMove(e);
        }
        captureMouseEvents(e, onMouseMove, onMouseUp);
    });


  return (
    <div
      ref={ref}
      className={'RulerAxis'}
      style={
        {
          height: hor ? thickness : '100%',
          width: hor ? '100%' : thickness,
          '--thickness': thickness,
          ...style,
        } as CSSProperties
      }
    >
      <svg
        xmlns={'http://www.w3.org/2000/svg'}
        style={{ borderRadius: borderRadius }}
      >
          <defs>
            <filter x="0" y="0" width="1" height="1" id="lightBackgroundFilter">
              <feFlood result="bg" />
              <feMerge>
                <feMergeNode in="bg"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

              <filter x="0" y="0" width="1" height="1" id="darkBackgroundFilter">
              <feFlood result="bg" />
              <feMerge>
                <feMergeNode in="bg"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        {preEmptyArea}
        {postEmptyArea}
        {ticks}
        {labels}
        {minDomainLabel}
        {maxDomainLabel}
        {preShadowArea}
        {postShadowArea}
        {cursorTick}
      </svg>
    </div>
  );
}

interface TickProps {
  length: number;
  tickLength?: number;
  horizontal: boolean;
}

function translateAlong(pos: number, hor: boolean) {
  return `translate(${hor ? pos : 0}, ${!hor ? pos : 0})`;
}

function Tick(props: TickProps): JSX.Element {
  const tickLength = props.length * (props.tickLength ?? 1 / 3);
  if (props.horizontal) {
    return (
      <line
        className={'tick'}
        x1={0}
        x2={0}
        y1={props.length - tickLength}
        y2={props.length}
      />
    );
  } else {
    return (
      <line
        className={'tick'}
        y1={0}
        y2={0}
        x1={props.length - tickLength}
        x2={props.length}
      />
    );
  }
}

interface TickLabelProps {
  length: number;
  horizontal: boolean;
  label: string | number;
  labelAnchor?: 'before' | 'middle' | 'after';
  tickLength?: number;
  className?: string;
  pos?: number;
  labelBackground?: 'light' | 'dark';
}

function TickLabel(props: TickLabelProps): JSX.Element {
  const hor = props.horizontal;
  const fontSize = props.length * (2 / 3);
  const textCenter = props.length / 3 + 1;
  const labelAnchor = props.labelAnchor ?? 'middle';
  const className = props.className ?? '';
  const offset = props.pos ?? 0;
  const labelBackground = props.labelBackground ?? null;

  const tickProps = {
    length: props.length,
    horizontal: props.horizontal,
    tickLength: props.tickLength,
  };
  let style: CSSProperties = {};
  let labelOffset = 0;

  if (labelAnchor === 'before') {
    style = { textAnchor: props.horizontal ? 'end' : 'start' };
    labelOffset = -3;
  } else if (labelAnchor === 'after') {
    style = { textAnchor: props.horizontal ? 'start' : 'end' };
    labelOffset = 3;
  }

  const label: string = typeof props.label === 'number' ?
        props.label.toFixed() : props.label;


  const textElement = (
      <text
          fontSize={fontSize}
          filter={labelBackground ? (labelBackground=='light'
                ? ("url(#lightBackgroundFilter)")
                : ("url(#darkBackgroundFilter)"))
              : undefined}
          transform={hor
              ? `translate(${labelOffset}, ${textCenter})`
              : `translate(${textCenter}, ${labelOffset}) rotate(-90)`}
          style={style}
        >
           {label}
        </text>) as JSX.Element;


  return (
      <g className={'labelTick ' + className} transform={translateAlong(offset, hor)}>
        {textElement}
        <Tick {...tickProps} />
      </g>
  );
}
