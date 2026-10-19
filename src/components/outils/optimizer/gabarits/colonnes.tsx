import { useMemo, useState } from 'react';
import ArtefactsEtReliqueBureau, { LARGEUR_ARTEFACTS } from '../bureau/ArtefactsEtReliqueBureau';
import MeilleursArtefactsBureau from '../bureau/MeilleursArtefactsBureau';
import SetsAuraBureau, { LARGEUR_COMPLEMENTS } from '../bureau/SetsAuraBureau';
import ExclusionRunesBureau from '../bureau/ExclusionRunesBureau';
import ReglagesAvancesBureau from '../bureau/ReglagesAvancesBureau';
import ExclusionMonstrePrecis from '../ExclusionMonstrePrecis';
import RunesDejaUtilisees from '../RunesDejaUtilisees';
import RunesImposees from '../RunesImposees';
import ReglagesAvancesContenu from '../ReglagesAvancesContenu';
import { exemplaireDuCompte } from './donnees';
import { listesInertes } from './inertes';
import type { ContexteGabarits, Gabarit } from './types';
import { sortesFigeesDe } from '../../../../lib/artifactFiche';
import type { ArtifactMainChoice, RelicUniqueChoice } from '../../../../hooks/useOptimizerState';
import type { LigneVerrouillee } from '../../../../lib/artifactOptim';
import type { AutoExclusionScope, ExclusionSelector } from '../../../../lib/optimizerExclusion';
import type { SlotFilterPresetKey } from '../../../../lib/runeBuildOptim';
import type { AuraExterne } from '../../../../lib/aurasExternes';
import type { DamageSetup } from '../../../../lib/damage';
import type { ArtifactDetail, ArtifactKind } from '../../../../types';

// Les gabarits des deux COLONNES REPLIABLES du bureau : « Artéfacts et relique »
// (artéfacts et relique, meilleurs artéfacts en carte à part) et « Aura,
// exclusion, avancés » (sets d'aura, exclusion de runes et réglages avancés en
// ligne). Chaque état part de l'état réel (`ContexteGabarits`) ; ses gestes
// agissent sur un état local, jamais sur l'Optimizer.

const rien = () => {};

interface ReglagesArtefacts {
  actif?: boolean;
  principales?: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  lignes?: LigneVerrouillee[];
  relique?: ArtifactMainChoice;
  unique?: RelicUniqueChoice;
  niveau?: number;
}

function ArtefactsGabarit({ ctx, initial }: { ctx: ContexteGabarits; initial: ReglagesArtefacts }) {
  const o = ctx.optimizer;
  const [actif, setActif] = useState(initial.actif ?? o.optimiserArtefacts);
  const [principales, setPrincipales] = useState(initial.principales ?? o.artifactMainByKind);
  const [lignes, setLignes] = useState(initial.lignes ?? o.lignesVerrouillees);
  const [relique, setRelique] = useState(initial.relique ?? o.relicMainChoice);
  const [unique, setUnique] = useState(initial.unique ?? o.relicUniqueChoice);
  const [niveau, setNiveau] = useState(initial.niveau ?? o.relicMinUpgrade);
  return (
    <ArtefactsEtReliqueBureau optimiserArtefacts={actif} setOptimiserArtefacts={setActif} artifactMainByKind={principales}
      setArtifactMainByKind={setPrincipales} lignesVerrouillees={lignes} setLignesVerrouillees={setLignes} diagnosticVerrous={null}
      sortesFigees={sortesFigeesDe(principales)} relicMainChoice={relique} setRelicMainChoice={setRelique}
      relicUniqueChoice={unique} setRelicUniqueChoice={setUnique} relicMinUpgrade={niveau} setRelicMinUpgrade={setNiveau} />
  );
}

// Une paire RÉELLE du compte importé : le premier artéfact d'attribut et le
// premier de type. Les chiffres de dégâts ne sont pas calculés dans la vue
// (l'écran les tire des évaluateurs de la fiche) : ceux des états qui en
// montrent sont des chiffres de vue, et l'état le dit.
function paireDuCompte(ctx: ContexteGabarits): ArtifactDetail[] {
  return (['element', 'archetype'] as const).flatMap((k) => ctx.artifacts.find((a) => a.kind === k) ?? []);
}

