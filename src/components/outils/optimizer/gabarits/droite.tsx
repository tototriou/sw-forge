import { useMemo, useRef, useState } from 'react';
import ExemplaireBureau, { LARGEUR_EXEMPLAIRE } from '../bureau/ExemplaireBureau';
import ObjectifEtRechercherBureau, { LARGEUR_OBJECTIF_ETROIT, LARGEUR_OBJECTIF_LARGE_MIN, type FormeObjectif } from '../bureau/ObjectifEtRechercherBureau';
import ResultatsBureau, { LARGEUR_RESULTATS_MIN, type AttenteResultats } from '../bureau/ResultatsBureau';
import BandeauBuildValide from '../BandeauBuildValide';
import BoutonValiderBuild from '../BoutonValiderBuild';
import ChoixExemplaire from '../ChoixExemplaire';
import EstimationPool from '../EstimationPool';
import MessageImportRecette from '../MessageImportRecette';
import EnteteResultats from '../EnteteResultats';
import DiagnosticsSansResultat from '../DiagnosticsSansResultat';
import GrilleResultats from '../GrilleResultats';
import PaginationResultats from '../PaginationResultats';
import { exemplaireDuCompte } from './donnees';
import type { ContexteGabarits, Gabarit } from './types';
import type { Selected } from '../../../MonsterGear';
import { exclusionCandidatesFor, libellePuceSource, SOURCE_OPTIONS, type ExclusionCandidate, type ExclusionSource, type ValidatedBuild } from '../../../../lib/optimizerExclusion';
import { computeStats } from '../../../../lib/stats';
import { useRuneMetric } from '../../../../hooks/useRuneMetric';
import type { BilanRecherche, BuildOptimProgress, BuildOptimStatus } from '../../../../hooks/useBuildOptimSearch';
import type { OptimizerSortKey } from '../../../../hooks/useOptimizerState';
import type { BuildCandidate, Objective } from '../../../../lib/runeBuildOptim';
import type { SetAura } from '../../../../lib/damage';
import type { RuneDetail } from '../../../../types';
import type { RelicVide } from '../../../../lib/relicOptim';

// Les gabarits de la COLONNE DE DROITE du bureau : « Exemplaire », le bloc
// « Objectif et Rechercher » (formes étroite et large) et les résultats.
// Chaque état part de l'état réel (`ContexteGabarits`) ; ses gestes agissent
// sur un état local, jamais sur l'Optimizer.

const rien = () => {};

// Les exemplaires de l'espèce, par source : la règle de `speciesCandidatesBySource`
// (OptimizerSection.tsx), reprise ici parce que la vue ne monte pas l'écran.
function exemplairesParSource(ctx: ContexteGabarits, com2usId: number | null): Record<ExclusionSource, ExclusionCandidate[]> {
  if (com2usId == null) return { box: [], rta: [], 'siege-defense': [], 'siege-offense': [] };
  const autre = (s: ExclusionSource) => exclusionCandidatesFor(s, ctx.exclusionData, null, null, false).filter((c) => c.monster.com2usId === com2usId);
  return {
    box: ctx.box.filter((b) => b.gear && b.monster.com2usId === com2usId).map((b) => ({ selector: { source: 'box' as const, unitKey: b.key }, monster: b.monster, gear: b.gear! })),
    rta: autre('rta'), 'siege-defense': autre('siege-defense'), 'siege-offense': autre('siege-offense'),
  };
}

