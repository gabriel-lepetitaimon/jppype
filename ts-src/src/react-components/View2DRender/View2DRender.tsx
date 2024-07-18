import { LayerData, LayerOptions } from "../../ipywidgets/JView2D";
import { Rect } from "../../utils/point";
import { GraphLayer, QuiverLayer, SvgPolygonsLayer } from "./d3_layers";
import { ImageLayer, LabelLayer } from "./images_layers";

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

    const layerArgs = {
      data,
      options: opt,
      sceneDomain: props.sceneDomain,
      pixelSize,
      key: name,
    };

    switch (data.type) {
      case "image":
        layers.push(<ImageLayer {...layerArgs} />);
        break;
      case "label":
        layers.push(<LabelLayer {...layerArgs} />);
        break;
      case "graph":
        layers.push(<GraphLayer {...layerArgs} />);
        break;
      case "polygons":
        layers.push(<SvgPolygonsLayer {...layerArgs} />);
        break;
      case "quiver":
        layers.push(<QuiverLayer {...layerArgs} />);
        break;
    }
  }

  return <>{layers}</>;
}
