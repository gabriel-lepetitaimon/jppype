from typing import Callable, List


def colormap_by_name(name="catppuccin") -> List[str]:
    assert isinstance(name, str), f"Invalid colormap name {name}. Must be str."
    match name:
        case "catppuccin":
            return [
                "#8caaee",
                "#99d1db",
                "#a6d189",
                "#ef9f76",
                "#e78284",
                "#f4b8e4",
                "#f2d5cf",
                "#babbf1",
                "#85c1dc",
                "#81c8be",
                "#e5c890",
                "#ea999c",
                "#ca9ee6",
                "#eebebe",
            ]
        case _:
            return [check_color(name)]


def check_color(color: str) -> str:
    import re

    if re.match(r"^#(?:[0-9a-fA-F]{3,4}){1,2}$", color) is not None:
        return color
    else:
        import webcolors

        try:
            return webcolors.name_to_hex(color)
        except ValueError:
            raise ValueError(f"Invalid color name {color}.") from None


class ColorRange(dict):
    def __init__(self, colors: dict[float, str | tuple[str, str]], update_callback: Callable = None):
        super().__init__()
        for i, c in colors.items():
            if isinstance(c, str):
                self[i] = check_color(c)
            elif isinstance(c, tuple) and len(c) == 2:
                self[i] = tuple(check_color(c) for c in c)
            else:
                raise ValueError(f"Invalid color {c}.")
        self._update_callbacks = [update_callback]
