import { LayerData, LayerOptions } from '../ipywidgets/JView2D';
import {Rect} from "../utils/point";
import {useEffect, useMemo, useRef, ReactElement} from "react";
import {CMapRGBA, cmap2RGBAlookup, cmap2Hexlookup} from "../utils/color";

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
    const pixelSize = props.scale * opt.domain.width/props.sceneDomain.width;

    switch (data.type) {
      case 'image':
        layers.push(
            <ImageLayer
              data={data}  options={opt}
              sceneDomain={props.sceneDomain}
              pixelSize={pixelSize}
              key={name}
            />);
        break;
      case 'label':
        layers.push(
            <LabelLayer
              data={data}  options={opt}
              sceneDomain={props.sceneDomain}
              key={name}
              pixelSize={pixelSize}
            />);
        break;
      case 'graph':
        layers.push(
            <GraphLayer
                data={data}  options={opt}
                sceneDomain={props.sceneDomain}
                pixelSize={pixelSize}
                key={name}
            />);
        break;
    }
  }

  return <>{layers}</>;
}


function ImageLayer(props: { data: LayerData; options: LayerOptions; sceneDomain: Rect, pixelSize: number }) {
  const { data, options, sceneDomain } = props;
  const { opacity } = options;

  const pixelSize = options.domain.width/data.infos.width * props.pixelSize;

  return (
    <img
      src={data.data}
      alt={options.label}
      style={{
        opacity: opacity,
        imageRendering: pixelSize < 7 ? 'auto' : 'pixelated',
        ...positionStyle(options.domain, sceneDomain),
      }}
    />
  );
}

function LabelLayer(props: { data: LayerData; options: LayerOptions; sceneDomain: Rect, pixelSize: number}) {
  const { data, options, sceneDomain } = props;
  const { opacity } = options;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const cMap = useMemo(
        () => cmap2RGBAlookup(data.infos.labels, options.cmap),
        [data.infos.label, options.cmap]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas == null) return;
      const ctx = canvas.getContext("2d");
      if (ctx == null) return;

      drawLabels(canvas, data.data, cMap);
    }, [data.data, options.cmap])

    const pixelSize = options.domain.width/(canvasRef.current?.width??options.domain.width) * props.pixelSize;

    return (
        <canvas
          ref={canvasRef}
          style={{
            opacity: opacity,
            imageRendering: pixelSize < 7 ? 'auto' : 'pixelated',
            ...positionStyle(options.domain, sceneDomain),
          }}
      />);
}


