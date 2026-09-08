// Le DIFFÉRENTIEL ENTRELACÉ — piste 11c (§5.2 bis des extensions).
//
// **Niveau A-PASSIF, au sens strict**, exactement comme `diagnosticLot.ts` :
// ce module BOUCLE sur des runs qui existent déjà, il n'appelle pas une
// seule fonction du moteur et ne réimplémente aucune étape. Ce qu'il ajoute
// n'est pas de la mesure, c'est une LECTURE — l'oracle spécifié par 11a,
// appliqué à deux sorties du harnais.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ Ce que 11a a établi, et qui décide de toute la forme de ce fichier
//
// **Un SEUL élément de l'oracle est bruité — l'INSTANT DE TRONCATURE —, et
// seulement sous `maxMs`.** Tout le reste est une fonction DÉTERMINISTE du
// préfixe exploré. Donc :
//   · l'entrelacement ne sert qu'aux TEMPS et à l'`explored` sous `maxMs` ;
//   · tout le reste tient en DEUX RUNS SUCCESSIFS ;
//   · plus un PORTIER D'ADMISSIBILITÉ qui refuse de comparer deux bras dont
//     les préfixes explorés diffèrent.
// ⚠️ **Ce n'est pas un assouplissement, c'est un déplacement** : au lieu
// d'entrelacer pour combattre un biais de position, le différentiel doit
// REFUSER de comparer ce qui n'est pas comparable. La discipline change de
// nature, elle ne disparaît pas.
//
// ⚠️ **La difficulté n'est donc PAS la boucle, c'est la RESTITUTION** — un
// ordre de lecture qui cherche le PREMIER point de divergence (jamais un
// constat final), quatre champs par divergence, et le mot `NON_COMPARABLE`
// là où une case vide se lirait « pareil ».
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ Pourquoi un MODULE À PART, exposé par un MODE du harnais
//
// Le précédent est le LOT (§5.3) : un module à part, un drapeau du CLI, un
// type qui CONTIENT N `ResultatHarnais` sans en modifier un seul. Le
// différentiel prend la même forme, et pour les mêmes raisons — mais il
// fait exactement l'INVERSE de ce que le garde-fou du lot autorise :
//
// | | Le LOT | Le DIFFÉRENTIEL |
// |---|---|---|
// | fait varier | le CAS | la CONDITION |
// | garde constant | la condition | le cas (un profil, un pool, une cible) |
// | protocole | N runs indépendants, aucune comparaison | 2N runs ENTRELACÉS, comparés |
//
// ⚠️ **Ce n'est donc pas une contradiction du §5.3, c'en est la moitié
// manquante** : `AVERTISSEMENT_LOT` dit « comparer deux CONDITIONS
// demanderait de les ENTRELACER dans une même séquence ; le harnais ne sait
// pas entrelacer ». Ce fichier est ce qu'il annonçait. Les deux modes
// s'EXCLUENT au CLI, et chacun porte son propre avertissement — parce que
// « si la sortie ne dit pas laquelle des deux lectures elle autorise, elle
// sera lue comme autorisant l'autre ».
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ Pourquoi un PROFIL, et rien d'autre, comme source
//
// Un différentiel sur un cas réel n'est pas « plus lent », il est
// INCOMPARABLE : un cas réel tronque, et il tronque par `maxMs` — or
// l'instant de coupe y varie de 3,65 % à 32 % d'un run à l'autre (mesures
// E, G, H de 11a), ce qui rend NON_COMPARABLES le verdict, la population,
// le classement et le near-miss. Un profil de 11b n'est donc pas « la
// version rapide du cas réel », c'est **la seule configuration où l'oracle
// est comparable du tout**. D'où le refus, au CLI, d'un différentiel sans
// `--profil` — un refus qui NOMME la raison plutôt que de laisser payer
// deux runs pour un `NON_COMPARABLE` général.

import { ConfigHarnais, OverridesHarnais, ResultatHarnais, SerieTemps } from './diagnosticTypes';
import { ConfigResolue, resoudreConfig } from './diagnosticConfig';
import { executerHarnaisResolu, serie } from './diagnosticHarness';
import { ProfilSynthetique, configDuProfil } from './diagnosticProfils';

/* --------------------------------------------------------------------------
 * L'AXE — ce qui varie, et rien d'autre
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Écrit comme une projection de `OverridesHarnais`, jamais recopié** :
 * un override ajouté au harnais devient un axe différentiel possible sans
 * que personne ait à y penser — même discipline que
 * `OptionsLot = Omit<ConfigHarnais, 'source'>`.
 *
 * ⚠️ Et c'est bien la SURFACE D'OVERRIDE qui est l'ensemble des axes, pas la
 * recette : la recette est la vérité prod, elle ne se fait pas varier (§4.4
 * règle 1). Un différentiel compare deux SURCHARGES du même cas.
 */
export type AxeDifferentiel = keyof OverridesHarnais;

export type ValeurAxe = NonNullable<OverridesHarnais[AxeDifferentiel]>;

/**
 * Ce qu'un différentiel garde CONSTANT entre ses deux bras — la même
 * soustraction que `OptionsLot`, sous un autre nom parce que ce n'est pas
 * la même chose : le lot garde la condition constante et fait varier le cas,
 * le différentiel garde le CAS constant et fait varier la condition.
 *
 * ⚠️ `repetitions` y figure mais est CONSOMMÉ par le différentiel, jamais
 * relayé : passé au harnais, il ferait `A×N puis B×N` — c'est-à-dire le
 * protocole en BLOCS, dont le biais se REPRODUIT (+4,8 % obtenu deux fois de
 * suite, +0,3 % une fois entrelacé). Chaque run part donc à `repetitions: 1`
 * et c'est la boucle ci-dessous qui alterne.
 */
export type CommunDifferentiel = Omit<ConfigHarnais, 'source'>;

/** Les deux bras, nommés — jamais « 1 » et « 2 », qui ne disent pas le rôle. */
export type Etiquette = 'témoin' | 'comparé';

export interface BrasDifferentiel {
  etiquette: Etiquette;
  valeur: ValeurAxe;
  /** Les N runs, dans l'ordre RÉEL d'exécution. */
  runs: ResultatHarnais[];
  /** Le dernier run — la source des éléments non temporels, comme le harnais. */
  dernier: ResultatHarnais;
}

/* --------------------------------------------------------------------------
 * L'ORACLE — sept éléments, en CASCADE et non en parallèle
 * ----------------------------------------------------------------------- */

/**
 * Les sept éléments de l'oracle, tels que 11a les a spécifiés.
 *
 * ⚠️ **Définis ICI et pas dans `diagnosticTypes.ts`**, pour la raison exacte
 * qui a fait naître `diagnosticLot.ts` : `ResultatHarnais` décrit UN run, et
 * lui faire porter le vocabulaire d'une COMPARAISON en ferait un type dont
 * les champs n'ont plus le même sens selon le mode. L'oracle est de
 * l'orchestration, pas de l'observation.
 */
export type ElementOracle =
  | 'troncature'
  | 'etage-perte'
  | 'verdict'
  | 'population'
  | 'classement'
  | 'near-miss'
  | 'explored';

/**
 * ⚠️ **L'ORDRE EST CELUI DU PIPELINE**, et c'est lui qui fait tout le
 * travail de localisation : on cherche le PREMIER point de divergence,
 * exactement comme `verdictBuildCible` ORDONNE les étages déjà observés sans
 * rien calculer (§5.1). Une divergence de classement rapportée sans dire que
 * les populations diffèrent déjà est un diagnostic qui accuse le mauvais
 * étage.
 */
export const ORDRE_LECTURE: ElementOracle[] = [
  'troncature',
  'etage-perte',
  'verdict',
  'population',
  'classement',
  'near-miss',
  'explored',
];

/**
 * ⚠️ **`NON_COMPARABLE` est le mot réservé de tout ce chantier.** Pas
 * « aucune différence », pas « inconclusif », pas une case vide : une case
 * vide se lit « pareil », et c'est un silence remplacé par un mensonge,
 * livré avec l'autorité d'un diagnostic. Même famille que `NON_OBSERVABLE`
 * au §5.1, et pour la même raison.
 *
 * `INDISPONIBLE` en est distinct, et la distinction porte : l'élément
 * n'existe dans AUCUN des deux bras (pas de near-miss quand `meilleurs`
 * n'est pas vide, pas de rang sans build cible). Ce n'est pas un refus de
 * comparer, c'est une absence de matière.
 */
export type EtatElement = 'IDENTIQUE' | 'DIVERGENT' | 'NON_COMPARABLE' | 'INDISPONIBLE';

/**
 * Une lecture d'élément — avec les QUATRE champs que 11a exige de toute
 * divergence, jamais moins.
 */
export interface LectureElement {
  element: ElementOracle;
  etat: EtatElement;
  /** **OÙ** — l'élément et sa COORDONNÉE (`meilleurs[4]`), jamais « le classement ». */
  ou: string;
  temoin: string;
  compare: string;
  /** **COMBIEN** — l'écart, dans l'unité de l'élément. */
  combien: string;
  /** **SUR COMBIEN** — la taille du support ; un rang sans sa population est illisible. */
  surCombien: string;
  /** **CE QUE ÇA AUTORISE À CONCLURE** — sur CE couple de runs, jamais en général. */
  autorise: string;
  /** Le piège de lecture propre à cet élément, imprimé seulement quand il MORD ici. */
  piege?: string;
  /** Des exemples REPRODUCTIBLES — la granularité de `filterslot-topk-diag`. */
  exemples?: string[];
}

