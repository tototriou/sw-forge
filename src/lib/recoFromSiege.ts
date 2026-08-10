// Construction d'un deck de recommandation à partir d'une équipe de siège
// existante (offense). Les équipes importées d'un compte portent le `gear` de
// chaque monstre : on peut donc pré-remplir les stats RÉELLES du build, que
// l'auteur ajuste ensuite. Calcul pur.

import {
  ArtifactKind,
  MAX_ARTIFACT_SUBS,
  Monster,
  RecoDeck,
  RecoSlot,
  RecoStatKey,
  SiegeTeam,
  emptyRecoArtifacts,
  emptyRecoSlot,
} from '../types';
import { computeStats } from './stats';
import { canAddSet, isArtifactSub } from './effects';

// Stats totales d'un gear → minimums recommandés. On ne garde que les valeurs
// > 0 (une stat à 0, comme la précision d'un build sans précision, n'a rien à
// faire dans une recommandation).
function statsFromGear(slot: SiegeTeam['slots'][number]): Partial<Record<RecoStatKey, number>> {
  const out: Partial<Record<RecoStatKey, number>> = {};
  if (!slot.gear) return out;
  // `computeStats` renvoie déjà des entiers (arrondis au supérieur) : rien à
  // réarrondir ici, sous peine d'introduire un second arrondi.
  for (const row of computeStats(slot.gear)) {
    if (row.total > 0) out[row.key as RecoStatKey] = row.total;
  }
  return out;
}

// Les sets d'un slot de siège sont déjà les sets ACTIFS (calculés à l'import) :
// on les reprend tels quels, en respectant la limite de 6 runes par sécurité.
function setsFromSlot(slot: SiegeTeam['slots'][number]): string[] {
  const out: string[] = [];
  for (const key of slot.sets ?? []) {
    if (canAddSet(out, key)) out.push(key);
  }
  return out;
}

// Propriétés secondaires réellement portées par les artéfacts du build de
// siège. Comme les stats, elles sont reprises TELLES QUELLES : l'auteur retire
// ensuite ce qui n'est pas déterminant. Pré-remplir puis élaguer demande moins
// de travail que retrouver huit lignes dans une liste de 45.
function artifactsFromSlot(slot: SiegeTeam['slots'][number]): Record<ArtifactKind, number[]> {
  const out = emptyRecoArtifacts();
  for (const art of slot.gear?.artifacts ?? []) {
    for (const sub of art.subs) {
      if (!isArtifactSub(sub.code) || out[art.kind].includes(sub.code)) continue;
      if (out[art.kind].length >= MAX_ARTIFACT_SUBS) break;
      out[art.kind].push(sub.code);
    }
  }
  return out;
}

// Une équipe de siège → un deck de recommandation (mêmes positions, slot 0 =
// leader). Un monstre absent des données chargées ou sans `com2usId` (monstre
// perso, non partageable) laisse le slot vide.
//
// Le `name` reste VIDE : le nom affiché est alors dérivé des monstres du deck
// (« Trevor - Bella - Loren »). L'auteur peut le remplacer s'il le souhaite.
export function deckFromSiegeTeam(team: SiegeTeam, monsterById: Map<string, Monster>): RecoDeck {
  const slots: RecoSlot[] = team.slots.map((slot) => {
    const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
    if (!monster || monster.com2usId == null) return emptyRecoSlot();
    return {
      com2usId: monster.com2usId,
      name: monster.name,
      stats: statsFromGear(slot),
      // Une seule possibilité au départ : l'auteur en ajoute s'il veut.
      setOptions: [setsFromSlot(slot)],
      artifacts: artifactsFromSlot(slot),
    };
  });
  return { name: '', note: '', slots };
}

// Résumé d'une équipe pour le sélecteur (« Trevor · Bella · Loren »).
export function teamSummary(team: SiegeTeam, monsterById: Map<string, Monster>): string {
  const noms = team.slots
    .map((s) => (s.monsterId ? monsterById.get(s.monsterId)?.name : null))
    .filter((n): n is string => !!n);
  return noms.length ? noms.join(' · ') : 'équipe vide';
}

// Une équipe est proposable si elle contient au moins un monstre partageable.
export function isTeamUsable(team: SiegeTeam, monsterById: Map<string, Monster>): boolean {
  return team.slots.some((s) => {
    const m = s.monsterId ? monsterById.get(s.monsterId) : null;
    return !!m && m.com2usId != null;
  });
}
