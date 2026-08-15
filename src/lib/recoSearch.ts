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

// Le monstre cherché est-il dans ce deck, et où ?
function chercheDansDeck(
  deck: RecoDeck,
  deckIndex: number,
  q: string,
  monsterByCom2us: Map<number, Monster>
): DeckHit | null {
  const slots: number[] = [];
  deck.slots.forEach((sl, i) => {
    if (sl.com2usId == null) return;
    if (normalise(nomDe(sl.com2usId, sl.name, monsterByCom2us)).includes(q)) slots.push(i);
  });

  const counters: number[] = [];
  deck.counters.forEach((c, i) => {
    const trouve = c.monsters.some(
      (m) => m.com2usId != null && normalise(nomDe(m.com2usId, m.name, monsterByCom2us)).includes(q)
    );
    if (trouve) counters.push(i);
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
  query: string,
  mode: RecoSearchMode,
  monsterByCom2us: Map<number, Monster>
): RecoHit[] | null {
  const q = normalise(query);
  if (!q) return null;

  const hits: RecoHit[] = [];
  for (const reco of recos) {
    const decks: DeckHit[] = [];
    reco.decks.forEach((deck, di) => {
      const h = chercheDansDeck(deck, di, q, monsterByCom2us);
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