export type VerdictDifferentiel =
  | 'DIVERGENCE_LOCALISÉE'
  | 'AUCUNE_DIVERGENCE_SUR_UN_AXE_SENSIBLE'
  | 'AUCUNE_DIVERGENCE_SENSIBILITÉ_NON_ÉTABLIE'
  | 'RIEN_DE_COMPARABLE';

/**
 * Un paramètre EFFECTIF qui diffère entre les deux bras.
 *
 * ⚠️ **Le passager clandestin, rendu visible.** L'avertissement nomme déjà le
 * régime d'appariement, qui peut basculer TOUT SEUL quand `bucketCap` change.
 * Mais le piège A du §4.3 est plus courant encore et purement mécanique :
 * `bucketCap = params.bucketCap ?? bucketCapFor(slotFilterCap)`, donc
 * **surcharger `slotFilterCap` déplace AUSSI `bucketCap`**. Un différentiel
 * qui annoncerait « axe slotFilterCap » en faisant varier deux paramètres
 * mesurerait les deux à la fois — exactement ce que le §5.3 interdit au lot
 * sous une autre forme (« faire varier le cas n'est pas faire varier la
 * condition »).
 *
 * D'où une DIFF des paramètres effectifs, lue sur les deux paliers 1 et
 * imprimée AVANT l'oracle : ce qui varie vraiment se voit avant qu'on lise
 * ce qui a changé.
 */
export interface ParametreDivergent {
  nom: string;
  temoin: string;
  compare: string;
  origineTemoin: string;
  origineCompare: string;
  /** L'axe demandé, ou un paramètre entraîné par lui. */
  demande: boolean;
}

export interface Admissibilite {
  /** Le PORTIER — motif de troncature, complétude, incohérence, config invalide. */
  portier: 'OUVERT' | 'FERMÉ';
  motifPortier: string;
  /** Le PRÉFIXE exploré — la condition de comparabilité des éléments 1, 3, 4 et 7. */
  prefixe: 'COMPARABLE' | 'NON_COMPARABLE' | 'SANS_OBJET';
  motifPrefixe: string;
}

export interface ResultatDifferentiel {
  profil: string;
  axe: AxeDifferentiel;
  temoin: BrasDifferentiel;
  compare: BrasDifferentiel;
  repetitions: number;
  /** L'ordre RÉEL d'exécution — la TRACE de l'entrelacement, pas sa promesse. */
  entrelacement: string[];
  /** ⚠️ TOUT ce qui diffère entre les deux bras, pas seulement l'axe demandé. */
  parametresDivergents: ParametreDivergent[];
  admissibilite: Admissibilite;
  lectures: LectureElement[];
  /** ⚠️ Le PREMIER point de divergence dans l'ordre du pipeline. `null` = aucun. */
  premiereDivergence: ElementOracle | null;
  verdict: VerdictDifferentiel;
  /**
   * ⚠️ **Ce que le profil PEUT détecter sur cet axe** — sans quoi « aucune
   * divergence » se lirait comme un résultat alors que le profil en est
   * peut-être incapable (constat n° 1 de 11b : un profil COMPLET peut être
   * totalement INSENSIBLE, et sa rétention affichée ne le dit pas).
   */
  sensibilite: { axeDeclareSensible: boolean; limitesDuProfil: string };
  temps: { temoin: Record<string, SerieTemps>; compare: Record<string, SerieTemps> };
  explored: { temoin: SerieTemps; compare: SerieTemps } | null;
  avertissement: string;
}

/* --------------------------------------------------------------------------
 * ⚠️ L'AVERTISSEMENT — ce que l'entrelacement NE corrige PAS
 * ----------------------------------------------------------------------- */

/**
 * Sur le modèle d'`AVERTISSEMENT_LOT` (§5.3), et imprimé **AVANT** le
 * tableau, jamais après : c'est au moment de LIRE deux colonnes que la
 * confusion se produit.
 *
 * ⚠️ **Le piège propre au différentiel, celui qui n'existe nulle part
 * ailleurs** : une sortie à deux colonnes RESSEMBLE à une causalité. « B
 * trouve le build, A ne le trouve pas » ne dit pas que le paramètre a causé
 * la trouvaille — la cause se lit à l'ÉTAGE de la divergence (élément 2),
 * jamais dans la colonne où elle apparaît.
 */
export const AVERTISSEMENT_DIFFERENTIEL =
  '⚠️ CE QU’UN DIFFÉRENTIEL AUTORISE, ET CE QU’IL N’AUTORISE PAS. Les deux colonnes ci-dessous sont ' +
  'le MÊME cas sous DEUX conditions, exécutées en ALTERNANCE (témoin, comparé, témoin, comparé…) et ' +
  'jamais en blocs. Ce qu’elles autorisent : lire l’effet du paramètre qui varie, à l’ÉTAGE où la ' +
  'divergence apparaît. Ce qu’elles n’autorisent PAS : (1) lire une CAUSALITÉ dans une colonne — ' +
  '« B trouve le build, A ne le trouve pas » dit que les deux bras diffèrent sur cet élément, pas que ' +
  'le paramètre a causé la trouvaille ; (2) conclure sur un écart plus petit que la dispersion affichée ; ' +
  '(3) comparer deux bras que le PORTIER a séparés — un motif de troncature qui diffère n’est pas une ' +
  'ligne parmi d’autres, c’est un ARRÊT : les deux bras n’ont pas parcouru le même espace, donc rien ' +
  'd’autre ne se compare. ⚠️ Et l’entrelacement ne rapproche PAS deux runs dont l’un a exploré ' +
  '200 000 paires et l’autre 800 000 : il corrige un biais de POSITION dans la séquence, c’est le ' +
  'portier qui traite ce cas. ⚠️ Le régime d’appariement doit rester CONSTANT entre les bras, ou bien ' +
  'être LUI-MÊME l’axe comparé — jamais varier en passager clandestin : le seuil des 100 M le fait ' +
  'basculer TOUT SEUL quand `bucketCap` change (`totalPairs` croît comme son CARRÉ), et c’est silencieux.';

/* --------------------------------------------------------------------------
 * La BOUCLE — et c'est la partie facile
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **`11c ALTERNE, il ne SUPERPOSE pas`** — et le protocole du voisin
 * n'est pas transposable. `perf-battery-compare` lance ses deux bras AU MÊME
 * INSTANT (deux processus) pour éliminer la dérive machine ; le harnais, lui,
 * ouvre déjà 4 workers d'appariement plus 2 de construction, et deux bras
 * simultanés en feraient douze — sous une contention que la production ne
 * connaît pas.
 *
 * ⚠️ **Chaque run part à `repetitions: 1`.** Le `N` du différentiel est
 * consommé ICI, par l'alternance ; le relayer au harnais produirait `A×N puis
 * B×N`, c'est-à-dire exactement le protocole en blocs que ce module existe
 * pour remplacer.
 */
export async function executerDifferentiel(
  profil: ProfilSynthetique,
  axe: AxeDifferentiel,
  valeurTemoin: ValeurAxe,
  valeurCompare: ValeurAxe,
  commun: CommunDifferentiel = {}
): Promise<ResultatDifferentiel> {
  const repetitions = Math.max(1, commun.repetitions ?? 1);
  const resolueTemoin = resoudreBras(profil, axe, valeurTemoin, commun);
  const resolueCompare = resoudreBras(profil, axe, valeurCompare, commun);

  const runsTemoin: ResultatHarnais[] = [];
  const runsCompare: ResultatHarnais[] = [];
  const entrelacement: string[] = [];
  // ⚠️ Un passage = UN run de CHAQUE bras, dans cet ordre. Une perturbation
  // frappe alors une répétition de chaque condition, jamais une condition
  // entière — c'est toute la différence entre +4,8 % et +0,3 %.
  for (let i = 1; i <= repetitions; i++) {
    runsTemoin.push(await executerHarnaisResolu(resolueTemoin.resolue, resolueTemoin.options));
    entrelacement.push(`T${i}`);
    runsCompare.push(await executerHarnaisResolu(resolueCompare.resolue, resolueCompare.options));
    entrelacement.push(`C${i}`);
  }

  const temoin: BrasDifferentiel = {
    etiquette: 'témoin',
    valeur: valeurTemoin,
    runs: runsTemoin,
    dernier: runsTemoin[runsTemoin.length - 1],
  };
  const compare: BrasDifferentiel = {
    etiquette: 'comparé',
    valeur: valeurCompare,
    runs: runsCompare,
    dernier: runsCompare[runsCompare.length - 1],
  };

  const explored = serieExplored(temoin, compare);
  const admissibilite = evaluerAdmissibilite(temoin, compare, explored);
  const lectures = lireOracle(temoin, compare, admissibilite, explored);
  const premiereDivergence = ORDRE_LECTURE.find((e) => lectures.find((l) => l.element === e)?.etat === 'DIVERGENT') ?? null;
  const axeDeclareSensible = profil.axesSensibles.includes(axe);

  return {
    profil: profil.nom,
    axe,
    temoin,
    compare,
    repetitions,
    entrelacement,
    parametresDivergents: diffParametres(resolueTemoin.resolue, resolueCompare.resolue, axe),
    admissibilite,
    lectures,
    premiereDivergence,
    verdict: verdictGlobal(lectures, premiereDivergence, axeDeclareSensible),
    sensibilite: { axeDeclareSensible, limitesDuProfil: profil.limites },
    temps: { temoin: agregerTemps(runsTemoin), compare: agregerTemps(runsCompare) },
    explored,
    avertissement: AVERTISSEMENT_DIFFERENTIEL,
  };
}

