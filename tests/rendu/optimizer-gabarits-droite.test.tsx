// Tests de rendu — les gabarits de bureau des colonnes repliables et de la
// colonne de droite de l'Optimizer (`src/components/outils/optimizer/bureau/`).
// Le sens, jamais la forme : libellés, choix, états et leur nom accessible.

import ArtefactsEtReliqueBureau from '../../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import MeilleursArtefactsBureau from '../../src/components/outils/optimizer/bureau/MeilleursArtefactsBureau';
import SetsAuraBureau from '../../src/components/outils/optimizer/bureau/SetsAuraBureau';
import ExclusionRunesBureau from '../../src/components/outils/optimizer/bureau/ExclusionRunesBureau';
import ReglagesAvancesBureau from '../../src/components/outils/optimizer/bureau/ReglagesAvancesBureau';
import ExclusionMonstrePrecis from '../../src/components/outils/optimizer/ExclusionMonstrePrecis';
import RunesImposees from '../../src/components/outils/optimizer/RunesImposees';
import ExemplaireBureau from '../../src/components/outils/optimizer/bureau/ExemplaireBureau';
import ObjectifEtRechercherBureau, { type ObjectifEtRechercherBureauProps } from '../../src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau';
import ResultatsBureau from '../../src/components/outils/optimizer/bureau/ResultatsBureau';
import EstimationPool from '../../src/components/outils/optimizer/EstimationPool';
import { GABARITS } from '../../src/components/outils/optimizer/gabarits/registre';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { SOURCE_OPTIONS } from '../../src/lib/optimizerExclusion';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { egal, ok, titre } from '../outils';
import { bouton, rendre, texteVisible } from './outils-rendu';
import { BOX } from './optimizer.test';

const rien = () => {};
const ref = { current: null };

// Le bouton dont le texte est `nom` est-il retiré de la lecture (invisible, place gardée) ?
function cache(html: string, nom: string): boolean | undefined {
  const b = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(([, , contenu]) => texteVisible(contenu) === nom);
  return b ? /aria-hidden="true"/.test(b[1]) : undefined;
}

