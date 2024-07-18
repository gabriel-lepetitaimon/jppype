import {
  CSSProperties,
} from "react";
import {  LayerOptions } from "../../ipywidgets/JView2D";
import { CMapRGBA } from "../../utils/color";
import { Rect } from "../../utils/point";


export function getLayerStyle(
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
    zIndex: options.z_index,
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

export function drawLabels(
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