function ExemplaireGabarit({ ctx, mode }: { ctx: ContexteGabarits; mode: 'vide' | 'rempli' | 'valide' }) {
  const exemplaire = mode === 'vide' ? null : exemplaireDuCompte(ctx);
  const candidats = exemplairesParSource(ctx, exemplaire?.monster.com2usId ?? null);
  const options = SOURCE_OPTIONS.map((o) => ({ ...o, label: libellePuceSource(o.label, candidats[o.key].length), disabled: candidats[o.key].length === 0 }));
  const [source, setSource] = useState<ExclusionSource>('box');
  const [ouvert, setOuvert] = useState(false);
  const [selection, setSelection] = useState<Selected>(null);
  const [reel, setReel] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const valide: ValidatedBuild | undefined = mode === 'valide' && exemplaire
    ? { listId: 'gabarit', selector: { source: 'box', unitKey: exemplaire.unitKey }, runeIds: exemplaire.gear.runes.map((r) => r.id) }
    : undefined;
  return (
    <ExemplaireBureau
      zoneDRef={zone} sourceOptions={options} matchesValidatedBuild={valide != null && !reel} unowned={false} gearSource={source}
      pickSource={(s) => { setSource(s); setOuvert(candidats[s].length > 1); }} allSourcesEmpty={options.every((o) => o.disabled)}
      zoneDOpen={ouvert} zoneDList={<ChoixExemplaire candidatesBySource={candidats} gearSource={source} choisirExemplaireZoneD={() => setOuvert(false)} />}
      validatedBadge={<BandeauBuildValide ownValidatedBuild={valide} showRealGear={reel} runesAbsentesValidees={[]} artefactsAbsentsValides={[]} setShowRealGear={setReel} />}
      selected={exemplaire ? { monster: exemplaire.monster, gear: exemplaire.gear } : null} selectionFiche={selection} setSelectionFiche={setSelection}
      relicUsageById={{}}
      validateBuildButton={<BoutonValiderBuild handleValidateDisplayed={rien} canValidateDisplayed={exemplaire != null}
        matchesValidatedBuild={valide != null && !reel} etatFiche={valide != null ? 'oui' : 'non'} displayedRuneConflicts={[]} />}
    />
  );
}

// L'estimation montrée par la vue : le nombre de runes du compte par
// emplacement, NON filtrées (l'écran la tire du pré-filtrage du moteur, que la
// vue ne lance pas). Chiffres de vue : l'état le dit.
function estimationDeVue(runes: RuneDetail[]) {
  const perSlot = [1, 2, 3, 4, 5, 6].map((s) => runes.filter((r) => r.slot === s).length);
  return { perSlot, product: perSlot.reduce((a, b) => a * b, 1) };
}

interface EtatObjectif {
  sansMonstre?: boolean;
  objectif?: Objective;
  statut?: BuildOptimStatus;
  progression?: BuildOptimProgress | null;
  message?: boolean;
  refus?: RelicVide;
}
function ObjectifGabarit({ ctx, forme, etat }: { ctx: ContexteGabarits; forme: FormeObjectif; etat: EtatObjectif }) {
  const exemplaire = etat.sansMonstre ? null : exemplaireDuCompte(ctx);
  const [objectif, setObjectif] = useState<Objective>(etat.objectif ?? ctx.optimizer.objective);
  const [statut, setStatut] = useState<BuildOptimStatus>(etat.statut ?? 'idle');
  const fichier = useRef<HTMLInputElement>(null);
  const sets = etat.sansMonstre ? [] : ctx.optimizer.comboSets.length > 0 ? ctx.optimizer.comboSets : ['violent'];
  return (
    <ObjectifEtRechercherBureau
      forme={forme}
      estimation={exemplaire && sets.length > 0 ? <EstimationPool estimate={estimationDeVue(ctx.runes)} /> : null}
      messageImport={<MessageImportRecette message={etat.message && exemplaire ? { text: `Réglages importés pour ${exemplaire.monster.name} — monstre sélectionné automatiquement.` } : null} />}
      progression={{ progress: statut === 'running' ? etat.progression ?? null : null,
        refusal: statut === 'refused' && etat.refus ? { motif: 'relique-pool-vide', vide: etat.refus } : null, compteAffiche: { compte: 1234 } }}
      objective={objectif} setObjective={setObjectif} setSetupOuvert={rien} resumeCombat="S3 · vs Feu · PV 50 000 · DEF 1 000 · Critique moyen"
      // Dans la vue, « Rechercher » bascule sur « Arrêter » sans rien lancer : on voit la place exacte et les 300 ms.
      handleSearch={() => setStatut('running')} selected={exemplaire} status={statut} comboSets={sets}
      exportRecipe={rien} importFileRef={fichier} importRecipe={rien} setStoppedManually={rien} stop={() => setStatut('idle')}
    />
  );
}

const APPARIEMENT: BuildOptimProgress = { phase: 'pairing', explored: 12_345_678, found: 1_234, pct: 0.42, totalPairs: 29_393_280 };
const CONSTRUCTION: BuildOptimProgress = { phase: 'building', halves: { A: { scanned: 1_234, total: 2_468, pct: 0.5 }, B: null } };

