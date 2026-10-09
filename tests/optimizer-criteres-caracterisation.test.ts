import { bancOptimizer, fonctionDeSource } from './optimizer-transition-banc';
import * as transitions from '../src/hooks/useOptimizerState';
import { egal, ok, titre } from './outils';
import {
  defaultRelicMainChoice, relicMainChoiceApresChangementExemplaire,
  type OptimizerState,
} from '../src/hooks/useOptimizerState';
import { DEFAULT_DAMAGE_SETUP, resolvedLeaderSkill } from '../src/lib/damage';
import { damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { exclusionSelectorKey, type ExclusionSelector } from '../src/lib/optimizerExclusion';

const ECRAN = 'src/components/outils/OptimizerSection.tsx';

export function remplirCriteres(s: OptimizerState) {
  s.setSelectedId('1'); s.setGearSource('rta');
  s.setSourceSelector({ source: 'box', unitKey: '10' });
  s.setComboSets(['Swift']); s.setMinStats({ spd: 230 }); s.setMaxStats({ res: 80 });
  s.setExcludeBase(false); s.setOptimiserArtefacts(false); s.setAdapterArtefactsAuTri(false);
  s.setArtifactMainByKind({ element: 100 }); s.setRelicMainChoice(101); s.setRelicUniqueChoice(1);
  s.setLignesVerrouillees([{ code: 206, min: 12 }]); s.setMainStatsBySlot({ 2: [8] }); s.setLockedRunes({ 1: 123 });
  s.setObjective('degats_reels'); s.setSortBy('spd'); s.setCompterAurasResPre(false);
  s.setDamageSetup({ ...DEFAULT_DAMAGE_SETUP, enemyDef: 2222, leaderSpeedPct: 24, skillCom2usId: 123, passifsOffensifs: { 123: true } });
  s.setRelicMinUpgrade(12); s.setExcludeUsedRunes(true); s.setExcludeUsedScope('box');
  s.setExcludedSelectors([{ source: 'box', unitKey: '99' }]);
  s.setAdaptiveTrancheWeighting(true); s.setExhaustiveSearch(true); s.setVerifierToutesLesCombinaisons(true);
  s.setSlotFilterPreset('haut'); s.setShowAdvanced(true); s.setDiagnoseBlockingEnabled(true);
  s.setSetPickerInvalid(true); s.setResultsPage(7); s.setStoppedManually(true); s.setOpenDetailKey('r:123');
}

const PERSONNELS_ANCIENS = [
  'comboSets', 'minStats', 'maxStats', 'excludeBase', 'optimiserArtefacts', 'adapterArtefactsAuTri',
  'artifactMainByKind', 'relicMainChoice', 'relicUniqueChoice', 'lignesVerrouillees', 'mainStatsBySlot',
  'lockedRunes', 'objective', 'damageSetup', 'sortBy', 'compterAurasResPre',
] as const;
const GLOBAUX = [
  'relicMinUpgrade', 'excludeUsedRunes', 'excludeUsedScope', 'excludedSelectors', 'adaptiveTrancheWeighting',
  'exhaustiveSearch', 'verifierToutesLesCombinaisons', 'slotFilterPreset', 'showAdvanced', 'diagnoseBlockingEnabled',
] as const;
function valeurs(s: OptimizerState, champs: readonly (keyof OptimizerState)[]) {
  return Object.fromEntries(champs.map((c) => [c, s[c]]));
}

export default async function testOptimizerCriteresCaracterisation() {
  titre('Optimizer · caractérisation des resets et gestes avant extraction');
  for (const motif of ['monstre', 'compte'] as const) {
    const banc = await bancOptimizer();
    const initial = valeurs(banc.etat, PERSONNELS_ANCIENS);
    remplirCriteres(banc.etat);
    const avant = banc.rendre();
    avant.resetSearch(motif);
    const apres = banc.rendre();
    egal(valeurs(apres, PERSONNELS_ANCIENS), {
      ...initial,
      damageSetup: motif === 'compte' ? DEFAULT_DAMAGE_SETUP : damageSetupApresChangementMonstre(avant.damageSetup),
      compterAurasResPre: motif === 'compte',
    }, `${motif} : tous les critères historiques`);
    egal(valeurs(apres, GLOBAUX), valeurs(avant, GLOBAUX), `${motif} : réglages globaux conservés`);
    egal([apres.selectedId, apres.gearSource, apres.sourceSelector], [avant.selectedId, avant.gearSource, avant.sourceSelector], `${motif} : sélection conservée`);
    egal([apres.setPickerInvalid, apres.resultsPage, apres.stoppedManually, apres.openDetailKey, banc.effacements()], [false, 1, false, null, 1], `${motif} : résultats et validation effacés`);
    egal(apres.importDuCompte, motif === 'compte' ? 1 : 0, `${motif} : identité d'import`);
    if (motif === 'compte') { apres.resetSearch(motif); egal(banc.rendre().importDuCompte, 2, 'chaque import avance l’identité'); }
    else egal(resolvedLeaderSkill(apres.damageSetup), { stat: 'Attack Speed', pct: 24 }, 'reset monstre : ancien lead lisible');
  }

  for (const geste of ['pickSpecies', 'choisirExemplaire'] as const) {
    for (const espece of ['1', '2']) for (const avecRelique of [false, true]) for (const memeCle of [false, true]) {
      const banc = await bancOptimizer(); remplirCriteres(banc.etat);
      banc.etat.setCritereArtefacts('reel');
      const avant = banc.rendre();
      const selector: ExclusionSelector = { source: 'box', unitKey: memeCle ? '10' : '20' };
      // Seule la résolution de l'exemplaire est substituée ; le gestionnaire
      // et les transitions de relique exécutés sont ceux de production.
      const relic = avecRelique ? { id: 1 } : undefined;
      let zoneOuverte = true;
      const contexte = {
        ...transitions, ...avant, optimizer: avant, box: [], exclusionData: {}, ownSelectorKey: 'box:10',
        speciesCandidatesBySource: () => ({ box: [{ selector, gear: { relic } }] }),
        unownedSelectorIfNoneOwned: () => null,
        resolveExclusionEntry: () => ({ gear: { relic } }), exclusionSelectorKey,
        defaultRelicMainChoice, relicMainChoiceApresChangementExemplaire,
        reliqueCoherenteAvecExemplaire: () => avant.setRelicMainChoice((c) => relicMainChoiceApresChangementExemplaire(c, relic as never, true)),
        setZoneDOpen: (v: boolean) => { zoneOuverte = v; },
      };
      const fonction = fonctionDeSource(ECRAN, geste, contexte);
      const monster = { id: Number(espece), com2usId: 101 };
      if (geste === 'pickSpecies') fonction(monster); else fonction(selector, monster);
      const apres = banc.rendre();
      const autreEspece = espece !== '1';
      const libelle = `${geste}, espèce ${espece}, relique ${avecRelique}, même clé ${memeCle}`;
      egal(apres.selectedId, espece, `${libelle} : sélection`);
      egal(apres.sourceSelector, selector, `${libelle} : exemplaire`);
      egal(apres.gearSource, 'box', `${libelle} : source`);
      egal(apres.relicMainChoice, autreEspece ? (avecRelique ? 'equipped' : 'libre') : 101, `${libelle} : relique`);
      egal(apres.damageSetup, autreEspece ? damageSetupApresChangementMonstre(avant.damageSetup) : avant.damageSetup, `${libelle} : contexte/sort`);
      egal(apres.comboSets, autreEspece ? [] : ['Swift'], `${libelle} : set`);
      egal(apres.objective, autreEspece ? 'efficience' : 'degats_reels', `${libelle} : objectif`);
      egal(apres.compterAurasResPre, false, `${libelle} : auras conservées`);
      egal(apres.critereArtefacts, geste === 'pickSpecies' && autreEspece ? 'brut' : 'reel', `${libelle} : cran d’artéfacts`);
      egal(banc.effacements(), autreEspece || (geste === 'choisirExemplaire' && !memeCle) ? 1 : 0, `${libelle} : effacement`);
      egal(valeurs(apres, GLOBAUX), valeurs(avant, GLOBAUX), `${libelle} : globaux conservés`);
      ok(!zoneOuverte, `${libelle} : zone D fermée`);
    }
  }
  const banc = await bancOptimizer();
  banc.etat.setRelicMainChoice('equipped');
  const avant = banc.rendre();
  fonctionDeSource(ECRAN, 'choisirExemplaire', {
    ...avant, optimizer: avant, selectedId: '1', ownSelectorKey: 'box:10', exclusionData: {}, exclusionSelectorKey,
    resolveExclusionEntry: () => ({ gear: {} }), relicMainChoiceApresChangementExemplaire, setZoneDOpen: () => {},
  })({ source: 'unowned', com2usId: 101 }, { id: 1 });
  egal(banc.rendre().relicMainChoice, 'libre', 'même espèce : équipée sans relique devient libre');
  egal(banc.rendre().gearSource, 'box', 'non possédé : dernière source réelle conservée');
}
