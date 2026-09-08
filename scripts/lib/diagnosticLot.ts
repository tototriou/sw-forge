// Le LOT — faire tourner le harnais sur PLUSIEURS des 7 cas connus au lieu
// d'un seul (§5.3 des extensions, ligne 10 du tableau du §10).
//
// **Niveau A-PASSIF, au sens strict** : rien ici ne mesure, n'observe ni ne
// calcule quoi que ce soit de nouveau. Ce module BOUCLE sur des runs qui
// existent déjà, à l'identique. Le principe directeur du harnais — « il
// ORCHESTRE et OBSERVE les fonctions de production, il ne réimplémente
// AUCUNE étape algorithmique » — s'applique donc ici sous sa forme la plus
// littérale : ce fichier n'appelle pas une seule fonction du moteur.
//
// ⚠️ **Pourquoi un module à part, et pas un champ de plus dans
// `diagnosticTypes.ts`.** Deux types existants disaient déjà « un run » et
// auraient été tordus pour en dire « sept » :
//   - `SourceHarnais` décrit **d'où vient UN pool** (une recette + un compte,
//     ou une graine). Un lot n'est pas une huitième provenance : c'est de
//     l'ORCHESTRATION, la même distinction que `ConfigResolue` (ce que le
//     moteur consomme) contre `OptionsHarnais` (ce qui pilote le harnais),
//     posée au §3.1 des extensions.
//   - `ResultatHarnais` décrit **UN run** — une préparation, une complétude,
//     une série de temps. Lui faire porter sept préparations en aurait fait
//     un type dont aucun champ n'a plus le même sens selon le mode.
// D'où `ResultatLot`, qui CONTIENT N `ResultatHarnais` sans en modifier un
// seul, et `OptionsLot = Omit<ConfigHarnais, 'source'>` — écrit comme une
// soustraction plutôt que recopié, pour qu'un champ ajouté à `ConfigHarnais`
// arrive ici sans que personne ait à y penser.
//
// ⚠️ **Le motif que ce module INTERNALISE.** La coquille ci-dessous a déjà
// été écrite ad hoc deux fois (mesures des §4.5 et §4.6 des extensions) puis
// jetée à chaque fois, toujours dans la même forme : boucler sur `CASES`,
// monter la recette par `buildOptimizerRecipe`, l'écrire dans un fichier
// temporaire (`chargerRecette` lit un CHEMIN, pas un objet), appeler le
// harnais, `unlinkSync` dans un `finally`. C'est exactement le motif que le
// harnais existe pour supprimer — un bout de tuyauterie recopié à chaque
// mesure est un bout de tuyauterie qui finit par diverger.
//
// ⚠️ **Le fichier temporaire ne survit pas à `resoudreCas`.** `chargerRecette`
// lit la recette pendant `resoudreConfig` ; une fois la configuration
// résolue, plus rien n'a besoin du fichier. Il est donc supprimé dans le
// `finally` de CETTE fonction, et aucun appelant n'hérite d'un nettoyage à
// faire — la seule forme qui ne peut pas fuir.

