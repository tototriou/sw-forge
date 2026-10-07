// La prose des passifs « Stats acquises en combat ».
//
// Deux vérifications :
// 1. `testProseStatsCombat` — la fonction pure `renduStatsCombat`
//    (src/lib/proseStatsCombat.ts) sur TOUT le corpus, avec les blocs voisins
//    construits par les mêmes producteurs que l'écran (OptimizerSection.tsx) :
//    l'inventaire des passifs de stats de combat (38 identifiants, 40 réglages, 80 formes), 30
//    proses pour 32 réglages, une par identifiant, jamais déjà rendue par un
//    bloc voisin. Les huit exclusions sont DÉDUITES de ces blocs, le test
//    vérifie seulement qu'on retrouve celles de l'inventaire. L'icône et le nom
//    du passif coiffent les 27 réglages dont le contrôle ne le nomme pas.
// 2. `testProseStatsCombatCarte` — la carte, sur la source (le dépôt n'a pas
//    d'infrastructure de test React, voir tests/run.mjs) : la prose passe par
//    `renduStatsCombat`, à un seul endroit, entre ce qui nomme le passif et
//    le réglage ; les blocs que la carte exclut sont ceux qui rendent une prose.
// 3. `testProseStatsCombatPassifMasque` — un passif
//    offensif MASQUÉ (choisi comme sort, ou qui ne suit pas le sort choisi)
//    et porteur de stats de combat garde sa prose, puisque l'exclusion ne lit
//    que les passifs que leur bloc rend (`passifsSuivants`).

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CombatStatProfile,
  type PassifOffensifProfile,
  type SkillDamageProfile,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsStackable,
  monsterBonusParEffetCible,
  monsterBonusParEffetPropre,
  monsterBonusSacrifice,
  monsterCombatStatProfiles,
  monsterConditionsCombat,
  monsterDamageSkills,
  monsterModificateursVit,
  monsterOffensivePassives,
  passifPeutSuivre,
  resolveDamageSkill,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { ProseDUnBloc, clesProseDejaRendue, renduStatsCombat } from '../src/lib/proseStatsCombat';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dossierSorts = resolve(racine, 'public/data/skills');

// Les huit blocs voisins, dans l'ordre de la carte, chacun construit par le
// producteur dont l'écran passe le résultat à `DamageSetupCard` ; les passifs
// offensifs sont ceux que leur bloc rend pour le sort retenu à l'ouverture
// (le sort par défaut : `passifsSuivants`). Les 84 formes à
// stats de combat ont toutes un sort par défaut : sans lui, la carte ne
// s'afficherait pas, et le test échoue plutôt que d'inventer un repli.
function blocsVoisins(fiche: DetailMonstre): (ProseDUnBloc | null)[] {
  const sort = resolveDamageSkill(monsterDamageSkills(fiche), null);
  if (!sort) throw new Error(`${fiche.com2usId} : aucun sort par défaut — la carte « Dégâts réels » ne s'afficherait pas`);
  return [
    ...monsterConditionsCombat(fiche),
    ...monsterModificateursVit(fiche),
    monsterBonusDegatsStackable(fiche),
    monsterBonusDegatsConditionnel(fiche),
    monsterBonusParEffetCible(fiche),
    monsterBonusParEffetPropre(fiche),
    monsterBonusSacrifice(fiche),
    ...monsterOffensivePassives(fiche).filter((p) => passifPeutSuivre(p, sort)),
  ];
}

// Le contrôle du réglage nomme-t-il déjà le passif ? Oracle du TEST, écrit
// comme la règle de branche de l'inventaire : un Jeton pour
// `toujours`, `debuffsInverses` et le `toggle` piloté par une condition déjà
// affichée ; un compteur ou un interrupteur d'état, nus, sinon.
function controleNomme(profil: CombatStatProfile, fiche: DetailMonstre): boolean {
  if (profil.source === 'toujours' || profil.source === 'debuffsInverses') return true;
  if (profil.source !== 'toggle' || !profil.togglePartageCondition) return false;
  const conditionnel = monsterBonusDegatsConditionnel(fiche);
  return monsterConditionsCombat(fiche).some((c) => c.condition.type === 'manuel' && c.skillCom2usId === profil.skillCom2usId)
    || conditionnel?.skillCom2usId === profil.skillCom2usId;
}

const EXCLUSIONS_1E = [2565, 9611, 9612, 9613, 9614, 9615, 10612, 18139];
// Flash Step (Ciri) et Turning Slash (Birgitta, Magic Order Swordsinger),
// compteurs de VIT : passifs offensifs
// « toujours », ils suivent chaque sort, et leur bloc rend déjà nom et prose.
const EXCLUSIONS_15E = [19014, 19414];

