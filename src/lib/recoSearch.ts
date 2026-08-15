// Recherche d'un monstre dans les recommandations — calcul pur.
//
// Deux questions différentes se posent devant une liste de recommandations :
//
//   « **contre quoi** ce monstre est-il joué ? »  → il est dans une DÉFENSE visée
//   « **qui** joue ce monstre ? »                 → il est dans un DECK
//
// ⚠️ La recherche regarde **toujours les deux**, et le sélecteur ne fait que
// **classer** les résultats. Restreindre la portée au type choisi cachait des
// correspondances réelles sans le dire : on cherche « Chloe », on ne la voit
// pas, et rien à l'écran n'indique qu'elle existe juste à côté dans l'autre
// rôle. Ici, un résultat n'est jamais masqué — il est seulement plus bas.

import { Monster, Reco, RecoDeck } from '../types';

// Ce qu'on veut voir en premier. `all` n'ordonne rien de particulier.
export type RecoSearchMode = 'all' | 'defense' | 'offense';

// Où le monstre cherché a été trouvé, dans UN deck.
export interface DeckHit {
  deckIndex: number;
  // Positions dans les 3 slots du deck — le monstre est joué par ce deck.
  slots: number[];
  // Index des défenses visées qui le contiennent — le deck bat ce monstre.
  counters: number[];
}

export interface RecoHit {
  reco: Reco;
  decks: DeckHit[];
  // Pour le tri : un deck qui JOUE le monstre, une défense qui le PORTE.
  enOffense: boolean;
  enDefense: boolean;
}

// Normalisation pour comparer des noms saisis à la main : casse et accents
// ignorés. « chloe » doit trouver « Chloé », sinon la recherche ne sert à rien
// sur des noms que le jeu écrit avec des accents.
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Le nom affiché d'un monstre référencé par `com2usId` : celui du bestiaire s'il
// est chargé, sinon le nom figé au moment du partage (repli déjà utilisé partout
// ailleurs pour les monstres absents des données).
function nomDe(
  com2usId: number | null,
  fallback: string,
  monsterByCom2us: Map<number, Monster>
): string {
  if (com2usId == null) return fallback;
  return monsterByCom2us.get(com2usId)?.name ?? fallback;
}

// Toutes les recherches sont-elles satisfaites par cette composition, et à
// quelles positions ?
//
// ⚠️ **ET, pas OU** : chaque monstre ajouté PRÉCISE la recherche au lieu de
// l'élargir. C'est ce qui permet de retrouver une défense précise qu'on
// affronte — « Chloé + Trevor + Bella » doit sortir le deck qui bat exactement
// cette composition, pas les trois listes de decks qui jouent l'un des trois.
//
// Renvoie les positions occupées, ou `null` si un seul terme n'est pas trouvé.
function positionsSiToutes(
  noms: string[], // noms des monstres de la composition, dans l'ordre des positions
  termes: string[]
): number[] | null {
  const positions = new Set<number>();
  for (const t of termes) {
    const i = noms.findIndex((n, k) => n.includes(t) && !positions.has(k));
    // ⚠️ Une position déjà prise ne compte pas deux fois : chercher deux fois le
    // même nom exigerait deux monstres, or une composition n'en a que trois.
    // Sans ça, « chloe chloe » passerait sur un deck avec une seule Chloé.
    if (i < 0) return null;
    positions.add(i);
  }
  return [...positions];
}

// Les monstres cherchés sont-ils dans ce deck, et où ?
//
// ⚠️ Le « tous présents » vaut **par composition** : soit les trois slots du
// deck, soit une MÊME défense visée. Réparti entre les deux, il ne voudrait rien
// dire — un deck qui joue Chloé et qui bat Trevor ne « contient » pas
// « Chloé + Trevor » au sens où on le cherche.
function chercheDansDeck(
  deck: RecoDeck,
  deckIndex: number,
  termes: string[],
  monsterByCom2us: Map<number, Monster>
): DeckHit | null {
  const nomsSlots = deck.slots.map((sl) =>
    sl.com2usId == null ? '' : normalise(nomDe(sl.com2usId, sl.name, monsterByCom2us))
  );
  const slots = positionsSiToutes(nomsSlots, termes) ?? [];

  const counters: number[] = [];
  deck.counters.forEach((c, i) => {
    const noms = c.monsters.map((m) =>
      m.com2usId == null ? '' : normalise(nomDe(m.com2usId, m.name, monsterByCom2us))
    );
    if (positionsSiToutes(noms, termes)) counters.push(i);
  });

  if (!slots.length && !counters.length) return null;
  return { deckIndex, slots, counters };
}

// Recommandations contenant le monstre cherché, ordonnées selon le mode.
//
// Une requête vide renvoie tout, sans hit : c'est l'état neutre de la page, on
// ne veut alors ni filtrer ni déplier quoi que ce soit.
export function chercheMonstre(
  recos: Reco[],
  query: string | string[],
  mode: RecoSearchMode,
  monsterByCom2us: Map<number, Monster>
): RecoHit[] | null {
  // Les termes vides sont écartés : un emplacement de recherche non rempli ne
  // doit rien exiger — sinon ajouter un champ vide viderait tous les résultats.
  const termes = (Array.isArray(query) ? query : [query]).map(normalise).filter(Boolean);
  if (!termes.length) return null;

  const hits: RecoHit[] = [];
  for (const reco of recos) {
    const decks: DeckHit[] = [];
    reco.decks.forEach((deck, di) => {
      const h = chercheDansDeck(deck, di, termes, monsterByCom2us);
      if (h) decks.push(h);
    });
    if (!decks.length) continue;
    hits.push({
      reco,
      decks,
      enOffense: decks.some((d) => d.slots.length > 0),
      enDefense: decks.some((d) => d.counters.length > 0),
    });
  }

  // ⚠️ Un tri STABLE qui ne retire rien : le mode remonte ce qui correspond au
  // rôle demandé, il ne masque pas le reste. Une reco où le monstre n'apparaît
  // que dans l'autre rôle reste visible, plus bas dans la liste.
  if (mode === 'defense') {
    return [...hits].sort((a, b) => Number(b.enDefense) - Number(a.enDefense));
  }
  if (mode === 'offense') {
    return [...hits].sort((a, b) => Number(b.enOffense) - Number(a.enOffense));
  }
  return hits;
}
