import base64
import os.path

import cv2
import numpy as np
import re
from typing import Tuple, Literal, Dict, List

from .layer_base import Layer, LayerData, LayerDomain
from .utilities.geometric import Rect, Transform


class LayerImage(Layer):
    def __init__(
        self,
        image,
        vmax: Literal["auto"] | float | None = "auto",
        vmin: Literal["auto"] | float | None = "auto",
        resize_buffer: Tuple[int, int] | int | None = None,
    ):
        super().__init__("image")
        self.buffer_size = resize_buffer
        self._image = None
        self.image = image

        self.vmin = vmin
        self.vmax = vmax

    # --- Properties ---
    @property
    def image(self):
        return self._image

    @image.setter
    def image(self, img):
        if isinstance(img, int | float | bool):
            img = np.empty(self.shape[:2], dtype=np.float).fill(img)
        else:
            img = LayerImage.cast_img_format(img, self.buffer_size)
        self._image = img
        self._notify_data_change()
        self._notify_options_change({"domain": self.shape})

    # --- Implementation of layer's abstract methods ---
    def _fetch_data(self, resize: tuple[int, int] | None = None) -> LayerData:
        img = self._image

        if self.vmax == "auto":
            vmax = np.max(img)
        else:
            vmax = self.vmax

        if self.vmin == "auto":
            vmin = np.min(img)
        else:
            vmin = self.vmin

        if self.vmin == "auto" and self.vmax == "auto":
            if vmin < 0 < vmax and 2 / 3 < -vmin / vmax < 3 / 2:
                vmax = max(-vmin, vmax)
                vmin = -vmax
            elif vmax <= 1 and vmin >= 0:
                vmax = 1
                vmin = 0
            elif vmax > 0 and abs(vmin) < vmax * 0.1:
                vmin = 0
            elif vmin < 0 and abs(vmax) < abs(vmin) * 0.1:
                vmax = 0

        elif self.vmax == "auto":
            if vmin < 0 and abs(vmax) < abs(vmin) * 0.1:
                vmax = 0
            elif vmax <= 1 and vmin >= 0:
                vmax = 1
        elif self.vmin == "auto":
            if vmax > 0 and abs(vmin) < vmax * 0.1:
                vmin = 0

        if vmin is not None:
            img = img - np.min(img)
            if vmax is not None:
                vmax = vmax - vmin
        if vmax is not None:
            img = img / vmax * 255.0

        h, w = img.shape[:2]
        if resize is not None:
            img = self.fit_resize(img, resize)

        return LayerData(self.encode_url(img, "jpg"), infos=dict(width=w, height=h))

    def _shape(self):
        return self._image.shape[:2] if self._image is not None else (0, 0)

    def _fetch_item(self, x: int, y: int) -> dict:
        return {"value": self.image[y, x]}

    def _fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str, any]:
        return {}

    def update_data(self, data: any):
        self.image = data

    # --- Utilities static methods ---
    @staticmethod
    def cast_img_format(img, resize=None) -> np.ndarray:
        """
        Cast image to numpy array with shape (H, W, C) or (H, W).

        Parameters
        ----------
        img: np.ndarray or torch.Tensor

        resize: tuple[int, int] or int or None

        Returns
        -------
        Casted image

        """
        if isinstance(img, str):
            if os.path.exists(img):
                img = cv2.imread(img)
            elif re.match(r"^https?://", img):
                from urllib.request import urlopen

                resp = urlopen(img)
                img = np.asarray(bytearray(resp.read()), dtype=np.uint8)
                img = cv2.imdecode(img, -1)
                if img is None:
                    raise ValueError(f"Invalid image url {img}.")
            else:
                raise ValueError(f"Invalid image path {img}.")
        elif type(img).__qualname__ == "Tensor":
            img = img.detach().cpu().numpy()

        if len(img.shape) == 3:
            if img.shape[0] in (1, 3) and img.shape[2] not in (1, 3):
                img = img.transpose((1, 2, 0))
            if img.shape[2] == 1:
                img = img[:, :, 0]
        elif len(img.shape) != 2:
            raise ValueError(f"Invalid image shape {img.shape}, must be (H, W, C) or (H, W).")

        if resize is not None:
            img = LayerImage.fit_resize(img, resize)

        return img

    @staticmethod
    def fit_resize(img: np.ndarray, size: Tuple[int, int] | int, interpolation=None) -> np.ndarray:
        if isinstance(size, int):
            size = (size, size)

        # Keep aspect ratio
        h, w = img.shape[:2]
        ratio = h / w
        mindim = min(size[0] * ratio, size[1])
        size = (round(mindim / ratio), round(mindim))

        # Select interpolation method based on image resize
        if interpolation is None:
            if size[0] > w or size[1] > h:
                interpolation = cv2.INTER_CUBIC
            else:
                interpolation = cv2.INTER_AREA

        # Resize image
        return cv2.resize(img, size, interpolation=interpolation)

    @staticmethod
    def encode_url(img: np.ndarray, format="jpg") -> str:
        _, data = cv2.imencode("." + format, img)
        return f"data:image/{format};base64," + base64.b64encode(data).decode("ascii")


