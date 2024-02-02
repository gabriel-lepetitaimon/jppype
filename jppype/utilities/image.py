import os
import re
from pathlib import Path
from typing import Tuple

import cv2
import numpy as np


def load_image_from_url(url: str | Path):
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