/**
 * ⚠️ **La configuration de chaque bras est résolue UNE SEULE FOIS**, avant
 * la boucle — pas une fois par run. Même raison qu'`executerHarnaisResolu` :
 * une seconde résolution relirait le disque et pourrait décrire une autre
 * configuration que celle qui s'exécute. Ici s'y ajoute une raison propre au
 * différentiel : deux bras dont la configuration serait relue à chaque
 * passage ne seraient plus garantis identiques d'un passage à l'autre, ce qui
 * ferait varier DEUX choses au lieu d'une.
 */
function resoudreBras(
  profil: ProfilSynthetique,
  axe: AxeDifferentiel,
  valeur: ValeurAxe,
  commun: CommunDifferentiel
): { resolue: ConfigResolue; options: ConfigHarnais } {
  // ⚠️ `configDuProfil` pose la cible du profil dans `suivre` par
  // construction, et laisse `commun.overrides` écraser ceux du profil —
  // c'est exactement ce qu'un différentiel FAIT. La cible, elle, n'est
  // jamais écrasée : sans quoi les deux bras ne parleraient plus du même
  // build.
  const config = configDuProfil(profil, {
    ...commun,
    overrides: { ...commun.overrides, [axe]: valeur },
    // ⚠️ Consommé par la boucle, jamais relayé — voir `CommunDifferentiel`.
    repetitions: 1,
  });
  return { resolue: resoudreConfig(config), options: config };
}

/**
 * La DIFF des paramètres effectifs des deux bras, lue sur leurs paliers 1
 * respectifs — donc AVANT toute exécution, et sur ce qui s'appliquera
 * vraiment.
 *
 * ⚠️ **`parametres` porte l'ORIGINE de chaque valeur** (`recette` /
 * `défaut moteur` / `DÉRIVÉ de <param>` / `OVERRIDE`), et c'est elle qui rend
 * la cascade lisible : un `bucketCap` marqué « DÉRIVÉ de slotFilterCap » dit
 * tout seul qu'on n'a pas fait varier un paramètre mais deux.
 */
/**
 * Le nom sous lequel chaque axe apparaît dans la table des paramètres
 * EFFECTIFS — qui n'est pas toujours celui de l'override.
 *
 * ⚠️ **Sans cette table, `regime` produisait un FAUX « paramètre entraîné »** :
 * le paramètre effectif s'appelle « régime d'appariement », donc l'axe demandé
 * était compté comme un passager clandestin. Une alerte qui crie à tort cesse
 * d'être lue — et celle-ci existe précisément pour attraper la cascade
 * `slotFilterCap` → `bucketCap`, qui est réelle. `Record` plutôt que `Map`
 * pour que `tsc` refuse un axe non traduit.
 */
const NOM_EFFECTIF: Record<AxeDifferentiel, string> = {
  bucketCap: 'bucketCap',
  slotFilterCap: 'slotFilterCap',
  maxCollected: 'maxCollected',
  maxMs: 'maxMs',
  combosOrderMode: 'combosOrderMode',
  regime: 'régime d’appariement',
};

function diffParametres(a: ConfigResolue, b: ConfigResolue, axe: AxeDifferentiel): ParametreDivergent[] {
  const parNom = new Map(b.parametres.map((p) => [p.nom, p]));
  const out: ParametreDivergent[] = [];
  for (const pa of a.parametres) {
    const pb = parNom.get(pa.nom);
    if (!pb || String(pa.valeur) === String(pb.valeur)) continue;
    out.push({
      nom: pa.nom,
      temoin: String(pa.valeur),
      compare: String(pb.valeur),
      origineTemoin: pa.origine,
      origineCompare: pb.origine,
      demande: pa.nom === NOM_EFFECTIF[axe],
    });
  }
  return out;
}

/**
 * Les temps, par phase, agrégés sur les N passages du bras.
 *
 * ⚠️ Chaque run n'ayant qu'UNE répétition, `serie()` est rappelée ici sur les
 * N minima — jamais recopiée : c'est la même fonction qui produit min,
 * médiane et dispersion partout dans le harnais (§6.4 bis).
 *
 * ⚠️ **Une phase absente d'un run est absente de la série**, jamais comptée
 * pour zéro : c'est la règle déjà tenue par `agregerTemps` du harnais, et la
 * violer ici rendrait « la construction a coûté 0 ms » sur un run qui n'a
 * rien construit.
 */
function agregerTemps(runs: ResultatHarnais[]): Record<string, SerieTemps> {
  const phases = ['preparation', 'demiBuilds', 'demiBuildA', 'demiBuildB', 'appariement', 'total'] as const;
  const out: Record<string, SerieTemps> = {};
  for (const phase of phases) {
    const valeurs = runs.map((r) => r.temps?.[phase]?.min).filter((v): v is number => v != null);
    if (valeurs.length === runs.length && valeurs.length > 0) out[phase] = serie(valeurs);
  }
  return out;
}

/**
 * L'`explored` de chaque bras, en SÉRIE.
 *
 * ⚠️ **C'est le seul élément de l'oracle qui soit intrinsèquement bruité**,
 * et seulement sous `maxMs` : sous quota ou sur un run complet, il est
 * identique à l'unité (mesures A, D, F de 11a). Le rendre en série plutôt
 * qu'en valeur unique est ce qui permet au portier de mesurer son plancher
 * **sur les répétitions du bras lui-même**, jamais sur un plancher importé
 * d'une autre grandeur.
 */
function serieExplored(a: BrasDifferentiel, b: BrasDifferentiel): { temoin: SerieTemps; compare: SerieTemps } | null {
  const va = a.runs.map((r) => r.completude?.explored).filter((v): v is number => v != null);
  const vb = b.runs.map((r) => r.completude?.explored).filter((v): v is number => v != null);
  if (va.length !== a.runs.length || vb.length !== b.runs.length || va.length === 0) return null;
  return { temoin: serie(va), compare: serie(vb) };
}

/* --------------------------------------------------------------------------
 * Le PORTIER, puis le PRÉFIXE — l'admissibilité avant toute comparaison
 * ----------------------------------------------------------------------- */

const nb = (n: number) => n.toLocaleString('fr-FR');

/** La signature de troncature d'un run — les quatre champs du portier. */
function signatureTroncature(r: ResultatHarnais): string {
  const c = r.completude;
  if (!c) return 'aucune complétude (arrêt avant l’appariement)';
  if (c.configurationInvalide) return `CONFIGURATION INVALIDE — ${c.configurationInvalide}`;
  if (c.incoherence) return 'INCOHÉRENT (incomplet, motif non déductible)';
  return c.complet ? 'complet' : `tronqué par ${c.motif}`;
}

/**
 * ⚠️ **Le portier N'EST PAS UN SEUIL, c'est une condition d'entrée.** Si le
 * motif de troncature, la complétude, l'incohérence ou l'invalidité de
 * configuration diffèrent entre les deux bras, les deux bras n'ont pas
 * parcouru le même espace — donc rien de ce qui dépend du préfixe ne se
 * compare. C'est le résultat le plus important qu'un différentiel puisse
 * produire, et le plus facile à lire de travers : il ne dit PAS « B est
 * moins bon ».
 *
 * ⚠️ **Le portier ferme tout SAUF l'élément 2 (étage de perte)**, et ce n'est
 * pas une exception de confort : l'étage de perte est évalué sur la
 * STRUCTURE des compartiments, en amont de toute troncature — vérifié
 * identique par 11a sur trois runs dont l'`explored` variait de 32 %. Le
 * fermer aussi jetterait la seule information qui survit, ce que la règle 3
 * du §5.2 bis interdit explicitement (« le refus est LOCAL, jamais global »).
 */
