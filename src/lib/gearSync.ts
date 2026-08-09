// La vitesse saisie correspond-elle encore aux runes importées ?
//
// La « SPD runes » d'une entrée RTA est **modifiable à la main** (champ de
// l'ordre de tour), alors que le détail d'équipement, lui, reste celui de
// l'import. Dès que les deux divergent, le panneau de runes affiche des valeurs
// qui ne produisent plus la vitesse annoncée — d'où un avertissement.
//
// On ne stocke aucun drapeau « modifié » : on **recalcule** la vitesse que
// donneraient les runes et on compare. Avantage décisif : ça reste juste après
// un rechargement, après un réimport, et **ça s'efface tout seul** si le joueur
// remet la valeur d'origine.

import { GearSet } from '../types';
import { computeStats } from './stats';

// Vitesse apportée par les runes de ce build, bonus de set compris — c'est la
// convention du champ « SPD : » (voir shared/calcul-vitesse.md).
export function runeSpeedFromGear(gear: GearSet): number {
  const spd = computeStats(gear).find((r) => r.key === 'spd');
  return spd ? spd.total - gear.base.spd : 0;
}

// Écart entre la vitesse saisie et celle des runes ; `null` si tout concorde
// (ou s'il n'y a rien à comparer).
export function gearSpeedMismatch(
  gear: GearSet | undefined,
  runeSpeed: number | null
): { attendu: number; saisi: number } | null {
  if (!gear || gear.runes.length === 0 || runeSpeed == null) return null;
  const attendu = runeSpeedFromGear(gear);
  return attendu === runeSpeed ? null : { attendu, saisi: runeSpeed };
}

// Texte de l'infobulle, partagé par la carte et le panneau de détail.
export function desyncTitle(e: { attendu: number; saisi: number }): string {
  return (
    `Vitesse modifiée à la main : ${e.saisi} de SPD saisis, alors que les runes ` +
    `en donnent ${e.attendu}. Le détail d'équipement est celui de l'import et n'a ` +
    `pas changé — remets ${e.attendu} pour resynchroniser.`
  );
}
