// Tests de rendu — les gabarits de bureau des colonnes repliables et de la
// colonne de droite de l'Optimizer (`src/components/outils/optimizer/bureau/`).
// Le sens, jamais la forme : libellés, choix, états et leur nom accessible.

import ArtefactsEtReliqueBureau from '../../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import MeilleursArtefactsBureau from '../../src/components/outils/optimizer/bureau/MeilleursArtefactsBureau';
import SetsAuraBureau from '../../src/components/outils/optimizer/bureau/SetsAuraBureau';
import PageBureau from '../../src/components/outils/optimizer/bureau/PageBureau';
import { coinsDuPanneau } from '../../src/components/outils/optimizer/bureau/panneau';
import { AurasExternesSaisie } from '../../src/components/outils/EtatMonstre';
import ExclusionRunesBureau from '../../src/components/outils/optimizer/bureau/ExclusionRunesBureau';
import ReglagesAvancesBureau from '../../src/components/outils/optimizer/bureau/ReglagesAvancesBureau';
import ExclusionMonstrePrecis from '../../src/components/outils/optimizer/ExclusionMonstrePrecis';
import RunesImposees from '../../src/components/outils/optimizer/RunesImposees';
import ExemplaireBureau from '../../src/components/outils/optimizer/bureau/ExemplaireBureau';
import ObjectifEtRechercherBureau, { type ObjectifEtRechercherBureauProps } from '../../src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau';
import ResultatsBureau from '../../src/components/outils/optimizer/bureau/ResultatsBureau';
import { ResumeCombat } from '../../src/components/outils/optimizer/ObjectifEtActions';
import EstimationPool from '../../src/components/outils/optimizer/EstimationPool';
import ProgressionRecherche from '../../src/components/outils/optimizer/ProgressionRecherche';
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

// Les classes du bouton dont le texte est `nom` ('' s'il manque).
function classesBouton(html: string, nom: string): string {
  const b = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(([, , contenu]) => texteVisible(contenu) === nom);
  return b?.[1].match(/class="([^"]*)"/)?.[1] ?? '';
}