function evaluerAdmissibilite(
  a: BrasDifferentiel,
  b: BrasDifferentiel,
  explored: { temoin: SerieTemps; compare: SerieTemps } | null
): Admissibilite {
  const sa = signatureTroncature(a.dernier);
  const sb = signatureTroncature(b.dernier);
  if (sa !== sb) {
    return {
      portier: 'FERMÉ',
      motifPortier:
        `témoin « ${sa} » contre comparé « ${sb} » — les deux bras ne se sont pas arrêtés pour la même ` +
        'raison, donc ils n’ont pas parcouru le même espace. ⚠️ Ce n’est PAS « le comparé est moins bon » : ' +
        'c’est un ARRÊT. Seul l’étage de perte reste lisible, étant évalué en amont de toute troncature.',
      prefixe: 'NON_COMPARABLE',
      motifPrefixe: 'sans objet — le portier a déjà fermé.',
    };
  }

  const completDesDeux = a.dernier.completude?.complet === true && b.dernier.completude?.complet === true;
  if (completDesDeux) {
    // ⚠️ **Un run COMPLET n'a pas de préfixe** : il a exploré tout SON espace.
    // Un `explored` différent entre deux bras complets n'est donc pas une
    // coupe survenue à un instant différent, c'est la CONFIGURATION qui a
    // changé l'espace — et c'est un résultat, pas un obstacle. C'est
    // exactement pourquoi l'exigence n° 1 de 11a demandait des bras complets :
    // « un run complet supprime le portier, le préfixe, le plancher et le
    // bruit d'un seul coup ».
    return {
      portier: 'OUVERT',
      motifPortier: `les deux bras se sont arrêtés de la même façon : ${sa}.`,
      prefixe: 'SANS_OBJET',
      motifPrefixe:
        'les deux bras sont COMPLETS : chacun a exploré tout SON espace, il n’y a pas de préfixe partiel. ' +
        'Un `explored` différent est alors l’effet de la configuration sur la taille de l’espace, pas un ' +
        'instant de coupe — tous les éléments restent comparables.',
    };
  }

  // ── Bras TRONQUÉS, même motif : `explored` est un PRÉFIXE, et il décide.
  if (!explored) {
    return {
      portier: 'OUVERT',
      motifPortier: `les deux bras se sont arrêtés de la même façon : ${sa}.`,
      prefixe: 'NON_COMPARABLE',
      motifPrefixe: 'aucun `explored` rendu (arrêt avant l’appariement) : la comparabilité du préfixe ne peut pas être établie.',
    };
  }
  const plancher = Math.max(explored.temoin.dispersionPct, explored.compare.dispersionPct);
  const base = Math.min(explored.temoin.min, explored.compare.min);
  const ecartPct = base > 0 ? (Math.abs(explored.temoin.min - explored.compare.min) / base) * 100 : 0;

  if (explored.temoin.repetitions === 1) {
    return {
      portier: 'OUVERT',
      motifPortier: `les deux bras se sont arrêtés de la même façon : ${sa}.`,
      prefixe: explored.temoin.min === explored.compare.min ? 'COMPARABLE' : 'NON_COMPARABLE',
      motifPrefixe:
        explored.temoin.min === explored.compare.min
          ? `préfixes identiques à l’unité (${nb(explored.temoin.min)} paires des deux côtés) sur UNE répétition.`
          : `${nb(explored.temoin.min)} contre ${nb(explored.compare.min)} paires (${ecartPct.toFixed(2)} %), et ` +
            '⚠️ AUCUNE dispersion mesurée (1 répétition) : impossible de dire si cet écart est du bruit de ' +
            'troncature ou l’effet du paramètre. Le plancher se mesure sur les RÉPÉTITIONS DU BRAS lui-même — ' +
            'relancer avec --repetitions=2 au moins, jamais importer les 2 à 4,5 % des temps.',
    };
  }
  if (ecartPct <= plancher) {
    return {
      portier: 'OUVERT',
      motifPortier: `les deux bras se sont arrêtés de la même façon : ${sa}.`,
      prefixe: 'COMPARABLE',
      motifPrefixe:
        `écart de préfixe ${ecartPct.toFixed(2)} % ≤ plancher ${plancher.toFixed(2)} % mesuré sur les ` +
        `répétitions des bras eux-mêmes : les deux bras ont exploré le même préfixe, au bruit près.`,
    };
  }
  return {
    portier: 'OUVERT',
    motifPortier: `les deux bras se sont arrêtés de la même façon : ${sa}.`,
    prefixe: 'NON_COMPARABLE',
    motifPrefixe:
      `écart de préfixe ${ecartPct.toFixed(2)} % > plancher ${plancher.toFixed(2)} % (mesuré sur les répétitions ` +
      `des bras eux-mêmes) : ${nb(explored.temoin.min)} contre ${nb(explored.compare.min)} paires explorées. Le ` +
      'verdict, la population, le classement et le near-miss sont des fonctions de ce préfixe — ils ne se ' +
      'comparent pas. L’étage de perte, lui, reste lisible : il est en amont de la troncature.',
  };
}

/* --------------------------------------------------------------------------
 * La STABILITÉ INTRA-BRAS — le plancher, élément par élément
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Un élément qui varie DANS un bras ne peut pas être comparé ENTRE
 * bras.** C'est la forme littérale de « le plancher est établi par les
 * répétitions du run lui-même, jamais importé » — appliquée à chaque élément
 * plutôt qu'au seul `explored`, parce que 11a a montré qu'un run tronqué par
 * `maxMs` fait bouger le verdict et la population autant que l'`explored`.
 *
 * Pour un élément catégoriel ou ensembliste, le plancher n'est pas un
 * pourcentage : c'est l'ÉGALITÉ STRICTE des signatures. Un bras qui rend
 * deux verdicts différents sur deux passages n'a pas un verdict « à 3 % près »,
 * il n'en a pas.
 */
function stable(bras: BrasDifferentiel, signature: (r: ResultatHarnais) => string): boolean {
  const premiere = signature(bras.runs[0]);
  return bras.runs.every((r) => signature(r) === premiere);
}

function instabilite(
  a: BrasDifferentiel,
  b: BrasDifferentiel,
  signature: (r: ResultatHarnais) => string
): string | null {
  for (const bras of [a, b]) {
    if (!stable(bras, signature)) {
      const distinctes = new Set(bras.runs.map(signature));
      return (
        `INSTABLE dans le bras ${bras.etiquette} lui-même : ${distinctes.size} valeurs distinctes sur ` +
        `${bras.runs.length} passages [${[...distinctes].join(' | ')}]. Un élément qui varie DANS un bras ne ` +
        'peut pas être comparé ENTRE bras — le plancher se mesure ici, il ne s’importe pas.'
      );
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
 * L'ORACLE, élément par élément
 * ----------------------------------------------------------------------- */

/** La signature d'un build de `meilleurs` — les six runes, ordre indifférent. */
const signatureBuild = (b: { runeIds: number[] }) => [...b.runeIds].sort((x, y) => x - y).join('-');

function lireOracle(
  a: BrasDifferentiel,
  b: BrasDifferentiel,
  adm: Admissibilite,
  explored: { temoin: SerieTemps; compare: SerieTemps } | null
): LectureElement[] {
  const portierFerme = adm.portier === 'FERMÉ';
  const prefixeRefuse = adm.prefixe === 'NON_COMPARABLE';
  // ⚠️ Les éléments 1, 3, 4 et 7 dépendent du préfixe ; l'élément 2 non.
  const barrage = portierFerme
    ? 'le PORTIER a fermé : les deux bras ne se sont pas arrêtés pour la même raison, donc ils n’ont pas parcouru le même espace.'
    : prefixeRefuse
      ? `le PRÉFIXE exploré diffère — ${adm.motifPrefixe}`
      : null;

  return [
    lireTroncature(a, b, adm),
    lireEtagePerte(a, b),
    lireVerdict(a, b, barrage),
    lirePopulation(a, b, barrage),
    lireClassement(a, b, barrage),
    lireNearMiss(a, b, barrage),
    // ⚠️ Le plancher de l'`explored` est MESURÉ, ou il n'existe pas. Deux
    // situations le rendent disponible, et deux seulement : plusieurs
    // passages (la dispersion se mesure), ou deux bras COMPLETS — auquel cas
    // `explored` vaut `totalPairs`, une grandeur STRUCTURELLE et non un
    // instant de coupe. Hors de là, un écart ne peut pas être distingué du
    // bruit de troncature : `NON_COMPARABLE`, jamais `DIVERGENT` sur un
    // plancher de 0 % qui veut dire « non mesuré ».
    lireExplored(
      a,
      b,
      explored,
      portierFerme,
      a.runs.length > 1 || (a.dernier.completude?.complet === true && b.dernier.completude?.complet === true)
    ),
  ];
}

/** Élément 6 — le PORTIER lui-même, rendu comme une lecture à part entière. */
function lireTroncature(a: BrasDifferentiel, b: BrasDifferentiel, adm: Admissibilite): LectureElement {
  const sa = signatureTroncature(a.dernier);
  const sb = signatureTroncature(b.dernier);
  const instable = instabilite(a, b, signatureTroncature);
  const base: LectureElement = {
    element: 'troncature',
    etat: 'IDENTIQUE',
    ou: 'completude.complet / motif / incoherence / configurationInvalide',
    temoin: sa,
    compare: sb,
    combien: 'aucun',
    surCombien: `${a.runs.length} passage(s) par bras`,
    autorise: 'les deux bras se sont arrêtés pour la même raison — le reste de l’oracle peut être lu.',
  };
  if (instable) {
    return {
      ...base,
      etat: 'NON_COMPARABLE',
      combien: '—',
      autorise: instable,
      piege:
        '⚠️ Un motif de troncature instable au sein d’un même bras est le cas que 11a déclarait « non observé, ' +
        'pas démontré impossible » : un bras qui frôle son quota peut basculer maxMs ↔ maxCollected d’un run à ' +
        'l’autre. C’est ce que les répétitions existent pour attraper.',
    };
  }
  if (sa === sb) return base;
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: 'motif d’arrêt différent',
    autorise: adm.motifPortier,
    piege:
      '⚠️ CE N’EST PAS UNE LIGNE PARMI D’AUTRES, C’EST UN ARRÊT. Un motif de troncature qui diffère ne dit ' +
      'pas « le comparé est moins bon » : il dit que les deux bras n’ont pas parcouru le même espace, donc que ' +
      'rien d’autre dans la sortie ne se compare. Un « 0 candidat » de configuration invalide n’est pas non ' +
      'plus un verdict algorithmique (§6.2 du cadrage).',
  };
}

/** Élément 2 — l'étage de perte. Le SEUL qui survive au portier. */
function lireEtagePerte(a: BrasDifferentiel, b: BrasDifferentiel): LectureElement {
  const sig = (r: ResultatHarnais) => {
    const ap = r.appariementBuildCible;
    if (!ap) return 'INDISPONIBLE';
    return `A#${ap.compartimentA ?? 'absent'} · B#${ap.compartimentB ?? 'absent'} · étage ${ap.arreteA ?? 'aucun (une moitié manque)'}`;
  };
  const sa = sig(a.dernier);
  const sb = sig(b.dernier);
  const base: LectureElement = {
    element: 'etage-perte',
    etat: 'IDENTIQUE',
    ou: 'appariementBuildCible.arreteA / compartimentA / compartimentB',
    temoin: sa,
    compare: sb,
    combien: 'aucun',
    surCombien: 'la structure des compartiments, en amont de toute troncature',
    autorise:
      'la paire de compartiments du build cible est coupée au MÊME étage dans les deux bras — la ' +
      'configuration ne déplace pas le point de perte structurel.',
  };
  if (sa === 'INDISPONIBLE' && sb === 'INDISPONIBLE') {
    return {
      ...base,
      etat: 'INDISPONIBLE',
      combien: '—',
      autorise: 'aucun build cible suivi, ou arrêt avant l’appariement : l’étage de perte n’est observable dans aucun des deux bras.',
    };
  }
  const instable = instabilite(a, b, sig);
  if (instable) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: instable };
  if (sa === sb) return base;
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: 'étage d’arrêt différent',
    autorise:
      'LA divergence qui LOCALISE : le build survit dans les deux bras, mais l’un le coupe un étage plus tôt. ' +
      '⚠️ Cet élément est DÉTERMINISTE SANS CONDITION — il reste lisible même quand le portier a fermé.',
    piege:
      '⚠️ `explorée` n’est PAS un cinquième élagage : c’est la valeur qui dit qu’aucun élagage n’a coupé. Une ' +
      'divergence `explorée` → `borne-compartiment` est un vrai résultat ; la même dans l’autre sens sur un bras ' +
      'plus tronqué ne l’est pas. ⚠️ Et `PERDUE_À_L_APPARIEMENT` nomme l’ÉTAGE, pas une perte (§5.1) — le ' +
      'différentiel hérite de ce vocabulaire, il ne le durcit pas.',
  };
}

