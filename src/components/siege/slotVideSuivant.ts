// ⚠️ **Un monstre choisi, le curseur passe au monstre suivant** : on compose
// une équipe ou une défense d'affilée, sans la souris. Vaut pour les 3 slots
// d'un deck de recommandation, les 3 monstres d'une défense visée (« Fort
// contre ») et les 3 slots d'une équipe de Siège Défense / Offense. Calcul pur, testé à part
// (tests/siege-slot-suivant.test.ts) : le focus lui-même ne se voit pas dans
// un rendu serveur.

// Le slot VIDE qui suit celui qu'on vient de remplir, en bouclant sur ceux
// d'avant (on a pu commencer par le deuxième) ; `null` si le trio est complet
// — le focus reste alors où il est, il n'y a plus de champ à remplir.
// `occupes` est lu AVANT la mise à jour : le slot `rempli` y compte comme pris,
// quelle que soit sa valeur.
export function slotVideSuivant(occupes: boolean[], rempli: number): number | null {
  const n = occupes.length;
  for (let pas = 1; pas < n; pas++) {
    const i = (rempli + pas) % n;
    if (!occupes[i]) return i;
  }
  return null;
}

// Le slot à focaliser, et un compteur qui CHANGE à chaque demande : voir
// `jetonFocus` dans MonsterPicker — un champ ne reprend le focus que si son
// jeton change.
export type JetonSlot = { slot: number; n: number };

export function prochainFocus(courant: JetonSlot | null, occupes: boolean[], rempli: number): JetonSlot | null {
  const slot = slotVideSuivant(occupes, rempli);
  return slot == null ? null : { slot, n: (courant?.n ?? 0) + 1 };
}
