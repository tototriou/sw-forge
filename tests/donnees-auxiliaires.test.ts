// Les compétences auxiliaires de SWARFARM, rangées sous leur compétence par
// `scripts/fetch-skills.mjs` (`Competence.auxiliaires`).
//
// Vérifié sur les VRAIES données de `public/data/skills` : ce qui serait grave
// et invisible, c'est une régénération qui les perdrait (les dégâts de la
// forme archer des anges, des secondes phases, retomberaient à rien sans
// erreur), ou un auxiliaire déjà listé sur le monstre compté deux fois.
// Chaque valeur attendue est relevée dans l'API, jamais relue dans le script.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function auxiliaireDe(com2usId: number, sort: number) {
  const c = fiche(com2usId).competences.find((k) => k.com2usId === sort);
  return c?.auxiliaires ?? [];
}

export default function testDonneesAuxiliaires() {
  titre('Données — les compétences auxiliaires sont rangées sous leur compétence');

  // Hammer Punch de Tractor eau : l'auxiliaire 11616 désigne le sort (coup en plus).
  const hammer = auxiliaireDe(20811, 11601);
  egal(hammer.map((a) => [a.sens, a.competence.com2usId, a.competence.formule]), [['versCeSort', 11616, '1.8*{DEF}']],
    'Hammer Punch (Tractor eau) : un auxiliaire, versCeSort, 1.8*{DEF}');

  // Anges jumeaux : le Horn et le tir de l'archer se désignent l'un l'autre.
  const corne = auxiliaireDe(29111, 18801);
  egal(corne.map((a) => [a.sens, a.competence.nom, a.competence.formule]), [['mutuel', 'Aim Shot', '3.8*{ATK}']],
    'Horn of Charge (Ramael et Judiah) : Aim Shot, lien mutuel, 3.8*{ATK}');

  // Incarnation Split désigne un sort que rien ne désigne en retour.
  const incarnation = auxiliaireDe(42206, 100906);
  egal(incarnation.map((a) => [a.sens, a.competence.com2usId]), [['depuisCeSort', 100908]],
    'Incarnation Split : un auxiliaire, depuisCeSort');

  // Sans lien, pas de champ (la plupart des sorts).
  const magicRay = fiche(1000101).competences.find((k) => k.com2usId === 10111000);
  ok(magicRay !== undefined && magicRay.auxiliaires === undefined, 'Magic Ray : aucun auxiliaire, champ absent');

  let fichesAvecAuxiliaires = 0;
  let doublons = 0;
  for (const f of readdirSync(DOSSIER_SORTS)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    const listees = new Set(d.competences.map((c) => c.id));
    const aux = d.competences.flatMap((c) => c.auxiliaires ?? []);
    if (aux.length > 0) fichesAvecAuxiliaires++;
    doublons += aux.filter((a) => listees.has(a.competence.id)).length;
  }
  // Témoin : 165 fiches le 2026-10-17 ; un seuil bas, pour qu'un ajout de SWARFARM ne casse rien.
  ok(fichesAvecAuxiliaires >= 150, `témoin : au moins 150 fiches portent des auxiliaires (${fichesAvecAuxiliaires})`);
  egal(doublons, 0, 'aucun auxiliaire n’est aussi une compétence listée du monstre');
}
