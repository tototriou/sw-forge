import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';
import { egal, ok, titre } from './outils';
import { bancOptimizer, fonctionDeSource } from './optimizer-transition-banc';
import { remplirCriteres } from './optimizer-criteres-caracterisation.test';
import {
  appliquerCriteres, baseCompleteCriteres, CLASSEMENT_CHAMPS_OPTIMIZER,
  completerCriteresImport, criteresApresChangementEspece, photoCriteres,
  type CriteresOptimizer, type CriteresPartielsOptimizer, type CritereVitesseOptimizer,
} from '../src/lib/criteresOptimizer';
import { DEFAULT_DAMAGE_SETUP, resolvedLeaderSkill } from '../src/lib/damage';
import { photoOptimizer } from '../src/lib/sessionOptimizer';

export async function testOptimizerCriteresPhotos() {
  titre('Optimizer · photos personnelles et trois états de lead');
  const banc = await bancOptimizer(); remplirCriteres(banc.etat);
  banc.etat.setCritereArtefacts('reel');
  const etat = banc.rendre();
  const personnelle = photoCriteres(etat, { type: 'personnel' });
  egal(Object.keys(personnelle).sort(), Object.entries(CLASSEMENT_CHAMPS_OPTIMIZER).filter(([, c]) => c === 'personnel').map(([k]) => k).sort(), 'photo : exactement les champs personnels');
  egal(photoCriteres(appliquerCriteres(personnelle, { type: 'personnel' }), { type: 'personnel' }), personnelle, 'photo → application personnelle → photo identique');
  const equipe = appliquerCriteres(personnelle, { type: 'equipe', lead: { stat: 'HP', pct: 33 } });
  egal(resolvedLeaderSkill(equipe.damageSetup), { stat: 'HP', pct: 33 }, 'lead effectif d’équipe');
  egal(equipe.damageSetup.leaderSpeedPct, undefined, 'lead d’équipe : legacy personnel masqué');
  equipe.damageSetup.enemyDef = 3456;
  const nouvelle = photoCriteres(equipe, { type: 'equipe', personnel: personnelle.damageSetup });
  egal(resolvedLeaderSkill(nouvelle.damageSetup), { stat: 'Attack Speed', pct: 24 }, 'nouvelle photo : lead personnel legacy intact');
  egal(nouvelle.damageSetup.enemyDef, 3456, 'nouvelle photo : modifications personnelles conservées malgré la mémoire du lead');
  egal(nouvelle, { ...personnelle, damageSetup: { ...personnelle.damageSetup, enemyDef: 3456 } }, 'seul le lead vient de la mémoire');
  const moderne = { ...personnelle, damageSetup: { ...personnelle.damageSetup, leaderSkill: { stat: 'Critical Rate' as const, pct: 19 } } };
  const effectiveModerne = appliquerCriteres(moderne, { type: 'equipe', lead: { stat: 'Defense', pct: 20 } });
  ok(isDeepStrictEqual(photoCriteres(effectiveModerne, { type: 'equipe', personnel: moderne.damageSetup }), moderne), 'lead personnel moderne et legacy intacts après superposition');
  const aucun = appliquerCriteres(moderne, { type: 'aucun' });
  egal(resolvedLeaderSkill(aucun.damageSetup), null, 'aucun lead neutralise moderne ET legacy');
  egal(aucun.damageSetup.leaderSkill, undefined, 'aucun lead : champ moderne retiré');
  egal(aucun.damageSetup.leaderSpeedPct, undefined, 'aucun lead : ancien champ retiré');
  const aucunAncien = appliquerCriteres(personnelle, { type: 'aucun' });
  egal(resolvedLeaderSkill(aucunAncien.damageSetup), null, 'ancienne recette portant seulement leaderSpeedPct : aucun lead');
  egal(photoCriteres(aucunAncien, { type: 'equipe', personnel: personnelle.damageSetup }), personnelle, 'équipe sans lead actif : photo personnelle restituée');
  egal(etat.damageSetup.leaderSpeedPct, 24, 'aucune application ne modifie l’état source');
  equipe.comboSets.push('Will'); equipe.mainStatsBySlot[2]!.push(9); equipe.lignesVerrouillees[0].min = 99;
  equipe.damageSetup.passifsOffensifs![123] = false;
  egal(personnelle.comboSets, ['Swift'], 'photo détachée : sets');
  egal(personnelle.mainStatsBySlot, { 2: [8] }, 'photo détachée : principales imbriquées');
  egal(personnelle.lignesVerrouillees, [{ code: 206, min: 12 }], 'photo détachée : verrous');
  egal(personnelle.damageSetup.passifsOffensifs, { 123: true }, 'photo détachée : réglages par sort');
  const globaux = Object.keys(personnelle).filter((k) => CLASSEMENT_CHAMPS_OPTIMIZER[k as keyof typeof CLASSEMENT_CHAMPS_OPTIMIZER] !== 'personnel');
  egal(globaux, [], 'application et photo ne transportent aucun global');
}

