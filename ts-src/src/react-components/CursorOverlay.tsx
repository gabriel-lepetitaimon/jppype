import { CSSProperties } from "react";
import { Point, Rect } from "../utils/point";
import { ZoomTransform } from "../utils/zoom-pan-handler";


interface CursorOverlayProps {
    sceneDomain: Rect;
    cursorPos: Point | null;
    transform: ZoomTransform;
}

export default function CursorOverlay(props: CursorOverlayProps) {
    const cursorPos = props.cursorPos ? props.transform.scene2view(props.cursorPos.add(.5)).subtract(1) : null;
    const svgStyle = {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
    } as CSSProperties;

    const cursor = cursorPos ? (<rect
        x={cursorPos.x}
        y={cursorPos.y}
        width={3}
        height={3}
        fill="white"
        stroke="grey"
        strokeWidth={1} />) : null;

    return <>
        <svg style={svgStyle}>
            {cursor}
        </svg>
    </>;
}
