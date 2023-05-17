from __future__ import annotations
import inspect
from typing import Mapping, Protocol, overload, Literal, TypeGuard


def call_matching_params(method, args=None, kwargs=None):
    """
    Call the specified method, matching the arguments it needs with those,
    provided in kwargs. The useless arguments are ignored.
    If some not optional arguments is missing, a ValueError exception is raised.
    :param method: The method to call
    :param kwargs: Parameters provided to method
    :return: Whatever is returned by method (might be None)
    """
    method_params = {}
    if kwargs:
        method_params = inspect.signature(method).parameters.keys()
        method_params = {_: kwargs[_] for _ in method_params & kwargs.keys()}

    if args is None:
        args = []
    i_args = 0
    for not_opt in not_optional_args(method):
        if not_opt not in method_params:
            if i_args < len(args):
                method_params[not_opt] = args[i_args]
                i_args += 1
            else:
                raise ValueError('%s is not optional to call method: %s.' % (not_opt, method))

    return method(**method_params)


def not_optional_args(f):
    """
    List all the parameters not optional of a method
    :param f: The method to analise
    :return: The list of parameters
    :rtype: list
    """
    sig = inspect.signature(f)
    return [p_name for p_name, p in sig.parameters.items() if p.default is inspect.Parameter.empty]


class EventsDispatcher:
    def __init__(self):
        self._cb = []

    def __call__(self, cb):
        cb.unsub = self.subscribe(cb)
        return cb

    def dispatch(self, *args, **kwargs):
        for cb in self._cb:
            call_matching_params(cb, args=args, kwargs=kwargs)

    def subscribe(self, cb):
        self._cb.append(cb)

        def unsubscribe():
            self.unsubscribe(cb)
        return unsubscribe

    def unsubscribe(self, cb):
        self._cb.remove(cb)


def dict_recursive_update(d1: dict, d2: Mapping) -> Mapping:
    for k, v in d2.items():
        if isinstance(v, Mapping):
            d1[k] = dict_recursive_update(d1.get(k, {}), v)
        else:
            d1[k] = v
    return d1


class Transform:
    def __init__(self, translate: Point = (0, 0), scale: float = 1, origin: Point = (0, 0)):
        self._translate = translate
        self._scale = scale
        self._origin = origin

    @overload
    def __call__(self, p: tuple) -> tuple: ...

    @overload
    def __call__(self, p: Point) -> Point: ...

    @overload
    def __call__(self, p: Rect) -> Rect: ...

    def __call__(self, p: tuple | Point | Rect) -> tuple | Point | Rect:
        if isinstance(p, tuple):
            match len(p):
                case 2:
                    p = Point(*p)
                case 4:
                    p = Rect(*p)
                case _:
                    raise TypeError('Only transformation of point (2-items tuple) or rect (4-items tuple) are supported')
        if isinstance(p, Rect):
            return Rect.from_points(self(p.top_left), self(p.bottom_right))
        elif isinstance(p, Point):
            return (p - self._origin) * self._scale + self._translate
        else:
            raise TypeError('Only Rect and Point are supported')

    @property
    def translate(self) -> Point:
        return self._translate

    @property
    def scale(self) -> float:
        return self._scale

    @property
    def origin(self) -> Point:
        return self._origin

    @staticmethod
    def from_rects(src: Rect, dst: Rect):
        origin = Rect(*src)
        target = Rect(*dst)

        offset = target.top_left - origin.top_left
        if origin.w != 0:
            ratio = target.w / origin.w
        elif origin.h != 0:
            ratio = target.h / origin.h
        else:
            raise ValueError('Origin rect cannot be empty')
        return Transform(offset, ratio, src.top_left)


FIT_WIDTH = 'fit_width'
FIT_HEIGHT = 'fit_height'
FIT_INNER = 'fit_inner'
FIT_OUTER = 'fit_outer'
CENTERED = 'centered'

FIT_OPTIONS = (FIT_WIDTH, FIT_HEIGHT, FIT_INNER, FIT_OUTER, CENTERED)

FitMode = Literal['fit_width', 'fit_height', 'fit_inner', 'fit_outer', 'centered']


