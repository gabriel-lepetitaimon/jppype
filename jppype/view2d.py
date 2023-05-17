#!/usr/bin/env python
# coding: utf-8
from typing import Dict, Mapping, Literal, Tuple, Iterator

# Copyright (c) Gabriel Lepetit-Aimon.
# Distributed under the terms of the Modified BSD License.

import numpy as np
import json
import traitlets
from ._frontend import BaseI3PWidget, ABCHasTraitMeta
from .layers_2d import LayerLabel, LayerImage
from .layer_base import LayersList, Layer
from .utils import EventsDispatcher, FlagContext


class View2D(LayersList, BaseI3PWidget, metaclass=ABCHasTraitMeta):
    _layers_data = traitlets.Dict(key_trait=traitlets.Unicode(), value_trait=traitlets.Bytes()).tag(sync=True, )
    _layers_options = traitlets.Dict(key_trait=traitlets.Unicode(), value_trait=traitlets.Unicode()).tag(sync=True)
    _domain = traitlets.Tuple(trait=(int, int, int, int)).tag(sync=True)
    _transform = traitlets.Tuple((0, 0, 1e-8), trait=(float, float, float)).tag(sync=True)
    _target_transform = traitlets.Tuple((0, 0, 1e-8), trait=(float, float, float)).tag(sync=True)
    linkedTransformGroup = traitlets.Unicode(None, allow_none=True).tag(sync=True)

    _model_name = traitlets.Unicode('JView2DModel').tag(sync=True)
    _view_name = traitlets.Unicode('JView2D').tag(sync=True)
    _loading = traitlets.Bool(False).tag(sync=True)

    def __init__(self):
        super(View2D, self).__init__()
        self.on_click = EventsDispatcher()
        self._transmit = FlagContext(self.__set_transmitting)

    # --- Implementation of LayersList abstract methods---
    def _send_new_layers(self, layers: Iterator[Layer]):
        with self._transmit:
            self._send_update_layers_data(layers)
            self.__send_all_layers_options()

    def _send_delete_layers(self, layers: Iterator[Layer]):
        with self._transmit:
            self.__send_all_layers_options()
            for layer in layers:
                del self._layers_data[self.get_layers_alias(layer)]

    def _send_update_layers_options(self, options: Mapping[str, str]):
        with self._transmit:
            # Ignore diff because the whole dict is sent anyway
            self.__send_all_layers_options()

    def _send_update_layers_data(self, layers: Iterator[Layer]):
        current_data = self._layers_data.copy()
        for layer in layers:
            current_data[self.get_layers_alias(layer)] = layer.get_data().to_json_bytes()

        with self._transmit:
            self._layers_data = current_data

    def __send_all_layers_options(self):
        layers_options = {self.get_layers_alias(layer): json.dumps(layer.options, ensure_ascii=False).encode('utf8')
                          for layer in self}
        with self._transmit:
            self._layers_options = layers_options
            if self.main_layer:
                self._domain = self.main_layer.domain

    def __set_transmitting(self, value: bool):
        self._loading = value

    # --- Specialized methods to add layers ---
    def add_image(self, img, layer_name: str | None = None,
                  vmax: Literal['auto'] | float | None = 'auto', vmin: Literal['auto'] | float | None = 'auto',
                  resize_buffer: Tuple[int, int] | int | None = None) -> LayerImage:
        layer = LayerImage(img, vmax=vmax, vmin=vmin, resize_buffer=resize_buffer)
        self.add_layer(layer, alias=layer_name)
        return layer

    def add_label(self, label, layer_name: str | None = None,
                  colormap: str | None = None) -> LayerLabel:
        layer = LayerLabel(label, colormap=colormap)
        self.add_layer(layer, alias=layer_name)
        return layer

    # --- Events handling ---
    def on_events(self, event, data):
        match event:
            case 'onclick':
                self.on_click.dispatch(**data)

    def goto(self, pos, scale=None):
        if scale is None:
            scale = self._transform[-1]
        self._target_transform = (pos[0], pos[1], scale)

    @property
    def transform(self):
        return self._transform


def imshow(image, vmax=None, vmin=None):
    viewer = View2D()
    viewer.add_image(image, vmax=vmax, vmin=vmin)
    return viewer
