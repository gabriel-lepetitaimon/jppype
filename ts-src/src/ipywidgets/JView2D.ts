import { DOMWidgetModel, ISerializers } from "@jupyter-widgets/base";
import { createElement } from "react";
import { render } from "react-dom";
import ImageViewerWidget from "../react-widgets/View2D";
import { Point, Rect } from "../utils/point";
import { SceneMouseEvent, Transform } from "../utils/zoom-pan-handler";
import { JBaseWidget, JModel, createUseModelState } from "./jbasewidget";
import { rect_serializer, transform_serializer } from "./serializers";

/**************************************************************************
 *              --- WIDGET ---
 **************************************************************************/

export class JView2D extends JBaseWidget {
  protected renderJWidget(el: HTMLElement): void {
    el.classList.add("custom-widget");
    el.classList.add("maximizing-widget");
    el.tabIndex = 0; // to be able to focus

    if (this.model === undefined) return;

    const castEvent = (ev: SceneMouseEvent) => {
      const modifiers: string[] = [];
      if (ev.altKey) modifiers.push("alt");
      if (ev.metaKey) modifiers.push("meta");
      if (ev.ctrlKey) modifiers.push("ctrl");
      if (ev.shiftKey) modifiers.push("shift");

      return {
        x: ev.cursor.x,
        y: ev.cursor.y,
        modifiers: modifiers,
        button: ev.button,
      };
    };

    const component = createElement(ImageViewerWidget, {
      model: this.model as JView2DModel,
      events: {
        onClick: (ev) => {
          this.send_event("onclick", castEvent(ev));
        },
        onMouseEnter: (ev) => {
          this.setActive(true);
          this.send_event("onmouseenter", castEvent(ev));
        },
        onMouseLeave: (ev) => {
          this.setActive(false);
          this.send_event("onmouseleave", castEvent(ev));
        },
        withMouseDownOrClick: () => {
          el.focus();
        },
      },
    });
    render(component, el);
  }

  static {
    JView2D.addCommand("jview2d:toggle-foreground", {
      execute: (widget) => {
        console.log("toggle-foreground");
        widget.model.set("_hide_foreground", !widget.model.get("_hide_foreground"));
        widget.model.save_changes();
      },
      shortcut: ["v"],
      label: "Toggle Foreground Layers",
      isGlobal: false,
    });
  }
}

/**************************************************************************
 *              --- MODEL ---
 **************************************************************************/

const defaultState = {
  _instance_id: 0,
  _loading: false,
  _layers_data: {},
  _layers_options: {},
  _hide_foreground: false,
  _domain: Rect.EMPTY,
  _area_selected: null,
  _transform: { center: Point.ORIGIN, zoom: 0 } as Transform,
  _target_transform: { center: Point.ORIGIN, zoom: 0 } as Transform,
  _left_ruler: true,
  _top_ruler: true,
  linkedTransform: null,
};

export type JView2DState = {
  _instance_id: number;
  _loading: boolean;
  _layers_data: { [name: string]: LayerData };
  _layers_options: { [name: string]: LayerOptions };
  _hide_foreground: boolean;
  _domain: Rect;
  _area_selected: Rect | null;
  _transform: Transform;
  _target_transform: Transform;
  _left_ruler : boolean;
  _top_ruler : boolean;
  linkedTransformGroup: string | null;
};

export const layers_data_serializer = {
  deserialize: (value: { [name: string]: DataView }): { [name: string]: LayerData } => {
    const decoder = new TextDecoder("ascii");
    const r: { [name: string]: LayerData } = {};
    for (const name in value) {
      r[name] = JSON.parse(decoder.decode(value[name]));
    }
    return r;
  },
};

export const layers_options_serializer = {
  deserialize: (value: { [name: string]: string }): { [name: string]: LayerOptions } => {
    const r: { [name: string]: LayerOptions } = {};
    for (const name in value) {
      const json = JSON.parse(value[name]);
      r[name] = {
        ...json,
        domain: Rect.fromTuple(json["domain"]),
      };
    }
    return r;
  },
};

export class JView2DModel extends JModel {
  protected view_name = "JView2D";
  protected model_name = "JView2DModel";

  get defaultState(): any {
    return defaultState;
  }

  get layers_data(): { [name: string]: LayerData } {
    return this.get("_layers_data");
  }

  get linkedTransformGroup(): string | null {
    return this.get("linkedTransformGroup");
  }

  get layers_options(): { [name: string]: LayerOptions } {
    return this.get("_layers_options");
  }

  get domain(): Rect {
    return this.get("_domain");
  }

  get areaSelected(): Rect | null {
    return this.get("_area_selected");
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    _layers_data: layers_data_serializer,
    _layers_options: layers_options_serializer,
    _domain: rect_serializer(false),
    _area_selected: rect_serializer(true),
    _transform: transform_serializer,
    _target_transform: transform_serializer,
  };

  static use = createUseModelState<JView2DState>();
}

export interface LayerData {
  type: string;
  data: any;
  infos: { [key: string]: any };
}

export interface LayerOptions {
  visible: boolean;
  foreground: boolean;
  opacity: number;
  blend_mode: string;
  z_index: number;
  label: string;
  auto_scale_domain: boolean;
  domain: Rect;

  [key: string]: any;
}