/** Élément 1 — présence/absence du build cible. */
function lireVerdict(a: BrasDifferentiel, b: BrasDifferentiel, barrage: string | null): LectureElement {
  const sig = (r: ResultatHarnais) => r.verdictBuildCible?.verdict ?? 'INDISPONIBLE';
  const sa = sig(a.dernier);
  const sb = sig(b.dernier);
  const base: LectureElement = {
    element: 'verdict',
    etat: 'IDENTIQUE',
    ou: 'verdictBuildCible.verdict',
    temoin: sa,
    compare: sb,
    combien: 'aucun',
    surCombien: 'un verdict par bras (valeur discrète, pas une grandeur continue)',
    autorise: 'les deux bras rendent le même verdict sur le build cible.',
  };
  if (sa === 'INDISPONIBLE' && sb === 'INDISPONIBLE') {
    return { ...base, etat: 'INDISPONIBLE', combien: '—', autorise: 'aucun build cible suivi : l’élément n’existe dans aucun des deux bras.' };
  }
  if (barrage) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: barrage };
  const instable = instabilite(a, b, sig);
  if (instable) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: instable };
  if (sa === sb) return base;
  const avecNonObservable = sa === 'NON_OBSERVABLE' || sb === 'NON_OBSERVABLE';
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: `${sa} → ${sb}`,
    autorise: avecNonObservable
      ? 'RIEN sur le moteur. ⚠️ `NON_OBSERVABLE` est une ABSENCE D’OBSERVATION, pas un troisième comportement : ' +
        'la bascule dit que l’un des deux bras a tronqué plus tôt, JAMAIS que le moteur s’est mis à perdre le build.'
      : 'les deux bras ne classent pas le build cible au même endroit du pipeline — à lire à l’ÉTAGE de la ' +
        'divergence (élément 2), jamais dans la colonne où elle apparaît.',
    piege:
      '⚠️ `PRÉSENT_DANS_LE_TOP_N` contre `PRÉSENT_HORS_TOP_N` n’est PAS une propriété du build : c’est une ' +
      'propriété de l’instant où la collecte s’est arrêtée. Mesure I de 11a — à configuration identique, la même ' +
      'cible passe de #20/50 000 à #37/200 000 à #48/800 000 et le verdict BASCULE, sans que sa qualité propre ' +
      '(`totalMetrique`) bouge d’un chiffre.',
  };
}

/** Élément 3 — l'ENSEMBLE des candidats : le cardinal, et le top-N rendu. */
function lirePopulation(a: BrasDifferentiel, b: BrasDifferentiel, barrage: string | null): LectureElement {
  const sig = (r: ResultatHarnais) => {
    const pop = r.appariementBuildCible?.rang?.population;
    const top = (r.meilleurs ?? []).map(signatureBuild).join(',');
    return `${pop ?? 'sans cible'} | ${top}`;
  };
  const popA = a.dernier.appariementBuildCible?.rang?.population ?? null;
  const popB = b.dernier.appariementBuildCible?.rang?.population ?? null;
  const topA = a.dernier.meilleurs ?? [];
  const topB = b.dernier.meilleurs ?? [];
  const setA = new Set(topA.map(signatureBuild));
  const setB = new Set(topB.map(signatureBuild));
  const seulementA = [...setA].filter((s) => !setB.has(s));
  const seulementB = [...setB].filter((s) => !setA.has(s));
  const symetrique = seulementA.length + seulementB.length;

  const base: LectureElement = {
    element: 'population',
    etat: 'IDENTIQUE',
    ou: 'appariementBuildCible.rang.population (cardinal) + meilleurs[] (l’ensemble RENDU)',
    temoin: `${popA == null ? 'population indisponible' : nb(popA)} collecté(s) · top-${topA.length}`,
    compare: `${popB == null ? 'population indisponible' : nb(popB)} collecté(s) · top-${topB.length}`,
    combien: 'aucun',
    surCombien: popA == null ? `top-${topA.length}` : `${nb(popA)} candidats collectés (témoin)`,
    autorise: 'les deux bras collectent le même volume et rendent le même ensemble de tête.',
    piege:
      '⚠️ Le harnais ne rend PAS l’ensemble des candidats : `meilleurs` est un `slice(0, TAILLE_TOP_RENDU)`. Le ' +
      'différentiel compare donc le TOP-N et le CARDINAL, jamais l’ensemble — et le cardinal n’existe que parce ' +
      'que le profil porte un build cible. ⚠️ Aucune extension n’est ouverte pour combler ça : c’est la grandeur ' +
      'qui a fait CONSERVER `monster-search-multicount-diag` au §5.4, et une grandeur manquante est un résultat ' +
      'écrit, pas un chantier enchaîné.',
  };
  if (popA == null && popB == null && topA.length === 0 && topB.length === 0) {
    return { ...base, etat: 'INDISPONIBLE', combien: '—', autorise: 'ni population ni top-N dans aucun des deux bras.' };
  }
  if (barrage) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: barrage };
  const instable = instabilite(a, b, sig);
  if (instable) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: instable };
  if (sig(a.dernier) === sig(b.dernier)) return base;

  const ecartPop = popA != null && popB != null ? popB - popA : null;
  const morceaux: string[] = [];
  if (ecartPop != null && ecartPop !== 0) {
    morceaux.push(`${ecartPop > 0 ? '+' : ''}${nb(ecartPop)} candidats (${((ecartPop / popA!) * 100).toFixed(2)} %)`);
  }
  if (symetrique > 0) morceaux.push(`${symetrique} build(s) de différence symétrique dans le top-N`);
  const exemples: string[] = [];
  for (const s of seulementA.slice(0, 3)) {
    const i = topA.findIndex((x) => signatureBuild(x) === s);
    exemples.push(`témoin seul : runes [${s.split('-').join(', ')}] au rang #${i + 1}/${topA.length}, total ${topA[i].total.toFixed(2)}`);
  }
  for (const s of seulementB.slice(0, 3)) {
    const i = topB.findIndex((x) => signatureBuild(x) === s);
    exemples.push(`comparé seul : runes [${s.split('-').join(', ')}] au rang #${i + 1}/${topB.length}, total ${topB[i].total.toFixed(2)}`);
  }
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: morceaux.length > 0 ? morceaux.join(' · ') : 'même cardinal, même ensemble — seul l’ORDRE change (voir « classement »)',
    autorise:
      'le comparé ne collecte pas la même population que le témoin. ⚠️ À lire AVANT le classement : un rang ne ' +
      'se compare qu’à population égale.',
    exemples: exemples.length > 0 ? exemples : undefined,
  };
}