type Proposition = { explication: string | null; chiffres?: { degats: number; gain: number }; dejaPorte?: boolean; figees?: ArtifactKind[] };
function MeilleursGabarit({ ctx, proposition }: { ctx: ContexteGabarits; proposition: Proposition }) {
  const [critere, setCritere] = useState<'brut' | 'reel'>('brut');
  const exemplaire = exemplaireDuCompte(ctx);
  const lists = useMemo(() => listesInertes(ctx.lists, { lists: [{ id: 'gabarit', name: 'Défense G3' }], activeListId: 'gabarit', validated: [] }), [ctx.lists]);
  const paire = proposition.explication == null ? paireDuCompte(ctx) : [];
  return (
    <MeilleursArtefactsBureau
      modeArtefactsSeuls={{
        explication: proposition.explication, paire, gainBrutParCoup: proposition.chiffres?.gain ?? 0, degatsParCoup: proposition.chiffres?.degats ?? 0,
        surLeReel: false, reelIndisponible: false, dejaPorte: proposition.dejaPorte ?? false, coutVerrousPct: null,
      }}
      setArtefactsOuverts={rien} artefactsOuverts critereArtefacts={critere} setCritereArtefacts={setCritere} setSetupOuvert={rien}
      sortesFigees={proposition.figees ?? []} resolvedSkill={null}
      sourceSelector={exemplaire ? { source: 'box', unitKey: exemplaire.unitKey } : null} lists={lists} ownValidatedBuild={undefined}
      canValidateDisplayed handleValidateArtefacts={rien} artefactsProposesDejaReserves={false}
    />
  );
}

function AurasGabarit({ ctx, initial }: { ctx: ContexteGabarits; initial?: AuraExterne[] }) {
  const [setup, setSetup] = useState<DamageSetup>(() => ({ ...ctx.optimizer.lireCombatMembre().setup, ...(initial ? { setsAuraExternes: initial } : {}) }));
  return <SetsAuraBureau setup={setup} maj={(p) => setSetup((s) => ({ ...s, ...p }))} rappel={false} onGuiderResPre={rien} />;
}

interface ReglagesExclusion { exclus?: boolean; selecteurs?: 'aucun' | 'compte' | 'beaucoup'; imposees?: boolean }
function ExclusionGabarit({ ctx, initial }: { ctx: ContexteGabarits; initial: ReglagesExclusion }) {
  const exemplaire = exemplaireDuCompte(ctx);
  // « Remplie » : les autres monstres équipés de la Box, exclus un à un.
  const autres = ctx.box.filter((b) => b.gear && b.key !== exemplaire?.unitKey).map((b): ExclusionSelector => ({ source: 'box', unitKey: b.key }));
  // « Beaucoup » : le compte d'exemple n'a pas assez de monstres pour remplir
  // la hauteur bornée ; des entrées Box absentes du compte (jetons « exclusion
  // introuvable ») la dépassent, et l'état le dit.
  const beaucoup = [...autres, ...Array.from({ length: 12 }, (_, i): ExclusionSelector => ({ source: 'box', unitKey: `gabarit-absent-${i + 1}` }))];
  const [exclure, setExclure] = useState(initial.exclus ?? ctx.optimizer.excludeUsedRunes);
  const [portee, setPortee] = useState<AutoExclusionScope>(ctx.optimizer.excludeUsedScope);
  const [selecteurs, setSelecteurs] = useState<ExclusionSelector[]>(initial.selecteurs === 'compte' ? autres : initial.selecteurs === 'beaucoup' ? beaucoup
    : initial.selecteurs === 'aucun' ? [] : ctx.optimizer.excludedSelectors);
  const [verrous, setVerrous] = useState<Partial<Record<number, number>>>(() => {
    if (!initial.imposees || !exemplaire) return initial.imposees === false ? {} : ctx.optimizer.lockedRunes;
    const r = exemplaire.gear.runes.slice(0, 2);
    return Object.fromEntries(r.map((rune) => [rune.slot, rune.id]));
  });
  const selected = exemplaire ? { monster: exemplaire.monster, gear: exemplaire.gear } : null;
  return (
    <ExclusionRunesBureau
      monstrePrecisBlock={<ExclusionMonstrePrecis exclusionData={ctx.exclusionData} selectedUnitKey={exemplaire?.unitKey ?? null} selected={selected}
        excludedSelectors={selecteurs} setExcludedSelectors={setSelecteurs} bureau />}
      dejaUtiliseesBlock={<RunesDejaUtilisees excludeUsedRunes={exclure} setExcludeUsedRunes={setExclure} excludeUsedScope={portee} setExcludeUsedScope={setPortee} />}
      runesImposeesBlock={<RunesImposees selected={selected} lockedRunes={verrous} setLockedRunes={setVerrous} bureau />}
    />
  );
}

