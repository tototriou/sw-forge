import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

// État « collant » : conservé dans un cache mémoire par clé, pour survivre à la
// navigation entre pages (démontage/remontage du composant) sans persister sur
// disque. Se réinitialise au reload — cohérent avec les données de compte, elles
// aussi en mémoire. Gère nativement les valeurs non sérialisables (Set, tableaux…).
const store = new Map<string, unknown>();

// Les hooks MONTÉS, par clé. ⚠️ Vider le magasin ne suffit pas : un composant
// affiché tient sa propre copie dans un `useState` et continuerait de montrer
// l'ancien compte. Il faut le prévenir.
const abonnes = new Map<string, Set<() => void>>();

export function useStickyState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  // ⚠️ La valeur d'origine est CAPTURÉE une fois : c'est celle vers laquelle on
  // revient. Relire `initial` à chaque rendu suivrait un littéral (`[]`, `{}`)
  // recréé à chaque passage, ce qui ne veut rien dire.
  const origine = useRef(initial);
  useEffect(() => {
    store.set(key, state);
  }, [key, state]);
  useEffect(() => {
    const revenir = () => setState(origine.current);
    const pourCleClef = abonnes.get(key) ?? new Set();
    pourCleClef.add(revenir);
    abonnes.set(key, pourCleClef);
    return () => {
      pourCleClef.delete(revenir);
      if (pourCleClef.size === 0) abonnes.delete(key);
    };
  }, [key]);
  return [state, setState];
}

// ⚠️ **Repartir de zéro sur tout un domaine**, clés démontées comprises.
//
// Le cas : on importe le JSON d'un AUTRE compte. Les états collants qui
// décrivent des monstres — le speed tuning et son équipe, ses vitesses de runes,
// ses artéfacts — ne veulent alors plus rien dire : ils parlent de monstres qui
// ne sont plus là. Les laisser en place donne un écran qui a l'air valide et qui
// ment.
//
// ⚠️ **Le magasin ET les hooks montés** : effacer le premier seul laisserait un
// écran affiché sur ses anciennes valeurs, qu'il réécrirait aussitôt dans le
// magasin — la réinitialisation serait annulée par le composant lui-même.
export function reinitialiserSticky(prefixe: string) {
  for (const cle of [...store.keys()]) if (cle.startsWith(prefixe)) store.delete(cle);
  for (const [cle, listeners] of abonnes) {
    if (!cle.startsWith(prefixe)) continue;
    for (const revenir of [...listeners]) revenir();
  }
}
