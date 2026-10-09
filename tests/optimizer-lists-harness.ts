import React from 'react';
import { useOptimizerLists, type UseOptimizerLists } from '../src/hooks/useOptimizerLists';

// Le hook réel et ses effets, avec un ordonnanceur synchrone. Ce harnais ne
// prouve ni le montage DOM ni l'ordonnancement concurrent du navigateur.
export function monterListesOptimizer() {
  const internes = (React as unknown as { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    ReactCurrentDispatcher: { current: unknown };
  } }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const valeurs: unknown[] = [], dependances: (readonly unknown[] | undefined)[] = [];
  let index = 0, effets: (() => void)[] = [];
  const dispatcher = {
    useState<T>(initial: T | (() => T)): [T, (v: T | ((ancien: T) => T)) => void] {
      const place = index++;
      if (!(place in valeurs)) valeurs[place] = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [valeurs[place] as T, (v) => { valeurs[place] = typeof v === 'function' ? (v as (ancien: T) => T)(valeurs[place] as T) : v; }];
    },
    useCallback<T>(callback: T) { return callback; },
    useRef<T>(initial: T) {
      const place = index++;
      if (!(place in valeurs)) valeurs[place] = { current: initial };
      return valeurs[place] as { current: T };
    },
    useSyncExternalStore(_subscribe: unknown, snapshot: () => boolean) { return snapshot(); },
    useEffect(effet: () => void, deps?: readonly unknown[]) {
      const place = index++, ancien = dependances[place];
      if (!ancien || !deps || deps.some((d, i) => !Object.is(d, ancien[i]))) effets.push(effet);
      dependances[place] = deps;
    },
  };
  return {
    render(): UseOptimizerLists {
      index = 0; effets = [];
      const avant = internes.ReactCurrentDispatcher.current;
      internes.ReactCurrentDispatcher.current = dispatcher;
      let listes: UseOptimizerLists;
      try { listes = useOptimizerLists(); } finally { internes.ReactCurrentDispatcher.current = avant; }
      effets.forEach((effet) => effet());
      return listes;
    },
  };
}
