import inspect
from enum import EnumMeta
from typing import Mapping, Protocol

from strenum import StrEnum as StrEnumBase


class FlagContextSetFlag(Protocol):
    def __call__(self, flag_value: bool):
        ...


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
                raise ValueError("%s is not optional to call method: %s." % (not_opt, method))

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


def dict_recursive_update(d1: dict, d2: Mapping) -> Mapping:
    for k, v in d2.items():
        if isinstance(v, Mapping):
            d1[k] = dict_recursive_update(d1.get(k, {}), v)
        else:
            d1[k] = v
    return d1


class MetaEnum(EnumMeta):
    def __contains__(cls, item):
        return item in tuple(cls)


class StrEnum(StrEnumBase, metaclass=MetaEnum):
    ...
