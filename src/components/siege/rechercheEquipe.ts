import type { Monster, SiegeTeam } from '../../types';

// Recherche d'équipe de siège par monstre — ajout décidé par le mainteneur
// (refonte graphique, décision 14) ; spec : spec/siege/README.md § Recherche
// d'équipe par monstre. Affichage seulement : un filtre de liste.

// Insensible aux accents et à la casse : « chasun » trouve Chasun, « eleonore »
// trouve Éléonore — comme la recherche de pages.
export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// L'équipe contient-elle un monstre dont le nom contient la saisie ? Une saisie
// vide (ou d'espaces) garde toutes les équipes.
export function equipeContient(team: SiegeTeam, saisie: string, monsterById: Map<string, Monster>): boolean {
  const q = normaliser(saisie.trim());
  if (!q) return true;
  return team.slots.some((sl) => {
    const m = sl.monsterId ? monsterById.get(sl.monsterId) : undefined;
    return !!m && normaliser(m.name).includes(q);
  });
}