function etatsObjectif(forme: FormeObjectif, largeur?: number) {
  const r = (e: EtatObjectif) => (ctx: ContexteGabarits) => <ObjectifGabarit ctx={ctx} forme={forme} etat={e} />;
  return [
    { id: 'sans-monstre', nom: 'Aucun monstre : « Rechercher » désactivé, estimation absente', rendu: r({ sansMonstre: true, objectif: 'efficience' }), largeur },
    { id: 'efficience', nom: 'Efficience, prêt à lancer (estimation : runes du compte non filtrées, chiffres de vue)', rendu: r({ objectif: 'efficience' }), largeur },
    { id: 'degats-reels', nom: 'Dégâts réels : résumé du combat (résumé de vue)', rendu: r({ objectif: 'degats_reels' }), largeur },
    { id: 'preparation', nom: 'Recherche lancée : « Arrêter », préparation', rendu: r({ objectif: 'efficience', statut: 'running', progression: null }), largeur },
    { id: 'construction', nom: 'Recherche lancée : préparation des deux moitiés (chiffres de vue)', rendu: r({ objectif: 'efficience', statut: 'running', progression: CONSTRUCTION }), largeur },
    { id: 'appariement', nom: 'Recherche en cours : progression (chiffres de vue)', rendu: r({ objectif: 'efficience', statut: 'running', progression: APPARIEMENT }), largeur },
    { id: 'erreur', nom: 'Recherche échouée', rendu: r({ objectif: 'efficience', statut: 'error' }), largeur },
    { id: 'refus', nom: 'Recherche refusée : aucune relique dans le compte (le plus long des refus)', rendu: r({ objectif: 'efficience', statut: 'refused', refus: 'inventaire' }), largeur },
    { id: 'import', nom: 'Après un import de paramètres (message de vue)', rendu: r({ objectif: 'efficience', message: true }), largeur },
    { id: 'reel', nom: 'Objectif de l\'Optimizer', rendu: r({}), largeur },
  ];
}

// Vingt builds RÉELS du compte importé : des combinaisons de ses runes, slot par
// slot, statistiques par `computeStats` sur la base de l'exemplaire et ses
// artéfacts portés. Le compte d'exemple n'en permet que quatre : au-delà, la
// vue répète les combinaisons sous des identifiants de copie (clés distinctes).
// Rangs et compte « confirmées » sont des chiffres de vue.
function buildsDuCompte(ctx: ContexteGabarits, nombre: number): { candidats: BuildCandidate[]; runeById: Map<number, RuneDetail> } {
  const exemplaire = exemplaireDuCompte(ctx);
  const runeById = new Map(ctx.runes.map((r) => [r.id, r]));
  if (!exemplaire) return { candidats: [], runeById };
  const parSlot = [1, 2, 3, 4, 5, 6].map((s) => {
    const duCompte = ctx.runes.filter((r) => r.slot === s);
    return duCompte.length > 0 ? duCompte : exemplaire.gear.runes.filter((r) => r.slot === s);
  });
  if (parSlot.some((l) => l.length === 0)) return { candidats: [], runeById };
  const combinaisons = parSlot.reduce((n, l) => n * l.length, 1);
  const candidats: BuildCandidate[] = [];
  for (let i = 0; i < nombre; i++) {
    const copie = Math.floor(i / combinaisons);
    let reste = i % combinaisons;
    const runes = parSlot.map((l) => {
      const r = l[reste % l.length];
      reste = Math.floor(reste / l.length);
      if (copie === 0) return r;
      const double = { ...r, id: r.id + copie * 1_000_000_000 };
      runeById.set(double.id, double);
      return double;
    });
    candidats.push({ runeIds: runes.map((r) => r.id), stats: computeStats({ ...exemplaire.gear, runes }), effTotal: 0 });
  }
  return { candidats, runeById };
}

const AUCUNE_AURA: Readonly<Record<SetAura, number>> = { fight: 0, determination: 0, enhance: 0, accuracy: 0, tolerance: 0 };