class LayerLabel(Layer):
    def __init__(self, label_map, colormap: Dict[int, str] | List[str] | str | None = None):
        super().__init__("label")
        self.label_map = label_map
        self.colormap = colormap

    @property
    def label_map(self):
        return self._label_map

    @label_map.setter
    def label_map(self, data):
        if type(data).__qualname__ == "Tensor":
            data = data.detach().cpu().numpy()
        assert isinstance(data, np.ndarray), f"Invalid label type {type(data)}. Must be numpy.ndarray."
        assert data.ndim == 2, f"Invalid label shape {data.shape}. Must be (H, W)."

        error = ValueError(f"Invalid label type {data.dtype}. Must be positive integer encoded on maximum 32 bits.")
        if data.dtype.kind not in "?bBiu":
            raise error
        elif np.min(data) < 0 or np.max(data) >= 2**32:
            raise error

        self._label_map = data.astype(np.uint32)
        self._notify_data_change()

    @property
    def colormap(self):
        """Get colormap as dict[int, str]."""
        return self._options.get("cmap", None)

    @colormap.setter
    def colormap(self, cmap):
        cmap = self.check_label_colormap(cmap)
        self._options["cmap"] = cmap
        self._notify_options_change({"cmap": cmap})

    @staticmethod
    def check_label_colormap(cmap, null_label=True) -> Dict[int, str]:
        from .utilities.color import colormap_by_name, check_color

        if not null_label and isinstance(cmap, dict):
            if None in cmap:
                cmap[-1] = cmap.pop(None)
            cmap = {k + 1: v for k, v in cmap.items()}
        match cmap:
            case list() | tuple():
                cmap = {0: list(cmap)}
            case str():
                cmap = {0: colormap_by_name(cmap)}
            case None:
                cmap = {0: colormap_by_name()}
        if not isinstance(cmap, dict) or any(
            not isinstance(k, int) or not isinstance(v, str) for k, v in cmap.items() if k != 0
        ):
            raise ValueError(f"Invalid colormap {cmap}. Must be dict[int, str].")

        return {int(k): check_color(v) if k != 0 else [check_color(_) for _ in v] for k, v in cmap.items()}

    def _fetch_data(self, resize: Tuple[int, int] | None = None) -> LayerData:
        label = self._label_map

        h, w = label.shape[:2]
        if resize is not None:
            label = LayerImage.fit_resize(label, resize, interpolation=cv2.INTER_NEAREST)
        labels = np.unique(label).tolist()

        return LayerData(
            LayerLabel.encode_label_url(label),
            infos={"width": w, "height": h, "labels": labels},
        )

    def _shape(self):
        return self.label_map.shape if self.label is not None else (0, 0)

    def _fetch_item(self, x: int, y: int) -> dict:
        return {"value": self._label[y, x]}

    def _fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str, any]:
        return {}

    def update_data(self, data: any):
        self.label_map = data

    @staticmethod
    def encode_label_url(label: np.ndarray) -> str:
        alpha = (label >> 24).astype(np.uint8)
        red = ((label >> 16) & 0xFF).astype(np.uint8)
        green = ((label >> 8) & 0xFF).astype(np.uint8)
        blue = (label & 0xFF).astype(np.uint8)

        label = np.stack((red, green, blue, 255 - alpha), axis=-1)
        return LayerImage.encode_url(label, "png")


