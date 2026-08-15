// Recherche d'un monstre dans les recommandations — calcul pur.
//
// Deux questions différentes se posent devant une liste de recommandations :
//
//   « **contre quoi** ce monstre est-il joué ? »  → il est dans une DÉFENSE visée
//   « **qui** joue ce monstre ? »                 → il est dans un DECK
//
// ⚠️ Le sélecteur **FILTRE** : il décide où l'on cherche, et ce qui relève de
// l'autre rôle n'est pas affiché. Un mode qui se contentait de trier laissait à
// l'écran des résultats qu'on n'avait pas demandés — demander « offense à
// runer » et voir remonter des défenses n'est pas un classement, c'est du
// bruit. « Partout » reste là pour qui veut les deux.

import { Monster, Reco, RecoDeck } from '../types';

// Où chercher. `all` = les deux rôles.
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
  mode: RecoSearchMode,
  monsterByCom2us: Map<number, Monster>
): DeckHit | null {
  // ⚠️ Le mode RESTREINT où l'on cherche :
  //   `offense` → uniquement les monstres du deck (« qui joue ça ? ») ;
  //   `defense` → uniquement les défenses visées (« qui bat ça ? ») ;
  //   `all`     → les deux.
  // Un mode qui se contentait de trier laissait à l'écran des résultats de
  // l'autre rôle : demander « offense à runer » et voir remonter des défenses
  // n'est pas un classement, c'est du bruit.
  const dansOffense = mode !== 'defense';
  const dansDefense = mode !== 'offense';

  const nomsSlots = deck.slots.map((sl) =>
    sl.com2usId == null ? '' : normalise(nomDe(sl.com2usId, sl.name, monsterByCom2us))
  );
  const slots = dansOffense ? positionsSiToutes(nomsSlots, termes) ?? [] : [];

  const counters: number[] = [];
  if (dansDefense) {
    deck.counters.forEach((c, i) => {
      const noms = c.monsters.map((m) =>
        m.com2usId == null ? '' : normalise(nomDe(m.com2usId, m.name, monsterByCom2us))
      );
      if (positionsSiToutes(noms, termes)) counters.push(i);
    });
  }

  if (!slots.length && !counters.length) return null;
  return { deckIndex, slots, counters };
}

// Recommandations contenant le monstre cherché, dans le rôle demandé.
//
// Une requête vide renvoie `null` : c'est l'état neutre de la page, on ne veut
// alors ni filtrer ni déplier quoi que ce soit.
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
      const h = chercheDansDeck(deck, di, termes, mode, monsterByCom2us);
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

  // ⚠️ Aucun tri : le mode a déjà FILTRÉ à la source (voir `chercheDansDeck`).
  // Ce qui reste répond toutes au rôle demandé, il n'y a plus rien à départager
  // — et l'ordre de la liste reste celui de l'utilisateur.
  return hits;
}