interface ReglagesAvances { prefiltrage?: SlotFilterPresetKey; epuisement?: boolean; diagnostic?: boolean; priorite?: boolean; toutes?: boolean; auras?: boolean }
function AvancesGabarit({ ctx, initial }: { ctx: ContexteGabarits; initial: ReglagesAvances }) {
  const o = ctx.optimizer;
  const [prefiltrage, setPrefiltrage] = useState(initial.prefiltrage ?? o.slotFilterPreset);
  const [epuisement, setEpuisement] = useState(initial.epuisement ?? o.exhaustiveSearch);
  const [diagnostic, setDiagnostic] = useState(initial.diagnostic ?? false);
  const [priorite, setPriorite] = useState(initial.priorite ?? o.adaptiveTrancheWeighting);
  const [toutes, setToutes] = useState(initial.toutes ?? o.verifierToutesLesCombinaisons);
  const [auras, setAuras] = useState(initial.auras ?? o.compterAurasResPre);
  const ref = { current: null };
  return (
    <ReglagesAvancesBureau>
      <ReglagesAvancesContenu slotFilterPreset={prefiltrage} handleSlotFilterPresetChange={setPrefiltrage} dansPanneau={false} estimate={null}
        exhaustiveSearch={epuisement} setExhaustiveSearch={setEpuisement} diagnoseBlockingEnabled={diagnostic} setDiagnoseBlockingEnabled={setDiagnostic}
        adaptiveTrancheWeighting={priorite} setAdaptiveTrancheWeighting={setPriorite} optimiserArtefacts={o.optimiserArtefacts}
        verifierToutesLesCombinaisons={toutes} setVerifierToutesLesCombinaisons={setToutes} interrupteurResPrePanneauRef={ref}
        interrupteurResPreFlottantRef={ref} attentionResPre={null} compterAurasResPre={auras} setCompterAurasResPre={setAuras} />
    </ReglagesAvancesBureau>
  );
}

const TELEPHONE_INCHANGE = 'aucun composant modifié : le téléphone garde sa carte ou son panneau « Options ».';