export function testProseStatsCombat() {
  titre('Stats acquises en combat — quelle prose est rendue, sur tout le corpus (degats-et-aura 11)');

  const formes: { fiche: DetailMonstre; profils: CombatStatProfile[] }[] = [];
  for (const nom of readdirSync(dossierSorts).filter((f) => f.endsWith('.json')).sort()) {
    const fiche: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, nom), 'utf8'));
    const profils = monsterCombatStatProfiles(fiche);
    if (profils.length > 0) formes.push({ fiche, profils });
  }

  // Ce que le bloc rend, résumé par identifiant : un triplet par réglage
  // [le contrôle nomme le passif, le réglage ouvre le passif, une prose est rendue].
  const resumeParId = new Map<number, string>();
  const nonUniformes = new Set<number>();
  const doublons: number[] = [];
  const reformulees: string[] = [];
  for (const { fiche, profils } of formes) {
    const blocs = blocsVoisins(fiche);
    const rendu = renduStatsCombat(profils, clesProseDejaRendue(blocs));
    const textesVoisins = new Set(blocs.map((b) => b?.description).filter((d): d is string => !!d));
    const proses = rendu.map((r) => r.prose).filter((p): p is string => p != null);
    if (rendu.length !== profils.length || new Set(proses).size !== proses.length || proses.some((p) => textesVoisins.has(p))) {
      doublons.push(fiche.com2usId);
    }
    rendu.forEach((r, i) => {
      const description = fiche.competences.find((c) => c.com2usId === profils[i].skillCom2usId)?.description;
      if (r.prose != null && r.prose !== description) reformulees.push(`${fiche.com2usId}/${profils[i].skillCom2usId}`);
    });
    for (const id of new Set(profils.map((p) => p.skillCom2usId))) {
      const resume = JSON.stringify(profils.flatMap((p, i) => (p.skillCom2usId === id
        ? [[controleNomme(p, fiche), rendu[i].ouvre, rendu[i].prose != null]] : [])));
      const precedent = resumeParId.get(id);
      if (precedent != null && precedent !== resume) nonUniformes.add(id);
      resumeParId.set(id, resume);
    }
  }
  const reglagesParId = new Map([...resumeParId].map(([id, r]) => [id, JSON.parse(r) as [boolean, boolean, boolean][]]));
  const somme = (ids: number[]) => ids.reduce((s, id) => s + reglagesParId.get(id)!.length, 0);
  const tous = [...reglagesParId.keys()].sort((a, b) => a - b);

  egal([tous.length, somme(tous), formes.length], [40, 42, 84],
    'inventaire du lot 1e retrouvé, plus Flash Step et Turning Slash (15e, quatre formes) : 40 identifiants, 42 réglages, 84 formes');
  egal([...nonUniformes], [], 'même rendu sur toutes les formes qui partagent un identifiant');
  egal(doublons, [],
    'aucun doublon : sur les 84 formes, aucune prose rendue deux fois par le bloc, aucune déjà rendue par un bloc voisin');
  egal(reformulees, [], 'prose du jeu telle quelle : la description de la compétence, jamais reformulée');

  const avecProse = tous.filter((id) => reglagesParId.get(id)!.some(([, , prose]) => prose));
  egal(reglagesParId.get(10014)?.length === 2 && reglagesParId.get(11663)?.length === 2, true,
    'précondition : Elsharion (10014) et Crane (11663) portent deux réglages chacun');
  egal([avecProse.length, somme(avecProse)], [30, 32], '30 proses, une par identifiant, pour 32 réglages');
  egal(tous.filter((id) => reglagesParId.get(id)!.filter(([, , prose]) => prose).length > 1), [],
    'jamais deux proses pour un même identifiant');
  egal(reglagesParId.get(10014), [[false, true, true], [false, false, false]],
    'Elsharion : une seule description, au-dessus du premier de ses deux compteurs');
  egal(reglagesParId.get(11663), [[false, true, true], [false, false, false]],
    'Crane : une seule description, au-dessus du premier de ses deux compteurs');

  const exclus = tous.filter((id) => reglagesParId.get(id)!.every(([, ouvre, prose]) => !ouvre && !prose));
  egal(exclus, [...EXCLUSIONS_1E, ...EXCLUSIONS_15E],
    'dix exclusions, déduites des blocs voisins : celles du lot 1e (2565, 9611 à 9615, 10612, 18139) et Flash Step, Turning Slash (15e), ni prose ni en-tête');

  // L'icône et le nom au-dessus des réglages dont le contrôle ne nomme pas le passif.
  const nus = tous.filter((id) => reglagesParId.get(id)!.every(([nomme]) => !nomme));
  const coiffes = nus.filter((id) => !exclus.includes(id));
  egal([coiffes.length, somme(coiffes)], [25, 27],
    'icône et nom du passif au-dessus des 27 réglages sans nom (25 passifs, un en-tête chacun)');
  const nommes = tous.filter((id) => !exclus.includes(id) && reglagesParId.get(id)!.every(([nomme]) => nomme));
  egal(nommes.map((id) => [id, reglagesParId.get(id)!.every(([, ouvre, prose]) => ouvre && prose)]),
    [[14313, true], [14813, true], [19814, true], [21515, true], [22115, true]],
    'les cinq passifs déjà nommés par un Jeton (Rankyaku, Accelerando, Inverted Output, Fierce Attack!, Attack Instinct) reçoivent leur prose sous ce Jeton, sans second en-tête');
  egal(nus.filter((id) => exclus.includes(id)), [10612, ...EXCLUSIONS_15E],
    'réglages sans nom laissés tels quels : 10612 (Astar), 19014 (Flash Step), 19414 (Turning Slash), dont « Passifs offensifs » rend déjà le nom et la prose — leur libellé de compteur porte le nom du passif');
}

