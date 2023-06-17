from __future__ import annotations
from typing import TypeVar, Generic, Protocol, Literal, Iterable
from asyncio import Future


class Event(dict):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)


E = TypeVar("E", bound=Event)


class EventCallBack(Generic[E], Protocol):
    def __call__(self, event: E):
        ...


class EventsDispatcherCallback(Generic[E]):
    def __init__(self, cb: EventCallBack[E], once: bool = False):
        self._cb = cb
        self._once = once
        self._dispatcher = []

    def __call__(self, event: E):
        if self._once:
            self.unsubscribe()
        self._cb(event)

    def _aknowlowdge_subscribe(self, dispatcher: EventsDispatcher):
        self._dispatcher.append(dispatcher)

    def unsubscribe(self):
        for d in self._dispatcher:
            d.unsubscribe(self)
        self._dispatcher.clear()


class EventFuture(EventsDispatcherCallback[E], Future):
    def __init__(self):
        EventsDispatcherCallback.__init__(self, self._on_event, True)
        Future.__init__(self)

    def _on_event(self, event: E):
        if self.done:
            if self.cancelled():
                print("EventFuture: cancelled")
                print(self.exception())
            else:
                print("EventFuture: already done")
                print(self.result())
        else:
            self.set_result(event)

    def result(self) -> E:
        return Future.result(self)


class EventsDispatcher(Generic[E]):
    def __init__(self):
        self._cb = []

    def __call__(self, cb: EventCallBack[E], once=False) -> EventsDispatcherCallback:
        return self.subscribe(cb, once)

    def dispatch(self, event: E):
        for cb in self._cb:
            cb(event)

    def create_future(self) -> EventFuture[E]:
        cb = EventFuture()
        self._cb.append(cb)
        cb._aknowlowdge_subscribe(self)
        return cb

    def subscribe(self, cb: EventCallBack[E], once=False):
        cb = EventsDispatcherCallback(cb, once)
        self._cb.append(cb)
        cb._aknowlowdge_subscribe(self)
        return cb

    def unsubscribe(self, cb: EventsDispatcherCallback):
        self._cb.remove(cb)


###################################################################################################
#           Events Specialization                                                                 #
###################################################################################################

MouseModifier = Literal["alt", "control", "shift", "meta"]


class ClickEvent(Event):
    def __init__(self, x: float, y: float, button: int, modifiers: Iterable[MouseModifier]):
        super().__init__(**{"x": x, "y": y, "button": button, "modifiers": modifiers})
        self.x = x
        self.y = y
        self.button = button
        self.modifiers = modifiers