/** Élément 4 — le CLASSEMENT : premier rang divergent, et le rang de la cible. */
function lireClassement(a: BrasDifferentiel, b: BrasDifferentiel, barrage: string | null): LectureElement {
  const sig = (r: ResultatHarnais) =>
    `${r.appariementBuildCible?.rang?.rang ?? 'sans rang'} | ${(r.meilleurs ?? []).map(signatureBuild).join(',')}`;
  const topA = a.dernier.meilleurs ?? [];
  const topB = b.dernier.meilleurs ?? [];
  const rangA = a.dernier.appariementBuildCible?.rang ?? null;
  const rangB = b.dernier.appariementBuildCible?.rang ?? null;
  const populationsDifferentes = rangA != null && rangB != null && rangA.population !== rangB.population;

  const base: LectureElement = {
    element: 'classement',
    etat: 'IDENTIQUE',
    ou: 'l’ordre de meilleurs[] + appariementBuildCible.rang.rang',
    // ⚠️ Le rang part TOUJOURS avec sa population — jamais le rang seul.
    temoin: rangA ? `cible #${nb(rangA.rang)} / ${nb(rangA.population)}` : 'cible sans rang',
    compare: rangB ? `cible #${nb(rangB.rang)} / ${nb(rangB.population)}` : 'cible sans rang',
    combien: 'aucun',
    surCombien:
      rangA && rangB
        ? `top-${topA.length} rendu · populations ${nb(rangA.population)} (témoin) contre ${nb(rangB.population)} (comparé)`
        : `top-${topA.length} rendu`,
    // ⚠️ **Un rang identique sur des populations DIFFÉRENTES n'est pas « rien
    // à signaler ».** C'est le constat n° 3 de 11b, et il se lit ici : l'ordre
    // n'a pas bougé alors que le volume collecté a bougé, donc l'élagage a
    // retiré des candidats classés APRÈS la cible. Écrire « à pool égal » sans
    // regarder les populations serait affirmer une égalité qui n'existe pas —
    // et c'est exactement la case qui se lit « pareil ».
    autorise: populationsDifferentes
      ? `le rang est le MÊME (#${nb(rangA!.rang)}) mais sur des populations DIFFÉRENTES ` +
        `(${nb(rangA!.population)} contre ${nb(rangB!.population)}) : l’ordre n’a pas bougé alors que le volume ` +
        'collecté a bougé, donc ce qui a été retiré était classé APRÈS la cible. ⚠️ Ce n’est PAS « pool égal, ' +
        'même classement » — c’est un résultat, et c’est la raison d’être d’un oracle multi-éléments : un ' +
        'différentiel qui ne lirait que le rang ne verrait rien ici.'
      : 'à pool égal, les deux bras classent identiquement — jusqu’au top-N rendu.',
    piege:
      '⚠️ Un rang ne se compare qu’à POPULATION ÉGALE : « #37 contre #20 » entre deux bras dont les populations ' +
      'valent 200 000 et 50 000 ne dit rien. D’où le rang ET la population, jamais le rang seul. ⚠️ Et un écart ' +
      'de métrique de 0,1 % au rang 5 n’est pas « négligeable » : sur un classement, ce qui compte est le RANG ; ' +
      'l’écart sert seulement à dire si la divergence départage des ex æquo ou change vraiment l’ordre.',
  };
  if (topA.length === 0 && topB.length === 0 && !rangA && !rangB) {
    return { ...base, etat: 'INDISPONIBLE', combien: '—', autorise: 'aucun classement dans l’un ou l’autre bras.' };
  }
  if (barrage) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: barrage };
  const instable = instabilite(a, b, sig);
  if (instable) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: instable };
  if (sig(a.dernier) === sig(b.dernier)) return base;

  const morceaux: string[] = [];
  const exemples: string[] = [];
  const commun = Math.min(topA.length, topB.length);
  let premier = -1;
  for (let i = 0; i < commun; i++) {
    if (signatureBuild(topA[i]) !== signatureBuild(topB[i])) {
      premier = i;
      break;
    }
  }
  if (premier >= 0) {
    const ecartPct = topA[premier].total !== 0 ? (Math.abs(topB[premier].total - topA[premier].total) / topA[premier].total) * 100 : 0;
    morceaux.push(`premier rang divergent #${premier + 1} / ${commun}, écart de métrique ${ecartPct.toFixed(3)} %`);
    exemples.push(
      `rang #${premier + 1} — témoin [${topA[premier].runeIds.join(', ')}] total ${topA[premier].total.toFixed(6)} · ` +
        `comparé [${topB[premier].runeIds.join(', ')}] total ${topB[premier].total.toFixed(6)}`
    );
  }
  if (rangA && rangB && rangA.rang !== rangB.rang) {
    morceaux.push(`rang de la cible ${rangA.rang > rangB.rang ? '−' : '+'}${Math.abs(rangB.rang - rangA.rang)}`);
    exemples.push(
      `cible — témoin #${nb(rangA.rang)} / ${nb(rangA.population)} (total ${rangA.totalMetrique.toFixed(6)}) · ` +
        `comparé #${nb(rangB.rang)} / ${nb(rangB.population)} (total ${rangB.totalMetrique.toFixed(6)})`
    );
  }
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: morceaux.length > 0 ? morceaux.join(' · ') : 'ordre différent au-delà du top-N commun',
    surCombien:
      rangA && rangB
        ? `top-${commun} commun · populations ${nb(rangA.population)} (témoin) contre ${nb(rangB.population)} (comparé)`
        : `top-${commun} commun`,
    autorise: populationsDifferentes
      ? '⚠️ LES POPULATIONS DIFFÈRENT DÉJÀ (voir « population » plus haut) : cette divergence de classement est ' +
        'au moins en partie l’effet du volume collecté, pas de l’ordre. Accuser l’ordre ici serait accuser le ' +
        'mauvais étage.'
      : 'à population ÉGALE, le comparé classe autrement — c’est le seul élément qui distingue « le comparé ' +
        'trouve moins » de « le comparé trouve autre chose ».',
    exemples: exemples.length > 0 ? exemples : undefined,
  };
}

/** Élément 7 — le near-miss. */
function lireNearMiss(a: BrasDifferentiel, b: BrasDifferentiel, barrage: string | null): LectureElement {
  const rendre = (r: ResultatHarnais) => {
    const qs = r.quasiSucces;
    if (!qs) return null;
    const parCondition = qs.parCondition
      .map((p) => `${p.stat}/${p.borne} manque ${p.quasiSucces.manques[0]?.manque ?? '?'}`)
      .join(' · ');
    const global = qs.global ? qs.global.manques.map((m) => `${m.stat}/${m.borne} manque ${m.manque}`).join(' · ') : 'aucune paire n’a atteint le test conjoint';
    return { texte: `global [${global}] · par condition [${parCondition || 'aucune'}]`, qs };
  };
  const ra = rendre(a.dernier);
  const rb = rendre(b.dernier);
  const sig = (r: ResultatHarnais) => rendre(r)?.texte ?? 'ABSENT';

  const base: LectureElement = {
    element: 'near-miss',
    etat: 'IDENTIQUE',
    ou: 'quasiSucces.global / quasiSucces.parCondition',
    temoin: ra?.texte ?? 'absent',
    compare: rb?.texte ?? 'absent',
    combien: 'aucun',
    surCombien: 'les paires EXPLORÉES avant troncature, dans chaque bras',
    autorise: 'les deux bras échouent d’un cheveu sur les mêmes conditions, du même écart.',
  };
  if (!ra && !rb) {
    return {
      ...base,
      etat: 'INDISPONIBLE',
      combien: '—',
      autorise:
        'absent des DEUX bras — `quasiSucces` n’existe que si `meilleurs` est vide (rien à chercher sinon), ou ' +
        'si l’appariement a tourné. Ce n’est pas un refus de comparer, c’est une absence de matière.',
    };
  }
  if (!ra || !rb) {
    return {
      ...base,
      etat: 'INDISPONIBLE',
      combien: '—',
      autorise:
        'présent d’un SEUL côté. ⚠️ **Ce n’est PAS une divergence de near-miss** : `quasiSucces` est absent dès ' +
        'que `meilleurs` n’est pas vide, donc « un bras trouve, l’autre pas » est la divergence n° 1 (verdict) ' +
        'vue par une autre fenêtre. À rattacher là, jamais à compter deux fois.',
    };
  }
  if (barrage) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: barrage };
  const instable = instabilite(a, b, sig);
  if (instable) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: instable };
  if (sig(a.dernier) === sig(b.dernier)) return base;

  const exemples: string[] = [];
  const parStatA = new Map(ra.qs.parCondition.map((p) => [`${p.stat}/${p.borne}`, p.quasiSucces.manques[0]?.manque]));
  const parStatB = new Map(rb.qs.parCondition.map((p) => [`${p.stat}/${p.borne}`, p.quasiSucces.manques[0]?.manque]));
  for (const cle of new Set([...parStatA.keys(), ...parStatB.keys()])) {
    const ma = parStatA.get(cle);
    const mb = parStatB.get(cle);
    if (ma !== mb) {
      // ⚠️ Le `manque` se compare en valeur ABSOLUE, dans l'unité de la stat —
      // jamais en pourcentage : 3 points de Précision et 3 points de Vitesse
      // ne sont pas la même chose.
      exemples.push(`quasiSucces.parCondition[${cle}] : manque ${ma ?? 'absent'} (témoin) contre ${mb ?? 'absent'} (comparé)`);
    }
  }
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: exemples.length > 0 ? `${exemples.length} condition(s) au manque différent` : 'le quasi-succès global diffère',
    autorise:
      'les deux bras échouent, mais pas sur la même condition ou pas du même écart — c’est le seul élément qui ' +
      'dit QUOI DESSERRER. ⚠️ Les manques sont en valeur ABSOLUE dans l’unité de la stat, jamais en pourcentage.',
    exemples: exemples.length > 0 ? exemples : undefined,
  };
}

