import {
  CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { LayerData, LayerOptions } from "../ipywidgets/JView2D";
import { CMapRGBA, cmap2Hexlookup, cmap2RGBAlookup } from "../utils/color";
import { Rect } from "../utils/point";

interface View2DRenderProps {
  layers: { [name: string]: LayerData };
  options: { [name: string]: LayerOptions };
  sceneDomain: Rect;
  scale: number;
}

export default function View2DRender(props: View2DRenderProps) {
  const zIndex: { name: string; zId: number }[] = [];
  for (const [name, opts] of Object.entries(props.options)) {
    if (name in props.layers && opts.visible) {
      zIndex.push({ name, zId: opts.zIndex });
    }
  }
  zIndex.sort((a, b) => a.zId - b.zId);
  const layers = [];

  for (const name of zIndex.map((z) => z.name)) {
    const data = props.layers[name];
    const opt = props.options[name];
    const pixelSize =
      (props.scale * opt.domain.width) / props.sceneDomain.width;

    switch (data.type) {
      case "image":
        layers.push(
          <ImageLayer
            data={data}
            options={opt}
            sceneDomain={props.sceneDomain}
            pixelSize={pixelSize}
            key={name}
          />
        );
        break;
      case "label":
        layers.push(
          <LabelLayer
            data={data}
            options={opt}
            sceneDomain={props.sceneDomain}
            key={name}
            pixelSize={pixelSize}
          />
        );
        break;
      case "graph":
        layers.push(
          <GraphLayer
            data={data}
            options={opt}
            sceneDomain={props.sceneDomain}
            pixelSize={pixelSize}
            key={name}
          />
        );
        break;
      case "quiver":
        layers.push(
          <QuiverLayer
            data={data}
            options={opt}
            sceneDomain={props.sceneDomain}
            pixelSize={pixelSize}
            key={name}
          />
        );
        break;
    }
  }

  return <>{layers}</>;
}

export function ImageLayer(props: {
  data: LayerData;
  options: LayerOptions;
  sceneDomain: Rect;
  pixelSize: number;
}) {
  const { data, options, sceneDomain } = props;

  const pixelSize = (options.domain.width / data.infos.width) * props.pixelSize;

  return (
    <img
      src={data.data}
      alt={options.label}
      className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
      style={{
        imageRendering: pixelSize < 7 ? "auto" : "pixelated",
        ...getLayerStyle(options, sceneDomain),
      }}
    />
  );
}

export function LabelLayer(props: {
  data: LayerData;
  options: LayerOptions;
  sceneDomain: Rect;
  pixelSize: number;
}) {
  const { data, options, sceneDomain } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cMap = useMemo(
    () => cmap2RGBAlookup(data.infos.labels, options.cmap),
    [data.infos.label, options.cmap]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    const ctx = canvas.getContext("2d");
    if (ctx == null) return;

    drawLabels(canvas, data.data, cMap);
  }, [data.data, options.cmap]);

  const pixelSize =
    (options.domain.width /
      (canvasRef.current?.width ?? options.domain.width)) *
    props.pixelSize;

  return (
    <canvas
      ref={canvasRef}
      className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
      style={{
        imageRendering: pixelSize < 7 ? "auto" : "pixelated",
        ...getLayerStyle(options, sceneDomain),
      }}
    />
  );
}