function ResultatsGabarit({ ctx, mode }: { ctx: ContexteGabarits; mode: AttenteResultats | 'vingt' | 'zero' }) {
  const metric = useRuneMetric();
  const grille = useRef<HTMLDivElement>(null);
  const [tri, setTri] = useState<{ tri: OptimizerSortKey; sens: 'desc' | 'asc' }>({ tri: ctx.optimizer.sortBy, sens: 'desc' });
  const [page, setPage] = useState(1);
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const { candidats, runeById } = useMemo(() => buildsDuCompte(ctx, mode === 'vingt' ? 20 : 0), [ctx, mode]);
  const exemplaire = exemplaireDuCompte(ctx);
  if (mode === 'sans-monstre' || mode === 'sans-recherche') return <ResultatsBureau attente={mode} />;
  const result: BilanRecherche = { nombre: candidats.length, explored: 29_393_280, truncated: false, nearMissByCondition: [], globalNearMiss: null };
  const confirmees = mode === 'vingt' ? 60 : 0;
  return (
    <ResultatsBureau attente={null}>
      <EnteteResultats result={result} compteConfirmes={{ confirmees, nonVerifies: 0, pages: 3, aucune: confirmees === 0 }} avecFile={false}
        tri={tri} trier={(t) => { setTri(t); setPage(1); }} metric={metric} disponible={(c) => c !== 'degats_reels'} enAttente={0}
        compteAffiche={{ compte: confirmees, ecartes: 0, raison: null }} bureau />
      <DiagnosticsSansResultat bureau result={result}
        feasibilityDiagnosis={mode === 'zero' ? [{ key: 'spd', kind: 'min', requested: 0, bound: 0, satisfiable: true }] : []}
        impossibleFeasibility={[]} blockingDiagnosis={null} diagnoseBlockingEnabled={false} runeById={runeById} metric={metric}
        objective={ctx.optimizer.objective} aurasPropresDe={() => AUCUNE_AURA} damageSetup={ctx.optimizer.damageSetup} />
      <GrilleResultats bureau grilleResultatsRef={grille} composition={{ cartes: candidats, premierRang: 1, placesEnAttente: 0, aVerifier: [] }}
        runeById={runeById} relicUsageById={undefined} metric={metric} openDetailKey={null} onToggleDetail={rien}
        proprietesCarte={() => ({ artifacts: exemplaire?.gear.artifacts ?? [], onValidate: rien, validated: 'non', onCompare: rien })} hauteurCarte={null} />
      {mode === 'vingt' && (
        <PaginationResultats setResultsPage={setPage} resultsPage={page} pageDraft={brouillon} setPageDraft={setBrouillon} totalResultsPages={3} />
      )}
    </ResultatsBureau>
  );
}

