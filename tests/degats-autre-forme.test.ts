// Les sorts de l'autre forme des anges jumeaux (`sortsDeLAutreForme`, damage.ts).
//
// Décision de l'utilisateur (valeurs-de-jeu-curees.md, « Anges jumeaux ») : le
// sort de la forme archer est choisi seul, sans le Horn lancé avant. Ce qui
// serait GRAVE ET INVISIBLE : ces cinq monstres sans aucun sort de dégâts
// (leur fiche ne liste que les Horn), ou un Horn calculé avec le ratio d'un tir.
// Les tirs attendus sont relevés dans l'API SWARFARM, écrits à la main.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { defaultDamageSkill, estPrisEnCharge, monsterDamageSkills } from '../src/lib/damage';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(racine, 'public/data/skills', `${com2usId}.json`), 'utf8'));
}

// [monstre, [identifiant, slot, nom, formule, coups, zone] par tir]
const ANGES: [string, number, [number, number, string, string, number, boolean][]][] = [
  ['Ramael et Judiah', 29111, [[18816, 1, 'Aim Shot', '3.8*{ATK}', 1, false], [18821, 2, 'Scatter Shot', '2.8*{ATK}', 1, true], [18826, 3, 'Focus Shot', '2.1*{ATK}', 3, false]]],
  ['Karuel et Lanoah', 29112, [[18817, 1, 'Aim Shot', '3.8*{ATK}', 1, false], [18822, 2, 'Multiple Shot', '1.6*{ATK}', 3, false], [18827, 3, 'Continuous Shot', '1.7*{ATK}', 5, false]]],
  ['Sadiel et Zeryah', 29113, [[18818, 1, 'Aim Shot', '3.8*{ATK}', 1, false], [18823, 2, 'Scatter Shot', '2.8*{ATK}', 1, true], [18828, 3, 'Charge Shot', '4.2*{ATK}', 1, true]]],
  ['Miruel et Graciah', 29114, [[18819, 1, 'Aim Shot', '3.8*{ATK}', 1, false], [18824, 2, 'Multiple Shot', '1.6*{ATK}', 3, false], [18829, 3, 'Barrage Shot', '1.4*{ATK}', 3, true]]],
  ['Jaduel et Aepiah', 29115, [[18820, 1, 'Aim Shot', '3.8*{ATK}', 1, false], [18825, 2, 'Scatter Shot', '2.8*{ATK}', 1, true], [18830, 3, 'Air Shot', '2.3*{ATK}', 2, true]]],
];

export default function testDegatsAutreForme() {
  for (const [monstre, forme, tirs] of ANGES) {
    titre(`Autre forme — ${monstre} (${forme}) : les tirs de la forme archer sont les sorts de dégâts`);
    const detail = fiche(forme);
    const sorts = monsterDamageSkills(detail);
    egal(
      sorts.map((s) => (estPrisEnCharge(s) ? [s.skillCom2usId, s.slot, s.nom, s.formule, s.hits, s.aoe] : ['refusé', s.nom])),
      tirs,
      `${forme} : les trois tirs, dans l’ordre des slots, avec leur ratio, leurs coups et leur portée`,
    );
    const horns = detail.competences.filter((c) => c.nom.startsWith('Horn of')).map((c) => c.com2usId);
    ok(horns.length === 3 && sorts.every((s) => !horns.includes(s.skillCom2usId)), `${forme} : aucun Horn n’est un sort de dégâts`);
    egal(defaultDamageSkill(sorts)?.skillCom2usId, tirs[2][0], `${forme} : le tir du S3 est le sort par défaut`);
  }

  titre('Autre forme — un sort qui frappe n’est jamais remplacé par le sort lié');
  {
    // Le même lien posé sur Aim Shot lui-même (sort à profil) : rien n'est ajouté.
    const detail = fiche(29111);
    const horn = detail.competences.find((c) => c.com2usId === 18801)!;
    const tir = horn.auxiliaires![0].competence;
    const avecTir: DetailMonstre = { ...detail, competences: [{ ...tir, auxiliaires: [{ sens: 'mutuel', competence: { ...tir, com2usId: 999_816 } }] }] };
    egal(monsterDamageSkills(avecTir).map((s) => s.skillCom2usId), [18816], 'Aim Shot dans la fiche, lié à un autre tir : seul Aim Shot');
    // Un lien qui n'est pas mutuel ne donne pas de sort.
    const versCeSort: DetailMonstre = { ...detail, competences: [{ ...horn, auxiliaires: [{ sens: 'depuisCeSort', competence: tir }] }] };
    egal(monsterDamageSkills(versCeSort).length, 0, 'Horn lié en depuisCeSort : aucun sort');
  }
}