class LayerIntensityMap(Layer):
    def __init__(self, map: np.ndarray, color_range):
        from .utilities.color import ColorRange

        super().__init__("intensity")
        self.map = map
        self._color_range = ColorRange(color_range)

    @property
    def map(self):
        return self._map

    @map.setter
    def map(self, map):
        assert isinstance(map, np.ndarray), f"Invalid map type {type(map)}. Must be numpy.ndarray."
        assert map.ndim == 2, f"Invalid map shape {map.shape}. Must be (H, W)."
        self._map = map
        self._notify_data_change()

    @property
    def color_range(self):
        return self._color_range

    @color_range.setter
    def color_range(self, color_range):
        assert isinstance(color_range, list) and len(color_range) == 2, f"Invalid color range {color_range}."
        self._options["color_range"] = color_range
        self._notify_options_change({"color_range": color_range})

    @staticmethod
    def encode_intensity_url(label: np.ndarray) -> str:
        label = label.astype(np.float32).tobytes()
        alpha = (label >> 24).astype(np.uint8)
        red = ((label >> 16) & 0xFF).astype(np.uint8)
        green = ((label >> 8) & 0xFF).astype(np.uint8)
        blue = (label & 0xFF).astype(np.uint8)

        label = np.stack((red, green, blue, 255 - alpha), axis=-1)
        return LayerImage.encode_url(label, "png")

    def _fetch_data(self, resize: Tuple[int, int] | None = None) -> LayerData:
        map = self.map
        if resize is not None:
            map = LayerImage.fit_resize(map, resize, interpolation=cv2.INTER_NEAREST)
        return LayerData(LayerIntensityMap.encode_intensity_url(map))

    def _shape(self):
        return self.map.shape if self.map is not None else (0, 0)

    def _fetch_item(self, x: int, y: int) -> dict:
        return {"value": self._map[y, x]}


