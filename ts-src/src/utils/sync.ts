export interface sync<V> {
  onChange: (subscribe: (v: V) => void) => void;
  set: (v: V) => void;
}
