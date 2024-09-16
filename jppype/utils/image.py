import os
import re
from pathlib import Path
from typing import Tuple

import numpy as np

from .safe_import import import_cv2


def load_image_from_url(url: str | Path):
    cv2 = import_cv2()

    if isinstance(url, Path):
        url = str(url)
    if os.path.exists(url):
        img = cv2.imread(url)
        if img is None:
            raise ValueError(f"Invalid image file: {url}.") from None
    elif re.match(r"^https?://", url):
        from urllib.request import urlopen

        resp = urlopen(url)
        img = np.asarray(bytearray(resp.read()), dtype=np.uint8)
        img = cv2.imdecode(img, -1)
        if img is None:
            raise ValueError(f"Invalid image url: {url}.")
    else:
        raise ValueError(f"No file was found at: {url}.")

    return img


def fit_resize(img: np.ndarray, size: Tuple[int, int] | int, interpolation=None) -> np.ndarray:
    cv2 = import_cv2()

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


def checkerboard(
    shape: Tuple[int, int], square_size: Tuple[int, int] = (10, 10), color1="white", color2="black"
) -> np.ndarray:
    """Create a checkerboard image.

    Parameters
    ----------
        shape : Tuple[int, int]
            Shape of the image (height, width).

        square_size : Tuple[int, int]
            Size of the each individual square (height, width).

        color1 : str
            Color of the first square.

        color2 : str
            Color of the second square.

    """
    from .color import check_rgb_color

    color1 = check_rgb_color(color1)
    color2 = check_rgb_color(color2)
    shape = shape + (3,)
    tile12 = np.concatenate(
        [
            np.full(square_size + (3,), np.asarray(color1)[None, None, :], dtype=np.uint8),
            np.full(square_size + (3,), np.asarray(color2)[None, None, :], dtype=np.uint8),
        ],
        axis=1,
    )
    tile = np.concatenate([tile12, tile12[:, ::-1]], axis=0)

    img = np.tile(tile, [shape[0] // (2 * square_size[0]) + 1, shape[1] // 2 * (square_size[1]) + 1, 1])
    return img[: shape[0], : shape[1]]