class LayerGraph(Layer):
    def __init__(
        self, adjacency_list, nodes_coordinates, edge_map=None, nodes_domain=None, nodes_cmap=None, edges_cmap=None
    ):
        super().__init__("graph")
        self.set_graph(adjacency_list, nodes_coordinates, edge_map, nodes_domain)
        self.nodes_cmap = nodes_cmap
        self.edges_cmap = edges_cmap
        self.edges_opacity = 0.7
        self.node_labels_visible = False
        self.edge_labels_visible = False
        self.edge_map_visible = edge_map is None

    def set_graph(self, adjacency_list, nodes_coordinates, edge_map=None, nodes_domains: Rect | None = None):
        if nodes_domains is None and edge_map is not None:
            nodes_domains = Rect.from_size(edge_map.shape)
        self._set_adjacency_list(adjacency_list, check_dim=False)
        self._set_nodes_coordinates(nodes_coordinates, nodes_domains)
        self._set_edge_map(edge_map)
        self._notify_data_change()

    def set_options(self, options: Dict[str, any], raise_on_error: bool = True):
        for k, v in options.items():
            if k == "nodes_cmap":
                self._options[k] = LayerLabel.check_label_colormap(v, null_label=False)
            elif k == "edges_cmap":
                self._options[k] = LayerLabel.check_label_colormap(v, null_label=False)
            elif k == "edges_opacity":
                self._options[k] = min(max(float(v), 0), 1)
            elif k == "node_labels_visible":
                self._options[k] = bool(v)
            elif k == "edge_labels_visible":
                self._options[k] = bool(v)
            elif k == "edge_map_visible":
                self._options[k] = bool(v)
        super().set_options(options, raise_on_error)

    @property
    def adjacency_list(self):
        return getattr(self, "_adjacency_list", None)

    @adjacency_list.setter
    def adjacency_list(self, data):
        self._set_adjacency_list(data)
        self._notify_data_change()

    def _set_adjacency_list(self, adj, check_dim=True):
        if type(adj).__qualname__ == "Tensor":
            data = adj.detach().cpu().numpy()
        adj = np.asarray(adj)
        assert adj.ndim == 2 and adj.shape[1] == 2, f"Invalid adjacency list shape {adj.shape}. Must be (E, 2)."
        if check_dim:
            if self.nodes_coordinates is not None:
                assert (
                    adj.max() < self.nodes_coordinates.shape[0]
                ), f"Invalid adjacency list. {self.nodes_coordinates.shape[0]} nodes are expected."
            if self.edge_map is not None:
                assert (
                    adj.shape[0] == self.edge_map.max()
                ), f"Invalid adjacency list. {self.edge_map.max()} edges are expected."
        self._adjacency_list = adj.astype(np.uint32)

    @property
    def nodes_coordinates(self) -> np.ndarray:
        return getattr(self, "_nodes_coordinates", None)

    @nodes_coordinates.setter
    def nodes_coordinates(self, data):
        self._set_nodes_coordinates(data)
        self._notify_data_change()

    def _set_nodes_coordinates(self, node_yx, nodes_domain=None, check_dim=True):
        node_yx = np.asarray(node_yx)
        assert (
            node_yx.ndim == 2 and node_yx.shape[1] == 2
        ), f"Invalid  nodes coordinates shape {node_yx.shape}. Must be (nbNodes, 2)."
        if check_dim:
            if self.adjacency_list is not None:
                assert node_yx.shape[0] > self.adjacency_list.max(), (
                    f"Invalid nodes coordinates shape {node_yx.shape}. "
                    f"Expected at least {self.adjacency_list.max()+1} nodes but got {node_yx.shape[0]}."
                )
        if nodes_domain is None:
            if self.edge_map is not None:
                nodes_domain = Rect.from_size(self._edge_map.shape)
            elif not Rect.is_empty(self._main_domain):
                nodes_domain = self._main_domain
        self._nodes_coordinates = node_yx.astype(np.uint32)
        self._nodes_domain = nodes_domain

    @property
    def edge_map(self) -> np.ndarray | None:
        return getattr(self, "_edge_map", None)

    @edge_map.setter
    def edge_map(self, data):
        self._set_edge_map(data)
        self._notify_data_change()

    def _set_edge_map(self, edge_label, check_dim=True):
        if type(edge_label).__qualname__ == "Tensor":
            edge_label = edge_label.detach().cpu().numpy()
        if edge_label is not None:
            error = ValueError(
                f"Invalid edge map type {edge_label.dtype}. " f"Must be positive integer encoded on maximum 32 bits."
            )
            if edge_label.ndim != 2:
                raise error
            elif edge_label.dtype.kind not in "?bBiu":
                raise error
            elif np.min(edge_label) < 0 or np.max(edge_label) >= 2**32:
                raise error
            if check_dim:
                if self.adjacency_list is not None:
                    assert edge_label.max() == self.adjacency_list.shape[0], (
                        f"Invalid edge label: maximum label is {edge_label.max()} "
                        f"but adjacency list contains{self.adjacency_list.shape[0]} edges."
                    )
            self._edge_map = edge_label.astype(np.uint32)
            if self._nodes_domain is None:
                self._nodes_domain = Rect.from_size(self._edge_map.shape)
        else:
            self._edge_map = None

    @property
    def nodes_cmap(self):
        """Get colormap as dict[int, str]."""
        return self._options.get("nodes_cmap", None)

    @nodes_cmap.setter
    def nodes_cmap(self, cmap):
        self.set_options({"nodes_cmap": cmap})

    @property
    def edges_cmap(self):
        """Get colormap as dict[int, str]."""
        return self._options.get("edges_cmap", None)

    @edges_cmap.setter
    def edges_cmap(self, cmap):
        self.set_options({"edges_cmap": cmap})

    @property
    def node_labels_visible(self):
        return self._options.get("node_labels_visible", False)

    @node_labels_visible.setter
    def node_labels_visible(self, cmap):
        self.set_options({"node_labels_visible": cmap})

    @property
    def edge_labels_visible(self):
        return self._options.get("edge_labels_visible", False)

    @edge_labels_visible.setter
    def edge_labels_visible(self, cmap):
        self.set_options({"edge_labels_visible": cmap})

    @property
    def edge_map_visible(self):
        return self._options.get("edge_map_visible", False)

    @edge_map_visible.setter
    def edge_map_visible(self, cmap):
        self.set_options({"edge_map_visible": cmap})

    @property
    def edges_opacity(self):
        return self._options.get("edges_opacity", 1.0)

    @edges_opacity.setter
    def edges_opacity(self, opacity):
        self.set_options({"edges_opacity": opacity})

    def set_main_shape(self, main_domain: Rect, transform_domain: Transform | LayerDomain | None = None):
        if self._nodes_domain is None:
            self._nodes_domain = main_domain
        super().set_main_shape(main_domain, transform_domain)

    def _fetch_data(self, resize: Tuple[int, int] | None = None) -> LayerData:
        data = dict(
            adj=self._adjacency_list.astype(int).tolist(), nodes_yx=self.nodes_coordinates.astype(float).tolist()
        )
        if self.edge_map is not None:
            data["edgeMap"] = LayerLabel.encode_label_url(self.edge_map)
        return LayerData(
            data=data,
            infos={
                "nbNodes": int(self._adjacency_list.max()) + 1,
                "nodesDomain": self._nodes_domain,
            },
        )

    def _shape(self):
        return self.edge_map.shape if self.edge_map is not None else self._nodes_domain

    def _fetch_item(self, x: int, y: int) -> dict:
        return {"value": self.edge_map[y, x]}

    def _fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str, any]:
        return {}

    def update_data(self, data: any):
        if isinstance(data, tuple) and len(data) in (2, 1):
            self.set_graph(*data)
        else:
            self.adjacency_list = data
