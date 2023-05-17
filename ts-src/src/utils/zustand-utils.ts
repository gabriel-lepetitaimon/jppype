import {
  State,
  StateCreator,
  StoreMutatorIdentifier,
  Mutate,
  StoreApi,
} from 'zustand';

export const instantiatedStore = <T>(
  createStore: () => T
): ((instance: number) => T) => {
  const stores: { [name: number]: T } = {};

  return (instance: number): T => {
    let store = stores[instance];
    if (store === undefined) {
      store = createStore();
      stores[instance] = store;
    }
    return store;
  };
};

/***********************************************************************
 *                    ---  Sync Middleware  ---
 ***********************************************************************/

const __syncedStores: { [name: string]: any[] } = {};

const syncImpl: SyncMiddlewareImpl = (f) => (set, get, _store) => {
  type T = ReturnType<typeof f>;
  type MutatedStore = Mutate<StoreApi<T>, SyncProps>;
  const store = _store as MutatedStore;

  const syncedStores = __syncedStores as { [name: string]: MutatedStore[] };

  store.setSync = (syncKey: string | null) => {
    if (syncKey === store._syncKey) {
      return;
    }
    if (store._syncUnsub) {
      store._syncUnsub();
    }
    if (store._syncKey !== null) {
      syncedStores[store._syncKey].filter((v) => v !== store);
    }

    store._syncKey = syncKey;
    store._syncUnsub = undefined;

    if (syncKey !== null) {
      if (syncKey in syncedStores) {
        syncedStores[syncKey].push(store);
      } else {
        syncedStores[syncKey] = [store];
      }

      store._syncUnsub = store.subscribe((state) => {
        if (store._syncLock) {
          return;
        }
        store._syncLock = true;
        syncedStores[syncKey].forEach((s) => {
          if (!s._syncLock) {
            s._syncLock = true;
            s.setState(state);
            s._syncLock = false;
          }
        });
        store._syncLock = false;
      });
    }
  };

  store.getSync = () => store._syncKey;

  store._syncKey = null;
  store._syncUnsub = undefined;
  store._syncLock = false;

  return f(set, get, _store);
};

export const synchronizableStates = syncImpl as unknown as SyncMiddleware;

type SyncProps = [
  ['setSync', (syncKey: string | null) => void],
  ['getSync', () => string | null],
  ['_syncKey', string | null],
  ['_syncUnsub', (() => void) | undefined],
  ['_syncLock', boolean]
];

type SyncMiddleware = <
  S extends State,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<S, [...Mps, ...SyncProps], Mcs>
) => StateCreator<S, Mps, [...SyncProps, ...Mcs]>;

declare module 'zustand' {
  interface StoreMutators<S, A> {
    setSync: Write<
      Cast<S, object>,
      { setSync: (syncKey: string | null) => void }
    >;
    getSync: Write<Cast<S, object>, { getSync: () => string | null }>;
    _syncKey: Write<Cast<S, object>, { _syncKey: string | null }>;
    _syncUnsub: Write<
      Cast<S, object>,
      { _syncUnsub: (() => void) | undefined }
    >;
    _syncLock: Write<Cast<S, object>, { _syncLock: boolean }>;
  }
}

type SyncMiddlewareImpl = <
  S extends State,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<S, Mps, Mcs>
) => StateCreator<S, Mps, Mcs>;

// ***************************** MISC *****************************
type Cast<T, U> = T extends U ? T : U;
type Write<T, U> = Omit<T, keyof U> & U;
/*type PopArgument<T extends (...a: never[]) => unknown> = T extends (
  ...a: [...infer A, infer _]
) => infer R
  ? (...a: A) => R
  : never;*/