class Rect(tuple):
    def __new__(cls, h: float, w: float, y: float = 0, x: float = 0):
        return tuple.__new__(Rect, (h, w, y, x))

    @property
    def x(self):
        return self[3]

    @property
    def y(self):
        return self[2]

    @property
    def h(self):
        return self[0]

    @property
    def w(self):
        return self[1]

    @property
    def center(self) -> Point:
        return Point(self.y + self.h // 2, self.x + self.w // 2)

    @property
    def top_left(self) -> Point:
        return Point(self.y, self.x)

    @property
    def bottom_right(self) -> Point:
        return Point(self.y + self.h, self.x + self.w)

    @property
    def shape(self) -> Point:
        return Point(self.w, self.h)

    def to_int(self):
        return Rect(*(int(round(_)) for _ in (self.h, self.w, self.y, self.x)))

    @staticmethod
    def from_size(shape: tuple):
        return Rect(shape[0], shape[1])

    @staticmethod
    def from_points(p1: tuple, p2: tuple):
        return Rect(p2[0] - p1[0], p2[1] - p1[1], p1[0], p1[1])

    @staticmethod
    def from_center(center: tuple, shape: tuple):
        return Rect(shape[0], shape[1], center[0] - shape[0] // 2, center[1] - shape[1] // 2)

    @staticmethod
    def empty():
        return Rect(0, 0, 0, 0)

    def is_self_empty(self) -> bool:
        return self.w == 0 or self.h == 0

    @staticmethod
    def is_empty(rect: Rect) -> bool:
        if isinstance(rect, tuple) and len(rect) == 4:
            rect = Rect(*rect)
        return isinstance(rect, tuple) and (rect.w == 0 or rect.h == 0)

    @staticmethod
    def is_rect(r) -> TypeGuard[Rect]:
        return isinstance(r, Rect) or (isinstance(r, tuple) and len(r) == 4)

    def __repr__(self):
        return "Rect(y={}, x={}, h={}, w={}, )".format(self.y, self.x, self.h, self.w)

    def __or__(self, other):
        if isinstance(other, Rect):
            return Rect.from_points((max(self.y + self.h, other.y + other.h),
                                     max(self.x + self.w, other.x + other.w)),
                                    (min(self.y, other.y), min(self.x, other.x)))
        else:
            raise TypeError('Rect can only be combined only with another Rect')

    def __and__(self, other):
        if isinstance(other, Rect):
            return Rect.from_points((min(self.y + self.h, other.y + other.h),
                                     min(self.x + self.w, other.x + other.w)),
                                    (max(self.y, other.y), max(self.x, other.x)))
        else:
            raise TypeError('Rect can only be combined only with another Rect')

    def translate(self, y: float, x: float):
        return Rect(self.w, self.h, self.y + y, self.x + x)

    def scale(self, fy: float, fx: float | None = None):
        if fx is None:
            fx = fy
        return Rect(self.w * fy, self.h * fx, self.y * fy, self.x * fx)

    def fit(self, other: Rect | Point | tuple, mode: FitMode = FIT_WIDTH):
        match other:
            case (h, w):
                other = Rect.from_size((h, w))
            case (h, w, y, x):
                other = Rect(h, w, y, x)
        match mode:
            case 'fit_outer':
                ratio = max(other.w / self.w, other.h / self.h)
            case 'fit_inner':
                ratio = min(other.w / self.w, other.h / self.h)
            case 'fit_width':
                ratio = other.w / self.w
            case 'fit_height':
                ratio = other.h / self.h
            case _:
                ratio = 1
        return Rect.from_center(other.center, (self.h * ratio, self.w * ratio))

    def transform(self, origin: Rect, target: Rect):
        mapping = Transform.from_rects(origin, target)
        return mapping(self)


class Point(tuple):
    def __new__(cls, y: float, x: float):
        return tuple.__new__(Point, (y, x))

    @property
    def x(self):
        return self[1]

    @property
    def y(self):
        return self[0]

    def __add__(self, other: Point | float):
        if isinstance(other, float):
            return Point(self.y + other, self.x + other)
        return Point(self.y + other.y, self.x + other.x)

    def __sub__(self, other: Point | float):
        if isinstance(other, float):
            return Point(self.y - other, self.x - other)
        return Point(self.y - other.y, self.x - other.x)

    def __mul__(self, other: float):
        return Point(self.y * other, self.x * other)

    def __truediv__(self, other: float):
        return Point(self.y / other, self.x / other)


class FlagContextSetFlag(Protocol):
    def __call__(self, flag_value: bool): ...


class FlagContext:
    def __init__(self, set_flag: FlagContextSetFlag, value_on_enter=True):
        self.set_flag = set_flag
        self.value_on_enter = value_on_enter
        self.enter_count = 0

    def __enter__(self):
        if self.enter_count == 0:
            self.set_flag(self.value_on_enter)
        self.enter_count += 1

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.enter_count -= 1
        if self.enter_count == 0:
            self.set_flag(not self.value_on_enter)