export function testRenduOptimizerGabaritsColonnes() {
  titre('rendu · Optimizer — gabarits de bureau des colonnes repliables');

  // Artéfacts et reliques : la carte d'aujourd'hui, sans l'encart des meilleurs artéfacts.
  const artefacts = texteVisible(rendre(<ArtefactsEtReliqueBureau optimiserArtefacts setOptimiserArtefacts={rien} artifactMainByKind={{}}
    setArtifactMainByKind={rien} lignesVerrouillees={[]} setLignesVerrouillees={rien} diagnosticVerrous={null} sortesFigees={[]}
    relicMainChoice="libre" setRelicMainChoice={rien} relicUniqueChoice="libre" setRelicUniqueChoice={rien} relicMinUpgrade={0} setRelicMinUpgrade={rien} />));
  ok(['Artéfacts et reliques', 'Attribut', 'Type', 'Relique', 'Propriété unique'].every((t) => artefacts.includes(t)), 'artéfacts : les libellés de la carte d\'aujourd\'hui, relique comprise');
  ok(!artefacts.includes('Meilleurs artéfacts offensifs'), 'artéfacts : les meilleurs artéfacts n\'y sont plus');

  // Meilleurs artéfacts : une carte à part, avec son geste de validation.
  const lists = { lists: [{ id: 'l', name: 'L' }], activeListId: 'l', validated: [] } as unknown as UseOptimizerLists;
  const meilleurs = rendre(<MeilleursArtefactsBureau modeArtefactsSeuls={{ explication: null, paire: [], gainBrutParCoup: 0, degatsParCoup: 0, surLeReel: false,
    reelIndisponible: false, dejaPorte: false, coutVerrousPct: null }} setArtefactsOuverts={rien} artefactsOuverts={false} critereArtefacts="brut"
    setCritereArtefacts={rien} setSetupOuvert={rien} sortesFigees={[]} resolvedSkill={null} sourceSelector={null} lists={lists}
    ownValidatedBuild={undefined} canValidateDisplayed handleValidateArtefacts={rien} artefactsProposesDejaReserves={false} />);
  ok(texteVisible(meilleurs).includes('Meilleurs artéfacts offensifs pour ce build'), 'meilleurs : le titre de l\'app');
  ok(!/aria-expanded/.test(meilleurs) && !!bouton(meilleurs, 'Dégâts réels'), 'meilleurs : jamais replié au bureau, les deux critères visibles');
  ok(texteVisible(meilleurs).includes('Aucun artéfact équipable ne correspond aux critères.'), 'meilleurs sans paire : la phrase d\'aujourd\'hui');

  // Sets d'aura : la saisie d'« État de mon monstre », dans sa carte.
  const auras = rendre(<SetsAuraBureau setup={{ ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: [{ set: 'fight', nombre: 3 }] }} maj={rien} rappel={false} onGuiderResPre={rien} />);
  ok(/aria-label="Sets d&#x27;aura des autres monstres"|aria-label="Sets d'aura des autres monstres"/.test(auras), 'auras : une carte nommée');
  ok(!!bouton(auras, 'Ajouter un set d\'aura') && texteVisible(auras).includes('3 / 15'), 'auras : l\'ajout fixe et le total');

  // Exclusion de runes : en ligne, les deux réglages empilés (monstre d'abord).
  const exclusion = rendre(<ExclusionRunesBureau monstrePrecisBlock={<p>Bloc monstre</p>} dejaUtiliseesBlock={<p>Bloc déjà utilisées</p>} runesImposeesBlock={<p>Bloc imposées</p>} />);
  const tex = texteVisible(exclusion);
  ok(tex.includes('Exclusion de runes') && !/aria-expanded/.test(exclusion), 'exclusion : en ligne, aucun en-tête qui déplie un flottant');
  ok(tex.indexOf('Bloc monstre') < tex.indexOf('Bloc déjà utilisées') && tex.indexOf('Bloc déjà utilisées') < tex.indexOf('Bloc imposées'),
    'exclusion : « Exclure les runes d\'un monstre », puis « déjà utilisées », puis les runes imposées');
  // Variantes bureau : monstres exclus à hauteur bornée, slots en deux colonnes également espacées.
  const equipe = BOX.find((b) => b.gear && b.gear.runes.length >= 2)!;
  const donnees = { box: BOX, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map() };
  const exclus = BOX.filter((b) => b !== equipe).map((b) => ({ source: 'box' as const, unitKey: b.key }));
  const monstreBureau = rendre(<ExclusionMonstrePrecis exclusionData={donnees} selectedUnitKey={equipe.key} selected={{ monster: equipe.monster, gear: equipe.gear! }}
    excludedSelectors={exclus} setExcludedSelectors={rien} bureau />);
  ok(/max-h-24 overflow-y-auto overscroll-contain/.test(monstreBureau), 'exclusion du bureau : les monstres exclus défilent dans une hauteur bornée');
  ok(!/max-h-24/.test(rendre(<ExclusionMonstrePrecis exclusionData={donnees} selectedUnitKey={equipe.key} selected={{ monster: equipe.monster, gear: equipe.gear! }}
    excludedSelectors={exclus} setExcludedSelectors={rien} />)), 'exclusion hors bureau : aucune hauteur bornée (le téléphone ne change pas)');
  const slotsBureau = rendre(<RunesImposees selected={{ monster: equipe.monster, gear: equipe.gear! }} lockedRunes={{}} setLockedRunes={rien} bureau />);
  ok(/grid grid-cols-\[auto_auto\] justify-evenly/.test(slotsBureau), 'slots conservés du bureau : deux colonnes espacées également');
  egal([...texteVisible(slotsBureau).matchAll(/Slot (\d)/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6'], 'slots conservés du bureau : 1 · 2, 3 · 4, 5 · 6 (impairs à gauche, pairs à droite)');

  // Réglages avancés : en ligne, sans dépliement.
  const avances = rendre(<ReglagesAvancesBureau><p>Contenu des réglages</p></ReglagesAvancesBureau>);
  ok(texteVisible(avances).includes('Réglages avancés') && texteVisible(avances).includes('Contenu des réglages') && !/aria-expanded/.test(avances),
    'avancés : en ligne, contenu visible, aucun dépliement');
}

function props(p: Partial<ObjectifEtRechercherBureauProps> = {}): ObjectifEtRechercherBureauProps {
  return {
    forme: 'etroite', estimation: null, messageImport: null, progression: { progress: null, refusal: null, compteAffiche: { compte: 0 } },
    objective: 'efficience', setObjective: rien, setSetupOuvert: rien, resumeCombat: 'S3 · vs Feu', handleSearch: rien,
    selected: { monster: BOX[0].monster, gear: BOX[0].gear! }, status: 'idle', comboSets: ['violent'], exportRecipe: rien,
    importFileRef: ref, importRecipe: rien, setStoppedManually: rien, stop: rien, ...p,
  };
}

export function testRenduOptimizerGabaritsDroite() {
  titre('rendu · Optimizer — gabarits de bureau de la colonne de droite');

  // Exemplaire : les quatre puces, la fiche, « Valider ce build ».
  const exemplaire = rendre(<ExemplaireBureau zoneDRef={ref} sourceOptions={SOURCE_OPTIONS.map((o) => ({ ...o, disabled: o.key !== 'box' }))}
    matchesValidatedBuild={false} unowned={false} gearSource="box" pickSource={rien} allSourcesEmpty={false} zoneDOpen={false} zoneDList={null}
    validatedBadge={null} selected={null} selectionFiche={null} setSelectionFiche={rien} relicUsageById={{}} validateBuildButton={<button type="button">Valider ce build</button>} />);
  ok(/aria-label="Exemplaire"/.test(exemplaire) && ['Box', 'RTA', 'Défenses siège', 'Offenses siège', 'Valider ce build'].every((n) => !!bouton(exemplaire, n)),
    'exemplaire : une carte nommée, les quatre puces et « Valider ce build »');

  // Objectif et Rechercher, forme étroite, au repos.
  const repos = rendre(<ObjectifEtRechercherBureau {...props({ estimation: <EstimationPool estimate={{ perSlot: [1, 2, 3, 4, 5, 6], product: 720 }} /> })} />);
  ok(texteVisible(repos).indexOf('runes gardées après pré-filtrage') < texteVisible(repos).indexOf('Objectif de recherche'), 'étroite : l\'estimation du pool au-dessus de l\'objectif');
  ok(/grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/.test(repos), 'étroite : les quatre objectifs en 2 × 2');
  ok(bouton(repos, 'Rechercher')?.desactive === false && cache(repos, 'Rechercher') === false, 'au repos : « Rechercher » actif et lisible');
  ok(cache(repos, 'Arrêter') === true && !!bouton(repos, 'Arrêter')?.desactive, 'au repos : « Arrêter » garde la place, invisible et inactif');
  ok(cache(repos, 'S3 · vs Feu') === true, 'hors « Dégâts réels » : le résumé du combat garde sa place, hors de lecture');
  egal(bouton(repos, 'Exporter')?.ariaLabel, 'Exporter les paramètres de recherche', '« Exporter » en libellé court, le long reste le nom');
  ok(!!bouton(repos, 'Importer'), '« Importer » présent');

  const degats = rendre(<ObjectifEtRechercherBureau {...props({ objective: 'degats_reels' })} />);
  ok(cache(degats, 'S3 · vs Feu') === false && bouton(degats, 'Modifier la description du combat') != null,
    '« Dégâts réels » : le résumé du combat se lit et rouvre la description');

  // Pendant une recherche : « Arrêter » à la place de « Rechercher », inactif au premier rendu (300 ms).
  const enCours = rendre(<ObjectifEtRechercherBureau {...props({ status: 'running' })} />);
  ok(cache(enCours, 'Rechercher') === true, 'en cours : « Rechercher » s\'efface, sa place reste');
  ok(cache(enCours, 'Arrêter') === false && !!bouton(enCours, 'Arrêter')?.desactive, 'en cours : « Arrêter » se lit, inactif au lancement');
  ok(texteVisible(enCours).includes('Préparation…'), 'en cours : la progression d\'aujourd\'hui');

  const sansMonstre = rendre(<ObjectifEtRechercherBureau {...props({ selected: null, forme: 'large' })} />);
  ok(!!bouton(sansMonstre, 'Rechercher')?.desactive && !/grid-template-columns:repeat\(2/.test(sansMonstre), 'large, sans monstre : « Rechercher » désactivé, objectifs sur une ligne');

  // Résultats : place d'attente avant la première recherche, contenu ensuite.
  ok(texteVisible(rendre(<ResultatsBureau attente="sans-recherche" />)).includes('Aucune recherche lancée pour ce monstre.'), 'résultats : la place d\'attente le dit');
  ok(texteVisible(rendre(<ResultatsBureau attente="sans-monstre" />)).includes('Choisis un monstre pour préparer la recherche.'), 'résultats sans monstre : la place d\'attente le dit');
  ok(texteVisible(rendre(<ResultatsBureau attente={null}><p>Cartes</p></ResultatsBureau>)) === 'Cartes', 'résultats : le contenu de l\'écran, sans attente');

  // Le registre : les gabarits de 6c2 suivent ceux des essentiels.
  egal(GABARITS.slice(6).map((g) => g.id), ['artefacts', 'meilleurs', 'auras', 'exclusion', 'avances', 'exemplaire', 'objectif-etroit', 'objectif-large', 'resultats'],
    'les colonnes repliables et la colonne de droite sont au registre, dans l\'ordre de la page');
  ok(GABARITS.filter((g) => g.elastique).every((g) => g.etats.every((e) => (e.largeur ?? g.largeur) >= g.largeur)), 'une boîte élastique ne se montre jamais sous sa largeur minimale');
}
