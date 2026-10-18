// Inventaire des compétences (`scripts/lib/inventaireCompetences.ts`), sur le
// VRAI corpus `public/data/skills`.
//
// Ce qui casserait sans bruit : un balayage qui lirait la formule de la FICHE
// au lieu de la formule RETENUE par l'application classerait « sans ratio »
// des sorts que l'app calcule — Purification, Cooperation! (21415) et Rite of
// Ashes (22015), fiche vide, ratio porté par leur compétence auxiliaire (relevé
// du 2026-10-17). Les comptes ci-dessous sont ceux des données du jour : une
// régénération qui les change se constate ici, et se relit.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import { inventaireDesCompetences, inventaireEnMarkdown, type EntreeInventaire } from '../scripts/lib/inventaireCompetences';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const FORMULE = /^formule-|^auxiliaire-|^ally-attack-|^coups-zero-/;

function une(id: number): EntreeInventaire | undefined {
  return inventaireDesCompetences({ racine, ids: [id] })[0];
}

export default function testInventaireCompetences() {
  titre('Inventaire des compétences — la formule retenue par l’app, la prose complète, des signaux');

  for (const [id, nom] of [[21415, 'Purification, Cooperation!'], [22015, 'Rite of Ashes']] as const) {
    const e = une(id);
    ok(e !== undefined, `${id} : présent au corpus`);
    if (!e) continue;
    egal(e.nom, nom, `${id} : ${nom}`);
    egal(e.formuleFiche, '', `${id} : formule de la fiche vide`);
    egal([e.formuleRetenue, e.origineFormule], ['4.5*{ATK}', 'auxiliaire'], `${id} : formule retenue 4.5*{ATK}, venue de l’auxiliaire`);
    ok(e.signaux.some((s) => s.code === 'formule-fiche-vide'), `${id} : signal formule-fiche-vide`);
    egal(e.calcul.statut, 'profil', `${id} : l’app le calcule (profil de dégâts)`);
  }

  const crossFire = une(10125);
  ok(crossFire !== undefined, '10125 Cross Fire : présent au corpus');
  if (crossFire) {
    egal([crossFire.formuleFiche, crossFire.formuleRetenue, crossFire.origineFormule], ['1.34*{ATK}', '1.34*{ATK}', 'fiche'], '10125 : la formule de la fiche est la formule retenue');
    egal(crossFire.signaux.filter((s) => FORMULE.test(s.code)), [], '10125 : aucun signal de formule');
  }

  // ⚠️ Tempest est un passif dont la formule vient de son AUXILIAIRE (3218),
  // pas de `FORMULES_CUREES_PAR_ID` : la table curée se vérifie sur Torrent.
  const tempest = une(3213);
  ok(tempest !== undefined, '3213 Tempest : présent au corpus');
  if (tempest) {
    egal([tempest.passif, tempest.formuleFiche, tempest.formuleRetenue, tempest.origineFormule], [true, '', '3.7*{ATK}', 'auxiliaire'], '3213 : passif, fiche vide, 3.7*{ATK} de l’auxiliaire');
    egal(tempest.calcul.statut, 'passif-offensif', '3213 : vu par l’app comme passif offensif');
  }
  const torrent = une(7808);
  if (torrent) {
    egal([torrent.formuleRetenue, torrent.origineFormule], ['5.5*{ATK}', 'curee'], '7808 Torrent : formule de la table curée');
    ok(torrent.signaux.some((s) => s.code === 'formule-fiche-remplacee'), '7808 : signal formule-fiche-remplacee');
  } else ok(false, '7808 Torrent : présent au corpus');

  // Prose complète : la description de la fiche, celle de chaque effet et de
  // l'auxiliaire, sans troncature, dans la sortie Markdown.
  const fiche: DetailMonstre = JSON.parse(readFileSync(resolve(racine, 'public/data/skills/31915.json'), 'utf8'));
  const brute = fiche.competences.find((c) => c.com2usId === 21415);
  const md = inventaireEnMarkdown(inventaireDesCompetences({ racine, ids: [21415] }));
  ok(!!brute?.description && md.includes(brute.description.trim()), '21415 : description complète du sort dans le Markdown');
  ok(!!brute && brute.effets.every((x) => md.includes((x.description ?? '').trim())), '21415 : description de chaque effet dans le Markdown');
  ok(!!brute?.auxiliaires?.length && brute.auxiliaires.every((a) => md.includes((a.competence.description ?? '').trim())), '21415 : prose de l’auxiliaire dans le Markdown');
  ok(md.includes('Nezuko Kamado') && md.includes('collab'), '21415 : porteurs nommés, forme collab signalée');

  const ally = inventaireDesCompetences({ racine, effet: 'Ally Attack' });
  egal(ally.length, 47, 'filtre par effet Ally Attack : 47 compétences (compte du 2026-10-16)');
  ok(ally.every((e) => e.effets.includes('Ally Attack')), 'filtre par effet : chacune porte l’effet');
  egal(new Set(ally.map((e) => e.com2usId)).size, ally.length, 'une entrée par identifiant');

  const filtres = inventaireDesCompetences({ racine, slot: 3, prose: 'together', monstre: 'nezuko' }).map((e) => e.com2usId);
  egal(filtres, [21415], 'filtres combinés (slot, prose, monstre)');

  // `formule-sans-calcul` : sorts ACTIFS seulement (limite déclarée) — un
  // passif non offensif à formule n'est jamais signalé.
  const sansCalcul = inventaireDesCompetences({ racine, signal: 'formule-sans-calcul' });
  ok(sansCalcul.length > 0, `formule-sans-calcul : des sorts actifs signalés (${sansCalcul.length})`);
  egal(sansCalcul.filter((e) => e.passif).map((e) => e.com2usId), [], 'formule-sans-calcul : aucun passif');
  ok(sansCalcul.every((e) => e.calcul.statut === 'refus' || e.calcul.statut === 'sans-profil'), 'formule-sans-calcul : chaque sort signalé est refusé ou sans profil');
  const passifsAFormule = inventaireDesCompetences({ racine }).filter((e) => e.passif && e.formuleRetenue && e.calcul.statut === 'passif-non-offensif');
  ok(passifsAFormule.length > 0 && passifsAFormule.every((e) => !e.signaux.some((s) => s.code === 'formule-sans-calcul')),
    `limite : ${passifsAFormule.length} passifs non offensifs à formule, aucun signalé`);
}