/** Élément 5 — `explored`, le seul intrinsèquement bruité, et seulement sous `maxMs`. */
function lireExplored(
  a: BrasDifferentiel,
  b: BrasDifferentiel,
  explored: { temoin: SerieTemps; compare: SerieTemps } | null,
  portierFerme: boolean,
  plancherMesure: boolean
): LectureElement {
  const base: LectureElement = {
    element: 'explored',
    etat: 'IDENTIQUE',
    ou: 'completude.explored',
    temoin: explored ? `${nb(explored.temoin.min)} … ${nb(Math.max(...explored.temoin.valeurs))} paires` : 'indisponible',
    compare: explored ? `${nb(explored.compare.min)} … ${nb(Math.max(...explored.compare.valeurs))} paires` : 'indisponible',
    combien: 'aucun',
    surCombien: explored ? `${explored.temoin.repetitions} passage(s) par bras` : '—',
    autorise: 'les deux bras explorent le même nombre de paires.',
    piege:
      '⚠️ `explored` sous `maxMs` MÉLANGE deux causes : la vitesse du moteur et le coût par paire. Un `explored` ' +
      'plus bas côté comparé est compatible avec « le comparé est plus lent » ET avec « le comparé explore des ' +
      'paires plus chères » — il ne tranche donc rien seul. ⚠️ L’estimateur du bras est le run le MOINS ' +
      'PERTURBÉ : sous un budget de TEMPS c’est le MAXIMUM (une interférence ne peut que RETIRER des paires), ' +
      'à l’inverse d’un temps où c’est le minimum.',
  };
  if (!explored) {
    return { ...base, etat: 'INDISPONIBLE', combien: '—', autorise: 'aucun `explored` rendu (arrêt avant l’appariement).' };
  }
  if (portierFerme) return { ...base, etat: 'NON_COMPARABLE', combien: '—', autorise: 'le PORTIER a fermé : les deux bras ne se sont pas arrêtés pour la même raison.' };
  if (explored.temoin.min === explored.compare.min && explored.temoin.dispersionPct === 0 && explored.compare.dispersionPct === 0) {
    return base;
  }
  const ecart = explored.compare.min - explored.temoin.min;
  const ecartPct = explored.temoin.min > 0 ? (ecart / explored.temoin.min) * 100 : 0;
  const plancher = Math.max(explored.temoin.dispersionPct, explored.compare.dispersionPct);
  if (!plancherMesure) {
    return {
      ...base,
      etat: 'NON_COMPARABLE',
      combien: `${ecart > 0 ? '+' : ''}${nb(ecart)} paires (${ecartPct.toFixed(2)} %) — mais AUCUN plancher`,
      surCombien: `${nb(explored.temoin.min)} paires (témoin), UN seul passage par bras`,
      autorise:
        'RIEN. Les deux bras sont TRONQUÉS et un seul passage a été fait : la dispersion affichée « 0,00 % » ne ' +
        'dit pas « stable », elle dit « non mesurée ». Un écart d’`explored` sur des bras tronqués ne se ' +
        'distingue du bruit de troncature qu’avec un plancher établi sur les RÉPÉTITIONS DU BRAS lui-même — ' +
        'relancer avec --repetitions=2 au moins. ⚠️ Sur deux bras COMPLETS la question ne se poserait pas : ' +
        '`explored` y vaut `totalPairs`, une grandeur structurelle et non un instant de coupe.',
    };
  }
  if (Math.abs(ecartPct) <= plancher) {
    return {
      ...base,
      etat: 'IDENTIQUE',
      combien: `${ecart > 0 ? '+' : ''}${nb(ecart)} paires (${ecartPct.toFixed(2)} %) — SOUS le plancher ${plancher.toFixed(2)} %`,
      surCombien: `${nb(explored.temoin.min)} paires (témoin, minimum sur ${explored.temoin.repetitions})`,
      autorise:
        'l’écart est plus petit que la dispersion des bras eux-mêmes : il ne veut rien dire. ⚠️ Ce n’est pas ' +
        '« aucune différence », c’est « aucune différence MESURABLE avec ce nombre de répétitions ».',
    };
  }
  return {
    ...base,
    etat: 'DIVERGENT',
    combien: `${ecart > 0 ? '+' : ''}${nb(ecart)} paires (${ecartPct.toFixed(2)} %), plancher ${plancher.toFixed(2)} %`,
    surCombien: `${nb(explored.temoin.min)} paires (témoin) · dispersions ${explored.temoin.dispersionPct.toFixed(2)} % et ${explored.compare.dispersionPct.toFixed(2)} %`,
    autorise:
      'le comparé n’explore pas le même nombre de paires que le témoin, au-delà du bruit de chaque bras — le ' +
      'rendement de l’appariement diffère. ⚠️ Sur des bras COMPLETS, cela veut dire que la configuration a changé ' +
      'la TAILLE de l’espace, pas la vitesse à le parcourir.',
  };
}

/* --------------------------------------------------------------------------
 * Le VERDICT global — et le refus de dire « aucune divergence » nu
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Constat n° 1 de 11b, tenu ici en code** : un profil COMPLET peut être
 * totalement INSENSIBLE à la configuration, et sa rétention affichée ne le
 * dit pas (le produit brut est un MAJORANT de l'énumération). Un différentiel
 * bâti sur un tel profil rendrait « aucune divergence » sans jamais pouvoir en
 * trouver une — c'est-à-dire un silence livré avec l'autorité d'un résultat.
 *
 * D'où deux verdicts distincts là où un seul se serait imposé : la sensibilité
 * du profil sur CET axe est lue dans `axesSensibles`, un champ MESURÉ, jamais
 * dans la prose de `limites` — laquelle est imprimée à côté, pour le lecteur.
 */
function verdictGlobal(
  lectures: LectureElement[],
  premiereDivergence: ElementOracle | null,
  axeDeclareSensible: boolean
): VerdictDifferentiel {
  if (premiereDivergence) return 'DIVERGENCE_LOCALISÉE';
  const comparables = lectures.filter((l) => l.etat === 'IDENTIQUE');
  if (comparables.length === 0) return 'RIEN_DE_COMPARABLE';
  return axeDeclareSensible ? 'AUCUNE_DIVERGENCE_SUR_UN_AXE_SENSIBLE' : 'AUCUNE_DIVERGENCE_SENSIBILITÉ_NON_ÉTABLIE';
}

/* --------------------------------------------------------------------------
 * L'ANNONCE — le coût se dit AVANT d'être payé
 * ----------------------------------------------------------------------- */

/**
 * Même doctrine que `annoncerLot` : le palier 1 existe pour challenger une
 * configuration avant de la laisser tourner, et un différentiel MULTIPLIE ce
 * temps par `2N`.
 *
 * ⚠️ **Et il annonce ce que 11a a corrigé** : le coût n'est `2N` que pour le
 * bras bruité. Sur deux bras complets ou tronqués par quota, `N = 1` suffit
 * pour tout sauf les temps — le §5.2 annonçait `2N`, la spécification l'a
 * ramené à `2 + 2N`, et à **2 runs** dès que le différentiel tronque par quota.
 */
export function annoncerDifferentiel(
  profil: ProfilSynthetique,
  axe: AxeDifferentiel,
  valeurTemoin: ValeurAxe,
  valeurCompare: ValeurAxe,
  commun: CommunDifferentiel
): string {
  const rep = Math.max(1, commun.repetitions ?? 1);
  const l: string[] = [];
  l.push('═'.repeat(78));
  l.push(`DIFFÉRENTIEL — profil « ${profil.nom} », axe ${axe}`);
  l.push('═'.repeat(78));
  l.push(`  témoin        : ${axe} = ${valeurTemoin}`);
  l.push(`  comparé       : ${axe} = ${valeurCompare}`);
  l.push(`  cible suivie  : [${profil.cible.join(', ')}] — posée par le profil, jamais par la ligne de commande`);
  l.push(`  arrêt après   : ${commun.arretApres ?? 'classement'}`);
  l.push(`  protocole     : ${rep} passage(s) ENTRELACÉ(S) — témoin, comparé, témoin, comparé…  →  ${2 * rep} recherche(s)`);
  l.push(`  coût indicatif: ~${((profil.attendu.tempsMsIndicatif * 2 * rep) / 1000).toFixed(1)} s (profil mesuré à ~${profil.attendu.tempsMsIndicatif} ms le run)`);
  l.push('');
  if (!profil.axesSensibles.includes(axe)) {
    // ⚠️ DIT AVANT, pas après : payer 2N runs pour apprendre à l'arrivée que
    // le profil ne pouvait rien détecter sur cet axe, c'est un run payé pour
    // rien — exactement ce que 11a reproche à `maxMs` sur un cas neuf.
    l.push(
      `  ⚠️ AXE NON DÉCLARÉ SENSIBLE sur ce profil (axes mesurés sensibles : ` +
        `${profil.axesSensibles.length > 0 ? profil.axesSensibles.join(', ') : 'AUCUN'}). Une absence de divergence ` +
        `ne prouvera donc RIEN — elle sera rendue « sensibilité non établie », jamais « aucune divergence ».`
    );
    l.push(`     Limites du profil : ${profil.limites}`);
    l.push('');
  }
  if (rep === 1) {
    l.push(
      '  ⚠️ UN SEUL passage : aucune dispersion mesurée, donc aucun plancher de bruit. Sur deux bras COMPLETS ' +
        'c’est suffisant (l’oracle y est déterministe) ; sur deux bras TRONQUÉS, un écart d’`explored` sera rendu ' +
        'NON_COMPARABLE faute de pouvoir le distinguer du bruit.'
    );
  }
  l.push(`  ${AVERTISSEMENT_DIFFERENTIEL}`);
  return l.join('\n');
}

