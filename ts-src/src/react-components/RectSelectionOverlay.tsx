import { Rect } from "../utils/point";


interface RectSelectionOverlayProps {
    sceneDomain: Rect;
    selection: Rect | null;
    borderColor?: string;
    shadowOpacity?: number;
}

export default function RectSelectionOverlay(props: RectSelectionOverlayProps) {
    if (!props.selection) {
        return null;
    }

    const selectionRect = props.selection.relativeTo(props.sceneDomain);
    const o = props.shadowOpacity ?? 0;
    return <>
        <OutOfSelectionShadow opacity={o} rect={Rect.fromXY(0,1, 0, selectionRect.top)} />
        <OutOfSelectionShadow opacity={o} rect={Rect.fromXY(0, selectionRect.left, selectionRect.top, selectionRect.bottom)} />
        <OutOfSelectionShadow opacity={o} rect={Rect.fromXY(selectionRect.right, 1, selectionRect.top, selectionRect.bottom)} />
        <OutOfSelectionShadow opacity={o} rect={Rect.fromXY(0,1, selectionRect.bottom, 1)} />
        <SelectionBorder rect={selectionRect} color={props.borderColor} />
    </>;
}

function SelectionBorder(props: {rect: Rect, color?: string}) {
    const style = {
        ...rectPosition(props.rect),
        border: "1px solid",
        borderColor: props.color ?? "var(--jppype-dim-foreground-color)",
        pointerEvents: "none" as const,
    };
    return <div style={style} />;
}

function OutOfSelectionShadow(props: {rect: Rect, opacity: number}) {
    const style = {
        ...rectPosition(props.rect),
        backgroundColor: "var(--jppype-shadow-color)",
        opacity: props.opacity,
        pointerEvents: "none" as const,
    };
    return <div style={style} />;
}

function rectPosition(rect: Rect) {
    return {
        position: "absolute" as const,
        top: `${rect.top * 100}%`,
        left: `${rect.left * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
    };
}