export function GraphLayer(props: {
  data: LayerData;
  options: LayerOptions;
  sceneDomain: Rect;
  pixelSize: number;
}) {
  const { data, options, sceneDomain } = props;
  const { opacity } = options;

  const adjList: number[][] = data.data.adj;

  const nbNodes = data.infos.nbNodes;
  const nodeCMap = useMemo(
    () => cmap2Hexlookup(nbNodes, options.nodes_cmap),
    [nbNodes, options.nodes_cmap]
  );

  const nodes = useMemo(
    () =>
      data.data.nodes_yx.map((yx: [number, number], i: number) => {
        const [y, x] = yx;
        const color = nodeCMap[i + 1];

        return (
          <g key={i}>
            <circle
              cx={x + 0.5}
              cy={y + 0.5}
              r={4.5 / props.pixelSize}
              fill={color}
              stroke="white"
              strokeWidth={1 / props.pixelSize}
            >
              <title>Node {i}</title>
            </circle>
            {options.node_labels_visible ? (
              <text
                x={x + 0.5 + 7 / props.pixelSize}
                y={y + 0.5 + 7 / props.pixelSize}
                fill={color}
                fontSize={13 / props.pixelSize}
                fontFamily={"sans-serif"}
                fontWeight={"bold"}
              >
                {i}
              </text>
            ) : undefined}
          </g>
        );
      }),
    [
      data.data.nodes_yx,
      options.nodes_cmap,
      props.pixelSize,
      options.node_labels_visible,
    ]
  );
  const nodesDomain = Rect.fromTuple(data.infos.nodesDomain);

  const nbEdges = adjList.length;
  const edgeRGBACMap = useMemo(
    () => cmap2RGBAlookup(nbEdges, options.edges_cmap),
    [nbEdges, options.edges_cmap]
  );

  const edgeHexCMap = useMemo(
    () => cmap2Hexlookup(nbEdges, options.edges_cmap),
    [nbEdges, options.edges_cmap]
  );

  const displayEdgeMap = data.data.edgeMap != null && options.edge_map_visible;
  const edges = useMemo(() => {
    if (!displayEdgeMap) {
      return adjList.map((nodes: number[], i: number) => {
        const node1_yx = data.data.nodes_yx[nodes[0]];
        const node2_yx = data.data.nodes_yx[nodes[1]];
        const [y1, x1] = node1_yx;
        const [y2, x2] = node2_yx;
        const color = edgeHexCMap[i + 1];
        return (
          <g key={i}>
            <line
              x1={x1 + 0.5}
              y1={y1 + 0.5}
              x2={x2 + 0.5}
              y2={y2 + 0.5}
              stroke={color}
              strokeWidth={3 / props.pixelSize}
              opacity={options.edges_opacity}
            >
              <title> Edge {i} </title>
            </line>
            {options.edge_labels_visible ? (
              <text
                x={(x1 + x2) / 2 + 7 / props.pixelSize}
                y={(y1 + y2) / 2 + 7 / props.pixelSize}
                fill={color}
                textDecoration={"overline"}
                fontSize={13 / props.pixelSize}
                fontFamily={"sans-serif"}
                fontWeight={"bold"}
              >
                {i}
              </text>
            ) : undefined}
          </g>
        );
      });
    } else {
      return [];
    }
  }, [
    displayEdgeMap,
    props.pixelSize,
    options.edges_opacity,
    options.edge_labels_visible,
    options.edges_cmap,
  ]);

  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useLayoutEffect(() => {
    const canvas = edgeCanvasRef.current;
    if (canvas == null) return;
    const ctx = canvas.getContext("2d");
    if (ctx == null) return;

    if (displayEdgeMap) {
      drawLabels(canvas, data.data.edgeMap, edgeRGBACMap);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [displayEdgeMap, data.data.edgeMap, options.edges_cmap]);

  const layerStyle = getLayerStyle(options, sceneDomain);
  const pixelSize =
    (options.domain.width /
      (edgeCanvasRef.current?.width ?? options.domain.width)) *
    props.pixelSize;

  return (
    <>
      <canvas
        className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
        ref={edgeCanvasRef}
        style={{
          ...layerStyle,
          imageRendering: pixelSize > 7 ? "crisp-edges" : "pixelated",
          opacity: options.edges_opacity * opacity,
        }}
      />
      <svg
        className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
        xmlns={"http://www.w3.org/2000/svg"}
        viewBox={`${nodesDomain.left} ${nodesDomain.top} ${nodesDomain.width} ${nodesDomain.height}`}
        preserveAspectRatio={"none"}
        style={layerStyle}
      >
        {edges}
        {nodes}
      </svg>
    </>
  );
}

export function QuiverLayer(props: {
  data: LayerData;
  options: LayerOptions;
  sceneDomain: Rect;
  pixelSize: number;
}) {
  const { data, options, sceneDomain } = props;

  const arrows = useMemo(
    () =>
      data.data.arrows.map((yxvu: [number, number, number, number], i: number) => {
        const [y, x, v, u] = yxvu;

        const angle = Math.atan2(v, u);
        let zoom_scaling = (x: number) => x;
        switch (options.zoom_scaling) {
          case "view_sqrt":
            zoom_scaling = (x: number) => Math.pow(props.pixelSize, -0.5) * x ;
            break;
          case "view_log":
            zoom_scaling = (x: number) => Math.log(1/props.pixelSize) * x;
            break;
          case "view":
            zoom_scaling = (x: number) => x / props.pixelSize;
            break;
        }
        let length = Math.sqrt(u * u + v * v);
        let arrowLength = zoom_scaling(Math.sqrt(length));
        length = zoom_scaling(length);
        
        const color = options.color;
        const width = options.width;

        const transform = `translate(${x+0.5}, ${y+0.5}) rotate(${angle * 180 / Math.PI})`;

        return (
          <g key={i} transform={transform}>
            <line
              x1={0}
              y1={0}
              x2={length}
              y2={0}
              stroke={color}
              strokeWidth={width / props.pixelSize}
            />
            <line
              x1={length}
              y1={0}
              x2={length - arrowLength}
              y2={-arrowLength}
              stroke={color}
              strokeWidth={width / props.pixelSize}
            />
            <line
              x1={length}
              y1={0}
              x2={length - arrowLength}
              y2={arrowLength}
              stroke={color}
              strokeWidth={width / props.pixelSize}
            />
          </g>
        );
      }),
    [
      data.data.arrows,
      props.pixelSize,
    ]
  );
  const quiverDomain = Rect.fromTuple(data.infos.quiverDomain);
  const layerStyle = getLayerStyle(options, sceneDomain);

  return (
    <>
      <svg
        className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
        xmlns={"http://www.w3.org/2000/svg"}
        viewBox={`${quiverDomain.left} ${quiverDomain.top} ${quiverDomain.width} ${quiverDomain.height}`}
        preserveAspectRatio={"none"}
        style={layerStyle}
      >
        {arrows}
      </svg>
    </>
  );
}

function getLayerStyle(
  options: LayerOptions,
  sceneDomain: Rect
): CSSProperties {
  const { domain, opacity, visible, blend_mode } = options;

  return {
    top: `${((domain.top - sceneDomain.top) / sceneDomain.height) * 100}%`,
    left: `${((domain.left - sceneDomain.left) / sceneDomain.width) * 100}%`,
    width: `${(domain.width / sceneDomain.width) * 100}%`,
    height: `${(domain.height / sceneDomain.height) * 100}%`,
    position: "absolute",
    mixBlendMode: blend_mode as any,
    opacity: opacity * (visible ? 1 : 0),
  };
}

function colorizeLabelInplace(imageData: ImageData, cmapLookup: CMapRGBA) {
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v =
      imageData.data[i] |
      (imageData.data[i + 1] << 8) |
      (imageData.data[i + 2] << 16) |
      ((255 - imageData.data[i + 3]) << 24);

    if (v == 0) {
      imageData.data[i + 3] = 0;
      continue;
    }

    const color = cmapLookup[v];
    if (color === undefined) {
      imageData.data[i + 3] = 0;
    } else {
      imageData.data[i] = color[0];
      imageData.data[i + 1] = color[1];
      imageData.data[i + 2] = color[2];
      imageData.data[i + 3] = color[3];
    }
  }
}

function drawLabels(
  canvas: HTMLCanvasElement,
  imgSrc: string,
  cmapLookup: CMapRGBA
) {
  const ctx = canvas.getContext("2d");
  if (ctx == null) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height, );
    colorizeLabelInplace(imageData, cmapLookup);
    ctx.putImageData(imageData, 0, 0);
  };
  img.src = imgSrc;
}