// Le code seul : un commentaire qui cite un motif ne doit ni faire échouer ni
// faire passer un contrôle.
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// Le texte entre `debut` (inclus) et la première occurrence de `fin` qui suit ;
// vide si l'un des deux manque, pour que le contrôle qui en dépend échoue.
function entre(source: string, debut: string, fin: string): string {
  const i = source.indexOf(debut);
  if (i < 0) return '';
  const j = source.indexOf(fin, i + debut.length);
  return j < 0 ? '' : source.slice(i, j);
}

export function testProseStatsCombatCarte() {
  titre('Stats acquises en combat — la carte rend la prose par `renduStatsCombat` (degats-et-aura 11)');

  const brute = readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const carte = sansCommentaires(brute);
  ok(carte.includes("import { clesProseDejaRendue, renduStatsCombat } from '../../lib/proseStatsCombat';"),
    'la carte importe la fonction pure, elle ne réécrit pas la règle');

  // Les blocs qui rendent la prose d'une compétence, hors « Stats acquises en combat ».
  egal([...carte.matchAll(/<p className="mt-1 text-xs leading-snug text-ink-dim">\{(\w+)\.description\}<\/p>/g)].map((m) => m[1]),
    ['p', 'm', 'bonusDegatsStack', 'bonusDegatsConditionnel', 'bonusParEffetCibleMonstre', 'bonusParEffetPropre', 'bonusSacrifice', 'p'],
    'huit blocs rendent une prose : conditions de combat, modificateurs de VIT, accumulable, conditionnel, par effet sur la cible, par effet propre, sacrifice, passifs offensifs');
  const appel = entre(carte, 'const renduCombat = renduStatsCombat(', '\n  );');
  const exclusion = appel.match(/clesProseDejaRendue\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  egal(exclusion.split(',').map((s) => s.trim()).filter(Boolean),
    ['...conditionsCombatMonstre', '...modificateursVit', 'bonusDegatsStack', 'bonusDegatsConditionnel',
      'bonusParEffetCibleMonstre', 'bonusParEffetPropre', 'bonusSacrifice', '...passifsSuivants'],
    'l’exclusion lit ces huit blocs, et eux seuls — pour les passifs offensifs, ceux que leur bloc rend (`passifsSuivants`, degats-et-aura 9c)');
  const definition = 'const passifsSuivants = passifs.filter((p) => passifPeutSuivre(p, resolved));';
  ok(carte.includes(definition) && carte.indexOf(definition) < carte.indexOf('const renduCombat = renduStatsCombat('),
    '`passifsSuivants` (passifPeutSuivre, la porte du calcul) est défini avant l’exclusion qui le lit');
  ok(/renduStatsCombat\(\s*combatStats,/.test(appel), 'le rendu porte sur les profils affichés (`combatStats`), dans leur ordre');

  const bloc = entre(carte, '{combatStats.map((profile, index) => {', '\n            })}');
  ok(bloc.length > 0, 'précondition : le bloc « Stats acquises en combat »');
  ok(/const \{ ouvre, prose \} = renduCombat\[index\];/.test(bloc), 'chaque réglage lit son rendu par son index');
  egal((bloc.match(/\{prose\}/g) ?? []).length, 1, 'une seule place pour la prose dans le bloc : jamais rendue deux fois');
  ok(/return \(\s*<div key=\{key\}>\s*\{nomme\}\s*\{prose && <p className="mt-1 text-xs leading-snug text-ink-dim">\{prose\}<\/p>\}\s*\{reglage\}\s*<\/div>\s*\);/.test(bloc),
    'ordre : ce qui nomme le passif, puis sa prose, puis le champ de saisie');
  ok(/const nomDuPassif = ouvre \? <Jeton icone=\{icone\} libelle=\{nom\} \/> : null;/.test(bloc),
    'en-tête : l’icône et le nom du passif, seulement sur le réglage qui l’ouvre');
  egal((bloc.match(/nomme = nomDuPassif;/g) ?? []).length, 2,
    'en-tête posé seulement au-dessus d’un compteur ou d’un interrupteur d’état (deux branches)');
  ok(!/\.description\b/.test(bloc) && !/profile\.description/.test(carte),
    'la carte ne lit jamais `profile.description` : la prose ne passe que par `renduStatsCombat`');

  // Ancres des validateurs de l'inventaire et du corpus
  // (scripts/audit-degats-aura-corpus.mjs) : chacune une fois et une seule.
  for (const fragment of [
    '{combatStats.map((profile, index) => {',
    "profile.source === 'debuffsInverses'",
    "profile.source === 'toujours'",
    "if (profile.source === 'debuffsInverses')",
    "if (profile.source === 'toujours')",
    "if (profile.source === 'toggle')",
    'const record = profile.source',
  ]) {
    egal(brute.split(fragment).length - 1, 1, `ancre unique dans la carte : ${fragment}`);
  }
}

/**
 * Un passif offensif MASQUÉ qui porte aussi un
 * réglage de stats de combat garde sa prose. Aucun cas au corpus (sentinelle
 * `testLot12PassifMasqueEtStatsDeCombat`) : le passif est SYNTHÉTIQUE, posé
 * sur l'identifiant d'un réglage RÉEL ; l'exclusion est calculée comme la
 * carte (`passifsSuivants` = `passifPeutSuivre(p, resolved)`, vérifié sur la
 * source par `testProseStatsCombatCarte`).
 */
export function testProseStatsCombatPassifMasque() {
  titre('Stats acquises en combat — un passif masqué porteur de stats de combat garde sa prose (degats-et-aura 9c)');

  // Un réglage de stats de combat RÉEL qui porte une prose : le premier du corpus.
  let reglage: CombatStatProfile | undefined;
  for (const nom of readdirSync(dossierSorts).filter((f) => f.endsWith('.json')).sort()) {
    const fiche: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, nom), 'utf8'));
    reglage = monsterCombatStatProfiles(fiche).find((p) => !!p.description);
    if (reglage) break;
  }
  if (!reglage) {
    ok(false, 'précondition : un réglage de stats de combat avec prose dans le corpus');
    return;
  }
  const prose = reglage.description;
  // Passif offensif SYNTHÉTIQUE sur le même identifiant, qui ne suit que le slot 2.
  const passif = {
    skillCom2usId: reglage.skillCom2usId,
    nom: reglage.nom,
    description: prose,
    slotsDeclencheurs: [2],
  } as unknown as PassifOffensifProfile;
  const sort = (slot: number, skillCom2usId = 999_100 + slot) => ({ skillCom2usId, slot }) as SkillDamageProfile;
  // La carte : le bloc des passifs rend `passifsSuivants`, l'exclusion lit la même liste.
  const rendu = (choisi: SkillDamageProfile) => {
    const suivants = [passif].filter((p) => passifPeutSuivre(p, choisi));
    return { suivants, stats: renduStatsCombat([reglage!], clesProseDejaRendue([...suivants]))[0] };
  };

  const masqueParSlot = rendu(sort(1));
  egal(masqueParSlot.suivants, [], 'sort de slot 1 : le passif (slots déclencheurs [2]) est masqué, son bloc ne le rend pas');
  egal(masqueParSlot.stats, { ouvre: true, prose }, '… et « Stats acquises en combat » ouvre le passif avec sa prose : rien n’est perdu');

  const masqueCommeSort = rendu(sort(2, reglage.skillCom2usId));
  egal(masqueCommeSort.suivants, [], 'passif choisi lui-même comme sort : masqué');
  egal(masqueCommeSort.stats, { ouvre: true, prose }, '… et sa prose reste rendue par « Stats acquises en combat »');

  const suit = rendu(sort(2));
  egal(suit.suivants.length, 1, 'sort de slot 2 : le passif suit, son bloc rend sa prose');
  egal(suit.stats, { ouvre: false, prose: null }, '… et « Stats acquises en combat » ne la répète pas : une prose, une fois');

  // Témoin : l'ancienne exclusion (`...passifs`, tous) la perdait des deux côtés.
  egal(renduStatsCombat([reglage], clesProseDejaRendue([passif]))[0], { ouvre: false, prose: null },
    'témoin : exclure TOUS les passifs (avant 9c) aurait retiré prose et en-tête, alors que le bloc des passifs ne la rend pas');
}
