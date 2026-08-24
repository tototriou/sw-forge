// Passage de main du SIÈGE vers le SPEED TUNING : « voir le speed tune » d'une
// équipe l'ouvre dans l'outil, déjà chargée.
//
// ⚠️ **`sessionStorage`, et une seule fois.** L'équipe n'est pas un état de
// l'app : c'est un message d'un écran à l'autre, consommé à l'arrivée. Le
// stocker durablement le ferait revenir à chaque visite de l'outil, longtemps
// après qu'on ait oublié d'où il venait. Passer par l'URL était l'autre option —
// écartée : une équipe complète n'y tient pas sans la sérialiser, et on ne
// partage pas ce lien.
//
// ⚠️ Le message ne porte QUE l'identifiant de l'équipe et son camp : l'équipe
// elle-même vit dans `useSiegeState` (localStorage), que l'outil relit. Copier
// les monstres ici aurait fait une deuxième source de vérité.

export type CampSiege = 'defense' | 'offense';

export interface PasseDeck {
  source: CampSiege;
  teamId: string;
}

const CLE = 'sw-forge-speedtune-deck';

export function poserDeck(source: CampSiege, teamId: string) {
  try {
    sessionStorage.setItem(CLE, JSON.stringify({ source, teamId }));
  } catch {
    /* stockage indisponible : l'outil s'ouvrira vide, ce n'est pas une erreur */
  }
}

// Lit le message ET l'efface : il ne vaut que pour cette arrivée-là.
export function prendreDeck(): PasseDeck | null {
  try {
    const brut = sessionStorage.getItem(CLE);
    if (!brut) return null;
    sessionStorage.removeItem(CLE);
    const lu = JSON.parse(brut) as Partial<PasseDeck>;
    if ((lu.source !== 'defense' && lu.source !== 'offense') || typeof lu.teamId !== 'string') return null;
    return { source: lu.source, teamId: lu.teamId };
  } catch {
    return null;
  }
}
