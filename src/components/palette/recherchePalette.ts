import type { ReactNode } from 'react';
import type { Monster, SiegeTeam } from '../../types';

// Ce que la palette Ctrl K propose pour une saisie (refonte graphique, lot 13,
// décision 29) — voir spec/shared/navigation.md § Palette Ctrl K. Pur : les
// règles de regroupement, d'ordre et de plafond se testent sans écran.

// Comparaison INSENSIBLE aux accents et à la casse : « arene » trouve « Arène »,
// « recos » trouve « Recommandations » — la règle de la recherche de pages.
export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Un résultat, quelle que soit sa nature : ce qu'on lit, et ce qu'il fait.
export interface EntreePalette {
  cle: string;
  libelle: string;
  // Précision à droite, en petit : la section d'une page, l'élément d'un
  // monstre, le côté d'une équipe.
  contexte?: string;
  icone?: ReactNode;
  // Un monstre : son portrait remplace l'icône.
  monstre?: Monster;
  faire: () => void;
}

export interface GroupePalette {
  titre: 'Pages' | 'Monstres' | 'Actions';
  entrees: EntreePalette[];
}

// Au plus 8 monstres et 8 équipes : la palette mène quelque part, elle ne
// remplace pas le Bestiaire. Les monstres, à partir de deux lettres : 3 000
// fiches ne se parcourent pas.
export const MAX_MONSTRES = 8;
export const MAX_EQUIPES = 8;
export const MIN_LETTRES_MONSTRES = 2;

export interface EquipeCherchable {
  cote: 'defense' | 'offense';
  rang: number; // 1, 2, 3… dans son côté
  team: SiegeTeam;
}

export function resultatsPalette({
  saisie,
  pages,
  actions,
  monstres,
  equipes,
  monsterById,
  ouvrirFiche,
  ouvrirSpeedTune,
}: {
  saisie: string;
  pages: EntreePalette[];
  actions: EntreePalette[];
  monstres: Monster[];
  equipes: EquipeCherchable[];
  monsterById: Map<string, Monster>;
  ouvrirFiche: (m: Monster) => void;
  ouvrirSpeedTune: (e: EquipeCherchable) => void;
}): GroupePalette[] {
  const q = normaliser(saisie.trim());
  const correspond = (e: EntreePalette) => !q || normaliser(e.libelle).includes(q) || normaliser(e.contexte ?? '').includes(q);

  const groupes: GroupePalette[] = [];

  const pagesTrouvees = pages.filter(correspond);
  if (pagesTrouvees.length) groupes.push({ titre: 'Pages', entrees: pagesTrouvees });

  if (q.length >= MIN_LETTRES_MONSTRES) {
    // Un nom par entrée : les formes d'un même monstre partagent souvent leur
    // nom, on garde la première.
    const vus = new Set<string>();
    const trouves: EntreePalette[] = [];
    for (const m of monstres) {
      if (trouves.length >= MAX_MONSTRES) break;
      const cle = `${m.name}|${m.element}`;
      if (vus.has(cle) || !normaliser(m.name).includes(q)) continue;
      vus.add(cle);
      trouves.push({ cle: `m-${m.id}`, libelle: m.name, contexte: 'Fiche', monstre: m, faire: () => ouvrirFiche(m) });
    }
    if (trouves.length) groupes.push({ titre: 'Monstres', entrees: trouves });
  }

  // Les actions fixes filtrées, puis le speed tuning des équipes dont un
  // monstre correspond — seulement quand on a tapé quelque chose.
  const actionsTrouvees = actions.filter(correspond);
  if (q) {
    const speed = equipes
      .filter(({ team }) =>
        team.slots.some((sl) => {
          const m = sl.monsterId ? monsterById.get(sl.monsterId) : undefined;
          return !!m && normaliser(m.name).includes(q);
        })
      )
      .slice(0, MAX_EQUIPES)
      .map((e): EntreePalette => {
        const noms = e.team.slots
          .map((sl) => (sl.monsterId ? monsterById.get(sl.monsterId)?.name : undefined))
          .filter(Boolean)
          .join(', ');
        return {
          cle: `st-${e.cote}-${e.team.id}`,
          libelle: `Speed tuning · ${noms}`,
          contexte: `${e.cote === 'defense' ? 'Défense' : 'Offense'} · équipe ${e.rang}`,
          faire: () => ouvrirSpeedTune(e),
        };
      });
    actionsTrouvees.push(...speed);
  }
  if (actionsTrouvees.length) groupes.push({ titre: 'Actions', entrees: actionsTrouvees });

  return groupes;
}
