import React, {
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";
import { LayerData, LayerOptions } from "../../ipywidgets/JView2D";
import { cmap2Hexlookup, cmap2RGBAlookup } from "../../utils/color";
import { Rect } from "../../utils/point";
import { drawLabels, getLayerStyle } from "./layers_utils";


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
                            style={{ strokeWidth: "calc(1 / var(--pixelSize))" }}
                        >
                            <title>Node {i}</title>
                        </circle>
                        {options.node_labels_visible ? (
                            <text
                                fill={color}
                                fontFamily={"sans-serif"}
                                fontWeight={"bold"}
                                style={{
                                    fontSize: "calc(13px / var(--pixelSize))",
                                    transform: `translate(calc(${x + 0.5}px + 7px / var(--pixelSize)), 
                                                          calc(${y + 0.5}px + 7px / var(--pixelSize)))`,
                                }}
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
            const edgePaths = data.data.edgePath;
            return adjList.map((nodes: number[], i: number) => {
                const node1_yx = data.data.nodes_yx[nodes[0]];
                const node2_yx = data.data.nodes_yx[nodes[1]];
                const [y1, x1] = node1_yx;
                const [y2, x2] = node2_yx;
                const color = edgeHexCMap[i + 1];

                const pathData = edgePaths !== undefined ? edgePaths[i] : undefined;
                const curve = pathData !== undefined ? (
                    <path
                        fill="none"
                        stroke={color}
                        opacity={options.edges_opacity}
                        style={{
                            strokeWidth: "calc(3 / var(--pixelSize))",
                            transform: `translate(0.5px, 0.5px)`
                        }}
                        d={pathData}
                    />
                ) : (
                    <line
                        x1={x1 + 0.5}
                        y1={y1 + 0.5}
                        x2={x2 + 0.5}
                        y2={y2 + 0.5}
                        stroke={color}
                        opacity={options.edges_opacity}
                        style={{ strokeWidth: "calc(3 / var(--pixelSize))" }}
                    >
                        <title> Edge {i} </title>
                    </line>
                );

                return (
                    <g key={i}>
                        {curve}
                        {options.edge_labels_visible ? (
                            <text
                                fill={color}
                                textDecoration={"overline"}
                                fontFamily={"sans-serif"}
                                fontWeight={"bold"}
                                style={
                                    {
                                        transform: `translate(calc(${(x1 + x2) / 2}px + 7px / var(--pixelSize)),
                                                        calc(${(y1 + y2) / 2}px + 7px / var(--pixelSize)))`,
                                        fontSize: "calc(13px / var(--pixelSize))",
                                    }
                                }
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
        data.data?.edgePath,
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
    const pixelSizeVar = { "--pixelSize": `${props.pixelSize}`, } as React.CSSProperties;

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
                style={
                    { ...layerStyle, ...pixelSizeVar }
                }
            >
                {edges}
                {nodes}
            </svg>
        </>
    );
}

export function SvgPolygonsLayer(props: {
    data: LayerData;
    options: LayerOptions;
    sceneDomain: Rect;
    pixelSize: number;
}) {
    const { data, options, sceneDomain } = props;

    const cMap = useMemo(
        () => cmap2Hexlookup(data.infos.labels, options.cmap),
        [data.infos.label, options.cmap]
    );

    const polygons = useMemo(
        () => data.data.polygons.map((polygon: [number, number][], i: number) => {
            const points = polygon
                .map(([y, x]) => (isNaN(y) || isNaN(x)) ? "" : `${x + 0.5},${y + 0.5}`)
                .join(" ");

            const color = cMap[data.data.labels[i]];
            return (
                <polygon
                    key={i}
                    points={points}
                    fill={color}
                    stroke={color}
                    strokeWidth={options.strokeWidth}
                    fillOpacity={options.opacity}
                />
            );
        }),
        [data.data.polygons, options.cmap, options.strokeWidth, options.opacity]
    );

    const layerStyle = getLayerStyle(options, sceneDomain);

    return (
        <svg
            className={options.foreground ? "foregroundLayer" : "backgroundLayer"}
            xmlns={"http://www.w3.org/2000/svg"}
            viewBox={`${sceneDomain.left} ${sceneDomain.top} ${sceneDomain.width} ${sceneDomain.height}`}
            preserveAspectRatio={"none"}
            style={layerStyle}
        >
            {polygons}
        </svg>
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
                        zoom_scaling = (x: number) => Math.pow(props.pixelSize, -0.5) * x;
                        break;
                    case "view_log":
                        zoom_scaling = (x: number) => Math.log(1 / props.pixelSize) * x;
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

                const transform = `translate(${x + 0.5}, ${y + 0.5}) rotate(${angle * 180 / Math.PI})`;

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