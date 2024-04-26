from __future__ import annotations

import abc
from copy import copy
from typing import (
    Callable,
    Dict,
    Iterable,
    Literal,
    Mapping,
    Protocol,
    Tuple,
    Type,
    TypeGuard,
    get_args,
)
from uuid import uuid4

from ..utilities.func import call_matching_params
from ..utilities.geometric import FitMode, Rect, Transform


# ======================================================================================================================
#   Utility class used by Layer and LayersList
# ======================================================================================================================
class LayerData:
    def __init__(self, data: any, infos: dict = None, type: str = None):
        self.data = data
        self.type = type
        self.infos = infos

    def to_json_bytes(self) -> bytes:
        import json

        return json.dumps(
            dict(data=self.data, type=self.type, infos=self.infos),
            indent=None,
            separators=(",", ":"),
            ensure_ascii=True,
        ).encode("ascii")


class LayerDataChangeDispatcher(Protocol):
    def __call__(self, layer: Layer):
        ...


class LayerOptionsChangeDispatcher(Protocol):
    def __call__(self, layer: Layer, options: Dict[str, any]):
        ...


class DispatcherUnbind:
    def __init__(self, dispatchers_dict, uuid):
        self._dispatchers_dict = dispatchers_dict
        self._uuid = uuid

    def __call__(self):
        try:
            del self._dispatchers_dict[self._uuid]
        except KeyError:
            pass


class LayerSelector(Protocol):
    def __call__(self, name: str, layer: Layer) -> bool:
        ...


class ContextLock:
    def __init__(self, final_callback: Callable[[dict[str, set]], None]):
        self._locked = False
        self._flags: dict[str, set] = {}
        self._final_callback = final_callback
        self._enter_count = 0

    def __enter__(self):
        self._locked = True
        self._enter_count += 1

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._enter_count -= 1

        if self._enter_count == 0:
            self._final_callback(self._flags)
            self._flags.clear()
            self._locked = False

    def add(self, flag: str, data=None):
        if self._locked:
            if flag not in self._flags:
                self._flags[flag] = set()
            if data is not None:
                self._flags[flag].add(data)
        return self

    def __contains__(self, item: str):
        return item in self._flags

    @property
    def flags(self) -> dict[str, set]:
        return self._flags

    def __bool__(self):
        return self._locked

    @property
    def locked(self) -> bool:
        return self._locked


LayerDomain = Rect | FitMode
DomainMode = Literal["manual"] | FitMode


def is_domain(value: any) -> TypeGuard[LayerDomain]:
    return isinstance(value, (Rect, str)) or value in FitMode


# ======================================================================================================================
#   Layer base class
# ======================================================================================================================


BlendMode = Literal[
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color_dodge",
    "color_burn",
    "hard_light",
    "soft_light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
]


