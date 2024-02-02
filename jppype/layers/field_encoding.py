from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, Enum, NamedTuple

NO_DEFAULT = object()


class EncodableField(ABC):
    def __init__(self, data_field, default=NO_DEFAULT, transition: Transition | None = None):
        self.data_field = data_field
        self.default = default
        self.transition = transition

    @abstractmethod
    @property
    def name(self):
        ...

    def check_data(self, data):
        return data

    def to_json(self):
        specs = {'name': self.name, 'field': self.data_field}
        if self.default is not NO_DEFAULT:
            specs['default'] = self.default
        if self.transition is not None:
            specs['transition'] = self.transition.to_json()
        return json.dumps(specs, ensure_ascii=True)


class TransitionEasing(str, Enum):
    LINEAR = 'linear'
    EASE_IN = 'easeIn'
    EASE_OUT = 'easeOut'
    EASE_IN_OUT = 'easeInOut'


class Transition(NamedTuple):
    duration: int = 0
    easing: TransitionEasing = TransitionEasing.LINEAR

    def to_json(self):
        return json.dumps({'easing': self.easing.value, 'duration': self.duration}, ensure_ascii=True)


class ScaleType(str, Enum):
    LINEAR = 'linear'
    LOG = 'log'
    SQRT = 'sqrt'
    QUANTILE = 'quantile'


class Scale(NamedTuple):
    type: ScaleType
    domain: tuple[Any, ...]
    clamp: bool = False

class PowScale(Scale):
    type: str = 'pow'



class FieldValueError(Exception):
    def __init__(self, field: EncodableField, value):
        self.field = field
        self.value = value

    def __str__(self):
        return f"Invalid value for field {self.field.name}: {self.value} (from data column: {self.field.data_field})."

#############################################
class NumberEncodableField(EncodableField):
    def check_data(self, data):
        try:
            return float(data)
        except ValueError:
            raise FieldValueError(self, data) from None


class ColorEncodableField(EncodableField):
    def check_data(self, data):
        import webcolors
        if isinstance(data, str):
            try:
                return webcolors.name_to_rgb(data)
            except ValueError:
                raise FieldValueError(self, data) from None

#############################################
class X(NumberEncodableField):
    @property
    def name(self):
        return "x"


class Y(NumberEncodableField):
    @property
    def name(self):
        return "y"


class Width(NumberEncodableField):
    @property
    def name(self):
        return "width"


class Height(NumberEncodableField):
    @property
    def name(self):
        return "height"


class Color(ColorEncodableField):
    @property
    def name(self):
        return "color"