export async function testOptimizerCriteresBase() {
  titre('Optimizer · base complète, import partiel et motifs');
  const banc = await bancOptimizer();
  const base = baseCompleteCriteres(undefined);
  egal(photoCriteres(banc.etat, { type: 'personnel' }), base, 'défauts initiaux du vrai hook = base complète');
  remplirCriteres(banc.etat); banc.etat.setCritereArtefacts('reel');
  const sale = banc.rendre();
  const relic = { id: 7, upgrade: 6, main: { code: 100, value: 11 } };
  const exemplaire = { relic };
  const avecRelique = baseCompleteCriteres(exemplaire);
  egal(avecRelique, { ...base, relicMainChoice: 'equipped' }, 'base complète : relique résolue contre l’exemplaire');
  egal(completerCriteresImport({}, exemplaire), avecRelique, 'import vide et membre sans mémoire partagent la même base');
  const partiels: CriteresPartielsOptimizer = { vitesse: { minimum: 250 }, comboSets: ['Swift'], minStats: { hp: 20000 } };
  const importes = completerCriteresImport(partiels, exemplaire);
  egal(importes, { ...avecRelique, comboSets: ['Swift'], minStats: { hp: 20000, spd: 250 } }, 'import partiel complété : VIT de fiche et minimums');
  for (const precedent of [banc.etat, sale]) {
    const suivant = { ...precedent, ...completerCriteresImport(partiels, exemplaire) };
    egal(photoCriteres(suivant, { type: 'personnel' }), importes, 'base d’import identique quel que soit l’affichage précédent');
    egal(suivant.relicMinUpgrade, precedent.relicMinUpgrade, 'application d’import : seuil global intact');
    egal(suivant.excludedSelectors, precedent.excludedSelectors, 'application d’import : exclusions intactes');
  }
  importes.comboSets.push('Will'); importes.damageSetup.passifsOffensifs![1] = true;
  egal(partiels.comboSets, ['Swift'], 'import détaché du producteur');
  egal(baseCompleteCriteres(undefined), base, 'bases indépendantes après modification');
  egal(DEFAULT_DAMAGE_SETUP.passifsOffensifs, {}, 'défaut partagé jamais muté');
  egal(completerCriteresImport({ objective: undefined }, undefined), base, 'champ partiel absent ou undefined : défaut complet');
  const vitesseEtendue: CritereVitesseOptimizer & { extensionFuture: number } = { minimum: 260, extensionFuture: 1 };
  egal(completerCriteresImport({ vitesse: vitesseEtendue }, undefined).minStats, { spd: 260 }, 'objet VIT extensible sans changer les autres producteurs');
  for (const motif of ['bestiaire', 'membre', 'compte'] as const) {
    const suivant = criteresApresChangementEspece(sale, motif, exemplaire);
    egal(suivant.relicMainChoice, 'equipped', `${motif} : défaut relique résolu`);
    egal(suivant.objective, 'efficience', `${motif} : objectif au défaut`);
    egal(suivant.compterAurasResPre, motif === 'compte', `${motif} : distinction des auras`);
    egal(suivant.critereArtefacts, motif === 'bestiaire' ? 'brut' : 'reel', `${motif} : cran historique conservé`);
    egal(suivant.damageSetup.skillCom2usId, null, `${motif} : sort vidé`);
    egal(suivant.damageSetup.enemyDef, motif === 'compte' ? 1000 : 2222, `${motif} : contexte`);
    egal(resolvedLeaderSkill(suivant.damageSetup), motif === 'compte' ? null : { stat: 'Attack Speed', pct: 24 }, `${motif} : lead personnel`);
  }
}