class Layer(abc.ABC):
    def __init__(self, layer_type: str):
        self._options = {
            "visible": True,
            "opacity": 1.0,
            "z_index": -1,
            "foreground": False,
            "label": "",
            "auto_scale_domain": True,
            "domain": Rect.empty(),
        }
        self._layer_type = layer_type
        self._on_data_change: Dict[str, LayerDataChangeDispatcher] = {}
        self._on_options_change: Dict[str, LayerOptionsChangeDispatcher] = {}
        self._main_domain = Rect.empty()
        self._domain_mode: DomainMode | None = None
        self._uuid = uuid4()

    def duplicate(self):
        layer = copy(self)
        layer._uuid = uuid4()
        return layer

    # --- Base properties ---
    @property
    def uuid(self) -> str:
        return self._uuid.hex

    def __hash__(self):
        return hash(self._uuid)

    def __eq__(self, other):
        return isinstance(other, Layer) and self._uuid == other._uuid

    @property
    def layer_type(self) -> str:
        return self._layer_type

    @property
    def options(self) -> Mapping[str, any]:
        return self._options

    @property
    def shape(self) -> Tuple[int, int]:
        return self._shape()

    # --- Options properties ---
    def set_options(self, options: Dict[str, any], raise_on_error: bool = True):
        for k, v in options.items():
            match k:
                case "visible":
                    if not isinstance(v, bool):
                        if raise_on_error:
                            raise ValueError(f"visible must be a bool, got {v}")
                        else:
                            continue
                    self._options["visible"] = v

                case "opacity":
                    if not isinstance(v, (int, float)):
                        try:
                            v = float(v)
                        except ValueError:
                            if raise_on_error:
                                raise ValueError(f"opacity must be a number between 0 and 1, got {v}") from None
                            else:
                                continue
                    if not 0 <= v <= 1:
                        if raise_on_error:
                            raise ValueError(f"opacity must be a number between 0 and 1, got {v}")
                        else:
                            continue
                    self._options["opacity"] = v

                case "blend_mode":
                    if v not in get_args(BlendMode):
                        if raise_on_error:
                            raise ValueError(f"blend_mode must be one of {BlendMode}, got {v}")
                        else:
                            continue
                    self._options["blend_mode"] = v

                case "label":
                    if not isinstance(v, str):
                        if raise_on_error:
                            raise ValueError(f"label must be a string, got {v}")
                        else:
                            continue
                    self._options["label"] = v

                case "z_index":
                    if not isinstance(v, (int, float)):
                        try:
                            v = float(v)
                        except ValueError:
                            if raise_on_error:
                                raise ValueError(f"z_index must be a number, got {v}") from None
                            else:
                                continue
                    self._options["z_index"] = v
                case "domain":
                    if (
                        not isinstance(v, (tuple, list))
                        or len(v) != 4
                        or not all(isinstance(x, (int, float)) for x in v)
                    ):
                        if raise_on_error:
                            raise (ValueError(f"domain must be a tuple or list of 4 numbers, got {v}"))
                        else:
                            continue
                    self._options["domain"] = tuple(v)
                case "foreground":
                    if not isinstance(v, bool):
                        if raise_on_error:
                            raise ValueError(f"foreground must be a bool, got {v}")
                        else:
                            continue
                    self._options["foreground"] = v
        self._notify_options_change({k: self._options[k] for k in options.keys() if k in self._options})

    @property
    def visible(self) -> bool:
        return self._options["visible"]

    @visible.setter
    def visible(self, value: bool):
        self.set_options({"visible": value})

    @property
    def opacity(self) -> float:
        return self._options["opacity"]

    @opacity.setter
    def opacity(self, value: float):
        self.set_options({"opacity": value})

    @property
    def blend_mode(self) -> BlendMode:
        return self._options["blend_mode"]

    @blend_mode.setter
    def blend_mode(self, value: BlendMode):
        self.set_options({"blend_mode": value})

    @property
    def label(self) -> str:
        return self._options["label"]

    @label.setter
    def label(self, value: str):
        self.set_options({"label": value})

    @property
    def z_index(self) -> float:
        return self._options["z_index"]

    @z_index.setter
    def z_index(self, value: float):
        self.set_options({"z_index": value})

    @property
    def foreground(self) -> bool:
        return self._options["foreground"]

    @foreground.setter
    def foreground(self, value: bool):
        self.set_options({"foreground": value})

    @property
    def domain(self) -> Rect:
        return Rect(*self._options["domain"])

    @domain.setter
    def domain(self, value: LayerDomain | None):
        shape = Rect.from_size(self.shape)
        match value:
            case value if value is None or Rect.is_empty(value):
                if not Rect.is_empty(shape):
                    value = Rect.from_size(self.shape).fit(self._main_domain, FitMode.WIDTH)
                    self._domain_mode = "manual"
            case v if v in FitMode:
                if not Rect.is_empty(shape):
                    value = Rect.from_size(self.shape).fit(self._main_domain, value)
                    self._domain_mode = value
            case _:
                value = Rect(*value)
        self.set_options({"domain": value})

    @property
    def domain_mode(self) -> FitMode | None:
        return self._domain_mode

    @domain_mode.setter
    def domain_mode(self, value: FitMode):
        raise AttributeError("domain_mode is read-only, use domain setter instead.")

    def set_main_shape(self, main_domain: Rect, transform_domain: Transform | LayerDomain | None = None):
        previous_domain = self._main_domain
        self._main_domain = main_domain

        match self.domain_mode:
            case "manual" | None:
                match transform_domain:
                    case None:
                        if main_domain is not None:
                            transform_domain = Transform.from_rects(previous_domain, main_domain)
                            self.domain = transform_domain(self.domain)
                    case Transform():
                        self.domain = transform_domain(self.domain)
                    case transform_domain if is_domain(transform_domain):
                        self.domain = transform_domain
            case v if v in FitMode:
                self.domain = self.domain_mode

    # --- Fetch data methods ---
    def get_data(self, **kwargs) -> LayerData:
        r = call_matching_params(self._fetch_data, kwargs)
        if isinstance(r, bytes):
            r = LayerData(r)
        if isinstance(r, LayerData):
            if r.type is None:
                r.type = self._layer_type
            return r
        raise TypeError(f"Invalid return type {type(r)}")

    def fetch_item(self, **kwargs) -> dict:
        return call_matching_params(self._fetch_item, kwargs)

    def fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str | str]:
        kwargs["rect"] = rect
        return call_matching_params(self._fetch_graphs, kwargs)

    # --- Abstract methods ---
    @abc.abstractmethod
    def _fetch_data(self, **kwargs) -> LayerData:
        ...

    @abc.abstractmethod
    def update_data(self, data: any):
        ...

    @abc.abstractmethod
    def _fetch_item(self, **kwargs) -> Mapping[str, any]:
        ...

    @abc.abstractmethod
    def _fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str, any]:
        ...

    @abc.abstractmethod
    def _shape(self) -> Tuple[int, int]:
        ...

    # --- Communication method ---
    def _notify_data_change(self):
        for callback in self._on_data_change.values():
            callback(self)

    def on_data_change(self, callback: LayerDataChangeDispatcher):
        uuid = uuid4().hex
        while uuid in self._on_data_change:
            uuid = uuid4().hex
        self._on_data_change[uuid] = callback
        return DispatcherUnbind(self._on_data_change, uuid)

    def _notify_options_change(self, options_changed: Dict[str, any]):
        for callback in self._on_options_change.values():
            callback(self, options_changed)

    def on_options_change(self, callback: LayerOptionsChangeDispatcher):
        uuid = uuid4().hex
        while uuid in self._on_options_change:
            uuid = uuid4().hex
        self._on_options_change[uuid] = callback
        return DispatcherUnbind(self._on_options_change, uuid)

    def _ipython_display_(self):
        from ..view2d import View2D  # noqa: I001
        from IPython.core.display import display

        return display(View2D(self))


