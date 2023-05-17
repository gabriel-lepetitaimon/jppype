import useResizeObserver from '@react-hook/resize-observer';
import React, { RefObject } from 'react';
import { Point } from './point';

export default function useSize(target: RefObject<HTMLElement>): Point {
  const [size, setSize] = React.useState(new Point(0, 0));

  React.useLayoutEffect(() => {
    const width = target.current?.getBoundingClientRect().width;
    const height = target.current?.getBoundingClientRect().height;
    setSize(new Point(width, height));
  }, [target]);

  useResizeObserver(target, (entry) => {
    const { width, height } = entry.contentRect;
    setSize(new Point(width, height));
  });
  return size;
}