export const GABARITS_COLONNES: Gabarit[] = [
  {
    id: 'artefacts', nom: 'Artéfacts et reliques (colonne « Artéfacts et relique »)', largeur: LARGEUR_ARTEFACTS, hauteurEstimee: 432,
    composant: 'ArtefactsEtReliqueBureau (bureau/ArtefactsEtReliqueBureau.tsx) : ArtefactsEtReliques à 320 px, sans l\'encart des meilleurs artéfacts',
    telephone: `ArtefactsEtReliques (partagé) repris tel quel ; ${TELEPHONE_INCHANGE}`,
    changements: [
      '« Meilleurs artéfacts offensifs pour ce build » quitte la carte (entre les sous-propriétés et la relique) pour sa propre carte, sous la relique.',
      'La carte vit dans la colonne repliable « Artéfacts et relique » : ouverte ou fermée par son onglet.',
    ],
    etats: [
      { id: 'defaut', nom: 'Activée, Libre, aucune ligne verrouillée, relique libre', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{ actif: true, principales: {}, lignes: [], relique: 'libre', unique: 'libre', niveau: 0 }} /> },
      { id: 'desactives', nom: 'Optimisation d\'artéfacts et reliques désactivée', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{ actif: false }} /> },
      { id: 'verrous', nom: 'Principales imposées, deux lignes verrouillées', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{ actif: true, principales: { element: 100, archetype: 'libre' }, lignes: [{ code: 218, min: 0 }, { code: 219, min: 0 }] }} /> },
      { id: 'relique-choisie', nom: 'Relique choisie : principale, propriété unique, niveau', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{ actif: true, relique: 101, unique: 1, niveau: 12 }} /> },
      { id: 'relique-equipee', nom: 'Artéfact et relique équipés gardés', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{ actif: true, principales: { element: 'equipped', archetype: 'equipped' }, relique: 'equipped' }} /> },
      { id: 'reel', nom: 'Réglages de l\'Optimizer', rendu: (ctx) => <ArtefactsGabarit ctx={ctx} initial={{}} /> },
    ],
  },
  {
    id: 'meilleurs', nom: 'Meilleurs artéfacts offensifs pour ce build', largeur: LARGEUR_ARTEFACTS, hauteurEstimee: 420,
    composant: 'MeilleursArtefactsBureau (bureau/MeilleursArtefactsBureau.tsx) : MeilleursArtefacts en carte (prop carte)',
    telephone: 'Partage MeilleursArtefacts avec le téléphone, par une variante qu\'il ne prend pas (prop carte) ; replié au doigt comme aujourd\'hui.',
    changements: [
      'Une carte à part sous la carte « Artéfacts et reliques » (donc sous la relique), au lieu d\'un encart entre les sous-propriétés et la relique.',
    ],
    etats: [
      { id: 'aucune', nom: '0 proposition : aucun artéfact n\'apporte de dégâts', rendu: (ctx) => <MeilleursGabarit ctx={ctx} proposition={{ explication: 'Aucun artéfact équipable n’apporte de dégâts supplémentaires pour ce critère.' }} /> },
      { id: 'figes', nom: '0 proposition : deux emplacements figés', rendu: (ctx) => <MeilleursGabarit ctx={ctx} proposition={{ explication: 'Les deux emplacements sont sur « Comme équipé » : la paire est déjà décidée, il n’y a rien à chercher.', figees: ['element', 'archetype'] }} /> },
      { id: 'paire', nom: 'Paire proposée (artéfacts du compte ; chiffres de vue, non calculés)', rendu: (ctx) => <MeilleursGabarit ctx={ctx} proposition={{ explication: null, chiffres: { degats: 1234, gain: 210 } }} /> },
      { id: 'un-fige', nom: 'Paire proposée, emplacement attribut figé (chiffres de vue)', rendu: (ctx) => <MeilleursGabarit ctx={ctx} proposition={{ explication: null, chiffres: { degats: 1234, gain: -35 }, figees: ['element'] }} /> },
    ],
  },
  {
    id: 'auras', nom: 'Sets d\'aura des autres monstres (colonne « Aura, exclusion, avancés »)', largeur: LARGEUR_COMPLEMENTS, hauteurEstimee: 216,
    composant: 'SetsAuraBureau (bureau/SetsAuraBureau.tsx) : AurasExternesSaisie dans sa carte',
    telephone: 'EtatMonstre (partagé) exporte AurasExternesSaisie, rendu inchangé ; le téléphone garde EtatMonstre entier.',
    changements: [
      'Quitte « État de mon monstre » pour la tête de la colonne repliable « Aura, exclusion, avancés », masquée par défaut.',
    ],
    etats: [
      { id: 'vide', nom: 'Aucun set d\'aura', rendu: (ctx) => <AurasGabarit ctx={ctx} initial={[]} /> },
      { id: 'deux', nom: 'Deux lignes (Fight × 3, Accuracy × 2)', rendu: (ctx) => <AurasGabarit ctx={ctx} initial={[{ set: 'fight', nombre: 3 }, { set: 'accuracy', nombre: 2 }]} /> },
      { id: 'plein', nom: 'Plein (15 / 15, ajout désactivé)', rendu: (ctx) => <AurasGabarit ctx={ctx} initial={[{ set: 'fight', nombre: 5 }, { set: 'determination', nombre: 4 }, { set: 'enhance', nombre: 3 }, { set: 'accuracy', nombre: 2 }, { set: 'tolerance', nombre: 1 }]} /> },
      { id: 'reel', nom: 'Sets d\'aura de l\'Optimizer', rendu: (ctx) => <AurasGabarit ctx={ctx} /> },
    ],
  },
  {
    id: 'exclusion', nom: 'Exclusion de runes (en ligne)', largeur: LARGEUR_COMPLEMENTS, hauteurEstimee: 440,
    composant: 'ExclusionRunesBureau (bureau/ExclusionRunesBureau.tsx) : ExclusionRunesContenu dans l\'ordre empilé du panneau, variantes bureau de ExclusionMonstrePrecis et RunesImposees',
    telephone: 'ExclusionRunesContenu et RunesDejaUtilisees repris tels quels ; ExclusionMonstrePrecis (et RuneExclusionPicker) et RunesImposees partagés par une variante que le téléphone ne prend pas (prop bureau) ; le téléphone garde son panneau « Options ».',
    changements: [
      'En ligne dans sa colonne : plus d\'en-tête qui ouvre un flottant ; le contenu est toujours visible quand la colonne est ouverte.',
      '« Exclure les runes d\'un monstre » passe au-dessus d\'« Exclure les runes déjà utilisées », empilés (l\'ordre du panneau « Options »), au lieu de côte à côte.',
      'Les monstres exclus défilent dans une hauteur bornée (≈ 3 rangées de jetons, 96 px) : en exclure beaucoup n\'allonge plus la colonne.',
      '« Conserver ces slots… » : deux colonnes, slots impairs puis pairs, espacées également entre les bords de la carte (au lieu d\'une rangée qui passe à la ligne).',
    ],
    etats: [
      { id: 'vide', nom: 'Vide : aucun monstre exclu, déjà utilisées coupé, aucune rune imposée', rendu: (ctx) => <ExclusionGabarit ctx={ctx} initial={{ exclus: false, selecteurs: 'aucun', imposees: false }} /> },
      { id: 'remplie', nom: 'Remplie : monstres exclus, déjà utilisées actif, deux runes imposées', rendu: (ctx) => <ExclusionGabarit ctx={ctx} initial={{ exclus: true, selecteurs: 'compte', imposees: true }} /> },
      { id: 'beaucoup', nom: 'Beaucoup d\'exclusions : hauteur bornée (entrées absentes du compte d\'exemple, « exclusion introuvable »)', rendu: (ctx) => <ExclusionGabarit ctx={ctx} initial={{ exclus: true, selecteurs: 'beaucoup', imposees: true }} /> },
      { id: 'reel', nom: 'Exclusion de l\'Optimizer', rendu: (ctx) => <ExclusionGabarit ctx={ctx} initial={{}} /> },
    ],
  },
  {
    id: 'avances', nom: 'Réglages avancés (en ligne)', largeur: LARGEUR_COMPLEMENTS, hauteurEstimee: 420,
    composant: 'ReglagesAvancesBureau (bureau/ReglagesAvancesBureau.tsx) : ReglagesAvancesContenu hors panneau',
    telephone: `ReglagesAvancesContenu repris tel quel ; ${TELEPHONE_INCHANGE}`,
    changements: [
      'En ligne dans sa colonne : plus d\'en-tête qui ouvre un flottant.',
      'L\'estimation du pool n\'est plus sous les réglages : elle est en tête du bloc « Objectif et Rechercher ».',
    ],
    etats: [
      { id: 'defaut', nom: 'Par défaut', rendu: (ctx) => <AvancesGabarit ctx={ctx} initial={{ prefiltrage: 'moyen', epuisement: false, diagnostic: false, priorite: false, toutes: false, auras: false }} /> },
      { id: 'modifies', nom: 'Modifiés : Extrême, tout activé', rendu: (ctx) => <AvancesGabarit ctx={ctx} initial={{ prefiltrage: 'extreme', epuisement: true, diagnostic: true, priorite: true, toutes: true, auras: true }} /> },
      { id: 'reel', nom: 'Réglages de l\'Optimizer', rendu: (ctx) => <AvancesGabarit ctx={ctx} initial={{}} /> },
    ],
  },
];