export async function testOptimizerCritereArtefactsNavigation() {
  titre('Optimizer · cran des artéfacts remonté et navigation');
  const banc = await bancOptimizer();
  banc.etat.setCritereArtefacts('reel');
  const apres = banc.rendre();
  egal(apres.critereArtefacts, 'reel', 'cran conservé par le vrai hook');
  ok(!('critereArtefacts' in photoOptimizer(apres)), 'format de session inchangé : cran hors session');
  const source = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  const destructuration = source.slice(source.indexOf('const {', source.indexOf('export default function')), source.indexOf('} = optimizer;'));
  ok(destructuration.includes('critereArtefacts,') && destructuration.includes('setCritereArtefacts,'), 'écran : cran et setter reçus de l’état partagé');
  ok(!/\[critereArtefacts,\s*setCritereArtefacts\]\s*=\s*useState/.test(source), 'écran : aucun état local perdant le cran au démontage');
  ok(readFileSync('src/pages/OutilsPage.tsx', 'utf8').includes('optimizer={optimizer}'), 'OutilsPage relaie le même objet');
  // Vérifie le branchement du geste, et non seulement le producteur pur.
  fonctionDeSource('src/components/outils/OptimizerSection.tsx', 'pickSpecies', {
    ...apres, optimizer: apres, selectedId: '1', box: [], exclusionData: {},
    speciesCandidatesBySource: () => ({ box: [] }), unownedSelectorIfNoneOwned: () => null,
    criteresApresChangementEspece, setZoneDOpen: () => {},
  })({ id: 2, com2usId: 101 });
  egal(banc.rendre().critereArtefacts, 'brut', 'bestiaire : le vrai setter partagé reçoit le défaut');
}

export function testOptimizerCriteresGarde() {
  titre('Optimizer · champ non classé refusé à la compilation');
  const configuration = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(configuration.config, ts.sys, process.cwd()).options;
  const host = ts.createCompilerHost(options);
  // Bundlé par tests/run.mjs, TypeScript chercherait ses lib.*.d.ts à côté du
  // bundle : on les désigne dans node_modules, sinon les types globaux manquent.
  const bibliotheques = resolve('node_modules/typescript/lib');
  host.getDefaultLibLocation = () => bibliotheques;
  host.getDefaultLibFileName = (o) => resolve(bibliotheques, ts.getDefaultLibFileName(o));
  const lire = host.readFile;
  host.readFile = (fichier) => {
    const source = lire(fichier);
    return resolve(fichier) === resolve('src/hooks/useOptimizerState.ts')
      ? `${source}\nexport interface OptimizerState { champNonClasseTemoin: number; }\n`
      : source;
  };
  const programme = ts.createProgram(['src/lib/criteresOptimizer.ts', 'src/lib/sessionOptimizer.ts'], { ...options, noEmit: true }, host);
  const erreurs = ts.getPreEmitDiagnostics(programme);
  ok(erreurs.some((d) => d.file?.fileName.replace(/\\/g, '/').endsWith('/criteresOptimizer.ts') && ts.flattenDiagnosticMessageText(d.messageText, '\n').includes('champNonClasseTemoin')), 'la garde des critères refuse le champ témoin non classé');
  ok(erreurs.some((d) => d.file?.fileName.replace(/\\/g, '/').endsWith('/sessionOptimizer.ts') && ts.flattenDiagnosticMessageText(d.messageText, '\n').includes('champNonClasseTemoin')), 'la garde de session reste exhaustive sans contournement');
  const personnelles = Object.entries(CLASSEMENT_CHAMPS_OPTIMIZER).filter(([, c]) => c === 'personnel').map(([k]) => k).sort();
  egal(Object.keys(baseCompleteCriteres(undefined)).sort(), personnelles, 'base complète et classement personnel exhaustifs');
  const photo: CriteresOptimizer = baseCompleteCriteres(undefined);
  egal(photo.critereArtefacts, 'brut', 'cran personnel obligatoire dans le type de photo');
}
