import { LayerData, LayerOptions } from '../ipywidgets/JView2D';
import {Rect} from "../utils/point";
import {useEffect, useRef} from "react";
import {hexToRGBA} from "../utils/color";

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
              smooth={pixelSize < 10}
              key={name}
            />);
        break;
      case 'label':
        layers.push(
            <LabelLayer
              data={data}  options={opt}
              sceneDomain={props.sceneDomain}
              key={name}
              smooth={pixelSize < 10}
            />);
        break;
    }
  }

  return <>{layers}</>;
}


function ImageLayer(props: { data: LayerData; options: LayerOptions; sceneDomain: Rect, smooth: boolean }) {
  const { data, options, sceneDomain } = props;
  const { opacity } = options;

  return (
    <img
      src={data.data}
      alt={options.label}
      style={{
        opacity: opacity,
        imageRendering: props.smooth ? 'auto' : 'pixelated',
        ...positionStyle(options.domain, sceneDomain),
      }}
    />
  );
}

function LabelLayer(props: { data: LayerData; options: LayerOptions; sceneDomain: Rect, smooth: boolean}) {
  const { data, options, sceneDomain } = props;
  const { opacity } = options;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas == null) return;
      const ctx = canvas.getContext("2d");
      if (ctx == null) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const defaultColors = options.cmap[0] || ['#0000'];
        const colorMap = Object.fromEntries((data.infos.labels as number[]).map(l => {
          let color;
          if (l in options.cmap) {
            color = hexToRGBA(options.cmap[l]);
          } else {
            color = hexToRGBA(defaultColors[(l-1) % defaultColors.length]);
          }
          return [l, color];
        }));

        for (let i = 0; i < imageData.data.length; i += 4) {
          const v = imageData.data[i]
              | (imageData.data[i + 1] << 8)
              | (imageData.data[i + 2] << 16)
              | ((255 - imageData.data[i + 3]) << 24);

          if (v == 0) {
            imageData.data[i+3] = 0;
            continue;
          }

          const color = colorMap[v];

          imageData.data[i] = color[0];
          imageData.data[i + 1] = color[1];
          imageData.data[i + 2] = color[2];
          imageData.data[i + 3] = color[3];
        }
        ctx.putImageData(imageData, 0, 0);
      }
      img.src = data.data;
    }, [data.data, options.cmap])

    return (
        <canvas
          ref={canvasRef}
          style={{
            opacity: opacity,
            imageRendering: props.smooth ? 'crisp-edges' : 'pixelated',
            ...positionStyle(options.domain, sceneDomain),
          }}
      />);
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
