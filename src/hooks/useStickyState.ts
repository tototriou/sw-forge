import { Dispatch, SetStateAction, useEffect, useState } from 'react';

// État « collant » : conservé dans un cache mémoire par clé, pour survivre à la
// navigation entre pages (démontage/remontage du composant) sans persister sur
// disque. Se réinitialise au reload — cohérent avec les données de compte, elles
// aussi en mémoire. Gère nativement les valeurs non sérialisables (Set, tableaux…).
const store = new Map<string, unknown>();

export function useStickyState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  useEffect(() => {
    store.set(key, state);
  }, [key, state]);
  return [state, setState];
}