/* --------------------------------------------------------------------------
 * La RESTITUTION — la vraie difficulté de 11c
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ Une décimale sous 10 ms : sur un profil qui tourne en 130 ms, un
 * `toFixed(0)` rendrait « 0 ms » pour une préparation de 0,4 ms — donc une
 * phase instantanée là où il y a une phase courte. Même défaut que celui que
 * `msFin` corrige pour A₂, à une autre échelle.
 */
const ms = (n: number) => (n < 10 ? `${n.toFixed(1)} ms` : `${n.toFixed(0)} ms`);

const ETIQUETTE_ETAT: Record<EtatElement, string> = {
  IDENTIQUE: '  identique   ',
  DIVERGENT: '⚠️ DIVERGENT  ',
  NON_COMPARABLE: '  NON_COMPARABLE',
  INDISPONIBLE: '  indisponible',
};

/**
 * ⚠️ **Un ordre de lecture, pas une liste à plat.** Les sept éléments sont
 * imprimés dans l'ordre du pipeline, et le PREMIER point de divergence est
 * nommé à part — parce que c'est lui la réponse, et que « les sorties sont
 * différentes » ne se lit pas quand « premier rang divergent #5/20, écart
 * 0,103 % » se lit.
 */
export function rendreDifferentiel(d: ResultatDifferentiel): string {
  const l: string[] = [];

  l.push('', '═'.repeat(78));
  l.push(`DIFFÉRENTIEL — profil « ${d.profil} », axe ${d.axe} : ${d.temoin.valeur} (témoin) contre ${d.compare.valeur} (comparé)`);
  l.push('═'.repeat(78));
  l.push(`  ordre RÉEL d’exécution : ${d.entrelacement.join(' ')}   (${d.repetitions} passage(s) entrelacé(s))`);

  // ── CE QUI VARIE VRAIMENT, avant tout le reste : un axe qui en déplace un
  // autre ferait mesurer deux choses à la fois, et le dire APRÈS l'oracle
  // arriverait trop tard pour changer la lecture.
  l.push('', 'CE QUI VARIE ENTRE LES DEUX BRAS — pas seulement l’axe demandé', '─'.repeat(78));
  for (const p of d.parametresDivergents) {
    l.push(
      `  ${p.demande ? '→' : '⚠️'} ${p.nom.padEnd(16)} ${p.temoin} [${p.origineTemoin}]   contre   ` +
        `${p.compare} [${p.origineCompare}]${p.demande ? '' : '   ← ENTRAÎNÉ, pas demandé'}`
    );
  }
  const entraines = d.parametresDivergents.filter((p) => !p.demande);
  if (entraines.length > 0) {
    l.push(
      `  ⚠️ ${entraines.length} paramètre(s) varie(nt) SANS avoir été demandé(s) : ${entraines.map((p) => p.nom).join(', ')}.`,
      '     Ce différentiel ne mesure donc PAS l’effet d’un paramètre isolé — il mesure celui du GROUPE. La',
      '     cascade la plus fréquente est le piège A du §4.3 : `bucketCap = params.bucketCap ?? bucketCapFor(',
      '     slotFilterCap)`, donc surcharger `slotFilterCap` déplace AUSSI `bucketCap`. Pour isoler l’un des',
      '     deux, le surcharger EXPLICITEMENT dans les deux bras (--bucketCap=<n>), ce qui fige la cascade.'
    );
  } else if (d.parametresDivergents.length === 0) {
    l.push('  (aucun — ⚠️ les deux bras appliquent la MÊME configuration effective : il n’y a rien à comparer.)');
  }

  // ── L'ADMISSIBILITÉ EN TÊTE : c'est elle qui décide si le reste se lit.
  l.push('', 'ADMISSIBILITÉ — le portier, puis le préfixe. AVANT tout le reste.', '─'.repeat(78));
  l.push(`  PORTIER  : ${d.admissibilite.portier}`);
  l.push(`    ${d.admissibilite.motifPortier}`);
  l.push(`  PRÉFIXE  : ${d.admissibilite.prefixe}`);
  l.push(`    ${d.admissibilite.motifPrefixe}`);

  // ── L'ORACLE, dans l'ordre du pipeline.
  l.push('', 'ORACLE — sept éléments, dans l’ordre du PIPELINE', '─'.repeat(78));
  for (const element of ORDRE_LECTURE) {
    const lec = d.lectures.find((x) => x.element === element);
    if (!lec) continue;
    l.push('', `  ${ETIQUETTE_ETAT[lec.etat]}  ${element}`);
    l.push(`      OÙ          : ${lec.ou}`);
    l.push(`      témoin      : ${lec.temoin}`);
    l.push(`      comparé     : ${lec.compare}`);
    l.push(`      COMBIEN     : ${lec.combien}`);
    l.push(`      SUR COMBIEN : ${lec.surCombien}`);
    l.push(`      AUTORISE    : ${lec.autorise}`);
    for (const e of lec.exemples ?? []) l.push(`      exemple     : ${e}`);
    // ⚠️ Le piège n'est imprimé QUE là où il mord — un avertissement collé
    // sous chaque ligne cesse d'être lu (défaut corrigé sur la sortie réelle
    // du §5.1, où le même texte partait sous tous les verdicts).
    if (lec.piege && (lec.etat === 'DIVERGENT' || lec.etat === 'NON_COMPARABLE')) l.push(`      ${lec.piege}`);
  }

  // ── LA RÉPONSE.
  l.push('', '─'.repeat(78));
  l.push(
    d.premiereDivergence
      ? `→ PREMIER POINT DE DIVERGENCE : ${d.premiereDivergence}`
      : '→ AUCUN point de divergence dans les éléments COMPARABLES.'
  );
  l.push(`→ VERDICT : ${d.verdict}`);
  if (d.verdict === 'AUCUNE_DIVERGENCE_SENSIBILITÉ_NON_ÉTABLIE') {
    l.push(
      `  ⚠️ L’axe « ${d.axe} » n’est PAS déclaré sensible sur ce profil : rien ne prouve qu’il puisse y produire`,
      '     une divergence. Cette absence n’est donc pas un résultat sur le moteur.',
      `     Limites du profil : ${d.sensibilite.limitesDuProfil}`
    );
  }
  if (d.verdict === 'RIEN_DE_COMPARABLE') {
    l.push('  ⚠️ Aucun élément n’a pu être comparé. Ce n’est PAS « aucune différence » — voir l’admissibilité ci-dessus.');
  }

  // ── LES TEMPS — la seule grandeur pour laquelle l'entrelacement existe.
  const phases = ['preparation', 'demiBuilds', 'demiBuildA', 'demiBuildB', 'appariement', 'total'];
  const presentes = phases.filter((p) => d.temps.temoin[p] && d.temps.compare[p]);
  if (presentes.length > 0) {
    l.push('', 'TEMPS — la grandeur pour laquelle l’entrelacement existe (minimum, §6.4 bis)', '─'.repeat(78));
    l.push(`  ${'phase'.padEnd(12)} ${'témoin'.padStart(12)} ${'comparé'.padStart(12)} ${'écart'.padStart(10)}   dispersions`);
    for (const p of presentes) {
      const ta = d.temps.temoin[p];
      const tb = d.temps.compare[p];
      const ecartPct = ta.min > 0 ? ((tb.min - ta.min) / ta.min) * 100 : 0;
      const plancher = Math.max(ta.dispersionPct, tb.dispersionPct);
      // ⚠️ « SOUS LE PLANCHER » plutôt qu'un écart nu : ne jamais conclure sur
      // un écart plus petit que la dispersion observée.
      // ⚠️ Et à UNE répétition il n'y a pas de plancher à 0 % — il n'y a PAS
      // DE PLANCHER DU TOUT. Laisser la colonne « dispersions » afficher
      // « 0,0 % / 0,0 % » ferait lire un écart de −87,7 % comme largement
      // significatif : une case qui se lit « stable » alors qu'elle dit
      // « non mesuré ». Le marquage part donc par LIGNE, pas seulement en
      // pied de tableau.
      const marque =
        d.repetitions === 1
          ? ' ⚠️ 1 rép. : AUCUN plancher'
          : Math.abs(ecartPct) <= plancher
            ? ' (SOUS le plancher)'
            : '';
      l.push(
        `  ${p.padEnd(12)} ${ms(ta.min).padStart(12)} ${ms(tb.min).padStart(12)} ` +
          `${`${ecartPct >= 0 ? '+' : ''}${ecartPct.toFixed(1)} %`.padStart(10)}   ` +
          `${ta.dispersionPct.toFixed(1)} % / ${tb.dispersionPct.toFixed(1)} %${marque}`
      );
    }
    if (d.repetitions === 1) {
      l.push('  ⚠️ UNE seule répétition : aucune dispersion, donc AUCUN écart de temps ci-dessus n’est concluant.');
    }
  }

  l.push('', `  ${d.avertissement}`);
  return l.join('\n');
}
