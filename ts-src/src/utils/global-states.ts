import { useEffect, useReducer } from 'react';
import { BehaviorSubject } from 'rxjs';

// Inspired from https://itnext.io/handling-global-state-in-react-without-providers-and-boilerplate-61d9b371bc14

export const createGlobalStateHook = <S>(init: S) => {
  const state$ = new BehaviorSubject(init);

  const setState = (change: S | ((state: S) => S)) => {
    state$.next(change instanceof Function ? change(state$.value) : change);
  };

  return (): [S, typeof setState] => {
    const [, forceUpdate] = useReducer((s) => s + 1, 0);
    useEffect(() => {
      const subscription = state$.subscribe(forceUpdate);
      return () => subscription.unsubscribe();
    }, []);

    return [state$.value, setState];
  };
};
