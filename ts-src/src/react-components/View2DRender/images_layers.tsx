import {
    useEffect,
    useMemo,
    useRef,
} from "react";
import { LayerData, LayerOptions } from "../../ipywidgets/JView2D";
import { cmap2RGBAlookup } from "../../utils/color";
import { Rect } from "../../utils/point";
import { drawLabels, getLayerStyle } from "./layers_utils";


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