import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { buildOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { SlotFilterPresetKey } from '../../src/lib/runeBuildOptim';
import { ConfigResolue, resoudreConfig } from './diagnosticConfig';
import { executerHarnaisResolu } from './diagnosticHarness';
import { ConfigHarnais, ResultatHarnais } from './diagnosticTypes';
import { loadDeckMonster } from './deckMonster';
import { CASES, loadCase } from './perfShared';

/**
 * Ce qu'une `ConfigHarnais` porte EN PLUS de sa source — c'est-à-dire tout
 * ce qui est COMMUN aux N runs d'un lot.
 *
 * ⚠️ Écrit en soustraction, jamais recopié champ à champ : un réglage ajouté
 * à `ConfigHarnais` (comme `horodaterProgression` l'a été pour A₂) devient
 * automatiquement commun au lot, sans qu'on ait à y penser. Une recopie
 * serait exactement l'endroit où un champ s'oublierait en silence.
 */
export type OptionsLot = Omit<ConfigHarnais, 'source'>;

/**
 * Le préréglage sous lequel un lot monte ses recettes.
 *
 * ⚠️ **Il n'est pas choisi ici, il est CONSTATÉ** : « Moyen » est le défaut
 * de l'écran (`useOptimizerState`), donc ce que la production applique quand
 * l'utilisateur ne touche à rien — et c'est aussi celui sous lequel les
 * mesures des §4.5 et §4.6 ont été relevées, donc la seule valeur qui rend
 * un lot d'aujourd'hui lisible à côté d'elles. Le changer se fait par
 * `--slotFilterCap`, qui est un OVERRIDE au sens plein : marqué, et le
 * drapeau de fidélité bascule.
 */
export const PRESET_LOT: SlotFilterPresetKey = 'moyen';

/** Une ligne de lot : UN cas, et le run complet qu'il a produit. */
export interface LigneLot {
  /** L'indice du cas dans `CASES` — l'identifiant stable, celui de `--cas=`. */
  index: number;
  libelle: string;
  resultat: ResultatHarnais;
}

export interface ResultatLot {
  /**
   * ⚠️ **LA condition, au singulier.** Un lot fait varier le CAS et rien
   * d'autre : ce bloc est ce qui reste identique d'une ligne à l'autre, et
   * c'est lui qui rend l'avertissement ci-dessous vérifiable plutôt que
   * déclaratif.
   */
  condition: {
    arretApres: NonNullable<OptionsLot['arretApres']>;
    repetitions: number;
    preset: SlotFilterPresetKey;
    overrides: NonNullable<OptionsLot['overrides']>;
    horodaterProgression: boolean;
  };
  lignes: LigneLot[];
  /**
   * Voir `AVERTISSEMENT_LOT`. ⚠️ Porté par le RÉSULTAT, pas seulement imprimé
   * par la mise en forme : un lecteur de `--json` qui recolle les sept lignes
   * dans un tableau court exactement le même risque qu'un lecteur du texte.
   */
  avertissementLot: string;
}

/** Ce que l'appelant veut afficher AU FIL du lot, plutôt qu'à la fin. */
export interface ObservateurLot {
  /** Le palier 1 du cas — disponible AVANT que quoi que ce soit s'exécute. */
  avant?(info: { position: number; total: number; index: number; libelle: string }, resolue: ConfigResolue): void;
  apres?(ligne: LigneLot, info: { position: number; total: number }): void;
}

/* --------------------------------------------------------------------------
 * La SÉLECTION — `--cas=<index|nom|tous>`
 * ----------------------------------------------------------------------- */

/**
 * Mise à plat pour la correspondance par NOM : minuscules, accents retirés,
 * tout ce qui n'est pas alphanumérique supprimé. `Lushen d15 (Rage+Blade,
 * reel)` devient `lushend15ragebladereel`, donc `rage+blade`, `Rage Blade` et
 * `rageblade` désignent tous le même cas.
 *
 * ⚠️ **Tolérante à la SAISIE, jamais au RÉSULTAT** : la mise à plat élargit
 * ce qui est reconnu, elle n'autorise aucun repli. Un nom qui ne désigne pas
 * exactement un cas — inconnu, ou correspondant à plusieurs — est REFUSÉ, il
 * n'en choisit pas un arbitrairement (règle 4 du §4.4, « aucun repli
 * silencieux »).
 */
function aplatir(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD') // les marques combinantes restantes tombent avec le filtre ci-dessous
    .replace(/[^a-z0-9]/g, '');
}

function listerLesCas(): string {
  return CASES.map((c, i) => `  ${i}  ${c.label}`).join('\n');
}

/**
 * D'un `--cas=…` à la liste des indices de `CASES` à exécuter.
 *
 * ⚠️ **Lève, jamais ne replie.** Trois refus possibles, et chacun NOMME ce
 * qui était attendu, comme `lireEnum` le fait déjà pour les énumérations du
 * CLI : indice hors bornes, nom inconnu, nom AMBIGU. Ce dernier est le plus
 * important : `--cas=lushen` désigne quatre cas, et en choisir un serait
 * exactement le « repli silencieux » que le harnais existe pour supprimer.
 */
export function resoudreSelectionCas(brut: string): number[] {
  const aplati = aplatir(brut);
  if (aplati === 'tous') return CASES.map((_, i) => i);

  // Un nombre est un INDICE, et il est borné — `--cas=7` ne doit pas
  // produire un `CASES[7]` indéfini qui planterait dix lignes plus loin.
  // ⚠️ Le signe est reconnu ICI, pas laissé filer vers la correspondance par
  // nom : `-1` mis à plat devient `1`, qui est un fragment de cinq libellés
  // (« d15 », « d10 », « d11 »…) — il aurait donc été refusé pour AMBIGUÏTÉ,
  // un motif qui n'a rien à voir avec ce que l'utilisateur a tapé.
  if (/^[+-]?\d+$/.test(brut.trim())) {
    const i = Number(brut.trim());
    if (i < 0 || i >= CASES.length) {
      throw new Error(`--cas : indice entre 0 et ${CASES.length - 1} attendu — reçu « ${brut} ».\n${listerLesCas()}`);
    }
    return [i];
  }

  const correspondants = CASES.map((_, i) => i).filter((i) => aplatir(CASES[i].label).includes(aplati));
  if (correspondants.length === 1) return correspondants;
  if (correspondants.length === 0) {
    throw new Error(
      `--cas : « ${brut} » ne correspond à aucun cas connu. Attendu : un indice, « tous », ` +
        `ou un fragment de libellé.\n${listerLesCas()}`
    );
  }
  throw new Error(
    `--cas : « ${brut} » est AMBIGU — il correspond à ${correspondants.length} cas. Préciser :\n` +
      correspondants.map((i) => `  ${i}  ${CASES[i].label}`).join('\n')
  );
}

/**
 * ⚠️ **Les deux exports de compte sont GITIGNORÉS**, donc absents de toute
 * machine qui n'est pas celle de leur propriétaire. Un cas dont l'export
 * manque est REFUSÉ en nommant le fichier — jamais sauté en silence, jamais
 * remplacé par un pool synthétique : un lot amputé de trois cas sans le dire
 * produirait un tableau qu'on relirait comme portant sur les sept.
 *
 * ⚠️ Vérifié AU PALIER 1, avant la moindre lecture : c'est un `existsSync`,
 * il coûte zéro, et il évite de découvrir au bout de dix minutes de run que
 * le quatrième cas n'a pas de compte.
 */
export function verifierComptesDisponibles(indices: number[]): void {
  const manquants = indices.filter((i) => !existsSync(CASES[i].exportPath));
  if (manquants.length === 0) return;
  throw new Error(
    `--cas : ${manquants.length} cas sur ${indices.length} n'ont pas leur export de compte sur ce disque ` +
      `(fichiers gitignorés, absents des autres machines) :\n` +
      manquants.map((i) => `  ${i}  ${CASES[i].label}  →  ${CASES[i].exportPath} INTROUVABLE`).join('\n') +
      `\nAucun repli : ni saut silencieux du cas, ni pool synthétique à la place.`
  );
}

/* --------------------------------------------------------------------------
 * D'un cas connu à une configuration RÉSOLUE
 * ----------------------------------------------------------------------- */

/**
 * Monte la recette du cas `index`, la résout, et rend la configuration
 * résolue — le palier 1, prêt à afficher, sans que rien ne se soit exécuté.
 *
 * ⚠️ **Le chemin est celui de la PRODUCTION, pas un raccourci** : le cas
 * fournit son exigence (`loadCase`, la fixture déjà partagée avec
 * `perf-battery`), `buildOptimizerRecipe` en fait une recette réimportable
 * telle quelle dans l'écran, et `chargerRecette` la rejoue exactement comme
 * `optimizer-search.ts` — objectif retiré replié, `com2usId` contrôlé,
 * `recipeToSearchParams` pour les bornes d'artéfact. C'est ce qui distingue
 * ce lot des trois scripts `-diag` qui fabriquaient leur `SearchParams` à la
 * main.
 *
 * ⚠️ `loadDeckMonster` est appelé À CÔTÉ de `loadCase` pour le seul
 * `com2usId` — que `loadCase` ne rend pas. Sans lui, `chargerRecette`
 * avertirait à CHAQUE cas d'un désaccord de monstre qui n'existe pas, et le
 * bruit finirait par masquer un vrai désaccord (même raison, et même
 * correctif, que dans `diagnostic-harness-parite.ts`).
 */
export function resoudreCas(index: number, commun: OptionsLot): { config: ConfigHarnais; resolue: ConfigResolue } {
  const c = CASES[index];
  const { requirement } = loadCase(c);
  const { com2usId } = loadDeckMonster({
    exportPath: c.exportPath,
    deckId: c.deckId,
    monsterName: c.monsterName,
    defense: c.defense,
    rest: [],
  });
  const recette = buildOptimizerRecipe({
    monsterCom2usId: com2usId,
    monsterName: c.monsterName,
    wizardName: null,
    requirement,
    objective: c.objective ?? 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP,
    metric: 'eff',
    slotFilterPreset: PRESET_LOT,
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'box',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: {},
  });

  const chemin = join(tmpdir(), `sw-forge-lot-${process.pid}-${index}.json`);
  const config: ConfigHarnais = {
    source: {
      type: 'recette',
      cheminCompte: c.exportPath,
      cheminRecette: chemin,
      mode: { type: 'siege', deckId: c.deckId, defense: c.defense },
    },
    ...commun,
  };
  writeFileSync(chemin, JSON.stringify(recette), 'utf8');
  try {
    return { config, resolue: resoudreConfig(config) };
  } finally {
    // ⚠️ Ici et nulle part ailleurs : `resoudreConfig` a fini de lire la
    // recette, plus rien en aval n'en a besoin. Rendre un `nettoyer()` à
    // l'appelant serait un nettoyage qu'un chemin d'erreur peut sauter.
    unlinkSync(chemin);
  }
}

/* --------------------------------------------------------------------------
 * L'exécution du lot
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **N runs INDÉPENDANTS, l'un après l'autre.** Aucun entrelacement, aucun
 * état partagé, aucune agrégation entre cas : ce que rend `executerLot` est
 * littéralement ce que rendraient N invocations successives du CLI. C'est ce
 * qui autorise à dire, dans `AVERTISSEMENT_LOT`, que le lot ne fabrique
 * aucune comparaison — la propriété est structurelle, pas une promesse.
 */
export async function executerLot(
  indices: number[],
  commun: OptionsLot,
  observateur: ObservateurLot = {}
): Promise<ResultatLot> {
  const lignes: LigneLot[] = [];
  for (const [position, index] of indices.entries()) {
    const info = { position: position + 1, total: indices.length, index, libelle: CASES[index].label };
    const { config, resolue } = resoudreCas(index, commun);
    observateur.avant?.(info, resolue);
    const ligne: LigneLot = { index, libelle: CASES[index].label, resultat: await executerHarnaisResolu(resolue, config) };
    lignes.push(ligne);
    observateur.apres?.(ligne, info);
  }
  return {
    condition: {
      arretApres: commun.arretApres ?? 'classement',
      repetitions: commun.repetitions ?? 1,
      preset: PRESET_LOT,
      overrides: commun.overrides ?? {},
      horodaterProgression: commun.horodaterProgression ?? false,
    },
    lignes,
    avertissementLot: AVERTISSEMENT_LOT,
  };
}

/* --------------------------------------------------------------------------
 * L'ANNONCE — le coût se dit AVANT d'être payé
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Le palier 1 existe pour « challenger la configuration AVANT de laisser
 * tourner vingt minutes »** (§5 du cadrage). Un lot multiplie ce temps par le
 * nombre de cas : il doit donc dire ce qu'il va faire — combien de cas,
 * lesquels, jusqu'où, combien de fois — avant de le faire, et pas seulement
 * l'afficher au fur et à mesure.
 */
export function annoncerLot(indices: number[], commun: OptionsLot): string {
  const arret = commun.arretApres ?? 'classement';
  const rep = commun.repetitions ?? 1;
  const pluriel = indices.length > 1 ? 's' : '';
  const surcharges = Object.entries(commun.overrides ?? {}).map(([k, v]) => `${k}=${v}`);
  const l: string[] = [];
  l.push('═'.repeat(78));
  l.push(`LOT — ${indices.length} cas sur ${CASES.length}, préréglage « ${PRESET_LOT} »`);
  l.push('═'.repeat(78));
  for (const [position, i] of indices.entries()) {
    l.push(`  ${String(position + 1).padStart(2)}/${indices.length}   cas ${i}  ${CASES[i].label}`);
  }
  l.push('');
  l.push(`  arrêt après   : ${arret}`);
  l.push(`  répétitions   : ${rep}   →   ${indices.length * rep} recherche(s) au total`);
  l.push(`  overrides     : ${surcharges.length > 0 ? surcharges.join(', ') : 'aucun'}`);
  if (commun.horodaterProgression) l.push('  progression   : A₂ activé (instrument OPT-IN, il se paie — son coût est imprimé avec lui)');
  l.push('');
  // ⚠️ L'ordre de grandeur est DIT, jamais estimé cas par cas : le harnais ne
  // sait pas prédire la durée d'une recherche (c'est même la raison d'être du
  // §6.2, « jamais un 0 candidat nu »). Ce qu'il peut dire honnêtement, c'est
  // que le coût est MULTIPLIÉ, et où se trouve le point d'arrêt gratuit.
  l.push(`  ${AVERTISSEMENT_LOT_COURT}`);
  l.push(
    arret === 'classement' || arret === 'appariement'
      ? `  ⚠️ COÛT : ${indices.length} recherche${pluriel} COMPLÈTE${pluriel.toUpperCase()} à la suite — des dizaines de minutes. ` +
          `Relire les paliers 1 ci-dessous avant de laisser tourner ; --apercu s'y arrête sans rien exécuter.`
      : `  ⚠️ COÛT : ${indices.length} run${pluriel} arrêté${pluriel} après « ${arret} » — l'appariement, qui domine, n'est PAS payé.`
  );
  return l.join('\n');
}

/* --------------------------------------------------------------------------
 * La RESTITUTION — et le garde-fou qui va avec
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Le piège propre au lot, et ce n'est PAS celui du run unique.**
 *
 * Une sortie qui aligne sept cas en colonnes RESSEMBLE à une comparaison. Le
 * harnais porte déjà `avertissementComparaison` (§6.4 bis), qui dit de ne pas
 * lancer deux runs séparés et soustraire — il part avec CHAQUE mesure de
 * temps, donc autant de fois qu'il y a de cas, et il n'est ici ni affaibli,
 * ni remplacé, ni remonté une seule fois en tête comme s'il ne valait que
 * pour le premier cas.
 *
 * Mais il ne suffit pas, parce qu'il répond à une AUTRE question. Comparer un
 * CAS à un autre CAS n'est pas comparer deux CONDITIONS : le premier est
 * légitime — c'est même tout ce pour quoi le lot existe, et c'est ainsi que
 * les §4.5 et §4.6 se lisent ; le second demande l'entrelacement, que le
 * harnais ne sait pas faire (niveau 2 du §6.4 bis, non implémenté ; n° 11c du
 * tableau du §10, dont l'ordre 11a → 11b → 11c est strict). **Si la sortie ne
 * dit pas laquelle des deux elle autorise, elle sera lue comme autorisant
 * l'autre** — d'où ce texte, imprimé AVANT le tableau récapitulatif et non
 * après, pour tomber sur le chemin d'un lecteur pressé plutôt que sous sa
 * dernière ligne.
 */
export const AVERTISSEMENT_LOT =
  '⚠️ CE QU’UN LOT AUTORISE, ET CE QU’IL N’AUTORISE PAS. Les lignes ci-dessous sont des runs ' +
  'INDÉPENDANTS d’UNE SEULE condition, chacun sur un pool, une exigence et un monstre DIFFÉRENTS. ' +
  'Lire une différence entre deux lignes, c’est donc lire une différence entre deux CAS — topologie ' +
  'du pool, volume, sets demandés : c’est légitime, et c’est ce pour quoi ce lot existe. Ce n’est ' +
  'JAMAIS l’effet d’un paramètre. Comparer deux CONDITIONS (deux bucketCap, deux modes de combos, ' +
  'avec et sans un correctif) demanderait de les ENTRELACER dans une même séquence (témoin, A, B, ' +
  'témoin, A, B…) : lancer deux lots et les soustraire ligne à ligne est le protocole en BLOCS, dont ' +
  'le biais se REPRODUIT (+4,8 % obtenu deux fois de suite, +0,3 % une fois entrelacé) et passe donc ' +
  'pour un résultat. Le harnais ne sait pas entrelacer ; pour un dos-à-dos fiable, ' +
  'scripts/perf-battery-compare.ts.';

/**
 * La même distinction en une ligne, pour l'ANNONCE — jamais À LA PLACE de
 * l'autre : l'annonce précède le run, le récapitulatif le suit, et c'est au
 * moment de LIRE le tableau que la confusion se produit.
 */
export const AVERTISSEMENT_LOT_COURT =
  '⚠️ Un lot fait varier le CAS, jamais la CONDITION : il ne compare pas deux réglages (avertissement complet avec le récapitulatif).';

const ms = (n: number) => `${n.toFixed(0)} ms`;
const nb = (n: number) => n.toLocaleString('fr-FR');

/**
 * Le récapitulatif — une ligne par cas, et seulement les colonnes que le point
 * d'arrêt demandé rend réellement disponibles.
 *
 * ⚠️ **Les colonnes SUIVENT le point d'arrêt**, elles ne sont pas figées : un
 * lot arrêté dans la préparation n'a ni rétention, ni régime, ni complétude, et
 * quatre colonnes de tirets seraient une invitation à les lire comme des zéros.
 */
export function rendreRecapLot(lot: ResultatLot): string {
  const l: string[] = [];
  const c = lot.condition;
  const surcharges = Object.entries(c.overrides).map(([k, v]) => `${k}=${v}`);

  l.push('', '═'.repeat(78));
  l.push(`RÉCAPITULATIF DU LOT — ${lot.lignes.length} cas`);
  l.push('═'.repeat(78));
  // ⚠️ La condition COMMUNE en tête, avant toute colonne : c'est elle qui rend
  // l'avertissement ci-dessous VÉRIFIABLE plutôt que déclaratif — le lecteur
  // voit de ses yeux que rien d'autre que le cas ne varie d'une ligne à
  // l'autre.
  l.push(
    `Condition unique : préréglage « ${c.preset} », arrêt après « ${c.arretApres} », ` +
      `${c.repetitions} répétition(s), overrides ${surcharges.length > 0 ? surcharges.join(', ') : 'aucun'}` +
      (c.horodaterProgression ? ', progression A₂ activée' : '')
  );
  l.push('', lot.avertissementLot, '');

  const avecTemps = lot.lignes.some((x) => x.resultat.temps != null);
  const avecDemiBuilds = lot.lignes.some((x) => x.resultat.demiBuilds != null);
  const avecCompletude = lot.lignes.some((x) => x.resultat.completude != null);
  const avecMeilleurs = lot.lignes.some((x) => x.resultat.meilleurs != null);

  const largeurLibelle = Math.max(...lot.lignes.map((x) => x.libelle.length));
  const cellulesEntete = [
    'n°',
    'Cas'.padEnd(largeurLibelle),
    'filterSlot'.padStart(11),
    ...(avecTemps ? ['préparation'.padStart(12)] : []),
    ...(avecDemiBuilds ? ['constr. (mur)'.padStart(13), 'fil A'.padStart(10), 'fil B'.padStart(10), 'rétention A/B'.padStart(17)] : []),
    ...(avecCompletude ? ['complétude'.padEnd(18)] : []),
    ...(avecMeilleurs ? ['builds'.padStart(7)] : []),
  ];
  const entete = cellulesEntete.join('  ');
  l.push(entete);
  l.push('─'.repeat(entete.length));

  for (const ligne of lot.lignes) {
    const r = ligne.resultat;
    // ⚠️ La taille du pool APRÈS `filterSlot`, disponible quel que soit le
    // point d'arrêt : sans elle une ligne « 0 build » n'a aucun contexte, et
    // c'est la première chose à écarter avant d'accuser le moteur.
    const filterslot = r.preparation.find((t) => t.etage === 'filterslot');
    const cellules = [
      String(ligne.index).padStart(2),
      ligne.libelle.padEnd(largeurLibelle),
      (filterslot ? nb(filterslot.total) : '—').padStart(11),
    ];
    if (avecTemps) cellules.push((r.temps ? ms(r.temps.preparation.min) : '—').padStart(12));
    if (avecDemiBuilds) {
      const d = r.demiBuilds;
      const t = r.temps;
      cellules.push(
        (t?.demiBuilds ? ms(t.demiBuilds.min) : '—').padStart(13),
        (t?.demiBuildA ? ms(t.demiBuildA.min) : '—').padStart(10),
        (t?.demiBuildB ? ms(t.demiBuildB.min) : '—').padStart(10),
        (d ? `${(d.retention.A.taux * 100).toPrecision(3)} / ${(d.retention.B.taux * 100).toPrecision(3)} %` : '—').padStart(17)
      );
    }
    if (avecCompletude) {
      const co = r.completude;
      // ⚠️ Même hiérarchie de verdicts que le bloc « Complétude » d'un run
      // unique, et dans le même ordre : une configuration invalide n'est pas
      // un verdict algorithmique, et l'incohérence est un verdict À PART, pas
      // une note en bas d'un « complet ».
      const verdict =
        co == null
          ? '—'
          : co.configurationInvalide != null
            ? '⚠️ CONFIG INVALIDE'
            : co.incoherence
              ? 'INCOHÉRENT'
              : co.complet
                ? 'complet'
                : `tronqué (${co.motif})`;
      cellules.push(verdict.padEnd(18));
    }
    if (avecMeilleurs) cellules.push((r.meilleurs ? nb(r.meilleurs.length) : '—').padStart(7));
    l.push(cellules.join('  '));
  }

  l.push('');
  if (avecTemps) {
    // ⚠️ Les temps de ce tableau sont des MINIMUMS (§6.4 bis) — l'estimateur
    // du harnais, et le seul qui ait un sens. La DISPERSION, elle, ne se
    // résume pas en une colonne : elle vit dans le bloc de chaque cas, et
    // c'est là qu'il faut aller AVANT de faire quoi que ce soit d'un écart.
    l.push(
      `  Temps = MINIMUM sur ${c.repetitions} répétition(s), l’estimateur du §6.4 bis. La dispersion de chaque`,
      '  série est dans le bloc du cas correspondant, plus haut — un écart plus petit qu’elle ne veut rien dire.'
    );
  } else {
    // ⚠️ Un arrêt DANS la préparation ne rend aucun temps (voir
    // `executerHarnaisResolu`) : le dire vaut mieux qu'une colonne absente
    // qu'on mettrait sur le compte d'un oubli.
    l.push('  Aucun temps : le harnais n’en rend pas sur un arrêt situé DANS la préparation.');
  }
  return l.join('\n');
}
