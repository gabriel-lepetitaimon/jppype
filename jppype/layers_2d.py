import base64
import cv2
import numpy as np
import re
from typing import Tuple, Literal, Dict, List

from .layer_base import Layer, LayerData


class LayerImage(Layer):
    def __init__(self, image,
                 vmax: Literal['auto'] | float | None = 'auto', vmin: Literal['auto'] | float | None = 'auto',
                 resize_buffer: Tuple[int, int] | int | None = None):
        super().__init__('image')
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
        self._notify_options_change({'domain': self.shape})

    # --- Implementation of layer's abstract methods ---
    def _fetch_data(self, resize: tuple[int, int] | None = None) -> LayerData:
        img = self._image

        if self.vmax == 'auto':
            vmax = np.max(img)
        else:
            vmax = self.vmax

        if self.vmin == 'auto':
            vmin = np.min(img)
            if vmin < 0 < vmax and .75 < abs(vmax + vmin)/vmax < 1.25:
                vmin = -vmax
            elif abs(vmin) < abs(vmax) * .1 and vmax > 0:
                vmin = 0
        else:
            vmin = self.vmin

        if self.vmax == 'auto' and abs(vmax) < abs(vmin) * .1 and vmin < 0:
            vmax = 0

        if vmin is not None:
            img = img - np.min(img)
            if vmax is not None:
                vmax = vmax - vmin
        if vmax is not None:
            img = img / vmax * 255.

        h, w = img.shape[:2]
        if resize is not None:
            img = self.fit_resize(img, resize)

        return LayerData(self.encode_url(img, 'jpg'), infos=dict(width=w, height=h))

    def _shape(self):
        return self._image.shape[:2] if self._image is not None else (0, 0)

    def _fetch_item(self, x: int, y: int) -> dict:
        return {'value': self.image[y, x]}

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
        if type(img).__qualname__ == 'Tensor':
            img = img.detach().cpu().numpy()

        if len(img.shape) == 3:
            if img.shape[0] in (1, 3) and img.shape[2] not in (1, 3):
                img = img.transpose((1, 2, 0))
            if img.shape[2] == 1:
                img = img[:, :, 0]
        elif len(img.shape) != 2:
            raise ValueError(f'Invalid image shape {img.shape}, must be (H, W, C) or (H, W).')

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
    def encode_url(img: np.ndarray, format='jpg') -> bytes:
        _, data = cv2.imencode('.'+format, img)
        return f'data:image/{format};base64,'.encode('ascii') + base64.b64encode(data)


class LayerLabel(Layer):
    def __init__(self, label_map, colormap: Dict[int, str] | List[str] | str | None = None):
        super().__init__('label')
        self.label_map = label_map
        self.colormap = colormap

    @property
    def label_map(self):
        return self._label_map

    @label_map.setter
    def label_map(self, data):
        if type(data).__qualname__ == 'Tensor':
            data = data.detach().cpu().numpy()
        assert isinstance(data, np.ndarray), f'Invalid label type {type(data)}. Must be numpy.ndarray.'
        assert data.ndim == 2, f'Invalid label shape {data.shape}. Must be (H, W).'

        error = ValueError(f'Invalid label type {data.dtype}. Must be positive integer encoded on maximum 32 bits.')
        if data.dtype.kind not in '?bBiu':
            raise error
        elif np.min(data) < 0 or np.max(data) >= 2**32:
            raise error

        self._label_map = data.astype(np.uint32)
        self._notify_data_change()

    @property
    def colormap(self):
        """Get colormap as dict[int, str]."""
        return self._options.get('cmap', None)

    @colormap.setter
    def colormap(self, cmap):
        match cmap:
            case list() | tuple():
                cmap = {0: list(cmap)}
            case str():
                cmap = {0: LayerLabel.colormap_by_name(cmap)}
            case None:
                cmap = {0: LayerLabel.colormap_by_name()}
        if not isinstance(cmap, dict) or any(not isinstance(k, int) or not isinstance(v, str)
                                             for k, v in cmap.items() if k != 0):
            raise ValueError(f'Invalid colormap type {type(cmap)}. Must be dict[int, str].')

        cmap = {int(k): LayerLabel.check_color(v) if k != 0 else [LayerLabel.check_color(_) for _ in v]
                for k, v in cmap.items()}

        self._options['cmap'] = cmap
        self._notify_options_change({'cmap': cmap})

    @staticmethod
    def colormap_by_name(name='catppuccin'):
        assert isinstance(name, str), f'Invalid colormap name {name}. Must be str.'
        match name:
            case 'catppuccin':
                return ['#8caaee', '#99d1db', '#a6d189', '#ef9f76', '#e78284', '#f4b8e4', '#f2d5cf',
                        '#babbf1', '#85c1dc', '#81c8be', '#e5c890', '#ea999c', '#ca9ee6', '#eebebe']
            case _:
                return [LayerLabel.check_color(name)]

    @staticmethod
    def check_color(color: str):
        if re.match(r'^#(?:[0-9a-fA-F]{3,4}){1,2}$', color) is not None:
            return color
        else:
            import webcolors
            try:
                return webcolors.name_to_hex(color)
            except ValueError:
                raise ValueError(f'Invalid color name {color}.')

    def _fetch_data(self, resize: Tuple[int, int] | None = None) -> LayerData:
        img = self._label_map
        h, w = img.shape[:2]
        if resize is not None:
            img = LayerImage.fit_resize(img, resize, interpolation=cv2.INTER_NEAREST)
        labels = np.unique(img)[1:].tolist()
        alpha = (img >> 24).astype(np.uint8)
        red = ((img >> 16) & 0xFF).astype(np.uint8)
        green = ((img >> 8) & 0xFF).astype(np.uint8)
        blue = (img & 0xFF).astype(np.uint8)

        img = np.stack((red, green, blue, 255-alpha), axis=-1)
        return LayerData(LayerImage.encode_url(img, 'png'),
                         infos={'width': w, 'height': h, 'labels': labels},)

    def _shape(self):
        return self.label_map.shape if self.label is not None else (0, 0)

    def _fetch_item(self, x: int, y: int) -> dict:
        return {'value': self._label[y, x]}

    def _fetch_graphs(self, rect: Tuple[float, float], **kwargs) -> Dict[str, any]:
        return {}

    def update_data(self, data: any):
        self.label_map = data
