from __future__ import annotations

import itertools
from typing import Iterable, Optional, Tuple

import numpy as np
from IPython.display import display
from ipywidgets import HTML, GridBox, Layout

from .layers import Layer, LayerImage
from .utils.geometric import Rect
from .view2d import View2D, sync_views


class View2dGroup:
    def __init__(self, layout_shape=Tuple[int, ...], views: Optional[Iterable[View2D]] = None):
        self._shape = (layout_shape,) if isinstance(layout_shape, int) else tuple(layout_shape)
        if views is not None:
            assert len(views) == np.prod(layout_shape), "Number of views must be equal to the product of the shape"
            self._views = tuple(views)
        else:
            self._views = [View2D() for _ in range(np.prod(self._shape))]

    def __len__(self):
        return self._shape[0]

    @property
    def views(self) -> Tuple[View2D]:
        return self._views

    def __getitem__(self, index) -> View2D | View2dGroup:
        if not isinstance(index, tuple):
            index = (index,)
        if len(index) > len(self._shape):
            raise IndexError("Index has more dimensions than the shape of the mosaic")

        shape = []
        ids = []
        for i, s in zip(index, self._shape, strict=False):
            if isinstance(i, slice):
                i = range(*i.indices(s))
                ids.append(i)
                shape.append(len(i))
                continue

            try:
                i = int(i)
            except TypeError:
                pass
            else:
                if not -s < i < s:
                    raise IndexError(f"Index {i} out of range")
                ids.append([i % s])
                continue

            try:
                i = [int(_) for _ in i]
            except TypeError:
                raise IndexError(f"Invalid index {i}") from None
            else:
                if not all(-s < _ < s for _ in i):
                    raise IndexError(f"Index {i} out of range")
                ids.append([_ % s for _ in i])
                shape.append(len(i))

        for _ in range(len(index), len(self._shape)):
            ids.append(range(self._shape[_]))
            shape.append(self._shape[_])

        if len(shape) == 0:
            return self._views[int(np.ravel_multi_index(ids, self._shape))]

        all_ids = np.array(list(itertools.product(*ids))).T
        return View2dGroup(
            views=[self._views[_] for _ in np.ravel_multi_index(all_ids, self._shape)], layout_shape=shape
        )

    @property
    def layout_shape(self):
        return self._shape

    @property
    def background(self) -> Layer:
        for v in self.views():
            if "background" in v:
                return v["background"]

    @background.setter
    def background(self, value):
        if value is None:
            for v in self.views:
                del v["background"]
        elif isinstance(value, Layer):
            pass
        else:
            value = LayerImage(value)

        value.z_index = -1
        value.foreground = False

        for v in self.views:
            v["background"] = value

    def add_label(self, label, name: str, colormap: str | None = "white", opacity=0.5, options=None, **opts):
        if options is None:
            options = {}
        for v in self.views:
            v.add_label(label, name=name, colormap=colormap, options=options | {"opacity": opacity}, **opts)

    @property
    def cell_height(self):
        return self._cell_height

    @cell_height.setter
    def cell_height(self, value):
        self._cell_height = value

    def sync_domains(self):
        domain = Rect.union(*[v.layers_domain() for v in self.views])
        for v in self.views:
            v._domain = domain


class Mosaic(View2dGroup):
    def __init__(
        self,
        layout_shape: int | Tuple[int, int],
        background=None,
        cols_titles=None,
        rows_titles=None,
        *,
        cell_height=650,
        sync=True,
    ):
        super().__init__(layout_shape)
        self._cell_height = cell_height

        self._rows_titles = [] if rows_titles is None else rows_titles
        self._cols_titles = [] if cols_titles is None else cols_titles

        if sync:
            if len(self.layout_shape) == 2:
                for row in range(self.rows):
                    for col in range(self.cols):
                        self[row, col]._top_ruler = row != 0
                        self[row, col]._left_ruler = col != 0
            elif len(self.layout_shape) == 1:
                for col in range(1, self.cols):
                    self[col]._left_ruler = False

            sync_views(*self.views)

        if background is not None:
            self.background = background

    ################################################################################################
    @property
    def cols(self):
        return self._shape[1] if len(self._shape) > 1 else self._shape[0]

    @property
    def rows(self):
        return self._shape[0] if len(self._shape) > 1 else 1

    ################################################################################################
    def _ipython_display_(self):
        self.show()

    def draw_mosaic(self):
        views = list(self.views)
        col_layout = f"repeat({self.cols}, 1fr)"
        if self._rows_titles:
            assert len(self._rows_titles) == self.rows, "Number of rows titles must be equal to the number of rows"
            for i, title in enumerate(self._rows_titles):
                title_item = HTML(
                    f'<h3 style="text-align: center; writing-mode: vertical-lr; height: 100%; transform: rotate(-180deg);">{title}</h3>'
                )
                views.insert(i * (self.cols + 1), title_item)
            col_layout = f"auto {col_layout}"

        row_layout = f"repeat({self.rows}, {self._cell_height}px)"

        if self._cols_titles:
            assert len(self._cols_titles) == self.cols, "Number of cols titles must be equal to the number of cols"
            title_items = [HTML("<span/>")] if len(self._rows_titles) > 0 else []
            for title in self._cols_titles:
                title_items.append(HTML(f'<h3 style="text-align: center;">{title}</h3>'))
            views = title_items + views
            row_layout = f"auto {row_layout}"
        layout = Layout(grid_template_columns=col_layout, grid_template_rows=row_layout, grid_gap="1px", width="100%")
        return GridBox(children=views, layout=layout)

    def show(self):
        display(self.draw_mosaic())
