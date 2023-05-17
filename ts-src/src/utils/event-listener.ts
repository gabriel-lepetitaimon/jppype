import { RefObject, useEffect } from 'react';

export function useEventListener<
  K extends keyof GlobalEventHandlersEventMap
>(
  ref: RefObject<HTMLElement | null>,
  event: K,
  listener: (event: GlobalEventHandlersEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const listenerWrapper = ((e: GlobalEventHandlersEventMap[K]) =>
      listener(e)) as EventListener;

    node.addEventListener(event, listenerWrapper, options);

    return () => node.removeEventListener(event, listenerWrapper);
  }, [ref, event, listener, options]);
}


const EventListenerMode = {capture: true};

export function captureMouseEvents (e: MouseEvent,
                                    onMousemove: (e: MouseEvent) => void ,
                                    onMouseup: (e: MouseEvent) => void,
    ) : void {
  const mouseupListener = (e: MouseEvent) => {
    onMouseup(e);
    e.preventDefault();
    e.stopPropagation();

    restoreGlobalMouseEvents();
    document.removeEventListener ('mouseup',   mouseupListener,   EventListenerMode);
    document.removeEventListener ('mousemove', mousemoveListener, EventListenerMode);
  }
  const mousemoveListener = (e: MouseEvent) => {
    onMousemove(e);
    e.preventDefault();
    e.stopPropagation();
  }

  preventGlobalMouseEvents ();
  document.addEventListener ('mouseup',   mouseupListener, EventListenerMode);
  document.addEventListener ('mousemove', mousemoveListener, EventListenerMode);
  e.preventDefault ();
  e.stopPropagation ();
}

function preventGlobalMouseEvents () {
  document.body.style.pointerEvents = 'none';
}

function restoreGlobalMouseEvents () {
  document.body.style.pointerEvents = 'auto';
}