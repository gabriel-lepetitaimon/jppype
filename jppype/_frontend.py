#!/usr/bin/env python
# coding: utf-8
# Copyright (c) Gabriel Lepetit-Aimon.
# Distributed under the terms of the Modified BSD License.
from __future__ import annotations

import abc
from ._version import NPM_PACKAGE_RANGE

from ipywidgets import DOMWidget
import traitlets
from traitlets import Unicode, Int

"""
Information about the frontend package of the ipywidgets.
"""
module_name = "jppype"
module_version = "0.1.0"


class BaseI3PWidget(DOMWidget):
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _model_name = Unicode(f'MODEL_NAME').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode(f'VIEW_NAME').tag(sync=True)
    _instance_id = Int(0).tag(sync=True)

    __last_instance_id = 0

    def __init__(self):
        self._instance_id = BaseI3PWidget.__last_instance_id
        BaseI3PWidget.__last_instance_id += 1
        super(BaseI3PWidget, self).__init__()
        self.on_msg(self._on_custom_msg_received)

    def _on_custom_msg_received(self, widget, content, buffer):
        if content.get('event', None) and isinstance(content.get('data', None), dict):
            self.on_events(content['event'], content['data'])

    def on_events(self, event, data):
        pass


class ABCHasTraitMeta(abc.ABCMeta, traitlets.MetaHasTraits):
    pass