function GraphLayer(props: { data: LayerData; options: LayerOptions; sceneDomain: Rect, pixelSize: number}) {
    const { data, options, sceneDomain } = props;
    const { opacity } = options;

    const branchCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const branchesSvgRef = useRef<ReactElement[] | null>(null);

    const adjList: number[][] = data.data.adj;

    const nbNodes = data.infos.nbNodes;
    const nodeCMap = useMemo(
        () => cmap2Hexlookup(nbNodes, options.nodes_cmap),
        [nbNodes, options.nodes_cmap]);

    const nodes = useMemo(
  () => data.data.nodes_yx.map((yx: [number, number], i: number) => {
            const [y, x] = yx;
            const color = nodeCMap[i+1];

            return (
            <g key={i}>
                <circle cx={x+0.5} cy={y+0.5} r={4.5 / props.pixelSize} fill={color}
                           stroke="white" strokeWidth={1/props.pixelSize}>
                <title>Node {i}</title>
                </circle>
                {options.node_labels_visible
                    ? <text x={x+0.5+ 7/props.pixelSize} y={y+0.5+ 7/props.pixelSize} fill={color}
                      fontSize={13/props.pixelSize} fontFamily={"sans-serif"} fontWeight={"bold"}>{i}</text>
                    : undefined}
            </g>);
        }), [data.data.nodes_yx, options.nodes_cmap, props.pixelSize, options.node_labels_visible]);
    const nodesDomain = Rect.fromTuple(data.infos.nodesDomain);

    const nbBranches = adjList.length;
    const branchRGBACMap = useMemo(
        () => cmap2RGBAlookup(nbBranches, options.branches_cmap),
        [nbBranches, options.branches_cmap]);

    const branchHexCMap = useMemo(
        () => cmap2Hexlookup(nbBranches, options.branches_cmap),
        [nbBranches, options.branches_cmap]);

    useEffect(() => {
      const canvas = branchCanvasRef.current;
      if (canvas == null) return;
      const ctx = canvas.getContext("2d");
      if (ctx == null) return;

      if (data.data.branchMap == null || options.branch_as_edge) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        branchesSvgRef.current = adjList.map((nodes: number[], i: number) => {
          const node1_yx = data.data.nodes_yx[nodes[0]];
          const node2_yx = data.data.nodes_yx[nodes[1]];
          const [y1, x1] = node1_yx;
          const [y2, x2] = node2_yx;
          const color = branchHexCMap[i+1];
          return <g key={i}>
                <line x1={x1+0.5} y1={y1+0.5} x2={x2+0.5} y2={y2+0.5}
                       stroke={color} strokeWidth={3 / props.pixelSize}
                        opacity={options.branches_opacity}>
                    <title> Edge {i} </title>
                </line>
              {options.branch_labels_visible
                  ? <text x={(x1+x2)/2 + 7/props.pixelSize} y={(y1+y2)/2 + 7/props.pixelSize} fill={color}
                          textDecoration={"overline"}
                      fontSize={13/props.pixelSize} fontFamily={"sans-serif"} fontWeight={"bold"}>{i}</text>
                    : undefined}
          </g>
        });
      } else {
        branchesSvgRef.current = null;
        drawLabels(canvas, data.data.branchMap, branchRGBACMap);
      }
    }, [options.branches_cmap,
        (data.data.branchMap==null || options.branch_as_edge)
            ? props.pixelSize+options.branches_opacity + (options.branch_labels_visible?100:0)
            : data.data.branchMap])

    const posStyle = positionStyle(options.domain, sceneDomain);
    const pixelSize = options.domain.width/(branchCanvasRef.current?.width??options.domain.width) * props.pixelSize;

    return (
        <>
          <canvas
            ref={branchCanvasRef}
            style={{
              imageRendering: pixelSize > 7 ? 'crisp-edges' : 'pixelated',
                opacity: options.branches_opacity * opacity,
              ...posStyle
            }}
        />
        <svg xmlns={'http://www.w3.org/2000/svg'}
             viewBox={`${nodesDomain.left} ${nodesDomain.top} ${nodesDomain.width} ${nodesDomain.height}`}
             preserveAspectRatio={'none'}
             style={{
                 opacity: opacity,
                 ...posStyle
            }}
        >
            {branchesSvgRef.current}
            {nodes}
        </svg>
      </>);
}

function positionStyle(domain: Rect, sceneDomain: Rect): React.CSSProperties{
  return {
    top: `${(domain.top - sceneDomain.top)/sceneDomain.height * 100}%`,
    left: `${(domain.left - sceneDomain.left)/sceneDomain.width * 100}%`,
    width: `${domain.width/sceneDomain.width * 100}%`,
    height: `${domain.height/sceneDomain.height * 100}%`,
    position: 'absolute',
  };
}


function colorizeLabelInplace(imageData: ImageData, cmapLookup: CMapRGBA){
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i]
        | (imageData.data[i + 1] << 8)
        | (imageData.data[i + 2] << 16)
        | ((255 - imageData.data[i + 3]) << 24);

    if (v == 0) {
      imageData.data[i+3] = 0;
      continue;
    }

    const color = cmapLookup[v];

    imageData.data[i] = color[0];
    imageData.data[i + 1] = color[1];
    imageData.data[i + 2] = color[2];
    imageData.data[i + 3] = color[3];
  }
}

function drawLabels(canvas: HTMLCanvasElement, imgSrc: string, cmapLookup: CMapRGBA) {
  const ctx = canvas.getContext("2d");
  if (ctx == null) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    colorizeLabelInplace(imageData, cmapLookup);
    ctx.putImageData(imageData, 0, 0);
  }
  img.src = imgSrc;
}