export function testRenduOptimizerGabaritsColonnes() {
  titre('rendu · Optimizer — gabarits de bureau des colonnes repliables');

  // Artéfacts et relique : la carte d'aujourd'hui, sans l'encart des meilleurs artéfacts.
  const artefacts = texteVisible(rendre(<ArtefactsEtReliqueBureau optimiserArtefacts setOptimiserArtefacts={rien} artifactMainByKind={{}}
    setArtifactMainByKind={rien} lignesVerrouillees={[]} setLignesVerrouillees={rien} diagnosticVerrous={null} sortesFigees={[]}
    relicMainChoice="libre" setRelicMainChoice={rien} relicUniqueChoice="libre" setRelicUniqueChoice={rien} relicMinUpgrade={0} setRelicMinUpgrade={rien} />));
  ok(['Artéfacts et relique', 'Attribut', 'Type', 'Relique', 'Propriété unique'].every((t) => artefacts.includes(t))
    && !artefacts.includes('Artéfacts et reliques'), 'artéfacts : les libellés de la carte d\'aujourd\'hui, relique comprise, titre « Artéfacts et relique » comme l\'onglet');
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
  // Au bureau, ni titre, ni icône, ni phrase d'accroche : la colonne situe la
  // section, nommée pour les lecteurs d'écran ; le téléphone garde les siens.
  ok(!tex.includes('Exclusion de runes') && !tex.includes('Deux réglages indépendants') && /<section aria-label="Exclusion de runes">/.test(exclusion)
    && !/aria-expanded|<svg/.test(exclusion), 'exclusion : en ligne, section nommée sans titre, icône ni accroche, aucun en-tête qui déplie un flottant');
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
  ok(/class="grid grid-cols-2 gap-x-3 gap-y-1\.5"/.test(slotsBureau), 'slots conservés du bureau : deux colonnes égales');
  // Les puces : après la grille (l'en-tête porte l'aide, un autre bouton rond).
  const grilleBureau = slotsBureau.slice(slotsBureau.indexOf('class="grid grid-cols-2'));
  const pucesBureau = [...grilleBureau.matchAll(/<(?:button|span)\b[^>]*class="([^"]*rounded-full[^"]*)"/g)].map((m) => m[1]);
  ok(pucesBureau.length === 6 && pucesBureau.every((c) => /\bjustify-center\b/.test(c) && (/\bw-full\b/.test(c) || /(^|\s)flex(\s|$)/.test(c))),
    'slots conservés du bureau : six puces à la largeur de leur colonne, libellé centré (emplacement vide compris)');
  const slotsTel = rendre(<RunesImposees selected={{ monster: equipe.monster, gear: equipe.gear! }} lockedRunes={{}} setLockedRunes={rien} />);
  const rangeeTel = slotsTel.slice(slotsTel.indexOf('class="flex flex-wrap gap-1.5"'));
  ok(rangeeTel.length < slotsTel.length && !/justify-center/.test(rangeeTel), 'slots conservés hors bureau : la rangée et les puces d\'aujourd\'hui (le téléphone ne change pas)');
  egal([...texteVisible(slotsBureau).matchAll(/Slot (\d)/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6'], 'slots conservés du bureau : 1 · 2, 3 · 4, 5 · 6 (impairs à gauche, pairs à droite)');

  // Réglages avancés : en ligne, sans dépliement.
  const avances = rendre(<ReglagesAvancesBureau><p>Contenu des réglages</p></ReglagesAvancesBureau>);
  ok(!texteVisible(avances).includes('Réglages avancés') && /<section aria-label="Réglages avancés">/.test(avances)
    && texteVisible(avances).includes('Contenu des réglages') && !/aria-expanded|<svg/.test(avances),
    'avancés : en ligne, section nommée sans titre ni icône au bureau, contenu visible, aucun dépliement');
  ok(!/\bmin-h-|\bmax-h-|\bh-|height/.test(avances.match(/<section[^>]*>/)?.[0] ?? 'h-'),'avancés : une enveloppe sans hauteur fixe ni place réservée (un réglage retiré passe sans retouche)');
}

function props(p: Partial<ObjectifEtRechercherBureauProps> = {}): ObjectifEtRechercherBureauProps {
  return {
    estimation: null, messageImport: null, progression: { progress: null, refusal: null, compteAffiche: { compte: 0 } },
    objective: 'efficience', setObjective: rien, setSetupOuvert: rien, resumeCombat: 'S3 · vs Feu', handleSearch: rien,
    selected: { monster: BOX[0].monster, gear: BOX[0].gear! }, status: 'idle', comboSets: ['violent'], exportRecipe: rien,
    importFileRef: ref, importRecipe: rien, setStoppedManually: rien, stop: rien, ...p,
  };
}

export function testRenduOptimizerGabaritsDroite() {
  titre('rendu · Optimizer — gabarits de bureau de la colonne de droite');

  // Exemplaire : les quatre puces, la fiche, « Valider ce build ».
  const exemplaire = rendre(<ExemplaireBureau zoneDRef={ref} sourceOptions={SOURCE_OPTIONS.map((o) => ({ ...o, disabled: o.key !== 'box' }))}
    vuesExemplaire={null} gearSource="box" pickSource={rien} allSourcesEmpty={false} zoneDOpen={false} zoneDList={null}
    validatedBadge={null} selected={null} selectionFiche={null} setSelectionFiche={rien} relicUsageById={{}} validateBuildButton={<button type="button">Valider ce build</button>} />);
  ok(/aria-label="Exemplaire"/.test(exemplaire) && ['Box', 'RTA', 'Défenses siège', 'Offenses siège', 'Valider ce build'].every((n) => !!bouton(exemplaire, n)),
    'exemplaire : une carte nommée, les quatre puces et « Valider ce build »');

  // Objectif et Rechercher, forme étroite, au repos.
  const repos = rendre(<ObjectifEtRechercherBureau {...props({ estimation: <EstimationPool estimate={{ perSlot: [1, 2, 3, 4, 5, 6], product: 720 }} /> })} />);
  ok(texteVisible(repos).indexOf('runes gardées après pré-filtrage') < texteVisible(repos).indexOf('Objectif de recherche'), 'étroite : l\'estimation du pool au-dessus de l\'objectif');
  ok(/grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/.test(repos), 'étroite : les quatre objectifs en 2 × 2');
  ok(bouton(repos, 'Rechercher')?.desactive === false && cache(repos, 'Rechercher') === false, 'au repos : « Rechercher » actif et lisible');
  // « Rechercher » pèse plus qu'un segment choisi : la braise pleine du bouton
  // principal dès qu'un set est choisi ; sans set, le fond doux et son grisé
  // (une braise pleine grisée serait brune).
  const pleinRepos = classesBouton(repos, 'Rechercher');
  ok(/(^|\s)bg-accent(\s|$)/.test(pleinRepos) && /(^|\s)text-accent-ink(\s|$)/.test(pleinRepos) && !/opacity-40/.test(pleinRepos),
    'set choisi : « Rechercher » en braise pleine (`fond="plein"`), sans grisé');
  const sansSetBouton = classesBouton(rendre(<ObjectifEtRechercherBureau {...props({ comboSets: [] })} />), 'Rechercher');
  ok(/(^|\s)bg-accent-soft(\s|$)/.test(sansSetBouton) && !/(^|\s)bg-accent(\s|$)/.test(sansSetBouton) && /(^|\s)opacity-40(\s|$)/.test(sansSetBouton),
    'sans set : « Rechercher » au fond doux, grisé, toujours cliquable');
  const gabarit = (c: string) => c.split(/\s+/).filter((k) => /^(lg:)?(px-|py-|p-|min-h-|rounded|w-full$|text-sm$|border$|border-transparent$)/.test(k)).sort().join(' ');
  ok(gabarit(pleinRepos) !== '' && gabarit(pleinRepos) === gabarit(sansSetBouton),
    `« Rechercher » : mêmes classes de taille et de contour avec ou sans set, le bouton ne bouge pas (${gabarit(pleinRepos)})`);
  ok(cache(repos, 'Arrêter') === true && !!bouton(repos, 'Arrêter')?.desactive, 'au repos : « Arrêter » garde la place, invisible et inactif');
  ok(!texteVisible(repos).includes('S3 · vs Feu') && !repos.includes('S3 · vs Feu'), 'hors « Dégâts réels » : aucun résumé du combat, ni place gardée');
  egal(bouton(repos, 'Exporter')?.ariaLabel, 'Exporter les paramètres de recherche', '« Exporter » en libellé court, le long reste le nom');
  ok(!!bouton(repos, 'Importer'), '« Importer » présent');

  const degats = rendre(<ObjectifEtRechercherBureau {...props({ objective: 'degats_reels' })} />);
  ok(cache(degats, 'S3 · vs Feu') === false && bouton(degats, 'Modifier la description du combat') != null,
    '« Dégâts réels » : le résumé du combat se lit et rouvre la description');
  // Plus de places réservées dans le bloc, hors « Rechercher » / « Arrêter »
  // Ni lignes du résumé, ni estimation, ni progression en double.
  ok(!/min-h-\[2lh\]/.test(degats) && !/min-h-\[2lh\]/.test(rendre(<ResumeCombat resumeCombat="S3 · vs Feu" setSetupOuvert={rien} />)),
    'le résumé du combat prend la hauteur de son texte, au bureau comme au téléphone');
  ok(!/aria-hidden="true" class="invisible col-start-1 row-start-1"/.test(repos), 'aucune copie invisible qui réserve une place (estimation, progression)');

  // Deux piles : réglages, barre collée et progression distincts.
  // « Rechercher » / « Arrêter » seul, sans
  // panneau ni progression : collé par le bas, un élément qui grandirait
  // ferait monter le bouton sous le pointeur.
  const reglages = rendre(<ObjectifEtRechercherBureau {...props({ partie: 'reglages', status: 'running' })} />);
  ok(!bouton(reglages, 'Rechercher') && !bouton(reglages, 'Arrêter') && !!bouton(reglages, 'Exporter') && texteVisible(reglages).includes('Objectif de recherche')
    && !texteVisible(reglages).includes('Préparation…'),
    'deux piles, réglages : objectifs et import/export, sans bouton de recherche ni progression');
  const progression = rendre(<ObjectifEtRechercherBureau {...props({ partie: 'progression', status: 'running' })} />);
  ok(texteVisible(progression).includes('Préparation…') && !bouton(progression, 'Rechercher'), 'deux piles : progression séparée de la barre collée');
  const barre = rendre(<ObjectifEtRechercherBureau {...props({ partie: 'barre', status: 'running' })} />);
  ok(!!bouton(barre, 'Arrêter') && !texteVisible(barre).includes('Objectif de recherche') && !texteVisible(barre).includes('Préparation…')
    && !barre.includes('rounded-xl border border-border bg-panel p-2') && !/aria-hidden="true" class="invisible col-start-1 row-start-1"/.test(barre),
    'deux piles, collé : « Arrêter » à la place de « Rechercher », seul — ni panneau, ni objectifs, ni progression');
  // « Rechercher » à droite de « Exporter » · « Importer »,
  // ou dessous, pleine largeur, sous 448 px de rangée (requête sur la rangée elle-même ; au navigateur :
  // testRenduOptimizerGabaritsLargeurs).
  const large = rendre(<ObjectifEtRechercherBureau {...props({  })} />);
  ok(/class="@container\/rangee"><div class="flex flex-col-reverse gap-2 @\[448px\]\/rangee:flex-row-reverse/.test(large)
    && /class="grid w-full @\[448px\]\/rangee:w-60 @\[448px\]\/rangee:flex-none"/.test(large),
    'forme large : « Rechercher », 240 px, à droite de sa rangée, dessous et pleine largeur sous 448 px de rangée');
  ok(/class="grid w-60 flex-none"/.test(barre) && /class="flex justify-end/.test(barre), 'deux piles, collé : « Rechercher » (ou « Arrêter ») toujours à 240 px, à droite');

  // Pendant une recherche : « Arrêter » à la place de « Rechercher », inactif au premier rendu (300 ms).
  const enCours = rendre(<ObjectifEtRechercherBureau {...props({ status: 'running' })} />);
  ok(cache(enCours, 'Rechercher') === true, 'en cours : « Rechercher » s\'efface, sa place reste');
  ok(cache(enCours, 'Arrêter') === false && !!bouton(enCours, 'Arrêter')?.desactive, 'en cours : « Arrêter » se lit, inactif au lancement');
  ok(texteVisible(enCours).includes('Préparation…'), 'en cours : la progression d\'aujourd\'hui');
  // Progression compacte : à l'appariement, les deux lignes seules, sans barre (réserve comprise).
  const appariement = { phase: 'pairing' as const, explored: 12_345_678, found: 1_234, pct: 0.42, totalPairs: 29_393_280, candidates: [] };
  const compacte = rendre(<ObjectifEtRechercherBureau {...props({ status: 'running', progression: { progress: appariement, refusal: null, compteAffiche: { compte: 1_234 } } })} />);
  const lu = texteVisible(compacte);
  ok(lu.includes('12 345 678 / 29 393 280 combinaisons examinées · 1 234 trouvée(s)') && lu.includes('Attendez la fin de la recherche pour être sûr de trouver votre build optimal.'),
    'progression compacte : les deux lignes d\'aujourd\'hui, vrais chiffres');
  ok(!/h-2 w-full overflow-hidden rounded-full/.test(compacte), 'progression compacte : aucune barre au bureau');
  ok(!/budget de recherche/.test(compacte), 'progression : plus de phrase sur un budget qui s\'élargit');
  const telephone = rendre(<ProgressionRecherche status="running" progress={appariement} refusal={null} compteAffiche={{ compte: 1_234 }} />);
  ok(/h-2 w-full overflow-hidden rounded-full/.test(telephone) && !/budget de recherche/.test(telephone), 'progression hors bureau : la barre reste, sans la phrase du budget');

  const sansMonstre = rendre(<ObjectifEtRechercherBureau {...props({ selected: null })} />);
  ok(!!bouton(sansMonstre, 'Rechercher')?.desactive && /grid-template-columns:repeat\(2/.test(sansMonstre), 'sans monstre : Rechercher désactivé, objectifs en 2 × 2 avant mesure de leur largeur');

  // Résultats : place d'attente avant la première recherche, contenu ensuite.
  ok(texteVisible(rendre(<ResultatsBureau attente="sans-recherche" />)).includes('Aucune recherche lancée pour ce monstre.'), 'résultats : la place d\'attente le dit');
  ok(texteVisible(rendre(<ResultatsBureau attente="sans-monstre" />)).includes('Choisis un monstre pour préparer la recherche.'), 'résultats sans monstre : la place d\'attente le dit');
  ok(texteVisible(rendre(<ResultatsBureau attente={null}><p>Cartes</p></ResultatsBureau>)) === 'Cartes', 'résultats : le contenu de l\'écran, sans attente');

  // Le registre : les gabarits de 6c2 suivent ceux des essentiels.
  egal(GABARITS.slice(6).map((g) => g.id), ['artefacts', 'meilleurs', 'auras', 'exclusion', 'avances', 'exemplaire', 'objectif', 'resultats',
    'configuration-deux-piles', 'configuration-groupe', 'configuration-criteres-et-groupe', 'configuration-colonnes'],
    'les réglages, le bloc unique, les résultats et les quatre configurations sont au registre');
  ok(GABARITS.filter((g) => g.elastique).every((g) => g.etats.every((e) => (e.largeur ?? g.largeur) >= g.largeur)), 'une boîte élastique ne se montre jamais sous sa largeur minimale');
}

// La page de bureau assemblée : la colonne de droite (Exemplaire, bloc
// « Objectif et Rechercher », résultats) en cases de la grille, et l'annonce
// du rappel des auras hors des colonnes repliables.
export function testRenduOptimizerPageBureauDroite() {
  titre('rendu · Optimizer — page de bureau : colonne de droite et annonce du rappel des auras');
  const page = (rappelAuras: boolean) => rendre(
    <PageBureau liste={<p>Liste</p>} set={null} conditions={null} principales={null} etat={null} artefacts={<p>Artefacts</p>} meilleurs={null}
      auras={<SetsAuraBureau setup={DEFAULT_DAMAGE_SETUP} maj={rien} rappel={rappelAuras} onGuiderResPre={rien} />} exclusion={null} avances={null}
      exemplaire={<p>Exemplaire</p>} objectif={({ cadre, partie }) => <p>Bloc large {partie} {cadre ? 'panneau' : 'section'}</p>} resultats={<ResultatsBureau attente="sans-monstre" />}
      onglet="complements" onOnglet={rien} rappelAuras={rappelAuras} />);
  const html = page(false);
  const zones = [...html.matchAll(/data-zone="([a-z-]+)"/g)].map((m) => m[1]);
  egal(zones, ['monstre', 'exemplaire', 'pile-droite', 'onglets', 'objectif', 'barre', 'resultats'],
    'ordre de lecture : Monstre (liste puis exemplaire), pile de droite (onglets, objectif, recherche, résultats)');
  ok(texteVisible(html).includes('Bloc large reglages section') && texteVisible(html).includes('Bloc large barre section')
    && texteVisible(html).includes('Bloc large progression section'),
    'largeur inconnue : deux piles, bloc en trois parties sans cadre individuel');
  ok(/data-zone="pile-droite" class="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain \[scrollbar-gutter:stable\]"/.test(html),
    'la pile est un panneau qui défile et réserve sa barre, sans display:contents');
  ok(/data-page-fenetre/.test(html) && !/style="[^"]*height/.test(html.slice(0, html.indexOf('>'))),
    'page à hauteur visible dans toutes les configurations ; la hauteur attend la mesure au navigateur');
  ok(/data-zone="barre" class="relative /.test(html) && !/data-zone="barre" class="[^"]*sticky/.test(html), 'deux piles : la barre de recherche reste à sa place, sans coller au bas');
  ok(html.includes('rounded-xl border border-border bg-panel p-2') && html.includes('before:border-t before:border-border')
    && !html.includes('linear-gradient') && !html.includes('border-t-[3px]'),
    'panneaux : un contour de 1 px et un haut fixe, sans bande braise en dégradé');
  ok(/class="relative mr-1"/.test(html), 'pile de droite : 4 px entre panneau et barre réservée');
  ok(/^<div class="-mx-3 @container"/.test(html),
    'page de bureau : marges de 12 px, 12 px repris de chaque côté sur les 24 de la page ou du volet (au premier rendu, avant la mesure), la racine restant le conteneur');
  // Les coins d'une colonne qui défile : la boîte est rognée aux coins du haut
  // du panneau, la barre et l'écart à sa droite gardés.
  egal(coinsDuPanneau(540, 14), "path('M 0 14 A 14 14 0 0 1 14 0 H 526 A 14 14 0 0 1 540 14 V 0 H 100000 V 100000 H 0 Z')",
    'coins d\'une colonne qui défile : rognés à l\'arrondi du panneau, tout le reste de la boîte gardé');

  // Le rappel des auras : la carte du bureau l'affiche sans l'annoncer ; la
  // page l'annonce dans une région toujours montée, hors des colonnes.
  const regions = (h: string) => [...h.matchAll(/<(\w+)[^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => texteVisible(m[2]));
  const carte = rendre(<SetsAuraBureau setup={DEFAULT_DAMAGE_SETUP} maj={rien} rappel onGuiderResPre={rien} />);
  ok(!carte.includes('aria-live'), 'carte des sets d\'aura du bureau : aucune région annoncée (la page annonce)');
  ok(rendre(<AurasExternesSaisie setup={DEFAULT_DAMAGE_SETUP} maj={rien} rappel onGuiderResPre={rien} />).includes('aria-live="polite"'),
    'boîte des auras partagée : elle annonce par défaut (téléphone inchangé)');
  egal(regions(html), [''], 'hors rappel : une seule région, vide');
  const avecRappel = page(true);
  egal(regions(avecRappel), ['Pense à vérifier les sets d\'aura externes.'], 'pendant le rappel : la page l\'annonce, une fois');
  const colonnes = avecRappel.slice(avecRappel.indexOf('data-zone="monstre"'));
  ok(!/aria-live/.test(colonnes), 'l\'annonce précède tous les panneaux : elle reste montée quel que soit l\'onglet');

  // La place d'attente pendant une recherche sans carte : cadre, sans « Aucune recherche lancée… » lisible.
  const sansCarte = rendre(<ResultatsBureau attente="sans-carte" />);
  ok(/<p class="label invisible" aria-hidden="true">/.test(sansCarte) && texteVisible(sansCarte).includes('Les builds trouvés s\'afficheront ici.'),
    'recherche sans carte : la ligne de la phrase reste réservée, invisible ; le cadre reste');
}
