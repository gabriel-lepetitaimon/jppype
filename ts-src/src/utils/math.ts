export function isValidNumber(n: any): boolean {
  return n !== undefined && n !== null && typeof n === 'number' && !isNaN(n);
}

export function validNumber(n: any, defaultN: number): number {
  return isValidNumber(n) ? (n as number) : defaultN;
}

export function linspace(
  start: number,
  end: number,
  step: number,
  roundStart = false,
  skipStep?: number
): Array<number> {
  const a = new Array<number>();
  let i = roundStart ? Math.ceil(start / step) * step : start;
  while (i <= end) {
    if (skipStep === undefined ? true : i % skipStep) {
      a.push(i);
    }
    i += step;
  }
  return a;
}

export function optiLog10Step(scale: number, minStepSize = 30): number {
  const log10 = Math.log10(minStepSize / scale);
  const a = Math.trunc(log10);
  const b = log10 - a;

  if (a >= 0 && b > 0.69897) {
    // 10, 100, ...
    return 10 ** (a + 1);
  } else if (a > 0 && b <= 0.39794) {
    // 25, 250, ...
    return 10 ** a * 2.5;
  } else if (log10 >= 0) {
    // 5, 50, ...
    return 10 ** a * 5;
  } else {
    return 1;
  }
}

export interface Interval {
  start: number;
  end: number;
}

export function inInterval(i: number, interval: Interval, margin = 0): boolean {
  return interval.start - margin <= i && i <= interval.end + margin;
}
