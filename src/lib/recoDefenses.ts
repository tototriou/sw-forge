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
// ⚠️ **Même défense = même équipe, au sens de `cleEquipe`** : même CHEF et
// mêmes deux autres monstres dans n'importe quel ordre, ou, sans chef, mêmes
// trois monstres dans n'importe quel ordre. Le chef est le premier monstre
// quand son lead est actif en siège : c'est lui seul qui change l'équipe en
// jeu. Un monstre sans identifiant (saisi à la main) se reconnaît à son nom,
// sans casse.

import type { ElementKey, LeaderSkill, Monster, Reco, RecoCounter } from '../types';

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

// Exportée pour la fusion d'un import (recoFusion.ts) : un monstre de défense
// s'y reconnaît de la même façon.
export function cleMonstre(m: { com2usId: number | null; name: string }): string {
  if (m.com2usId != null) return `#${m.com2usId}`;
  const nom = m.name.trim().toLowerCase();
  return nom ? `@${nom}` : '';
}

// Les monstres connus des données chargées, par `com2usId` : seuls leur leader
// skill et leur élément servent à la clé. Un paramètre, pas un import : le
// calcul reste pur, et l'écran passe l'index qu'il a déjà (`monsterByCom2us`).
export type MonstresConnus = ReadonlyMap<number, Pick<Monster, 'element' | 'leaderSkill'>>;

// Une leader skill est-elle active EN SIÈGE (contenu de guilde) pour cette
// équipe ? Même règle de portée que `siegeLeadFor` (speed.ts) pour la vitesse,
// étendue à toute leader skill, quelle que soit sa stat :
//  - General ou Guild : active ;
//  - Element : active si au moins un monstre de l'équipe est de cet élément ;
//  - Arena, Dungeon, ou pas de leader skill : inactive.
// ⚠️ Dans les données SWARFARM, un lead d'élément porte toujours l'élément de
// son monstre : le chef le remplit seul. La condition reste écrite pour un
// lead qui ne le ferait pas.
export function leadActifEnSiege(lead: LeaderSkill | null | undefined, elements: readonly ElementKey[]): boolean {
  if (!lead) return false;
  if (lead.area === 'General' || lead.area === 'Guild') return true;
  if (lead.area === 'Element') return lead.element != null && elements.includes(lead.element);
  return false;
}

// Le premier monstre compte-t-il pour chef ? Oui si son lead est actif en
// siège ; non s'il n'en a pas, ou si l'emplacement est vide.
//
// ⚠️ **Lead inconnu = chef** : un monstre saisi à la main (`com2usId` null, un
// nom) ou absent des données chargées. Le compter pour chef est le choix sûr :
// la clé distingue alors autant d'équipes que si son lead était actif, jamais
// moins — on ne regroupe ni ne fusionne deux équipes qui pourraient différer
// en jeu. Au pire, une même équipe apparaît deux fois. Même prudence pour un
// lead d'élément qu'un allié inconnu pourrait remplir.
function premierEstChef(monsters: readonly { com2usId: number | null; name: string }[], connus: MonstresConnus): boolean {
  const premier = monsters[0];
  if (!premier || cleMonstre(premier) === '') return false;
  const ficheDe = (m: { com2usId: number | null }) => (m.com2usId != null ? connus.get(m.com2usId) : undefined);
  const fiche = ficheDe(premier);
  if (!fiche) return true;
  const presents = monsters.filter((m) => cleMonstre(m) !== '');
  const elements = presents.flatMap((m) => {
    const e = ficheDe(m)?.element;
    return e ? [e] : [];
  });
  if (leadActifEnSiege(fiche.leaderSkill, elements)) return true;
  return fiche.leaderSkill?.area === 'Element' && presents.some((m) => !ficheDe(m));
}

// L'identité d'une ÉQUIPE de trois monstres — une défense visée, ou l'équipe
// d'un deck (recoFusion.ts) : une seule clé pour les deux.
//  - avec chef : `chef|les deux autres triés` ;
//  - sans chef : `|les trois triés`.
// Solveig-Adriana-Odin et Solveig-Odin-Adriana : même équipe (chef Solveig) ;
// Odin-Adriana-Solveig en est une autre (chef Odin) ; Kinki-Windy-Lulu et
// Windy-Lulu-Kinki : même équipe, aucun des deux premiers n'ayant de lead
// actif en siège.
// `null` : équipe entièrement vide (trois emplacements non remplis) — elle ne
// nomme rien.
export function cleEquipe(
  monsters: readonly { com2usId: number | null; name: string }[],
  connus: MonstresConnus,
): string | null {
  const cles = monsters.map(cleMonstre);
  if (cles.every((c) => c === '')) return null;
  const tries = (l: string[]) => l.filter(Boolean).sort().join('+');
  if (premierEstChef(monsters, connus)) {
    const [chef, ...autres] = cles;
    return `${chef}|${tries(autres)}`;
  }
  return `|${tries(cles)}`;
}

// `connus` : les monstres des données chargées, pour reconnaître le chef.
// `garder` : filtre d'une recherche en cours (deck, défense) — `counterIndex`
// vaut `null` pour un deck sans défense visée. Absent : tout est gardé.
export function vueDefenses(
  reco: Reco,
  connus: MonstresConnus,
  garder?: (deckIndex: number, counterIndex: number | null) => boolean,
): VueDefenses {
  const parCle = new Map<string, DefenseVisee>();
  const sansDefense: number[] = [];

  reco.decks.forEach((deck, deckIndex) => {
    let viseUneDefense = false;
    deck.counters.forEach((counter, counterIndex) => {
      const cle = cleEquipe(counter.monsters, connus);
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