export const GABARITS_DROITE: Gabarit[] = [
  {
    id: 'exemplaire', nom: 'Exemplaire', largeur: LARGEUR_EXEMPLAIRE, hauteurEstimee: 372,
    composant: 'ExemplaireBureau (bureau/ExemplaireBureau.tsx) : ExemplaireEtFiche dans sa carte',
    telephone: 'ExemplaireEtFiche (partagé) repris tel quel ; le téléphone garde son bloc « Monstre & équipement ».',
    changements: [
      'Sort de la carte « Monstre & équipement » (qui disparaît du bureau) pour sa propre carte, en tête de la colonne de droite (A3) ou sous les réglages (A1, A2).',
      'Les puces Box / RTA / Défenses siège / Offenses siège quittent le voisinage de la recherche du monstre : elles sont dans cette carte.',
    ],
    etats: [
      { id: 'vide', nom: 'Aucun monstre : fiche vide, puces désactivées', rendu: (ctx) => <ExemplaireGabarit ctx={ctx} mode="vide" /> },
      { id: 'rempli', nom: 'Exemplaire du compte', rendu: (ctx) => <ExemplaireGabarit ctx={ctx} mode="rempli" /> },
      { id: 'valide', nom: 'Build validé affiché', rendu: (ctx) => <ExemplaireGabarit ctx={ctx} mode="valide" /> },
    ],
  },
  {
    id: 'objectif-etroit', nom: 'Objectif et Rechercher, forme étroite', largeur: LARGEUR_OBJECTIF_ETROIT, hauteurEstimee: 356,
    composant: 'ObjectifEtRechercherBureau forme="etroite" (bureau/ObjectifEtRechercherBureau.tsx), composant à part',
    telephone: 'ObjectifEtActions (partagé) exporte TitreObjectifRecherche et ResumeCombat, rendu inchangé ; le téléphone garde ObjectifEtActions.',
    changements: [
      'L\'estimation du pool passe en tête du bloc, au-dessus de l\'objectif, à place réservée (deux lignes) : rien ne bouge quand elle paraît.',
      'Les quatre objectifs en 2 × 2, séparés par leurs bords intérieurs (traits de 1 px).',
      'Le résumé « Dégâts réels » garde sa place, invisible, sous un autre objectif : choisir « Dégâts réels » ne pousse plus rien.',
      '« Rechercher » plus grand (taille lg) ; « Arrêter » prend sa place exacte pendant une recherche (carré plein), inactif 300 ms, au lieu de s\'ajouter à côté de « Recherche… ».',
      '« Exporter » · « Importer » en libellé court au bureau (le libellé long reste le nom et l\'infobulle).',
      'Progression compacte : plus de barre ; à l\'appariement, deux lignes seules (« … combinaisons examinées · … trouvée(s) », « Attendez la fin de la recherche… ») ; préparation, erreur et refus dans la même place réservée, à la hauteur de ces deux lignes : le lancement ne pousse rien.',
      'Aux deux formats : plus de phrase « Le budget de recherche s\'élargit automatiquement… » (l\'escalade n\'existe plus dans le moteur).',
      'Dans cette vue : « Rechercher » bascule sur « Arrêter » sans lancer de recherche.',
    ],
    etats: etatsObjectif('etroite'),
  },
  {
    id: 'objectif-large', nom: 'Objectif et Rechercher, forme large', largeur: LARGEUR_OBJECTIF_LARGE_MIN, hauteurEstimee: 260, elastique: true,
    composant: 'ObjectifEtRechercherBureau forme="large" (bureau/ObjectifEtRechercherBureau.tsx), composant à part',
    telephone: 'Comme la forme étroite.',
    changements: [
      'Les changements de la forme étroite, sauf la disposition : objectifs sur une ligne, « Rechercher » · « Exporter » · « Importer » sur une rangée, « Rechercher » dessous, pleine largeur, sous 448 px de rangée.',
      'À la largeur de sa colonne (élastique) : A1, et A3 quand la colonne de droite fait moins de 952 px.',
    ],
    etats: [
      ...etatsObjectif('large'),
      { id: 'efficience-758', nom: 'Efficience, à 758 px (A1, 1920 scindé)', rendu: (ctx: ContexteGabarits) => <ObjectifGabarit ctx={ctx} forme="large" etat={{ objectif: 'efficience' }} />, largeur: 758 },
      { id: 'appariement-758', nom: 'Progression, à 758 px (chiffres de vue)', rendu: (ctx: ContexteGabarits) => <ObjectifGabarit ctx={ctx} forme="large" etat={{ objectif: 'efficience', statut: 'running', progression: APPARIEMENT }} />, largeur: 758 },
    ].map((e) => ({ ...e, rendu: enveloppe(e.rendu, e.largeur ?? LARGEUR_OBJECTIF_LARGE_MIN) })),
  },
  {
    id: 'resultats', nom: 'Résultats', largeur: LARGEUR_RESULTATS_MIN, hauteurEstimee: 160, elastique: true,
    composant: 'ResultatsBureau (bureau/ResultatsBureau.tsx), composant à part, autour d\'EnteteResultats, DiagnosticsSansResultat, GrilleResultats et PaginationResultats',
    telephone: 'Les composants des résultats repris tels quels ; aucun modifié.',
    changements: [
      'Présents dès le départ, dans leur cadre : avant la première recherche, une place d\'attente (≈ 160 px, libellés nouveaux à valider) tient la place des cartes.',
      'Le reste comme aujourd\'hui : en-tête, tri, cartes de 328 px au moins, 20 par page, pagination.',
    ],
    etats: [
      { id: 'sans-monstre', nom: 'Attente : aucun monstre', rendu: enveloppe((ctx) => <ResultatsGabarit ctx={ctx} mode="sans-monstre" />, LARGEUR_RESULTATS_MIN) },
      { id: 'attente', nom: 'Attente : aucune recherche lancée', rendu: enveloppe((ctx) => <ResultatsGabarit ctx={ctx} mode="sans-recherche" />, 758), largeur: 758 },
      { id: 'zero', nom: '0 résultat, avec diagnostic', rendu: enveloppe((ctx) => <ResultatsGabarit ctx={ctx} mode="zero" />, 758), largeur: 758 },
      { id: 'vingt', nom: '20 cartes, page 1 / 3 (builds du compte, répétés au-delà de 4 ; compte de vue)', rendu: enveloppe((ctx) => <ResultatsGabarit ctx={ctx} mode="vingt" />, 758), largeur: 758 },
      { id: 'vingt-386', nom: '20 cartes, une colonne (largeur minimale)', rendu: enveloppe((ctx) => <ResultatsGabarit ctx={ctx} mode="vingt" />, LARGEUR_RESULTATS_MIN) },
    ],
  },
];

// Une boîte élastique se montre à une largeur donnée : l'enveloppe la porte,
// la boîte la remplit.
function enveloppe(rendu: (ctx: ContexteGabarits) => JSX.Element, largeur: number) {
  return function Enveloppe(ctx: ContexteGabarits) {
    return <div style={{ width: largeur }}>{rendu(ctx)}</div>;
  };
}