# ======================================================================================================================
#   Layer base class list
# ======================================================================================================================
class LayersList(metaclass=abc.ABCMeta):
    _layers: dict[str, Layer]
    _layers_alias: dict[str, str]
    _layers_binding: dict[str, list[DispatcherUnbind]]
    _main_layer: str | None

    def __init__(self):
        super(LayersList, self).__init__()
        self._layers = {}
        self._layers_alias = {}
        self._layers_binding = {}
        self._update_lock = ContextLock(self.__release_update_lock)
        self._main_layer = None

    # --- Public methods to add, manipulate and remove layers ---
    def add_layer(self, layer: Layer, alias: str | None = None, domain: LayerDomain | None = None):
        """
        Add a layer to the list, placing it on top of the other (if no z_index is specified).
        If the layer is already in the list, it will be duplicated.
        If the alias is already in the list, the old layer will be removed.
        If the domain is not specified, the layer will be fitted to the main layer domain.

        :param layer: The layer to add.
        :param alias: The alias to use for the layer.
        :param domain: The domain to use for the layer. Can be a Rect or a fit indication:
            'fit_width', 'fit_height', 'fit_inner', 'fit_outer'. (By default: 'fit_width')

        """
        main_layer = False
        if alias is None:
            for i in range(1, len(self._layers) + 2):
                alias = f"{layer.layer_type.title()} {i:02d}"
                if alias not in self._layers_alias:
                    break
        elif alias in self:
            main_layer = self[alias].uuid == self._main_layer
            self.remove_layer(alias)

        if layer.label is None:
            layer.label = alias

        if layer.uuid in self._layers:
            layer = layer.duplicate()

        if layer.z_index == -1:
            layer.z_index = max([layer.z_index for layer in self] + [0]) + 1

        if domain is None:
            domain = layer.domain if layer.domain_mode == "manual" else layer.domain_mode

        if self._main_layer is None:
            # If no main layer is set, the first layer added will be the main layer
            if not Rect.is_rect(domain):
                domain = Rect.from_size(layer.shape)
            layer.domain = domain
            main_layer = True
        else:
            layer.set_main_shape(self.main_layer.domain, FitMode.WIDTH if domain is None else domain)

        self._layers[layer.uuid] = layer
        self._layers_alias[alias] = layer.uuid
        self._bind_layer(layer)
        self._send_new_layers([layer])

        if main_layer:
            self.main_layer = layer

    def remove_layer(self, layer: str | Layer | int):
        layer = self._item_to_layer(layer)
        if layer.uuid == self._main_layer:
            self.main_layer = next((layer for layer in self if layer.uuid != self._main_layer), None)

        self._send_delete_layers([layer])
        self._unbind_layer(layer)
        del self._layers_alias[self.get_layers_alias(layer)]
        del self._layers[layer.uuid]

    def update_all_options(self, options, layer_selector: str | Iterable[str | Layer] | LayerSelector | None):
        layers = self.get_layers(layer_selector)
        with self._update_lock:
            for layer in layers:
                layer.set_options(options)

    def update_options(self, layers_options: Mapping[str | Layer, Mapping[str, any]]):
        layers_options = {self[k] if isinstance(k, str) else k: v for k, v in layers_options.items()}
        with self._update_lock:
            if self.main_layer in layers_options and "domain" in layers_options[self.main_layer]:
                self._update_main_layer_domain()
            for layer, opt in layers_options.items():
                layer.set_options(opt)
        # self._send_update_layers_options(layers_options)

    def update_all_data(self, data: any, layer_selector: str | Iterable[str] | LayerSelector | None):
        layers = self.get_layers(layer_selector)
        with self._update_lock:
            for layer in layers:
                layer.update_data(data)

    def update_data(self, data: Mapping[str | Layer, any]):
        data = {self[k] if isinstance(k, str) else k: v for k, v in data.items()}
        with self._update_lock:
            for layer, d in data.items():
                layer.update_data(d)

    # --- Accessors for layers and aliases ---
    @property
    def layers(self) -> dict[str, Layer]:
        return {alias: self._layers[uuid] for alias, uuid in self._layers_alias.items()}

    @property
    def layers_alias(self) -> tuple[str]:
        return tuple(self._layers_alias.keys())

    @property
    def main_layer(self) -> Layer | None:
        return self._layers[self._main_layer] if self._main_layer is not None else None

    @main_layer.setter
    def main_layer(self, main_layer: str | Layer | None):
        if main_layer is None:
            self._main_layer = None
        else:
            main_layer = self._item_to_layer(main_layer)
            new_domain = main_layer.domain

            if self._main_layer is not None:
                previous_domain = self.main_layer.domain
                transform = Transform.from_rects(previous_domain, new_domain)
            else:
                transform = None

            self._main_layer = main_layer.uuid
            self._update_main_layer_domain(transform)

    def _update_main_layer_domain(self, transform: Transform | None = None):
        with self._update_lock:
            new_domain = self.main_layer.domain
            for layer in self:
                if layer.uuid != self._main_layer:
                    layer.set_main_shape(new_domain, transform)

    def get_layers(
        self,
        layers_selector: str | Layer | Iterable[str | Layer] | LayerSelector | None,
        only_visible=False,
        sort_zindex=False,
        layer_type: Type[Layer] | str | Iterable[Type[Layer] | str] | None = None,
    ) -> list[Layer]:
        match layers_selector:
            case None:
                layers = self._layers.values()
            case str():
                try:
                    layers = [self[layers_selector]]
                except KeyError:
                    raise ValueError(f"Unknown layer {layers_selector}") from None
            case Layer():
                if layers_selector not in self:
                    raise ValueError("The provided layer is not in the list.")
                layers = [layers_selector]
            case LayerSelector():
                layers = [layer for name, layer in self.items() if layers_selector(name, layer)]
            case _:  # Iterable[str | Layer]
                layers = [self[layer] for layer in layers_selector]

        if only_visible:
            layers = [layer for layer in layers if layer.visible]
        if layer_type is not None:
            if not isinstance(layer_type, tuple):
                layer_type = (layer_type,)
            layers = [
                layer
                for layer in layers
                if any(
                    layer.layer_type == l_type if isinstance(l_type, str) else isinstance(layer, l_type)
                    for l_type in layer_type
                )
            ]
        if sort_zindex:
            layers.sort(key=lambda layer: layer.z_index)
        return layers

    def get_layers_alias(
        self,
        layers: Layer | Iterable[Layer] | None = None,
        sort_zindex=False,
        only_visible=False,
        by_type: Type[Layer] | str | Iterable[Type[Layer] | str] | None = None,
    ) -> str | list[str]:
        single_layer = isinstance(layers, Layer)
        layers = self.get_layers(layers, sort_zindex=sort_zindex, only_visible=only_visible, layer_type=by_type)

        layers_alias = []
        for layer in layers:
            for alias, uuid in self._layers_alias.items():
                if uuid == layer.uuid:
                    layers_alias.append(alias)
                    break
            else:
                layers_alias.append(None)
        return layers_alias[0] if single_layer else layers_alias

    def layers_domain(self) -> Rect:
        domain = Rect.empty()
        for layer in self:
            domain = domain | Rect.from_size(layer.shape) if layer.domain == "auto" else layer.domain
        return domain

    # --- Item and Iterables accessors ---
    def __len__(self):
        return len(self._layers)

    def __iter__(self):
        return self._layers.values().__iter__()

    def __contains__(self, item: str | Layer):
        match item:
            case str():
                return item in self._layers_alias
            case Layer():
                return item.uuid in self._layers

    def __getitem__(self, key: int | str) -> Layer:
        return self._item_to_layer(key)

    def __setitem__(self, key: str, value: Layer | any):
        if isinstance(value, Layer):
            self.add_layer(value, key)
        else:
            self[key].update_data(value)

    def __delitem__(self, key: int | str):
        self.remove_layer(key)

    def aliases(self):
        return self._layers_alias.keys()

    def values(self):
        return self._layers.values()

    def items(self):
        return zip(self._layers_alias.keys(), self._layers.values(), strict=True)

    # --- Private methods for layer handling ---
    def _item_to_layer(self, item: int | str | Layer) -> Layer:
        if isinstance(item, (int, slice)):
            layers = list(self._layers.values())
            return layers[item]
        elif isinstance(item, str):
            if item not in self._layers_alias:
                raise KeyError(f"No layer named {item}.")
            return self._layers[self._layers_alias[item]]
        elif isinstance(item, Layer):
            if item not in self:
                raise KeyError("This layer is not part of the list.")
            return item

    # --- Private methods for communication ---
    def _bind_layer(self, layer: Layer):
        # Bind options events
        self._layers_binding[layer.uuid] = [
            layer.on_data_change(self.__update_layer_data),
            layer.on_options_change(self.__update_layer_options),
        ]

    def _unbind_layer(self, layer: Layer):
        for unbind in self._layers_binding.get(layer.uuid, ()):
            unbind()

    def __update_layer_data(self, layer: Layer):
        if not self._update_lock:
            self._send_update_layers_data([layer])
        else:
            self._update_lock.add("data", layer)

    def __update_layer_options(self, layer: Layer, options: Mapping[str, any]):
        if not self._update_lock:
            self._send_update_layers_options({layer: options})
        else:
            self._update_lock.add("options", layer)

    def __release_update_lock(self, updated: dict[str, set]):
        if "data" in updated:
            self._send_update_layers_data(updated["data"])
        elif "options" in self._update_lock:
            self._send_update_layers_options({layer: layer.options for layer in updated["options"]})

    # --- Abstract methods for communication ---
    @abc.abstractmethod
    def _send_new_layers(self, layers: Iterable[Layer]):
        ...

    @abc.abstractmethod
    def _send_delete_layers(self, layers: Iterable[Layer]):
        ...

    @abc.abstractmethod
    def _send_update_layers_data(self, layers: Iterable[Layer]):
        ...

    @abc.abstractmethod
    def _send_update_layers_options(self, layers_options: Mapping[Layer, Mapping[str, any]]):
        ...
