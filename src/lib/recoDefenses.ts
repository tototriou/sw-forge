// Vue DÉFENSE d'une recommandation : les défenses visées, et pour chacune les
// offenses de la recommandation qui la battent — l'inverse de la vue Attaque
// (un deck, puis les défenses contre lesquelles il est fort). Spec :
// docs/02-app/siege/ § Vue Défense.
//
// ⚠️ **Une VUE, pas un modèle** : tout est DÉRIVÉ des `counters` de chaque
// deck, rien n'est stocké. Le format exporté ne change pas : un ancien fichier
// s'affiche dans les deux vues sans conversion, et les fichiers déjà partagés
// restent lisibles.
//
// ⚠️ **Même défense = même LEADER et mêmes deux autres monstres**, dans
// n'importe quel ordre : un leader différent change la
// défense en jeu — son lead —, les deux autres se saisissent dans l'ordre
// qu'on veut. Un monstre sans identifiant (saisi à la main) se reconnaît à son
// nom, sans casse.

import type { Reco, RecoCounter } from '../types';

// Les deux vues de la page : Attaque (deck → défenses battues, où l'on
// modifie) et Défense (défense → offenses qui la battent, en lecture seule).
export type VueRecos = 'attaque' | 'defense';

// Une offense de la recommandation qui bat la défense : le deck, et la défense
// visée telle que CE deck la porte (sa précision, « si Galleon est en lead »,
// lui appartient).
export interface OffenseContre {
  deckIndex: number;
  counterIndex: number;
  note: string;
}

export interface DefenseVisee {
  cle: string;
  // Les monstres tels que saisis à la PREMIÈRE apparition de la défense.
  monsters: RecoCounter['monsters'];
  offenses: OffenseContre[];
}

export interface VueDefenses {
  defenses: DefenseVisee[];
  // Les decks qui ne visent aucune défense : ils n'ont pas de ligne à eux, mais
  // ne disparaissent pas de la vue — rien n'est caché en changeant de vue.
  sansDefense: number[];
}

function cleMonstre(m: { com2usId: number | null; name: string }): string {
  if (m.com2usId != null) return `#${m.com2usId}`;
  const nom = m.name.trim().toLowerCase();
  return nom ? `@${nom}` : '';
}

// `null` : défense entièrement vide (trois emplacements non remplis) — elle ne
// nomme rien, elle ne fait pas de ligne.
export function cleDefense(monsters: RecoCounter['monsters']): string | null {
  const cles = monsters.map(cleMonstre);
  if (cles.every((c) => c === '')) return null;
  const [leader = '', ...autres] = cles;
  return `${leader}|${autres.filter(Boolean).sort().join('+')}`;
}

// `garder` : filtre d'une recherche en cours (deck, défense) — `counterIndex`
// vaut `null` pour un deck sans défense visée. Absent : tout est gardé.
export function vueDefenses(
  reco: Reco,
  garder?: (deckIndex: number, counterIndex: number | null) => boolean,
): VueDefenses {
  const parCle = new Map<string, DefenseVisee>();
  const sansDefense: number[] = [];

  reco.decks.forEach((deck, deckIndex) => {
    let viseUneDefense = false;
    deck.counters.forEach((counter, counterIndex) => {
      const cle = cleDefense(counter.monsters);
      if (cle == null) return;
      viseUneDefense = true;
      if (garder && !garder(deckIndex, counterIndex)) return;
      let defense = parCle.get(cle);
      if (!defense) {
        defense = { cle, monsters: counter.monsters, offenses: [] };
        parCle.set(cle, defense);
      }
      // Un deck qui vise deux fois la même défense n'y figure qu'une fois : la
      // première saisie, et sa précision.
      if (!defense.offenses.some((o) => o.deckIndex === deckIndex)) {
        defense.offenses.push({ deckIndex, counterIndex, note: counter.note });
      }
    });
    if (!viseUneDefense && (!garder || garder(deckIndex, null))) sansDefense.push(deckIndex);
  });

  // Ordre de PREMIÈRE apparition (deck puis défense) : celui de la vue Attaque,
  // qu'on retrouve en changeant de vue. `Map` garde l'ordre d'insertion.
  return { defenses: [...parCle.values()], sansDefense };
}
