import { DOMWidgetModel, ISerializers } from '@jupyter-widgets/base';
import React from 'react';
import ImageViewerWidget from '../react-widgets/ImageViewer';
import ReactDOM from 'react-dom';
import {JBaseWidget, createUseModelState, JModel} from './jbasewidget';
import { rect_serializer, transform_serializer } from './serializers';
import { Transform } from '../utils/zoom-pan-handler';
import { Point, Rect } from '../utils/point';

/**************************************************************************
 *              --- WIDGET ---
 **************************************************************************/

export class JView2D extends JBaseWidget {
  render(): void {
    this.el.classList.add('custom-widget');
    this.el.classList.add('maximizing-widget');

    if (this.model === undefined)
      return;

    const component = React.createElement(ImageViewerWidget, {
      model: this.model as JView2DModel,
      events: {
        onClick: (ev) => {
          this.send_event('onclick', {
            x: ev.cursor.x,
            y: ev.cursor.y,
            altKey: ev.altKey,
            metaKey: ev.metaKey,
            ctrlKey: ev.ctrlKey,
            shiftKey: ev.shiftKey,
            button: ev.button,
          });
        },
      },
    });
    ReactDOM.render(component, this.el);
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
  _domain: Rect.EMPTY,
  _transform: { center: Point.ORIGIN, zoom: 0 } as Transform,
  _target_transform: { center: Point.ORIGIN, zoom: 0 } as Transform,
  linkedTransform: null,
};

export type JView2DState = {
  _instance_id: number;
  _loading: boolean;
  _layers_data: { [name: string]: LayerData };
  _layers_options: { [name: string]: LayerOptions };
  _domain: Rect;
  _transform: Transform;
  _target_transform: Transform;
  linkedTransformGroup: string | null;
};

export const layers_data_serializer = {
  deserialize: (value: {
    [name: string]: DataView;
  }): { [name: string]: LayerData } => {
    const decoder = new TextDecoder('ascii');
    const r: { [name: string]: LayerData } = {};
    for (const name in value) {
      r[name] = JSON.parse(decoder.decode(value[name]));
    }
    return r;
  },
};

export const layers_options_serializer = {
  deserialize: (value: {
    [name: string]: string;
  }): { [name: string]: LayerOptions } => {
    const r: { [name: string]: LayerOptions } = {};
    for (const name in value) {
      const json = JSON.parse(value[name]);
      r[name] = { ...json,
                  domain: Rect.fromTuple(json['domain'])
      };
    }
    return r;
  },
};

export class JView2DModel extends JModel {
  protected view_name = 'JView2D';
  protected model_name = 'JView2DModel';

  get defaultState(): any {
    return defaultState;
  }

  get layers_data(): {[name: string]: LayerData } {
    return this.get('_layers_data');
  }

  get linkedTransformGroup(): string | null {
    return this.get('linkedTransformGroup');
  }

  get layers_options(): {[name: string]: LayerOptions } {
    return this.get('_layers_options');
  }

  get domain(): Rect {
    return this.get('_domain');
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    _layers_data: layers_data_serializer,
    _layers_options: layers_options_serializer,
    _domain: rect_serializer,
    _transform: transform_serializer,
    _target_transform: transform_serializer,
  };

  static use = createUseModelState<JView2DState>();
}

export interface LayerData {
  type: string;
  data: any;
  infos: {[key: string]: any};
}

export interface LayerOptions {
  visible: boolean;
  opacity: number;
  z_index: number;
  label: string;
  auto_scale_domain: boolean;
  domain: Rect;

  [key: string]: any;
}
