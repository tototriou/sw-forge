// Optimiseur de build : cherche, dans un pool de runes possédées, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre donné, sous contrainte
// d'un combo de sets, de statistiques principales imposées (slots 2/4/6) et
// de minimums/maximums de stats.
//
// Anticipé dans spec/compte/calcul-runes.md §6 (Perf) : « jamais de
// brute-force → Web Worker, tableaux typés, branch-and-bound + pré-filtrage
// par slot ». Calcul pur (aucune dépendance React) : réutilisable tel quel
// dans le Worker (src/workers/runeBuildOptim.worker.ts) et dans les tests.
//
// ⚠️ **Meet-in-the-middle**, pas un simple branch-and-bound linéaire sur les
// 6 slots. Un branch-and-bound naïf ne détecte un combo de sets impossible
// qu'au bout des 6 choix (le test `missingSets` n'a de sens que sur les 6
// runes réunies) : il gaspille énormément de branches à explorer des débuts
// de combinaison qui ne pourront jamais aboutir. Ici, les 6 slots sont
// scindés en deux MOITIÉS de 3, chacune énumérée depuis le pool déjà
// pré-filtré par slot ; les moitiés sont regroupées par le compte EXACT de
// pièces de chaque set demandé qu'elles apportent (+ jokers Intangible) —
// deux moitiés dont les comptes s'additionnent pour satisfaire le combo
// peuvent être appariées SANS jamais énumérer le produit complet des runes
// individuelles.
//
// ⚠️ **Compartiments EN FLUX, bornés en mémoire.** Une première version
// construisait un tableau complet de `cap³` combinaisons par moitié avant de
// les regrouper : sur un vrai compte (des centaines de runes par slot), ça
// pouvait épuiser plusieurs Go de mémoire et planter — voir
// spec/outils/optimizer/, « Validation grandeur nature ». Chaque
// combinaison est maintenant évaluée puis, selon son mérite, retenue ou
// **immédiatement jetée** : la mémoire dépend du nombre de compartiments ×
// leur taille max (`BUCKET_CAP`), plus jamais du cube du pré-filtrage par
// slot. Voir spec/outils/optimizer/ pour le résumé fonctionnel, et
// .claude/skills/algo-verify/SKILL.md pour la discipline de vérification
// (référence brute-force + test différentiel dans
// tests/rune-optim-differential.test.ts).
//
// ⚠️ **Élagage de FAISABILITÉ uniquement.** Le but n'est pas de maximiser un
// seul critère pendant la recherche, mais de COLLECTER un ensemble large mais
// borné de combinaisons valides, pour que le tri (PV/VIT/efficience/…) se
// fasse ensuite côté client, instantanément, sur des candidats déjà
// entièrement calculés — sans relancer la recherche à chaque changement de
// tri. D'où des bornes d'élagage volontairement SÛRES (jamais un sous-estimé
// du potentiel restant, qui écarterait à tort une combinaison réellement
// valable) plutôt que maximalement serrées.

import { ArtifactDetail, BaseStats, ElementKey, GearSet, RelicDetail, RuneDetail } from '../types';
import { MAX_SET_PIECES, RUNE_EFFECT, SET_STAT_BONUS, StatKey, activeSets, runeEfficiency, runeScore, setPieces, setsCost } from './effects';
import { computeStats, StatRow } from './stats';
import { missingSets } from './recoMatch';
import { OptimMetric } from './runeOptim';
import {
  DEF_FACTOR_CONST,
  DEF_FACTOR_COEF,
  BonusDegatsStackableProfile,
  DamageSetup,
  PassifOffensifProfile,
  SkillDamageProfile,
  computeTotalDamage,
} from './damage';

// Statistiques principales possibles, par emplacement — RÈGLES DU JEU. Les
// slots 1/3/5 ont une principale FIXE (ATQ plat / DEF plat / PV plat) : pas
// de choix, donc pas d'entrée ici. Codes : voir RUNE_EFFECT (2=PV%, 4=ATQ%,
// 6=DEF%, 8=VIT, 9=Taux Crit, 10=Dmg Crit, 11=RES, 12=Précision).
export const SLOT_MAIN_OPTIONS: Record<2 | 4 | 6, number[]> = {
  2: [2, 4, 6, 8],
  4: [2, 4, 6, 9, 10],
  6: [2, 4, 6, 11, 12],
};

export interface BuildRequirement {
  // Multiset de clés RUNE_SETS, **au format `activeSets`** (une entrée par
  // activation : ['violent','will'] = Violent 4p + Will 2p ; ['fight','fight']
  // = 2× Fight). Coût en runes ≤ 6, garanti par l'UI (setsCost/canAddSet).
  sets: string[];
  // Minimums exigés sur le TOTAL final (comme RecoSlot.stats). Absent = non exigé.
  minStats: Partial<Record<StatKey, number>>;
  // Maximums exigés sur le TOTAL final. Absent = non plafonné.
  maxStats?: Partial<Record<StatKey, number>>;
  // Statistiques principales AUTORISÉES sur les slots 2/4/6 (codes RUNE_EFFECT,
  // voir SLOT_MAIN_OPTIONS). Absent/vide pour un slot = pas de contrainte.
  mainStats?: Partial<Record<2 | 4 | 6, number[]>>;
  // Runes IMPOSÉES, par emplacement (1..6) : `lockedRunes[slot] = runeId`
  // force CE slot à n'avoir qu'un seul candidat — la rune choisie. Absent
  // pour un slot = emplacement libre, comportement inchangé.
  //
  // ⚠️ **Une RÉDUCTION de pool, pas une contrainte de plus.** Le verrou est
  // appliqué tout en amont (`mainStatFilteredBySlot`, voir son
  // implémentation), avant dominance/faisabilité/pré-filtrage : le slot
  // n'a plus qu'un candidat, et TOUT le reste du moteur continue de
  // travailler exactement comme avant sur un pool simplement plus petit.
  // Aucun élagage n'a besoin de connaître la notion de verrou — c'est ce
  // qui rend cette fonctionnalité sûre par construction (elle ne peut pas
  // provoquer de faux rejet, elle retire des candidats que l'utilisateur a
  // explicitement écartés lui-même).
  //
  // ⚠️ Une rune verrouillée dont l'emplacement RÉEL ne correspond pas au
  // slot demandé, ou absente du pool (exclue par ailleurs, compte
  // différent), rend la recherche VIDE pour ce slot — donc zéro résultat.
  // C'est le comportement voulu : mieux vaut zéro build qu'un build qui
  // ignore silencieusement le verrou posé.
  lockedRunes?: Partial<Record<number, number>>;
}

export interface BuildCandidate {
  runeIds: number[]; // 6 ids, alignés slot 1..6
  stats: StatRow[]; // computeStats(base + ces 6 runes + artefacts/relique fixes)
  // ⚠️ Somme des 6 valeurs individuelles, dans la mesure ACTIVE AU MOMENT DE
  // LA RECHERCHE (`SearchParams.metric`), figée dans le candidat. Le réglage
  // global Efficience/Score (menu ⚙) peut changer APRÈS coup sans relancer
  // de recherche — ce champ ne le sait pas et devient alors incohérent avec
  // le popover d'une rune individuelle (qui, lui, se recalcule en direct).
  // ⚠️ Ne JAMAIS afficher ce champ tel quel dans l'UI : utiliser
  // `candidateMetricTotal(candidate, runeById, metric)` (recalculé à partir
  // des VRAIES runes, dans la mesure COURANTE) pour tout affichage ou tri
  // qui doit rester juste si l'utilisateur change de mesure sans relancer.
  effTotal: number;
}

export interface SearchParams {
  base: BaseStats;
  artifacts: ArtifactDetail[]; // fixes : ceux actuellement équipés
  relic?: RelicDetail; // fixe
  pool: RuneDetail[]; // runes candidates (déjà filtrées par exclusion en amont)
  requirement: BuildRequirement;
  metric: OptimMetric;
  maxNodes?: number; // budget de PAIRES (moitié+moitié) évaluées, pas de nœuds d'arbre
  maxCollected?: number; // plafond de candidats retenus avant arrêt (défaut MAX_COLLECTED)
  maxMs?: number; // budget de TEMPS écoulé, en ms (défaut DEFAULT_MAX_MS)
  slotFilterCap?: number; // candidats retenus par slot et par paquet (défaut MAX_PER_SLOT_MATCH/FILL)
  // ⚠️ Surcharge de BUCKET_CAP (voir sa constante pour le défaut courant,
  // recalibré plusieurs fois) — n'existe QUE pour la mesure
  // (scripts/benchmark-bucket-retention.ts) : élargir ce plafond pour
  // comparer la qualité trouvée à différents niveaux, en réutilisant le
  // moteur réel déjà vérifié plutôt qu'une réimplémentation séparée risquant
  // de diverger. Jamais exposé dans l'UI — voir spec/outils/optimizer/.
  bucketCap?: number;
  // Choix fait AVANT de lancer la recherche (voir OptimizerSection.tsx) :
  // oriente le PRÉ-FILTRAGE par slot vers les stats utiles à cet objectif,
  // en plus de servir de tri par défaut des résultats. Absent = aucun biais
  // (le pré-filtrage ne suit que minStats/maxStats/l'efficience générale).
  objective?: Objective;
  // ⚠️ IMPOSE les stats à privilégier au pré-filtrage/à la rétention, en
  // remplacement de `OBJECTIVE_RELEVANT_STATS[objective]` (voir
  // `objectiveKeysOf`). Existe pour l'objectif « Dégâts réels », dont les
  // stats pertinentes dépendent du SORT choisi et ne peuvent donc pas être
  // écrites dans une table statique — l'écran les calcule via
  // `damageRelevantStats` (damage.ts) et les transmet ici. Absent =
  // comportement inchangé.
  objectiveStats?: StatKey[];
  // Bouton « Prioriser les stats les plus difficiles » (OptimizerSection.tsx)
  // — piste B, spec/outils/optimizer/ « Suite — piste B gatée derrière un
  // paramètre ». `false`/absent (défaut, bouton « Rechercher » normal) :
  // comportement inchangé, coût nul (vérifié par mesure dos-à-dos). `true` :
  // réalloue le budget de rétention par tranche entre les stats demandées
  // selon leur dispersion mesurée — peut retrouver un build qu'une
  // répartition uniforme raterait, au prix d'un temps de recherche plus
  // long (+20 % de temps de construction mesuré en moyenne).
  adaptiveTrancheWeighting?: boolean;
  // Voir `buildBuckets`, paramètre `combosOrderMode`. `undefined`/
  // `'relevance'` (défaut depuis le 2026-08-18, tous les appels de
  // production) : tri des demi-builds par `relevanceScore` au sein d'un
  // compartiment (mesuré ~2× plus rapide, 0 régression — voir
  // historique-dimensionnement.md). `'potential'` : ancien comportement,
  // conservé comme échappatoire de mesure/comparaison. `'combined'` :
  // PROTOTYPE (forge/order-as-weight-contrib) — trie uniquement par
  // combinedRetentionScore, repli sur relevanceScore si aucun minimum posé.
  // Jamais exposé dans l'UI.
  combosOrderMode?: 'potential' | 'relevance' | 'combined' | 'objective';
}

export interface SearchResult {
  candidates: BuildCandidate[];
  explored: number;
  truncated: boolean;
}

// Objectifs : choisis AVANT de lancer la recherche (OptimizerSection.tsx),
// un grand bouton à choix unique — pour orienter le type de rune étudié dès
// le pré-filtrage, pas seulement trier les résultats après coup.
// `'degats_reels'` : les dégâts d'un SORT précis contre un adversaire
// configuré (voir spec/outils/degats-reels.md). Contrairement aux trois
// autres, ses stats pertinentes ne sont PAS fixes — elles dépendent du sort
// choisi (`{ATK}`, `{ATK}*({SPD}+70)/30`, `0.2*{MAX HP}`…). L'écran les
// calcule via `damageRelevantStats` et les transmet dans
// `SearchParams.objectiveStats` ; l'entrée ci-dessous n'est que le repli
// utilisé tant qu'aucun sort n'est résolu (fiche absente — monstre perso —
// ou formule hors modèle). ⚠️ Remplace `'speed_nuker'` (archétype générique
// ATQ+Dmg Crit+VIT, retiré : cet objectif calcule la VRAIE formule d'un sort
// qui dépend de VIT — ex. Lagmaron, `ATQ×(VIT+70)/30` — plutôt qu'une
// approximation qui ignorait VIT au tri final ; voir historique).
export type Objective = 'efficience' | 'degats' | 'ehp' | 'vitesse' | 'degats_reels';

export const OBJECTIVE_LABELS: { key: Objective; label: string }[] = [
  { key: 'efficience', label: 'Efficience' },
  { key: 'degats', label: 'Dégâts' },
  { key: 'degats_reels', label: 'Dégâts réels' },
  { key: 'ehp', label: 'PV effectifs' },
  { key: 'vitesse', label: 'Vitesse' },
];

// ⚠️ Constantes de RÈGLE DU JEU (pas d'affichage) déplacées ici depuis
// OptimizerSection.tsx pour avoir une SEULE source, utilisée à la fois par
// l'écran et par tout script qui doit reconstruire un `SearchParams` fidèle
// (voir scripts/lib/) — deux copies indépendantes auraient pu diverger en
// silence, exactement le genre de dérive qui a coûté du temps sur ce moteur.

export type SlotFilterPresetKey = 'bas' | 'moyen' | 'haut' | 'extreme';

// Pré-filtrage par emplacement, en PRESETS plutôt qu'un curseur libre —
// calibré par mesure sur un vrai compte (voir spec/outils/optimizer/,
// « Validation grandeur nature ») : 40 est le défaut historique, 300 est la
// valeur qui a permis de retrouver un build réel sur un très gros compte.
export const SLOT_FILTER_PRESETS: { key: SlotFilterPresetKey; label: string; cap: number; hint: string }[] = [
  {
    key: 'bas',
    label: 'Bas',
    cap: 40,
    hint: 'Rapide, mais peut manquer des runes si tu en as beaucoup au même emplacement.',
  },
  {
    key: 'moyen',
    label: 'Moyen',
    cap: 80,
    hint: 'Un bon équilibre entre rapidité et exhaustivité — le choix par défaut.',
  },
  {
    key: 'haut',
    label: 'Haut',
    cap: 150,
    hint: 'Considère plus de runes, donc plus long — utile si Moyen ne trouve pas de résultat satisfaisant.',
  },
  {
    key: 'extreme',
    label: 'Extrême',
    cap: 300,
    hint: 'Le plus complet, mais le plus long — peut prendre plusieurs minutes selon le nombre de conditions demandées.',
  },
];

// Les trois valeurs de statistique principale d'artéfact possibles en jeu
// (codes 100/101/102 = PV/ATQ/DEF, voir ARTIFACT_MAIN dans effects.ts) — la
// valeur elle-même n'est jamais un choix libre, seule la STAT l'est.
export const ARTIFACT_MAIN_VALUE: Record<100 | 101 | 102, number> = { 100: 1500, 101: 100, 102: 100 };
export const ARTIFACT_MAIN_OPTIONS: { code: 100 | 101 | 102; label: string }[] = [
  { code: 101, label: 'ATQ +100' },
  { code: 102, label: 'DEF +100' },
  { code: 100, label: 'PV +1500' },
];

// Stats individuellement pertinentes pour chaque objectif — sert à élargir
// leur budget de rétention dans `filterSlot`, et à choisir quelles stats
// obtiennent leur propre tranche de rétention dans `buildBuckets`
// (`retentionKeys`). « Efficience » n'en a pas : c'est déjà la lentille par
// défaut du pré-filtrage (voir `relevance`), aucun biais de plus à lui
// donner.
// ⚠️ **Dégâts n'inclut PAS le Taux Crit.** ATQ et Dmg Crit se maximisent
// (jamais de plafond utile), mais le Taux Crit est plafonné à 100 % en jeu —
// le pousser au-delà n'apporte rien (voir `objectiveScore`, qui l'écrête
// déjà dans le calcul). Pour cet objectif, TC se comporte comme une
// CONDITION à satisfaire (l'utilisateur pose typiquement un minimum, souvent
// 100 % ou une valeur pensée pour se compléter avec un buff en jeu), pas
// comme une cible à maximiser plus loin — sa protection passe entièrement
// par `minEntries` (la tranche combinée par conditions), jamais par cette
// liste. Le mettre ici pousserait la rétention à privilégier des demi-builds
// pour un potentiel TC qui ne sert à rien une fois le plafond atteint.
export const OBJECTIVE_RELEVANT_STATS: Record<Objective, StatKey[]> = {
  efficience: [],
  degats: ['atk', 'cd'],
  // ⚠️ REPLI seulement — les vraies stats de « Dégâts réels » dépendent du
  // sort choisi et arrivent par `SearchParams.objectiveStats` (voir
  // `objectiveKeysOf` juste en dessous). Cette entrée sert quand aucun sort
  // n'est résolu (fiche du monstre absente, formule non prise en charge).
  degats_reels: ['atk', 'cd'],
  ehp: ['hp', 'def'],
  vitesse: ['spd'],
};

// Les stats à privilégier au pré-filtrage/à la rétention, avec la
// possibilité de les IMPOSER indépendamment de l'objectif nommé.
//
// ⚠️ **Le moteur reste générique** : il ne sait pas ce qu'est un sort ni
// comment on calcule des dégâts réels — seulement « ces stats-là comptent
// plus que les autres pour cette recherche ». C'est ce qui permet à
// `damage.ts` de rester la seule source du raisonnement métier, sans que ce
// fichier ait à en dépendre (même principe que `pool`, déjà filtré en amont
// sans que le moteur connaisse les périmètres d'exclusion).
export function objectiveKeysOf(objective: Objective | undefined, override: StatKey[] | undefined): StatKey[] {
  if (override) return override;
  // ⚠️ `?? []`, pas un accès direct : `objective` peut porter une valeur
  // ABSENTE de la table — une recette exportée pendant la courte durée de vie
  // d'un objectif depuis retiré (ex. `speed_nuker`, v1.8.1) est du JSON non
  // validé, `parseOptimizerRecipe` ne vérifie pas que `objective` fait partie
  // du type. Sans ce repli, `[...objectiveKeysOf(...)]` plus haut dans la
  // pile lève une `TypeError` (spread sur `undefined`) au lieu de dégrader
  // proprement vers « aucun biais » — même esprit de tolérance que le reste
  // de ce fichier de recette (un identifiant introuvable est ignoré, jamais
  // une exception).
  return objective ? (OBJECTIVE_RELEVANT_STATS[objective] ?? []) : [];
}

export function statTotal(stats: StatRow[], key: StatKey): number {
  return stats.find((s) => s.key === key)?.total ?? 0;
}

// Score d'un candidat DÉJÀ CALCULÉ, selon l'objectif choisi. Prend le
// candidat entier (pas seulement ses stats) : « Efficience » lit `effTotal`
// (la mesure choisie globalement — voir compte/runes.md), pas une stat.
// ⚠️ La branche « efficience » hérite donc de la mesure FIGÉE au moment de la
// recherche (voir `BuildCandidate.effTotal`) — pour un tri ou un affichage
// qui doit rester juste si l'utilisateur change de mesure après coup SANS
// relancer, utiliser `candidateMetricTotal` à la place (voir plus bas),
// jamais cette fonction pour « efficience » spécifiquement.
//  - dégâts : espérance sur le taux de critique réellement atteint — ni
//    « toujours critique » ni « jamais », ce que le joueur observe en
//    moyenne sur beaucoup de coups.
//  - PV effectifs : réutilise le facteur de défense déjà documenté dans
//    spec/mecaniques.md (1000 / (1140 + 3,5 × DEF)), pas une formule maison.
// Contexte supplémentaire exigé par « Dégâts réels » : contrairement aux
// autres objectifs, son score ne se déduit PAS des seules stats du candidat —
// il faut le sort visé et l'adversaire configuré. Passé par l'appelant qui
// les possède (l'écran, ou un script rejouant une recette).
export interface RealDamageContext {
  profile: SkillDamageProfile;
  setup: DamageSetup;
  // Élément du monstre optimisé — décide de la compétence d'invocateur
  // « Puis. d'att. de <élément> ». Déduit du monstre, jamais saisi, donc
  // hors de `setup` (qui ne porte que de la saisie, pour rester partageable
  // dans une recette).
  element: ElementKey | null;
  // Passifs offensifs de CE monstre (voir `monsterOffensivePassives`,
  // damage.ts) — additionnés au sort choisi selon `setup.passifsOffensifs`.
  // Vide = comportement strictement inchangé (aucun passif connu, ou fiche
  // absente).
  passifs: PassifOffensifProfile[];
  // Somme des lignes d'artéfact « Effet aug. VIT » ÉQUIPÉES (voir
  // `speedBuffAmpliPct`, damage.ts) — fixe pour toute une recherche
  // (l'Optimizer n'optimise que les runes). 0 = comportement inchangé.
  ampliVitPct: number;
  // Ce monstre force-t-il le critique quand il est plus rapide que
  // l'adversaire (voir `monsterCritSiPlusRapide`) ? Déduit de la fiche,
  // jamais saisi. `false` = comportement inchangé.
  critSiPlusRapide: boolean;
  // Ce monstre majore-t-il TOUS ses dégâts selon l'écart de VIT (Sonia —
  // voir `monsterBonusDegatsSelonVit`) ? Déduit de la fiche, jamais saisi.
  // `null` = comportement inchangé.
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null;
  // Ce monstre porte-t-il un bonus de dégâts ACCUMULABLE (Momo — voir
  // `monsterBonusDegatsStackable`) ? Déduit de la fiche ; le POURCENTAGE,
  // lui, est saisi par l'utilisateur (`setup.stackPersonnalise`). `null` =
  // comportement inchangé.
  bonusDegatsStack: BonusDegatsStackableProfile | null;
}

export function objectiveScore(candidate: BuildCandidate, objective: Objective, realDamage?: RealDamageContext): number {
  if (objective === 'efficience') return candidate.effTotal;
  const { stats } = candidate;
  if (objective === 'vitesse') return statTotal(stats, 'spd');
  if (objective === 'degats_reels') {
    // ⚠️ Sans contexte, on ÉCHOUE bruyamment plutôt que de retomber sur la
    // formule « Dégâts » générique : un score plausible mais calculé sur un
    // autre modèle que celui affiché à l'utilisateur serait invisible. Même
    // garde-fou que la branche finale de cette fonction, qui a justement
    // rendu visible un trou réel (voir spec/outils/optimizer/, revue de code
    // externe).
    if (!realDamage) {
      throw new Error("objectiveScore : l'objectif « Dégâts réels » exige un contexte (sort + adversaire).");
    }
    return computeTotalDamage(
      realDamage.profile,
      realDamage.passifs,
      stats,
      realDamage.setup,
      realDamage.element,
      realDamage.ampliVitPct,
      realDamage.critSiPlusRapide,
      realDamage.bonusDegatsSelonVit,
      realDamage.bonusDegatsStack
    );
  }
  if (objective === 'degats') {
    const atk = statTotal(stats, 'atk');
    // ⚠️ Le Taux Crit est PLAFONNÉ à 100 % dans le jeu — passer 100 % ne
    // rapporte plus rien (la formule utiliserait sinon une chance de critique
    // > 100 %, gonflant les dégâts espérés d'un build dont le total brut
    // dépasse 100 % au-delà de ce qu'il apporte réellement en jeu). `computeStats`
    // n'écrête jamais rien lui-même (voir Conditions) : c'est ICI, au moment
    // de transformer une stat en dégâts, que le plafond compte.
    const cr = Math.min(statTotal(stats, 'cr'), 100);
    return atk * (1 + (cr / 100) * (statTotal(stats, 'cd') / 100));
  }
  // Filet de sécurité : tout objectif futur sans branche dédiée ci-dessus
  // échoue bruyamment plutôt que de retomber silencieusement sur EHP (voir
  // historique-acceleration-et-outillage.md, « revue de code externe » —
  // c'est ce garde-fou qui a justement rendu visible le trou comblé ici).
  if (objective !== 'ehp') {
    throw new Error(`objectiveScore : aucune formule de score pour l'objectif "${objective}".`);
  }
  const hp = statTotal(stats, 'hp');
  const def = statTotal(stats, 'def');
  // ⚠️ Constantes importées de damage.ts, seule source du facteur de défense
  // pour toute l'app — l'arithmétique reste écrite TELLE QUELLE (et non
  // `hp / defenseFactor(def)`, pourtant mathématiquement identique) : passer
  // par la division changerait les derniers bits du résultat, donc l'ordre de
  // deux candidats à égalité près, pour zéro bénéfice.
  return (hp * (DEF_FACTOR_CONST + DEF_FACTOR_COEF * def)) / 1000;
}

// Efficience/Score total d'un candidat, recalculé À LA DEMANDE à partir des
// VRAIES runes, dans la mesure COURANTE — contrairement à `BuildCandidate.
// effTotal`, figé dans la mesure active au moment de la recherche. À utiliser
// pour tout affichage ou tri qui doit rester cohérent avec le popover d'une
// rune individuelle (lui-même toujours recalculé en direct) même si
// l'utilisateur bascule Efficience ↔ Score (menu ⚙) après avoir lancé la
// recherche, sans la relancer.
export function candidateMetricTotal(
  candidate: BuildCandidate,
  runeById: Map<number, RuneDetail>,
  metric: OptimMetric
): number {
  let sum = 0;
  for (const id of candidate.runeIds) {
    const r = runeById.get(id);
    if (!r) continue;
    sum += metric === 'eff' ? runeEfficiency(r) : runeScore(r);
  }
  return sum;
}

// ⚠️ Historique du budget de paires par défaut, avant qu'il ne devienne
// ADAPTATIF (voir `adaptiveMaxNodes` plus bas, qui remplace ce qui était ici
// une constante fixe `DEFAULT_MAX_NODES`) : 4 000 000 → 20 000 000 (×5, en
// même temps que `BUCKET_CAP` — les deux doivent grandir ENSEMBLE, voir son
// commentaire ; relever seulement `BUCKET_CAP` peut faire RECULER un
// résultat déjà trouvé, mesuré sur deck 10 Lushen) → 20 000 000 →
// 32 000 000 (×1,6, Sonia deck 14, 4 minimums à la fois). Cette dernière
// valeur (32 000 000) sert maintenant d'ANCRE au calcul adaptatif, pas de
// plafond fixe universel — voir `adaptiveMaxNodes`.
// ⚠️ Relevé de 5000 à 100 000 (×20) — demande explicite : trouver le
// meilleur build importe plus que la vitesse, une recherche allant jusqu'à
// ~1 minute est acceptable. Mesuré avant de relever
// (scripts/benchmark-search-budget.ts, voir spec/outils/optimizer/) plutôt
// que deviné : au preset « Moyen » (slotFilterCap=80, le défaut réel),
// relever `maxCollected` de 5000 à 100 000 a fait passer un scénario serré
// (maximum posé) de 95,2 % à 100 % du meilleur trouvé, pour un coût de temps
// négligeable (< 1 s de plus, sur un total < 2 s). Au preset « Extrême »
// (slotFilterCap=300), aucun effet mesuré sur la qualité NI sur le temps
// (~22-55 s, dominés par la construction des compartiments — un coût FIXE
// de `slotFilterCap`, indépendant de `maxCollected`) : ce plafond n'y était
// déjà pas le facteur limitant, donc le relever n'y coûte quasiment rien de
// plus. `DEFAULT_MAX_NODES` relevé dans la même proportion (×10, plus
// prudent) pour ne jamais redevenir, lui, le facteur limitant à la place.
// Surchargeable via SearchParams.maxCollected.
export const MAX_COLLECTED = 100_000;
// Filet de sécurité indépendant de maxNodes/maxCollected : sur les scénarios
// mesurés (500 à 5000 runes, scripts/benchmark-optim.ts), le pire cas était
// sous ~4 s — 15 s laisse une marge large avant de considérer qu'une
// recherche est anormalement lente, sans jamais bloquer l'interface
// puisqu'elle tourne dans un Worker. Surchargeable via SearchParams.maxMs.
export const DEFAULT_MAX_MS = 15_000;
// Deux paquets par slot : les runes du (ou des) set(s) demandé(s) — pour
// garantir qu'une combinaison satisfaisant le combo reste atteignable même
// après filtrage — et les meilleures runes toutes provenances, pour la
// diversité des slots « libres ». L'union des deux, dédupliquée.
// Exportée : c'est le défaut réel appliqué par `prepareSearch` quand
// `SearchParams.slotFilterCap` est omis — un test qui vérifie une propriété
// dépendant de `slotFilterCap` (ex. `estimatePairBound`) sur un appel sans
// override doit connaître CETTE valeur précise, pas la redevine/dupliquer en
// dur (risque de dérive silencieuse si elle change un jour).
export const MAX_PER_SLOT_MATCH = 40;
// ⚠️ Exportée (au lieu de rester privée) uniquement pour que les scripts de
// mesure (filterslot-topk-diag.ts) important les VRAIES valeurs de
// production plutôt que de les dupliquer localement — incident vécu : une
// copie locale à 80/40 (asymétrique, jamais vraie en production) a produit
// une mesure de divergence qui ne caractérisait pas le vrai comportement de
// filterSlot (voir historique-dimensionnement.md, « revue de code
// externe »).
export const MAX_PER_SLOT_FILL = 40;
// ⚠️ En plus des deux paquets ci-dessus : le meilleur d'un slot sur CHAQUE
// stat individuellement, même sans minimum demandé dessus. Sans ça, le
// pré-filtrage ne retient que ce qui sert les minimums SAISIS — si
// l'utilisateur ne demande aucun minimum de VIT puis trie les résultats
// « par VIT », le pool a déjà pu écarter les meilleures runes VIT au profit
// de runes globalement plus « pertinentes » pour d'autres critères. Le tri
// après coup (voir OptimizerSection.tsx) ne peut être honnête que si le pool
// pré-filtré garde une chance à chacun des 9 critères de tri proposés.
const PER_STAT_KEEP = 6;
// Budget élargi pour les stats de l'OBJECTIF choisi (voir OBJECTIVE_RELEVANT_
// STATS) : l'utilisateur a explicitement dit « je cherche des dégâts » (ou
// « des PV effectifs ») avant même de lancer la recherche — le pré-filtrage
// doit lui laisser une vraie chance d'en trouver, pas juste une place parmi
// six comme les autres stats.
const PER_STAT_KEEP_OBJECTIVE = 24;
// Combinaisons retenues PAR TRANCHE, DANS un compartiment (pas par slot,
// voir l'en-tête du fichier) — depuis la 3ᵉ recalibration ci-dessous, CHAQUE
// tranche (générique, combinée, une par stat de `retentionKeys`) reçoit ce
// nombre de places EN PROPRE (voir `buildBuckets`, `genericCap`), pas un
// total partagé divisé par le nombre de tranches. Borne la mémoire
// indépendamment de `slotFilterCap` : même à un pré-filtrage large, une
// tranche ne grossit jamais au-delà de ça.
// ⚠️ Historique des deux premiers calibrages, quand cette constante
// représentait encore un budget TOTAL partagé (pas un budget par tranche) :
// 600 → 5000 (×8,3, deck 10 Lushen, ATQ/Taux Crit/Dmg Crit : le demi-build
// réel avait besoin d'au moins ~2900-3000 places dans sa tranche la plus
// favorable) ; 5000 → 8000 (×1,6, Sonia deck 14, 4 minimums à la fois :
// besoin du rang #1212 sur sa meilleure tranche, mais 6 tranches à
// `bucketCap=5000` ÷ 6 ne lui laissaient que 833 places). Chaque fois,
// `DEFAULT_MAX_NODES` a dû être relevé DANS LA MÊME FOULÉE (voir son propre
// commentaire) : relever seulement ce plafond peut faire RECULER un résultat
// déjà trouvé (chaque paire de compartiments coûte plus cher à parcourir à
// `bucketCap` élevé, donc sans plus de budget de paires, la recherche épuise
// son budget sur MOINS de paires explorées, pas plus).
//
// ⚠️ **Partage à parts égales ABANDONNÉ après le second calibrage** :
// diviser le budget total par le nombre de tranches dilue CHAQUE tranche à
// mesure qu'on pose PLUS de conditions à la fois — un plafond qui recule
// structurellement, jamais « assez grand pour de bon » : même `bucketCap
// (total)=8000` échouait encore sur un cas synthétique à 8 conditions
// simultanées (vérifié directement, pas supposé). Passé à une réservation
// FIXE par tranche : la mémoire d'un compartiment grandit maintenant avec le
// nombre de conditions posées (logique, c'est justement là qu'il en faut le
// plus), sans jamais dégrader une tranche existante en ajoutant une autre.
// Recalibré à la baisse dans la foulée (8000 → 1500 PAR TRANCHE, pas un
// retour en arrière : la sémantique a changé) — mesuré sur les TROIS cas
// réels connus (rang le plus défavorable observé : #1212, Sonia deck 14) et
// sur un test de stress à 5 conditions simultanées inventé pour cette
// recalibration : les quatre retrouvent leur build exact, entre 35 et 107 s,
// toujours sous la barre des 2 minutes. `bucketCap (par tranche)=2000`
// testé aussi : plus de marge sur le rang, mais un compartiment plus gros
// épuise `maxNodes` sur MOINS de paires de compartiments explorées (même
// piège que d'habitude) — a fait RECULER deck 10 Lushen (retrouvé à 1500,
// plus retrouvé à 2000 avec le même `maxNodes`), écarté pour cette raison.
// ⚠️ Un cas encore plus extrême (8 conditions à la fois) échoue toujours,
// mais pour une raison DIFFÉRENTE et hors de portée de cette constante : une
// des runes réelles ne survit déjà plus à `filterSlot` (le pré-filtrage PAR
// SLOT, pas la rétention par compartiment) — dilution analogue, mais un
// autre étage du pipeline. Documenté comme limite connue plutôt que corrigé
// ici : demander 8 conditions à la fois est un usage extrême, jamais observé
// en pratique contrairement aux cas à 3-5 qui ont motivé cette recalibration.
//
// ⚠️ **Relevé une quatrième fois, 1500 → 3000, une fois l'escalade de budget
// de nœuds en place** (voir `adaptiveMaxNodes`/`NodeBudget` plus haut) —
// « Phase 0 » de spec/outils/optimizer/. Le rejet de `bucketCap=2000`
// ci-dessus supposait un budget de paires FIXE : un compartiment plus gros
// épuise ce budget sur MOINS de paires, faisant reculer un résultat déjà
// trouvé. Cette hypothèse ne tient plus depuis l'escalade — REMESURÉ sur
// TOUTE la batterie de cas réels connus (deck 10 ET deck 11 Lushen, Sonia
// deck 6, Sonia deck 14, Ciri défense équipe 3), aucune régression : chacun
// reste trouvé EXACTEMENT, en 1,7 s à 130 s selon le cas, largement sous les
// 10 minutes réelles de l'écran (`HARD_TIMEOUT_MS`). Et ça RÉSOUT le cas qui
// avait motivé cette relecture (Lushen deck 15 offense, `rage` demandé seul
// au lieu de `rage+blade` — voir « Limites connues » plus bas) : le
// demi-build cible, totalement absent à `bucketCap=1500`, redevient présent
// et trouvé à `bucketCap=3000`, exhaustivement, en 51,7 s (297M paires).
const BUCKET_CAP = 3000;

// ⚠️ **Dilution par `slotFilterCap`, découverte et mesurée cette session**
// (cas Sonia, Swift 4p, ATQ/VIT/TC/DCC demandés ensemble) : `BUCKET_CAP`
// était une constante FIXE, indépendante de `slotFilterCap` — chaque tranche
// de rétention reçoit `bucketCap` places EN PROPRE (voir son commentaire),
// mais le NOMBRE de demi-combos candidats qui se disputent ces places grandit
// avec `slotFilterCap` (pré-filtrage par slot plus large → triple boucle par
// moitié bien plus peuplée). Le budget FIXE peut alors perdre un demi-build
// déjà présent à un préréglage plus étroit — l'inverse de ce qu'élargir le
// pré-filtrage devrait faire.
//
// ⚠️ **Piège évité de justesse : `perf-battery.ts` (ses sept cas réels,
// TOUS à `slotFilterCap=80`) ne pouvait PAS détecter ce problème.** Il ne
// vérifie qu'une chose — « le build CIBLE connu est-il retrouvé ? » — jamais
// le NOMBRE de builds valides retenus. Une première version de ce correctif
// ancrait `bucketCapFor` pour reproduire EXACTEMENT 3000 à `slotFilterCap=
// 80`, en supposant (à tort) que « les 7 cas de perf-battery passent à
// bucketCap=3000/cap=80 » prouvait que ce point était sûr. Faux : sur le cas
// Sonia objectif Vitesse + piste B activée, `slotFilterCap=40` (Bas) trouve
// RÉELLEMENT 5 builds valides, mais `slotFilterCap=80` (Moyen) — MÊME
// `bucketCap=3000`, valeur INCHANGÉE entre les deux — n'en retient que 3 :
// 2 des 5 demi-builds (moitié A, slots 1-3) trouvés à Bas ne survivaient déjà
// plus à Moyen (runes toujours présentes dans le pool filtré — `filterSlot`
// est croissant, la perte est dans `buildBuckets`). La dilution touche donc
// DÉJÀ la plage 40→80, pas seulement au-delà de 80 comme le cas Dégâts
// (Moyen→Extrême) l'avait d'abord laissé croire.
//
// **Ancre corrigée : Bas (`slotFilterCap=40`), pas Moyen.** C'est le plus
// petit préréglage réel de l'écran — le seul point où `BUCKET_CAP=3000`
// reste validé par construction (rien de plus petit à comparer contre).
// Mesuré directement (cas Sonia réel) : `bucketCap=4000` est la première
// valeur testée qui retient les 5 demi-builds à `slotFilterCap=80` (3000
// n'en retient que 3, monotone croissant jusqu'à 10 000 testé).
//
// ⚠️ **Racine carrée ESSAYÉE D'ABORD, insuffisante — mesuré, pas supposé.**
// Ancrée à 40, elle donne `bucketCap(80)≈4243` (au-dessus du seuil mesuré,
// suffisant) mais `bucketCap(300)≈8216` à Extrême — revérifié sur le cas le
// plus exigeant (Vitesse+piste B, 5 demi-builds) : encore 2 PERTES sur les 5
// à ce niveau. `bucketCap=12 000` est la première valeur testée qui retient
// les 5/5 à Extrême. Passé à une échelle LINÉAIRE (ancrée à 40 elle aussi) :
// `bucketCap(300)=22 500`, confortablement au-dessus du seuil mesuré, avec
// un coût de construction du même ordre de grandeur que les valeurs
// testées entre 8 216 et 22 500 (30-44 s mesurés, pas de blowup) — plus
// simple à raisonner qu'un exposant ajusté au plus juste, cohérent avec
// « la plus petite formule SIMPLE qui ne perd rien », pas la plus petite
// valeur possible au chiffre près.
// Revérifié aux quatre préréglages, sur LES DEUX cas connus (Dégâts, 3
// demi-builds à Moyen ; Vitesse+piste B, 5 demi-builds à Bas) : aucune perte
// nulle part. `perf-battery.ts` (`slotFilterCap=80` fixe) change de résultat
// après ce correctif — ATTENDU : c'est justement la preuve que ce point
// n'était pas correctement calibré avant (il ne vérifie qu'un build CIBLE
// connu, jamais le NOMBRE de builds valides retenus — voir plus haut, et
// `--monotonicity` désormais disponible pour vérifier ça directement).
// ⚠️ À Extrême, `bucketCap=22 500` fait ATTEINDRE le filet de temps de 10
// min (`HARD_TIMEOUT_MS`) sur des cas volumineux — resserrer à une valeur
// juste suffisante (9000, mesurée) N'ÉVITE PAS la troncature (l'escalade
// consomme de toute façon tout le budget-temps disponible) et trouve
// MOINS de builds en prime — conservé tel quel après mesure, pas par
// défaut. Détails complets, y compris la piste « objectif de recherche
// mieux aligné » testée et écartée : spec/outils/optimizer/, section
// « BUCKET_CAP mis à l'échelle ». Script de calibration réutilisable :
// scripts/bucket-cap-scaling-diag.ts.
// ⚠️ Volontairement IDENTIQUE à `MAX_PER_SLOT_MATCH` — les deux dérivent du
// même préréglage « Bas » (slotFilterCap=40) : l'un est le plafond de
// rétention par défaut de `filterSlot`/le repli de `prepareSearch` quand
// `slotFilterCap` est omis, l'autre l'ancre de la mise à l'échelle de
// `bucketCap` — deux RÔLES distincts qui doivent rester la MÊME valeur
// (voir `bucketCapFor` juste en dessous : sa formule n'est correcte, au
// repli `slotCap = params.slotFilterCap ?? MAX_PER_SLOT_MATCH` de
// `prepareSearch`, QUE parce que les deux coïncident). Lié explicitement,
// pas dupliqué, pour ne plus pouvoir diverger silencieusement (CLAUDE.md :
// un concept partagé entre plusieurs endroits a plusieurs
// « constructeurs »).
const BUCKET_CAP_REFERENCE_SLOT_FILTER_CAP = MAX_PER_SLOT_MATCH;

function bucketCapFor(slotFilterCap: number): number {
  return Math.round(BUCKET_CAP * (slotFilterCap / BUCKET_CAP_REFERENCE_SLOT_FILTER_CAP));
}

const ALL_STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

/* --------------------------------------------------------------------------
 * Contribution d'une rune à une stat donnée (pct/flat), réutilisant la même
 * table que computeStats — mais rune par rune, pour l'accumulation
 * incrémentale du pré-filtrage et des bornes d'élagage.
 * ----------------------------------------------------------------------- */
export function runeContribution(rune: RuneDetail, key: StatKey): { pct: number; flat: number } {
  let pct = 0;
  let flat = 0;
  const add = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def || def.stat !== key) return;
    if (def.pct) pct += value;
    else flat += value;
  };
  add(rune.main.code, rune.main.value);
  if (rune.innate) add(rune.innate.code, rune.innate.value);
  for (const s of rune.subs) add(s.code, s.value);
  return { pct, flat };
}

// ⚠️ Même résultat que d'appeler `runeContribution(rune, k)` pour CHAQUE
// `k` de `ALL_STAT_KEYS`, mais en UN SEUL passage sur les effets de la
// rune (principale + innée + jusqu'à 4 sous-stats, ~6 lignes) au lieu de
// 8 — rescannait les mêmes ~6 lignes à chaque fois (~48 vérifications par
// rune au lieu de 6), exactement le motif déjà corrigé ailleurs pour la
// même raison (`precomputeSlot` dans `buildBuckets`, voir son commentaire).
// Deux appelants aujourd'hui, tous deux ont besoin des 8 clés À LA FOIS
// pour CHAQUE rune comparée dans une boucle O(n) ou O(n²) : `filterSlot`
// (top-K par stat) et `pruneDominated`/`isDominated` (élagage de
// dominance — précalculée une fois par rune, plutôt que rappelée à
// `runeContribution` pour CHAQUE paire comparée, voir son commentaire).
// Les AUTRES appelants de `runeContribution` (rétention par compartiment,
// `precomputeSlot`…) n'ont besoin que d'UNE clé à la fois, pas des 8 —
// eux restent sur `runeContribution` seule.
function runeContributionAllKeys(rune: RuneDetail): Record<StatKey, { pct: number; flat: number }> {
  const out = {} as Record<StatKey, { pct: number; flat: number }>;
  for (const k of ALL_STAT_KEYS) out[k] = { pct: 0, flat: 0 };
  const add = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def) return;
    const entry = out[def.stat as StatKey];
    if (!entry) return;
    if (def.pct) entry.pct += value;
    else entry.flat += value;
  };
  add(rune.main.code, rune.main.value);
  if (rune.innate) add(rune.innate.code, rune.innate.value);
  for (const s of rune.subs) add(s.code, s.value);
  return out;
}

// ⚠️ Comme `runeContribution`, mais SANS la principale — sous-stats et
// innée uniquement. Sert à la pondération adaptative des tranches de
// rétention (voir « Suite — point 4 » dans spec/outils/optimizer/, piste
// B) : la principale d'un slot est une valeur GARANTIE et relativement
// stable pour toute rune candidate de ce slot (surtout sur un slot à
// principale imposée — VIT slot 2, TC/DCC slot 4, RES/PRE slot 6) — elle
// NOIE la vraie dispersion (sous-stats, aléatoires) derrière une moyenne
// artificiellement stable. Une rune ne peut d'ailleurs JAMAIS avoir sa
// propre principale dupliquée en sous-stat (règle du jeu, voir la mémoire
// sw-rune-mainstat-rules) : sur un slot dont la principale EST la stat
// suivie, la contribution hors-principale est structurellement nulle —
// exactement le signal recherché (ce slot n'apporte rien à la VARIABILITÉ
// de cette stat, seulement un plancher fixe). Validé sur la piste A
// (conservée dans scripts/patches/piste-a-tranche-weighting.patch) avant
// d'être reprise ici.
function runeSubOnlyContribution(rune: RuneDetail, key: StatKey): { pct: number; flat: number } {
  let pct = 0;
  let flat = 0;
  const add = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def || def.stat !== key) return;
    if (def.pct) pct += value;
    else flat += value;
  };
  if (rune.innate) add(rune.innate.code, rune.innate.value);
  for (const s of rune.subs) add(s.code, s.value);
  return { pct, flat };
}

function valueOf(rune: RuneDetail, metric: OptimMetric): number {
  return metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
}

/* --------------------------------------------------------------------------
 * Pré-filtrage par slot
 * ----------------------------------------------------------------------- */
// ⚠️ Un `pct` et un `flat` de la MÊME stat ne sont PAS la même unité — un `%`
// s'applique à `base[key]` (PV/ATQ/DEF seulement, voir `RUNE_EFFECT`), un
// plat s'ajoute tel quel. Additionner `pct+flat` directement (ex. `pct=10,
// flat=0` traité comme égal à `pct=0,flat=10`) mélange deux échelles —
// mesuré : sur le pool réel d'un slot, jusqu'à ~47 % du top-40 par
// `relevance()` change entre l'ancien classement et celui-ci (Lushen deck 10,
// slot 2 — voir spec/outils/optimizer/historique-dimensionnement.md, « Suite
// — pct/flat pondérés par base »). Même principe que `totalOf` (résultat
// EXACT, avec le terme `base` additif en plus) et déjà appliqué par
// `isDominated` (comparaison composante par composante) — seul son propre
// commentaire n'avait pas essaimé jusqu'à `relevance`/`retentionScore`/
// `combinedRetentionScore`.
function weightedContribution(base: BaseStats, key: StatKey, pct: number, flat: number): number {
  const b = (base as unknown as Record<string, number>)[key] ?? 0;
  return key === 'hp' || key === 'atk' || key === 'def' ? Math.ceil((b * pct) / 100) + flat : flat;
}

// ⚠️ **Ne dépend JAMAIS de `objective`** — vérifié précisément cette session
// (voir spec/outils/optimizer/, « Piste écartée — un objectif de
// recherche mieux aligné… ») après avoir supposé le contraire par erreur.
// Ce classement (qui alimente `matches`/`fillCap` dans `filterSlot`, ET la
// rétention par tranche dans `buildBuckets`) n'est influencé QUE par
// `requirement.minStats` — jamais par l'objectif choisi à l'écran.
// L'objectif n'élargit QUE `PER_STAT_KEEP_OBJECTIVE` (voir `filterSlot`,
// `OBJECTIVE_RELEVANT_STATS`) : plus de runes CANDIDATES entrent dans le
// pool pré-filtré pour ses stats, mais leur CLASSEMENT une fois dedans reste
// entièrement gouverné par les minimums posés, pas par l'objectif. Un
// objectif « Dégâts » ne fait donc PAS que la recherche privilégie les
// demi-builds les plus offensifs pendant la rétention — seulement qu'elle
// leur garde une place plus large au pré-filtrage.
export function relevance(rune: RuneDetail, requirement: BuildRequirement, base: BaseStats): number {
  let score = 0;
  for (const [key, min] of Object.entries(requirement.minStats)) {
    if (min == null || min <= 0) continue;
    const c = runeContribution(rune, key as StatKey);
    score += weightedContribution(base, key as StatKey, c.pct, c.flat) / min;
  }
  // Tie-break générique : une rune globalement meilleure reste préférable
  // quand rien ne la distingue sur les stats demandées.
  score += runeEfficiency(rune) / 1000;
  return score;
}

// ⚠️ Au-delà de ce nombre de conditions (`minStats`) posées À LA FOIS,
// `matchCap`/`fillCap` sont ÉLARGIS — jamais réduits en dessous de ce que
// l'appelant a demandé. `relevance()` (juste au-dessus) SOMME une
// contribution normalisée par condition : une rune qui n'aide que sur UNE
// PARTIE des conditions (la norme — une rune n'a que 6 emplacements de
// contribution au total, jamais assez pour peser sur 7-8 stats à la fois)
// se classe d'autant plus mal sur ce score combiné qu'il y a de conditions
// en concurrence, même si elle reste indispensable au build final. Mesuré
// sur un vrai compte (Eivor Feu, 7 conditions à la fois — PV/ATQ/DEF/Vitesse/
// Taux Crit/Dmg Crit/RES) : une rune du set demandé, décente sur 3-4 stats
// mais nulle sur les autres, se classait #111 parmi seulement 183 candidates
// DU MÊME SET — hors de portée de `matchCap=80`. Jamais nécessaire en
// dessous de 5 conditions (vérifié sans régression jusqu'à 6, Sonia deck 14)
// — le seuil est choisi avec marge sous ce repère. Même principe que le
// budget par tranche de `buildBuckets` (voir son commentaire), un étage plus
// tôt dans le pipeline.
const FILTER_SLOT_WIDENING_THRESHOLD = 4;
const FILTER_SLOT_WIDENING_PER_CONDITION = 20;

export function filterSlot(
  candidates: RuneDetail[],
  requirement: BuildRequirement,
  base: BaseStats,
  matchCap = MAX_PER_SLOT_MATCH,
  fillCap = MAX_PER_SLOT_FILL,
  objective?: Objective,
  // ⚠️ Paramètre AJOUTÉ en fin de liste, jamais un changement de type de
  // `objective` : les ~7 scripts de diagnostic qui appellent cette fonction
  // vivent hors du périmètre de `tsconfig.json` — `tsc --noEmit` ne verrait
  // pas leur rupture (incident déjà vécu deux fois, voir
  // spec/outils/optimizer/). Omis = comportement strictement inchangé.
  objectiveStats?: StatKey[]
): RuneDetail[] {
  const requiredKeys = new Set(requirement.sets);
  // ⚠️ Élagage SÛR, pas une heuristique : combo à coût COMPLET
  // (`setsCost(requirement.sets) === MAX_SET_PIECES`, ex. Rage+Blade
  // 4+2=6) → AUCUN emplacement libre où une rune hors combo (ni un set
  // demandé, ni joker) pourrait légitimement figurer dans un build FINAL
  // valide. Preuve : les 6 emplacements se répartissent alors
  // EXACTEMENT entre les sets demandés (un joker substituant au plus UNE
  // pièce, où qu'il soit) — une seule rune hors combo parmi les 6 choisis
  // prive nécessairement l'un des sets demandés d'au moins une pièce,
  // laissant `missingSets` non vide quel que soit le reste du build.
  // Trouvé en vérifiant explicitement (script ad hoc, pool synthétique
  // varié) : pour Rage+Blade, environ la MOITIÉ du pool filtré par slot
  // appartenait à des sets totalement hors combo AVANT ce correctif —
  // occupant une place dans `matchCap`/`fillCap`/le top-K par stat qui
  // aurait pu revenir à une rune réellement utile (dilution, même classe
  // de problème que `BUCKET_CAP`/`slotFilterCap` cette session).
  // ⚠️ SANS EFFET s'il reste un emplacement libre (ex. un set 4 pièces
  // SEUL) : la réserve garantie hors combo plus bas reste alors
  // nécessaire — voir son propre commentaire, motif ORIGINAL de son
  // ajout, qui ne s'applique qu'à ce cas-là.
  const hasFreeSlots = setsCost(requirement.sets) < MAX_SET_PIECES;
  const isRelevantToCombo = (r: RuneDetail): boolean => requiredKeys.has(r.set) || r.set === 'intangible';
  const pool = hasFreeSlots ? candidates : candidates.filter(isRelevantToCombo);
  const scored = pool
    .map((r) => ({ r, s: relevance(r, requirement, base) }))
    .sort((a, b) => b.s - a.s);

  const conditionCount = Object.values(requirement.minStats).filter((v) => v != null && v > 0).length;
  const extraCap = Math.max(0, conditionCount - FILTER_SLOT_WIDENING_THRESHOLD) * FILTER_SLOT_WIDENING_PER_CONDITION;
  const effectiveMatchCap = matchCap + extraCap;
  const effectiveFillCap = fillCap + extraCap;

  const kept = new Map<number, RuneDetail>();

  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  for (const { r } of matches.slice(0, effectiveMatchCap)) kept.set(r.id, r);
  for (const { r } of scored.slice(0, effectiveFillCap)) kept.set(r.id, r);

  // ⚠️ Réserve GARANTIE de runes HORS du set demandé, symétrique de `matches`.
  // Sans elle : quand les meilleures runes toutes provenances du joueur sont
  // justement du set demandé (courant — c'est souvent LE set qu'il a
  // optimisé), `matches` ET `scored.slice(fillCap)` se recouvrent presque
  // entièrement, et aucune alternative d'un AUTRE set n'a jamais sa propre
  // place garantie — la recherche ne peut alors proposer que des builds
  // tout-un-set, même quand le combo demandé n'en réclame qu'une partie des
  // pièces (ex. un set 4 pièces sur 6 emplacements). Signalé sur un compte
  // réel (voir spec/outils/optimizer/, « Limites connues »).
  // ⚠️ Motif ci-dessus SANS OBJET à coût complet (`!hasFreeSlots`) : `pool`
  // a déjà exclu toute rune hors combo plus haut, `offSet` est alors
  // structurellement vide — pas une branche morte à retirer, juste un
  // no-op cohérent avec l'élagage déjà appliqué en amont.
  const offSet = scored.filter(({ r }) => !requiredKeys.has(r.set) && r.set !== 'intangible');
  for (const { r } of offSet.slice(0, effectiveFillCap)) kept.set(r.id, r);

  // Le meilleur d'un slot sur chaque stat individuellement — voir
  // PER_STAT_KEEP. Budget élargi (PER_STAT_KEEP_OBJECTIVE) pour les stats de
  // l'objectif choisi, s'il y en a un.
  // ⚠️ Top-K via le tas borné (`heapPush`, déjà utilisé pour la rétention par
  // compartiment dans `buildBuckets`) au lieu d'un tri complet de tout
  // `candidates` suivi d'un `.slice()` — même sémantique top-K (les `keepN`
  // plus grandes valeurs de `weightedContribution(base, k, c[k].pct, c[k].flat)` sont gardées), coût ramené de
  // O(n log n) à O(n log keepN) par stat, `keepN` (6 ou 24) restant petit
  // devant `n` (jusqu'à plusieurs milliers de runes par slot sur un gros
  // compte). Un seul passage sur `candidates` par stat, aucun tableau
  // intermédiaire trié. Voir spec/outils/optimizer/, piste « point 2 —
  // filterSlot : top-K via le tas ».
  // ⚠️ Contribution des 8 clés précalculée UNE FOIS par rune
  // (`runeContributionAllKeys`), pas rappelée 8× via `runeContribution` —
  // voir son commentaire pour le motif (même bug que `precomputeSlot`
  // ailleurs dans ce fichier, jamais corrigé ici avant).
  const objectiveKeys = objectiveKeysOf(objective, objectiveStats);
  const contribByRune = pool.map((r) => ({ r, c: runeContributionAllKeys(r) }));
  for (const k of ALL_STAT_KEYS) {
    const keepN = objectiveKeys.includes(k) ? PER_STAT_KEEP_OBJECTIVE : PER_STAT_KEEP;
    const heap: ScoredEntry<RuneDetail>[] = [];
    for (const { r, c } of contribByRune) {
      heapPush(heap, { item: r, score: weightedContribution(base, k, c[k].pct, c[k].flat) }, keepN);
    }
    for (const { item } of heap) kept.set(item.id, item);
  }

  return Array.from(kept.values());
}

/* --------------------------------------------------------------------------
 * Élagage SÛR n°1 — DOMINANCE. Une rune strictement moins bonne qu'une autre
 * du même slot ne sert jamais à rien : si B égale ou dépasse A sur pct ET
 * flat de CHAQUE stat, avec un avantage strict quelque part (ou une valeur
 * identique en tout point, départagée par l'id pour ne garder qu'un seul
 * exemplaire), alors tout build valide utilisant A resterait valide — et au
 * moins aussi bon — en remplaçant A par B. C'est vrai pour n'importe quel
 * critère de tri après coup, puisqu'aucune stat ne recule.
 * ----------------------------------------------------------------------- */

// ⚠️ Comparer deux runes de sets DIFFÉRENTS n'est sûr que si leur set est
// ÉQUIVALENT du point de vue de la satisfaction du combo demandé — sinon une
// rune moins bonne en stats brutes mais seule à apporter une pièce de set
// manquante serait écartée à tort. Deux cas sûrs : même set (interchangeables
// pièce pour pièce, y compris deux jokers) ; ou aucun des deux sets ne compte
// pour le combo demandé (ni l'un ni l'autre n'apporte de pièce, donc le set
// n'entre pas en ligne de compte).
function isSetIrrelevant(setKey: string, requiredKeys: Set<string>): boolean {
  return setKey !== 'intangible' && !requiredKeys.has(setKey);
}
function isSetComparable(a: RuneDetail, b: RuneDetail, requiredKeys: Set<string>): boolean {
  if (a.set === b.set) return true;
  return isSetIrrelevant(a.set, requiredKeys) && isSetIrrelevant(b.set, requiredKeys);
}

// ⚠️ **Un maximum INVERSE le sens de « mieux ».** Sur une stat SANS plafond,
// plus est toujours sans risque : B qui égale ou dépasse A partout domine A.
// Mais sur une stat PLAFONNÉE (`maxKeys`), plus peut faire DÉPASSER le
// maximum — une rune qui en apporte davantage n'est pas « au moins aussi
// bonne », elle est plus dangereuse. Sur ces stats-là, seule l'ÉGALITÉ
// stricte (ni plus, ni moins) reste sûre à comparer : on ne sait pas, sans
// connaître le reste du build, si « plus » ou « moins » serait le bon choix.
function isDominated(
  a: RuneDetail,
  b: RuneDetail,
  requiredKeys: Set<string>,
  maxKeys: Set<StatKey>,
  contribById: Map<number, Record<StatKey, { pct: number; flat: number }>>
): boolean {
  if (a.id === b.id || !isSetComparable(a, b, requiredKeys)) return false;
  const contribA = contribById.get(a.id)!;
  const contribB = contribById.get(b.id)!;
  let strictlyBetter = false;
  for (const k of ALL_STAT_KEYS) {
    const ca = contribA[k];
    const cb = contribB[k];
    if (maxKeys.has(k)) {
      // Stat plafonnée : seule l'égalité est sûre dans les deux sens.
      if (cb.pct !== ca.pct || cb.flat !== ca.flat) return false;
    } else {
      // pct et flat comparés SÉPARÉMENT : additionner les deux avant de
      // comparer mélangerait deux échelles différentes (un pct s'applique à
      // la base, un flat s'ajoute tel quel) — voir `totalOf`.
      if (cb.pct < ca.pct || cb.flat < ca.flat) return false;
      if (cb.pct > ca.pct || cb.flat > ca.flat) strictlyBetter = true;
    }
  }
  const effA = runeEfficiency(a);
  const effB = runeEfficiency(b);
  if (effB < effA) return false;
  if (effB > effA) strictlyBetter = true;
  // Égalité totale (clone exact niveau stats) : un seul exemplaire retenu,
  // celui du plus petit id — repère arbitraire mais déterministe, sinon A et
  // B se domineraient mutuellement et disparaîtraient tous les deux.
  return strictlyBetter || b.id < a.id;
}

// Garde-fou de performance : la comparaison est O(n²) — négligeable sur les
// tailles réelles d'un slot (quelques centaines à ~1000 runes, voir
// spec/outils/optimizer/), mais sans borne un pool démesuré (« Explorer
// tout l'inventaire » sur un très gros compte) pourrait coûter cher pour un
// gain marginal. Au-delà, on renonce à cet élagage plutôt que de ralentir.
const DOMINANCE_MAX_POOL = 2000;

// ⚠️ `runeContributionAllKeys` précalculée UNE FOIS par rune (O(n)) avant la
// double boucle O(n²) — pas rappelée via `runeContribution` à CHAQUE paire
// comparée (16 appels/paire : 8 clés × 2 runes). Même motif que
// `filterSlot`/`precomputeSlot` ailleurs dans ce fichier, jusqu'ici oublié
// ici — trouvé par une revue de code externe (2026-08-19, point 3) : ce
// coût est payé À CHAQUE fois que `prepareSearch` tourne, y compris une
// fois PAR WORKER en pairing parallèle (jusqu'à 4×, voir
// `pairSlice.worker.ts`).
export function pruneDominated(list: RuneDetail[], requiredKeys: Set<string>, maxKeys: Set<StatKey>): RuneDetail[] {
  if (list.length > DOMINANCE_MAX_POOL) return list;
  const contribById = new Map<number, Record<StatKey, { pct: number; flat: number }>>();
  for (const r of list) contribById.set(r.id, runeContributionAllKeys(r));
  return list.filter((a) => !list.some((b) => isDominated(a, b, requiredKeys, maxKeys, contribById)));
}

/* --------------------------------------------------------------------------
 * Élagage SÛR n°2 — FAISABILITÉ. Une rune ne peut jamais entrer dans un
 * build valide si, même dans le MEILLEUR des cas pour les 5 autres
 * emplacements (le meilleur trouvé dans le pool RÉELLEMENT possédé de chaque
 * autre emplacement, pas une borne théorique du jeu), un minimum demandé
 * reste hors de portée — ou si elle dépasse déjà, À ELLE SEULE, un maximum
 * demandé (les autres emplacements ne peuvent qu'AJOUTER, jamais retirer).
 * Symétrique de l'élagage déjà appliqué au niveau des PAIRES de compartiments
 * (`pairFeasibleMin` / le repli MAXIMUM dans `searchBuildsSteps`), mais bien
 * plus tôt : par rune, avant même le pré-filtrage heuristique — l'exemple
 * qui a motivé cet ajout : une rune dont le VIT ne peut mathématiquement pas,
 * même complétée par les 5 meilleures runes VIT du reste du compte, atteindre
 * le minimum de vitesse demandé.
 * ----------------------------------------------------------------------- */
export function computeSlotMaxBounds(
  bySlot: RuneDetail[][],
  keys: StatKey[]
): Record<string, { pct: number; flat: number }>[] {
  return bySlot.map((list) => {
    const out: Record<string, { pct: number; flat: number }> = {};
    for (const k of keys) {
      let pct = 0;
      let flat = 0;
      for (const r of list) {
        const c = runeContribution(r, k);
        if (c.pct > pct) pct = c.pct;
        if (c.flat > flat) flat = c.flat;
      }
      out[k] = { pct, flat };
    }
    return out;
  });
}

export function eliminateInfeasible(
  bySlot: RuneDetail[][],
  minEntries: { k: StatKey; min: number }[],
  maxEntries: { k: StatKey; max: number }[],
  constrainedKeys: StatKey[],
  guaranteed: { pct: Record<string, number>; flat: Record<string, number> },
  artFlat: Record<string, number>,
  relPct: Record<string, number>,
  totalOf: (k: StatKey, pct: number, flat: number) => number,
  // ⚠️ Réservé aux vérifications de MINIMUM (`bestPct`/`bestFlat` plus bas) —
  // `guaranteed` seul reste utilisé pour les maximums (`worstPct`/
  // `worstFlat`), voir `additionalSetActivationHeadroom`. Par défaut = `guaranteed`
  // (comportement inchangé) pour les quelques appelants qui n'ont pas encore
  // ce contexte (scripts de mesure).
  guaranteedMin: { pct: Record<string, number>; flat: Record<string, number> } = guaranteed
): RuneDetail[][] {
  if (minEntries.length === 0 && maxEntries.length === 0) return bySlot;

  // Borne SÛRE par slot : le meilleur trouvé dans le pool réellement possédé
  // de CE slot, jamais une borne théorique du jeu — plus étroite, donc plus
  // efficace, et tout aussi sûre : aucun rune de ce slot ne dépasse jamais ce
  // maximum, par construction (c'est le max OBSERVÉ, pas estimé).
  const slotMax = computeSlotMaxBounds(bySlot, constrainedKeys);
  const totalMaxPct: Record<string, number> = {};
  const totalMaxFlat: Record<string, number> = {};
  for (const k of constrainedKeys) {
    totalMaxPct[k] = slotMax.reduce((s, b) => s + (b[k]?.pct ?? 0), 0);
    totalMaxFlat[k] = slotMax.reduce((s, b) => s + (b[k]?.flat ?? 0), 0);
  }

  return bySlot.map((list, i) =>
    list.filter((r) => {
      for (const { k, min } of minEntries) {
        const c = runeContribution(r, k);
        // Les 5 AUTRES emplacements à leur propre maximum observé — celui de
        // CE slot est exclu du total (r le remplace).
        const otherPct = totalMaxPct[k] - (slotMax[i][k]?.pct ?? 0);
        const otherFlat = totalMaxFlat[k] - (slotMax[i][k]?.flat ?? 0);
        const bestPct = c.pct + otherPct + (guaranteedMin.pct[k] ?? 0) + (relPct[k] ?? 0);
        const bestFlat = c.flat + otherFlat + (guaranteedMin.flat[k] ?? 0) + (artFlat[k] ?? 0);
        if (totalOf(k, bestPct, bestFlat) < min) return false;
      }
      for (const { k, max } of maxEntries) {
        const c = runeContribution(r, k);
        // Pire cas pour un MAXIMUM : les autres emplacements à zéro (toujours
        // atteignable — rien n'oblige un slot à contribuer à cette stat).
        const worstPct = c.pct + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
        const worstFlat = c.flat + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
        if (totalOf(k, worstPct, worstFlat) > max) return false;
      }
      return true;
    })
  );
}

/* --------------------------------------------------------------------------
 * Bonus de set GARANTI par le combo demandé (il sera actif dans tout build
 * valide, puisqu'un build valide satisfait `requirement.sets` par
 * construction) — ajouté une fois comme base des accumulateurs.
 * ----------------------------------------------------------------------- */
export function guaranteedSetBonus(requirement: BuildRequirement, base: BaseStats): { pct: Record<string, number>; flat: Record<string, number> } {
  const pct: Record<string, number> = {};
  const flat: Record<string, number> = {};
  for (const key of requirement.sets) {
    const bonus = SET_STAT_BONUS[key];
    if (!bonus) continue;
    if (bonus.pct != null) {
      if (bonus.stat === 'hp' || bonus.stat === 'atk' || bonus.stat === 'def') {
        pct[bonus.stat] = (pct[bonus.stat] ?? 0) + bonus.pct;
      } else {
        const baseVal = (base as unknown as Record<string, number>)[bonus.stat] ?? 0;
        flat[bonus.stat] = (flat[bonus.stat] ?? 0) + Math.ceil((baseVal * bonus.pct) / 100);
      }
    } else if (bonus.flat != null) {
      flat[bonus.stat] = (flat[bonus.stat] ?? 0) + bonus.flat;
    }
  }
  return { pct, flat };
}

/* --------------------------------------------------------------------------
 * Bonus de set NON demandé, potentiellement en PLUS de `guaranteedSetBonus`
 * — voir spec/outils/optimizer/, « Limites connues ». `guaranteedSetBonus`
 * ne compte QUE les sets de `requirement.sets` ; un set À BONUS DE STAT
 * (`SET_STAT_BONUS`) peut s'activer PAR ACCIDENT sur les emplacements
 * « libres » (ceux que le combo demandé ne réserve pas), et ce bonus est
 * bien réel dans le build final — `computeStats`/`activeSets` ne
 * distinguent JAMAIS un set « demandé » d'un set « accidentel ».
 * ----------------------------------------------------------------------- */

// Borne SÛRE mais délibérément GROSSIÈRE, réservée aux vérifications de
// MINIMUM UNIQUEMENT — jamais de maximum : un bonus qui POURRAIT s'activer
// ne DOIT pas s'activer (un build peut toujours écarter les runes du set en
// question), l'inverse exact du raisonnement pour un minimum, où seul le
// MEILLEUR cas compte. Compte GLOBALEMENT, tous emplacements confondus, sans
// tenir compte de la répartition réelle par emplacement ni des runes déjà
// retenues pour le combo demandé : peut donc estimer un bonus qui ne serait
// pas RÉELLEMENT atteignable pour une paire de demi-builds précise — c'est
// délibéré (même philosophie que `diagnoseFeasibility` : « une borne
// optimiste par stat isolée, jamais une preuve de faisabilité conjointe »),
// la revérification via `computeStats` en aval reste la SEULE décision
// finale. Ne DOIT en revanche jamais SOUS-estimer ce qui est possible : la
// raison d'être de cette fonction, voir « Limites connues ».
// ⚠️ Suite — généralisée aux sets DÉJÀ demandés qui pourraient s'activer
// PLUS de fois que le minimum demandé, pas seulement aux sets absents de
// `requirement.sets` — voir spec/outils/optimizer/, cas réel Ciri (Energy
// demandé UNE fois = 1 activation garantie par `guaranteedSetBonus`, mais le
// pool permet une SECONDE activation d'Energy sur les emplacements
// « libres » : `guaranteed` seul ne créditait que +15 % PV, la moitié du
// vrai bonus — `activeSets` sur le build réel donnait bien `energy+shield+
// energy`, deux activations). La MÊME formule couvre les deux cas : un set
// NON demandé a 0 pièce déjà réservée par `guaranteedSetBonus` (comportement
// inchangé, ancien nom `unrequestedSetBonusHeadroom`) ; un set DÉJÀ demandé
// `n` fois a `n × setPieces(set)` pièces déjà réservées — seul le SURPLUS de
// pièces disponibles AU-DELÀ de cette réserve compte comme headroom
// supplémentaire ici.
export function additionalSetActivationHeadroom(
  pool: RuneDetail[],
  requirement: BuildRequirement,
  base: BaseStats
): { pct: Record<string, number>; flat: Record<string, number> } {
  const pct: Record<string, number> = {};
  const flat: Record<string, number> = {};
  const freeSlots = MAX_SET_PIECES - setsCost(requirement.sets);
  if (freeSlots <= 0) return { pct, flat };
  const requestedOccurrences = new Map<string, number>();
  for (const key of requirement.sets) requestedOccurrences.set(key, (requestedOccurrences.get(key) ?? 0) + 1);
  const counts = new Map<string, number>();
  for (const r of pool) counts.set(r.set, (counts.get(r.set) ?? 0) + 1);
  for (const [setKey, bonus] of Object.entries(SET_STAT_BONUS)) {
    const pieces = setPieces(setKey);
    if (pieces > freeSlots) continue;
    // Pièces déjà « dépensées » par les activations GARANTIES de ce set
    // (0 si le set n'est pas demandé du tout) — seul ce qui reste au-delà,
    // dans le pool réel, peut fournir une activation SUPPLÉMENTAIRE.
    const alreadyReserved = (requestedOccurrences.get(setKey) ?? 0) * pieces;
    // ⚠️ `Math.min(available, freeSlots)` : le pool peut posséder BEAUCOUP
    // plus de runes de ce set (au-delà de la réserve garantie) que
    // d'emplacements libres pour les accueillir — sans ce plafond, une
    // seule activation possible se compterait comme plusieurs (ex. 8 runes
    // Blade en surplus dans le pool, mais seulement 2 emplacements libres :
    // 1 activation possible, pas 4).
    const available = (counts.get(setKey) ?? 0) - alreadyReserved;
    if (available <= 0) continue;
    const activations = Math.floor(Math.min(available, freeSlots) / pieces);
    if (activations <= 0) continue;
    if (bonus.pct != null) {
      if (bonus.stat === 'hp' || bonus.stat === 'atk' || bonus.stat === 'def') {
        pct[bonus.stat] = (pct[bonus.stat] ?? 0) + bonus.pct * activations;
      } else {
        const baseVal = (base as unknown as Record<string, number>)[bonus.stat] ?? 0;
        flat[bonus.stat] = (flat[bonus.stat] ?? 0) + Math.ceil((baseVal * bonus.pct) / 100) * activations;
      }
    } else if (bonus.flat != null) {
      flat[bonus.stat] = (flat[bonus.stat] ?? 0) + bonus.flat * activations;
    }
  }
  return { pct, flat };
}

function mergeBonus(
  a: { pct: Record<string, number>; flat: Record<string, number> },
  b: { pct: Record<string, number>; flat: Record<string, number> }
): { pct: Record<string, number>; flat: Record<string, number> } {
  const pct: Record<string, number> = { ...a.pct };
  const flat: Record<string, number> = { ...a.flat };
  for (const k of Object.keys(b.pct)) pct[k] = (pct[k] ?? 0) + b.pct[k];
  for (const k of Object.keys(b.flat)) flat[k] = (flat[k] ?? 0) + b.flat[k];
  return { pct, flat };
}

export function artifactFlatBonus(artifacts: ArtifactDetail[]): Record<string, number> {
  const flat: Record<string, number> = {};
  // Les artéfacts utilisent des codes distincts (100/101/102) : PV/ATQ/DEF plats.
  for (const a of artifacts) {
    if (a.main.code === 100) flat.hp = (flat.hp ?? 0) + a.main.value;
    else if (a.main.code === 101) flat.atk = (flat.atk ?? 0) + a.main.value;
    else if (a.main.code === 102) flat.def = (flat.def ?? 0) + a.main.value;
  }
  return flat;
}

export function relicPctBonus(relic?: RelicDetail): Record<string, number> {
  const pct: Record<string, number> = {};
  if (!relic) return pct;
  // 100 PV% / 101 ATQ% / 102 DEF%
  if (relic.main.code === 100) pct.hp = (pct.hp ?? 0) + relic.main.value;
  else if (relic.main.code === 101) pct.atk = (pct.atk ?? 0) + relic.main.value;
  else if (relic.main.code === 102) pct.def = (pct.def ?? 0) + relic.main.value;
  return pct;
}

/* --------------------------------------------------------------------------
 * Meet-in-the-middle : moitiés de 3 slots, compartiments EN FLUX
 * ----------------------------------------------------------------------- */

export interface HalfCombo {
  runes: [RuneDetail, RuneDetail, RuneDetail];
  counts: number[]; // aligné sur `distinctKeys` : nb de pièces de chaque set demandé
  jokers: number; // nb de runes Intangible dans cette moitié
  // Contribution cumulée, par stat CONTRAINTE (min OU max) OU utile à la
  // rétention (`retentionKeys` — voir buildBuckets) — l'union des deux, pas
  // seulement les stats contraintes.
  pct: Record<string, number>;
  flat: Record<string, number>;
  relevanceScore: number; // efficience agrégée des 3 runes — UN critère de tri parmi d'autres, voir buildBuckets
}

export interface Bucket {
  counts: number[];
  jokers: number;
  combos: HalfCombo[]; // fusion dédupliquée des tranches de rétention, triée par potentiel NORMALISÉ décroissant (toutes tranches confondues, pas seulement relevanceScore — voir buildBuckets)
  maxPct: Record<string, number>; // borne SÛRE (jamais sous-estimée) par stat contrainte
  maxFlat: Record<string, number>;
  // PROTOTYPE (ordre d'appariement) — le score « potentiel normalisé » déjà
  // calculé par buildBuckets pour trier les compartiments entre eux (Étape
  // « ordonnancement conscient des tranches »), conservé ici au lieu d'être
  // jeté après le tri — sert à pairBuckets pour explorer les paires de
  // compartiments par potentiel combiné décroissant plutôt qu'en boucle
  // imbriquée séquentielle. Toujours défini (jamais optionnel) : calculé pour
  // CHAQUE compartiment avant le tri final, quel que soit combosOrderMode.
  potential: number;
  // ⚠️ PROTOTYPE EN MESURE, absent (`undefined`) sauf si `buildBuckets` reçoit
  // `skylineKeys` — voir son commentaire. La frontière de Pareto EXACTE de ce
  // compartiment sur `skylineKeys` (voir `insertIntoSkyline`), calculée EN
  // PLUS des tranches habituelles, jamais à leur place : `combos` reste
  // inchangé, ceci n'est qu'une mesure pour l'instant.
  skyline?: HalfCombo[];
}

function bucketKeyOf(counts: number[], jokers: number): string {
  return `${counts.join(',')}|${jokers}`;
}

// ⚠️ PROTOTYPE EN MESURE — voir spec/outils/optimizer/, « Suite —
// dominance de demi-builds (skyline) ». Dominance de DEMI-BUILDS (3 runes),
// un cran au-dessus de la dominance de runes individuelles (`isDominated`
// plus haut). Même principe, même sûreté : A est dominé par B si B est AU
// MOINS aussi bon que A sur CHAQUE dimension suivie (`keys`), pct et flat
// comparés SÉPARÉMENT — jamais combinés en un seul score (mélanger les deux
// échelles serait faux pour un total réel, voir `totalOf` — même piège que
// `isDominated`) — avec un avantage strict quelque part. Un demi-build
// dominé ne sert JAMAIS à rien POUR CES DIMENSIONS : tout appariement
// utilisant A resterait valide, et au moins aussi bon sur elles, en
// remplaçant A par B — une PREUVE, pas une heuristique de plus. ⚠️ Ne couvre
// QUE `keys` (pensé pour `retentionKeys`, JAMAIS les maximums — même raison
// que le reste de `buildBuckets` : sur une stat plafonnée, « plus » n'est
// pas sûrement « mieux ») : ne dit rien de `relevanceScore` ni des stats
// hors `keys`, laissées à la tranche générique existante — cette fonction
// ne remplace PAS les tranches actuelles, elle est un filet
// COMPLÉMENTAIRE en cours d'évaluation.
export function dominatesHalfCombo(a: HalfCombo, b: HalfCombo, keys: StatKey[]): boolean {
  let strictlyBetter = false;
  for (const k of keys) {
    const ap = a.pct[k] ?? 0;
    const af = a.flat[k] ?? 0;
    const bp = b.pct[k] ?? 0;
    const bf = b.flat[k] ?? 0;
    if (bp < ap || bf < af) return false;
    if (bp > ap || bf > af) strictlyBetter = true;
  }
  return strictlyBetter;
}

// Insertion incrémentale dans une frontière de Pareto (« skyline »), EN
// FLUX comme le reste de `buildBuckets` — jamais un recalcul global après
// coup. Ajoute `combo` seulement s'il n'est dominé par AUCUN membre déjà
// présent, puis retire tout membre existant que `combo` domine à son tour
// (un nouvel arrivant peut rendre obsolètes plusieurs anciens membres à la
// fois). ⚠️ Coût par insertion : O(taille de la skyline courante × |keys|)
// — SANS BORNE fixe (contrairement à `heapPush`) : c'est délibéré, la
// skyline est exacte par construction, pas un compromis mémoire/qualité.
// Voir `scripts/monster-search-skyline-diag.ts` pour la taille RÉELLEMENT
// observée sur des comptes réels avant d'en faire une dépendance de la
// recherche de production — une skyline qui grossirait sans borne sur des
// cas à beaucoup de dimensions (`retentionKeys` nombreux) coûterait cher
// pour un bénéfice à vérifier, pas à supposer.
export function insertIntoSkyline(skyline: HalfCombo[], combo: HalfCombo, keys: StatKey[]): void {
  for (const existing of skyline) {
    if (dominatesHalfCombo(combo, existing, keys)) return;
  }
  for (let i = skyline.length - 1; i >= 0; i--) {
    if (dominatesHalfCombo(skyline[i], combo, keys)) skyline.splice(i, 1);
  }
  skyline.push(combo);
}

// Une entrée de tas : l'élément gardé, et le SCORE selon lequel CE tas
// précis trie — un même demi-build peut être poussé dans plusieurs tas avec
// des scores différents (voir « Rétention par tranches » plus bas), sans
// dupliquer ni muter l'objet `HalfCombo` lui-même.
// ⚠️ Exporté UNIQUEMENT pour que les tests différentiels (voir
// rune-optim-filterslot-topk.test.ts) puissent appeler `heapPush` RÉELLEMENT
// utilisé par `filterSlot`/`buildBuckets`, plutôt qu'une réimplémentation
// locale qui ne détecterait jamais une régression du vrai code (incident
// vécu : voir historique-dimensionnement.md, « revue de code externe »).
export interface ScoredEntry<T> {
  item: T;
  score: number;
}

// Insertion bornée dans un TAS BINAIRE MIN (par `score`) : ce qui ne rentre
// plus est jeté IMMÉDIATEMENT, jamais accumulé puis élagué après coup —
// c'est ce qui borne la mémoire, pas seulement le temps. Repli rapide (O(1))
// pour l'écrasante majorité des entrées une fois le tas plein : elles ne
// battent pas la pire déjà gardée (la racine du tas), donc un seul test
// suffit à les écarter.
//
// ⚠️ Remplace une ancienne version à liste triée (`splice`), en O(taille) par
// insertion — mesuré comme un vrai goulot à capacité élevée (voir
// scripts/benchmark-bucket-retention.ts) : un tas à capacité fixe ramène
// chaque insertion/éviction à O(log cap). ⚠️ Le tas n'est PAS trié pendant la
// construction — le tri final se fait une seule fois, après coup (voir
// `buildBuckets`), pour ne jamais payer un tri à chaque insertion.
export function heapPush<T>(heap: ScoredEntry<T>[], entry: ScoredEntry<T>, cap: number): void {
  if (heap.length < cap) {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].score <= heap[i].score) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
    return;
  }
  if (heap.length === 0 || entry.score <= heap[0].score) return;
  heap[0] = entry;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    let smallest = i;
    if (l < heap.length && heap[l].score < heap[smallest].score) smallest = l;
    if (r < heap.length && heap[r].score < heap[smallest].score) smallest = r;
    if (smallest === i) break;
    [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
    i = smallest;
  }
}

/* --------------------------------------------------------------------------
 * Élagage SÛR n°3 — FAISABILITÉ DE SET, précoce (pendant la génération d'une
 * moitié, pas seulement à l'appariement des compartiments — voir
 * `satisfiesSets` plus haut, qui ne voit que des comptes déjà agrégés).
 * ----------------------------------------------------------------------- */

// Pour chaque set demandé, le nombre de slots (parmi `slotIdxs`) dont le pool
// contient AU MOINS une rune de ce set — borne SÛRE (jamais sous-estimée) du
// nombre de pièces que ces emplacements peuvent au mieux apporter : un slot
// ne fournit jamais plus d'UNE rune, donc « en avoir au moins une » suffit à
// compter 1, quel que soit le nombre réel de candidats de ce set dans ce
// slot. Même principe que `computeSlotMaxBounds` pour les stats, appliqué
// aux comptes de sets.
export function maxSetCountsForSlots(filtered: RuneDetail[][], slotIdxs: readonly number[], distinctKeys: string[]): number[] {
  return distinctKeys.map((key) => slotIdxs.reduce((n, i) => n + (filtered[i].some((r) => r.set === key) ? 1 : 0), 0));
}

// ⚠️ Crédit de joker VOLONTAIREMENT généreux (0 ou 1, jamais plus précis) :
// pas de tentative de savoir SI ce joker aiderait réellement ce set précis
// (ça dépend de combien d'AUTRES sets sont incomplets par ailleurs — voir la
// règle du jeu dans effects.ts, `activeSets`) — seulement s'il existe AU
// MOINS une rune Intangible n'importe où dans le pool filtré. Accordé À
// CHAQUE set indépendamment dans le test ci-dessous, ce qui est plus généreux
// que la réalité (un seul joker ne peut jamais aider deux sets à la fois) —
// mais c'est précisément ce qui rend l'élagage SÛR : plus généreux que la
// réalité ne peut jamais écarter à tort une combinaison réellement valide,
// seulement échouer à couper une branche qui, elle, s'avérera infaisable un
// peu plus tard (à la vérification réelle sur les runes, voir `activeSets`
// dans searchBuildsSteps). Même principe de sûreté que `satisfiesSets`.
export function anyJokerAvailable(filtered: RuneDetail[][]): boolean {
  return filtered.some((slot) => slot.some((r) => r.set === 'intangible'));
}

// Construit les compartiments d'une moitié EN FLUX : chaque combinaison
// (r0,r1,r2) est évaluée une fois, jamais matérialisée dans un tableau
// intermédiaire de `cap³` éléments. Voir l'en-tête du fichier.
//
// ⚠️ `otherHalfMaxSets`/`jokerCredit`/`requiredPieces` : élagage précoce SÛR,
// avant même de choisir r1/r2 — si, même dans le MEILLEUR cas (le reste de
// CETTE moitié au mieux + le meilleur de L'AUTRE moitié + le joker généreux),
// un set demandé reste hors de portée, la branche est coupée immédiatement.
// Ne retire jamais une combinaison réellement valide (voir les commentaires
// des deux fonctions ci-dessus) — seulement du travail qui n'aurait de toute
// façon jamais abouti.
// ⚠️ RÉTENTION PAR TRANCHES, pas un score scalaire unique. `relevanceScore`
// (l'efficience agrégée des 3 runes) ne reflète PAS ce que la recherche
// demande réellement : un demi-build fortement spécialisé sur les stats
// recherchées, au prix des autres, peut avoir une efficience GLOBALE basse
// et se faire évincer de `bucketCap` par des demi-builds « équilibrés » mais
// hors sujet — confirmé sur un vrai compte (Lushen, deck 10 : le demi-build
// réel classé 11 854ᵉ sur 342 654 dans son compartiment, hors de portée même
// à `bucketCap` très relevé). Chaque compartiment maintient donc PLUSIEURS
// tas bornés en parallèle — un générique (par `relevanceScore`, le
// comportement historique) et un par stat de `retentionKeys` (par sa propre
// contribution) — puis les fusionne à la fin. Même principe que
// `PER_STAT_KEEP`/`PER_STAT_KEEP_OBJECTIVE` dans `filterSlot` (réserver une
// tranche par critère plutôt qu'un seul tri global), appliqué ici aux
// demi-builds plutôt qu'aux runes individuelles.
function retentionScore(base: BaseStats, pct: Record<string, number>, flat: Record<string, number>, key: StatKey): number {
  // Pondéré par `base` (voir `weightedContribution`) — PAS une valeur totale
  // exacte (le terme `base` additif de `totalOf` manque encore), mais un
  // repère de classement qui respecte au moins le bon poids relatif entre
  // `pct` et `flat` sur cette même stat.
  return weightedContribution(base, key, pct[key] ?? 0, flat[key] ?? 0);
}

// ⚠️ Score COMBINÉ, normalisé par le seuil de chaque minimum — pas la simple
// somme des tranches par stat individuelle. Un demi-build qui satisfait
// PLUSIEURS minimums À LA FOIS sans être le meilleur sur AUCUN pris isolément
// (cas réel : Lushen deck 10, ATQ+Taux Crit+Dmg Crit demandés ensemble)
// n'aurait sa place dans AUCUNE tranche par stat seule — cette tranche
// supplémentaire, triée par la somme des contributions rapportées à leur
// propre seuil, le protège. Même heuristique que `relevance()` dans
// `filterSlot`, appliquée ici aux demi-builds.
function combinedRetentionScore(base: BaseStats, pct: Record<string, number>, flat: Record<string, number>, minEntries: { k: StatKey; min: number }[]): number {
  let score = 0;
  for (const { k, min } of minEntries) {
    if (min <= 0) continue;
    score += weightedContribution(base, k, pct[k] ?? 0, flat[k] ?? 0) / min;
  }
  return score;
}

// PROTOTYPE (forge/order-as-weight-contrib, combosOrderMode='objective') —
// même principe que `combinedRetentionScore` (somme de contributions
// pondérées par `base`), mais sur les stats de l'OBJECTIF choisi
// (`objectiveKeys` — ex. ATQ+Dmg Crit pour Dégâts), jamais les minimums
// posés. Pas de division par un seuil ici (une stat de l'objectif n'a pas
// forcément de minimum posé dessus — rien à normaliser par) : simple somme
// des contributions réelles. Vide (`objectiveKeys.length === 0`, ex.
// objectif « Efficience ») → score toujours 0 pour tout le monde, le tri
// retombe alors sur `relevanceScore` (voir son site d'appel).
function objectiveRetentionScore(base: BaseStats, pct: Record<string, number>, flat: Record<string, number>, objectiveKeys: StatKey[]): number {
  let score = 0;
  for (const k of objectiveKeys) {
    score += weightedContribution(base, k, pct[k] ?? 0, flat[k] ?? 0);
  }
  return score;
}

// ⚠️ Regroupe 8 des paramètres de `buildBuckets` — tous déjà des champs de
// `PreparedSearch` (voir plus bas), passés SÉPARÉMENT jusqu'ici (signature à
// 14 paramètres positionnels, revue de code externe point 9 — 67 sites
// d'appel dans 29 fichiers, aucun bug d'ordre trouvé en les auditant, mais
// un vrai risque latent : la plupart de ces sites sont dans `scripts/`, hors
// périmètre `tsc`, où un paramètre inversé ne serait détecté qu'à
// l'exécution). N'importe quel objet qui a STRUCTURELLEMENT ces 9 champs
// convient — un `PreparedSearch` complet (le cas normal, `searchBuildsSteps`)
// ou un objet plus étroit comme `BuildHalfRequest` (buildHalf.worker.ts, qui
// ne peut pas recevoir un `PreparedSearch` tel quel — sa fonction `totalOf`
// n'est pas sérialisable via `postMessage`).
export interface BuildBucketsContext {
  filtered: RuneDetail[][];
  distinctKeys: string[];
  constrainedKeys: StatKey[];
  retentionKeys: StatKey[];
  minEntries: { k: StatKey; min: number }[];
  bucketCap: number;
  jokerCredit: number;
  requiredPieces: number[];
  // ⚠️ Nécessaire à `retentionScore`/`combinedRetentionScore` (pondération
  // pct/flat, voir `weightedContribution`) — absent avant, ces deux
  // fonctions mélangeaient les deux échelles. Propagé à TOUS les chemins
  // structurellement compatibles (`BuildHalfRequest`, `BuildHalfWorkerData`)
  // — voir spec/outils/optimizer/historique-dimensionnement.md, « Suite —
  // pct/flat pondérés par base ».
  base: BaseStats;
  // PROTOTYPE (combosOrderMode='objective') — voir son commentaire dans
  // prepareSearch. Même discipline de propagation que `base` ci-dessus.
  objectiveKeys: StatKey[];
}

// ⚠️ GÉNÉRATEUR, comme `searchBuildsSteps` — la construction d'un
// compartiment (triple boucle sur les pools filtrés) peut à elle seule
// prendre plusieurs dizaines de secondes sur un compte réel avec beaucoup de
// conditions à la fois (plus de tranches à alimenter, voir le commentaire de
// `BUCKET_CAP`), et se produit ENTIÈREMENT AVANT que la boucle d'appariement
// (le seul endroit qui rendait la main jusqu'ici) n'ait la moindre chance de
// tourner — sans point de passage ICI, ni la barre de progression ni le
// bouton Arrêter ne réagissaient pendant cette phase (voir
// spec/outils/optimizer/, « Suite — la phase de préparation restait
// muette »). `half` sert uniquement à étiqueter la progression émise (A ou
// B), aucun effet sur le calcul lui-même.
export function* buildBuckets(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: BuildBucketsContext,
  otherHalfMaxSets: number[],
  // ⚠️ PROTOTYPE EN MESURE — voir `Bucket.skyline`/`insertIntoSkyline`.
  // `undefined` (par défaut, TOUS les appels de production actuels) : rien
  // ne change, coût nul. Fourni : maintient EN PLUS, pour chaque
  // compartiment, la frontière de Pareto exacte sur ces clés — jamais à la
  // place des tranches habituelles. Réservé aux scripts de mesure
  // (`scripts/monster-search-skyline-diag.ts`) tant que le coût réel
  // (taille de la skyline sur un compte réel) n'est pas mesuré.
  skylineKeys?: StatKey[],
  // ⚠️ PROTOTYPE EN MESURE — piste B, pondération adaptative par tranche
  // (spec/outils/optimizer/, « Suite — piste B »). `false`/`undefined`
  // (par défaut, TOUS les appels de production actuels) : le bloc
  // `reallocatedCap` ci-dessous ne s'exécute pas, chaque tranche par stat
  // reçoit `perOtherSliceCap` exactement comme avant sa mise en place —
  // coût nul À VÉRIFIER (voir la mesure demandée avant d'exposer un bouton
  // dans l'UI, pas encore fait). `true` : reproduit le comportement piste B
  // déjà validé (Sonia deck 6, cas de stress atteignable) contre un coût de
  // construction non démontré meilleur que la piste A.
  adaptiveTrancheWeighting = false,
  // Voir spec/outils/optimizer/historique-dimensionnement.md, « Suite —
  // vitesse de convergence : ordre au sein d'un compartiment » et « Suite —
  // rétention re-vérifiée EMPIRIQUEMENT avec le prototype ». Quatre valeurs,
  // toutes INTERNES — jamais exposées dans l'UI, aucun appel de production
  // n'en passe une explicitement (le défaut ci-dessous s'applique donc
  // partout). Trient les demi-builds À L'INTÉRIEUR d'un même compartiment
  // (le tri des COMPARTIMENTS entre eux, par potentiel normalisé, reste
  // inchangé quel que soit ce réglage) :
  // - `'relevance'` : `relevanceScore` seul — mesuré ~2× plus rapide en
  //   paires explorées pour un même objectif que l'ancien `'potential'`,
  //   sans coût de rang relatif ni de rétention (696/696 scénarios
  //   synthétiques, 0 régression). Défaut de production du 2026-08-18 au
  //   passage à `'combined'` (voir plus bas).
  // - `'potential'` : ancien comportement (tri par potentiel normalisé
  //   aussi au sein d'un compartiment) — conservé comme échappatoire de
  //   mesure/comparaison.
  // - `'combined'` : `combinedRetentionScore` (somme pondérée par `base` de
  //   TOUTES les stats à minimum posé), retombe sur `relevanceScore` si
  //   aucun minimum n'est posé.
  // - `'objective'` (DÉFAUT ACTUEL) : comme `'combined'` mais ne pondère
  //   QUE les stats de l'objectif de recherche choisi
  //   (`OBJECTIVE_RELEVANT_STATS`), pas les minimums posés — retombe sur
  //   `relevanceScore` si aucun objectif n'est choisi (Efficience). Choisi
  //   après comparaison manuelle par l'utilisateur (dev server, branche
  //   `forge/order-as-weight-contrib`) — pas (encore) un benchmark
  //   automatisé committé comme la mesure `'relevance'` ci-dessus.
  combosOrderMode: 'potential' | 'relevance' | 'combined' | 'objective' = 'objective'
): Generator<BuildingProgress, Bucket[], void> {
  const { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base, objectiveKeys } = ctx;
  const [i0, i1, i2] = slotIdxs;
  const buckets = new Map<string, Bucket>();
  // Tas de construction, PAS le contrat final (`Bucket.combos`) : une entrée
  // par compartiment, [tranche générique, tranche combinée éventuelle, une
  // tranche par retentionKey…].
  const slices = new Map<string, ScoredEntry<HalfCombo>[][]>();
  const skylines = skylineKeys ? new Map<string, HalfCombo[]>() : null;
  const trackedKeys = Array.from(new Set<StatKey>([...constrainedKeys, ...retentionKeys, ...(skylineKeys ?? [])]));
  const hasCombined = minEntries.length > 0;

  // Chaque tranche reçoit `bucketCap` places EN PROPRE — pas un budget total
  // partagé, divisé par le nombre de tranches. Le partage à parts égales
  // (l'implémentation d'origine) semblait naturel, mais DILUE chaque tranche
  // à mesure que l'utilisateur pose PLUS de conditions à la fois : signalé
  // sur un vrai compte (Sonia, deck 14, 4 minimums en même temps — ATQ/Taux
  // Crit/Dmg Crit/Vitesse — soit 6 tranches ; le demi-build réel, classé
  // #1212 sur sa MEILLEURE tranche, était hors de portée avec bucketCap/6).
  // Pire : ce plafond effectif recule structurellement à mesure qu'on ajoute
  // des conditions, donc AUCUNE valeur de `bucketCap` n'est jamais « assez
  // grande pour de bon » — vérifié directement, même `bucketCap=8000` (le
  // calibrage qui couvrait tout juste le cas à 4 conditions) échoue encore
  // sur un cas synthétique à 8 conditions à la fois (un futur utilisateur
  // aurait fini par recréer le même mur, un cran plus loin). Avec CHAQUE
  // tranche gardant sa propre réservation pleine, la mémoire d'un
  // compartiment grandit avec le nombre de conditions posées — logique,
  // c'est justement quand il y en a le plus qu'il en faut le plus — sans
  // jamais dégrader une tranche existante quand on en ajoute une autre. Sans
  // retentionKeys ni minEntries (objectif « Efficience », aucun minimum
  // posé) : comportement historique inchangé, une seule tranche à
  // `bucketCap` places, comme avant.
  const genericCap = bucketCap;
  const perOtherSliceCap = genericCap;

  // ⚠️ Piste B — pondération adaptative par tranche (spec/outils/
  // optimizer/, « Suite — piste B envisagée à la lumière de la piste A »).
  // PROXY ANALYTIQUE calculé AVANT la triple boucle — pour chaque
  // `retentionKey`, estime la variance du demi-build complet en sommant la
  // variance de la contribution HORS PRINCIPALE (`runeSubOnlyContribution`,
  // même exclusion que la piste A conservée dans
  // scripts/patches/piste-a-tranche-weighting.patch — une principale
  // garantie noie sinon la vraie dispersion) sur le pool DÉJÀ FILTRÉ de
  // CHAQUE slot de cette moitié (`filtered[i0/i1/i2]`, une centaine à
  // quelques centaines de candidats — une POPULATION STABLE, pas un
  // échantillon de demi-builds en cours de construction comme la piste A).
  // Hypothèse d'indépendance entre les 3 slots (variance d'une somme = somme
  // des variances) : approximative, pas garantie exacte, mais un premier
  // ordre défendable — à confirmer par la mesure, pas à supposer. Coût :
  // O(taille des 3 pools filtrés), négligeable face au O(pool³) de la
  // triple boucle qui suit. Réutilise ENSUITE la même formule de
  // réallocation déjà validée sur la piste A (part au CARRÉ du CV, budget
  // total inchangé = `retentionKeys.length × bucketCap`, plancher à 10 % de
  // la part égale) — mais pour fixer la BONNE taille de chaque tas par stat
  // DÈS LE DÉPART, sans jamais surprovisionner ni élaguer après coup : le
  // défaut principal mesuré sur la piste A (coût de construction accru sur
  // la majorité des cas réels, même quand la réallocation ne change rien à
  // l'issue) ne devrait structurellement pas exister ici — à VÉRIFIER par
  // la même batterie de mesure, pas à présumer.
  const reallocatedCap: Record<string, number> = {};
  if (adaptiveTrancheWeighting && retentionKeys.length > 0) {
    const cv: Record<string, number> = {};
    for (const k of retentionKeys) {
      let sumMean = 0;
      let sumVariance = 0;
      for (const i of [i0, i1, i2]) {
        const slotPool = filtered[i];
        if (slotPool.length === 0) continue;
        let sum = 0;
        let sumSq = 0;
        for (const r of slotPool) {
          const c = runeSubOnlyContribution(r, k as StatKey);
          const v = weightedContribution(base, k as StatKey, c.pct, c.flat);
          sum += v;
          sumSq += v * v;
        }
        const mean = sum / slotPool.length;
        const variance = Math.max(0, sumSq / slotPool.length - mean * mean);
        sumMean += mean;
        sumVariance += variance;
      }
      cv[k] = sumMean > 0 ? Math.sqrt(sumVariance) / sumMean : 0;
    }
    const cv2: Record<string, number> = {};
    for (const k of retentionKeys) cv2[k] = cv[k] * cv[k];
    const totalCv2 = retentionKeys.reduce((s, k) => s + cv2[k], 0);
    const totalBudget = retentionKeys.length * perOtherSliceCap;
    const floorCap = Math.max(1, Math.round(perOtherSliceCap * 0.1));
    for (const k of retentionKeys) {
      const share = totalCv2 > 0 ? cv2[k] / totalCv2 : 1 / retentionKeys.length;
      reallocatedCap[k] = Math.max(floorCap, Math.round(share * totalBudget));
    }
  }

  // Meilleur cas atteignable par CHAQUE slot de cette moitié, pour chaque set
  // demandé — calculé une fois, réutilisé à chaque étape du triple flux.
  const slotHasKey = [i0, i1, i2].map((i) => distinctKeys.map((key) => filtered[i].some((r) => r.set === key)));

  // ⚠️ Précalcul PAR RUNE, une fois avant la triple boucle — voir
  // spec/outils/optimizer/, « Suite — relecture du pipeline, pistes
  // d'accélération ». `runeEfficiency(r0)`/`runeContribution(r0, k)`
  // étaient recalculés à CHAQUE itération de la double boucle r1×r2, alors
  // que r0 est fixe pour toute cette double boucle — pur travail redondant
  // (mesuré : ~1,5M appels à `runeEfficiency` au lieu de 240 possibles, au
  // préréglage « Moyen »). Indexé par POSITION dans `filtered[i]`, pas par
  // id de rune : les trois slots d'une moitié sont TOUJOURS disjoints
  // (une rune n'appartient qu'à un seul `slot`), aucun risque de collision,
  // et évite le coût d'une table de hachage supplémentaire.
  function precomputeSlot(pool: RuneDetail[]): { eff: number; isJoker: boolean; contribPct: number[]; contribFlat: number[] }[] {
    return pool.map((r) => {
      const contribPct = new Array<number>(trackedKeys.length);
      const contribFlat = new Array<number>(trackedKeys.length);
      for (let j = 0; j < trackedKeys.length; j++) {
        const c = runeContribution(r, trackedKeys[j]);
        contribPct[j] = c.pct;
        contribFlat[j] = c.flat;
      }
      return { eff: runeEfficiency(r), isJoker: r.set === 'intangible', contribPct, contribFlat };
    });
  }
  const precompI0 = precomputeSlot(filtered[i0]);
  const precompI1 = precomputeSlot(filtered[i1]);
  const precompI2 = precomputeSlot(filtered[i2]);

  // Vrai si, comptes réels `have` (déjà choisis) + le meilleur restant de
  // cette moitié (`remainingSlotIdxs`, indices dans `slotHasKey`) + l'autre
  // moitié + le joker, chaque set demandé reste atteignable.
  function stillFeasible(have: number[], remainingSlotIdxs: number[]): boolean {
    for (let k = 0; k < distinctKeys.length; k++) {
      let remain = 0;
      for (const si of remainingSlotIdxs) if (slotHasKey[si][k]) remain++;
      if (have[k] + remain + otherHalfMaxSets[k] + jokerCredit < requiredPieces[k]) return false;
    }
    return true;
  }

  // Sous-ensemble de l'emplacement i2 pertinent pour SAUVER un demi-build
  // encore à 0 pièce/0 joker pour un set demandé À PLUS DE 3 PIÈCES —
  // runes qui sont soit ce set, soit un joker (les seules capables de
  // changer l'issue, voir le repli final après r2). Utilisé UNIQUEMENT
  // quand r0+r1 n'ont encore fourni ni l'un ni l'autre pour AU MOINS un
  // tel set — dans ce cas précis, tout AUTRE choix de r2 est déjà condamné
  // par construction, inutile de l'itérer pour le découvrir après coup.
  const fourPieceKeys = distinctKeys.map((_, k) => requiredPieces[k] > 3);
  const hasFourPieceRequirement = fourPieceKeys.some(Boolean);
  const rescueIdxI2: number[] = [];
  if (hasFourPieceRequirement) {
    for (let idx = 0; idx < filtered[i2].length; idx++) {
      const r = filtered[i2][idx];
      if (r.set === 'intangible' || fourPieceKeys.some((is4p, k) => is4p && r.set === distinctKeys[k])) {
        rescueIdxI2.push(idx);
      }
    }
  }

  const totalR0 = filtered[i0].length;
  let scannedR0 = 0;
  for (let idx0 = 0; idx0 < filtered[i0].length; idx0++) {
    const r0 = filtered[i0][idx0];
    const p0 = precompI0[idx0];
    scannedR0++;
    yield { phase: 'building', half, scanned: scannedR0, total: totalR0 };
    const haveR0 = distinctKeys.map((key) => (r0.set === key ? 1 : 0));
    if (distinctKeys.length > 0 && !stillFeasible(haveR0, [1, 2])) continue;
    for (let idx1 = 0; idx1 < filtered[i1].length; idx1++) {
      const r1 = filtered[i1][idx1];
      const p1 = precompI1[idx1];
      const haveR01 = distinctKeys.map((key, k) => haveR0[k] + (r1.set === key ? 1 : 0));
      if (distinctKeys.length > 0 && !stillFeasible(haveR01, [2])) continue;
      // ⚠️ Sûr, PAS une heuristique : si un set demandé >3 pièces est
      // encore à 0 ET qu'aucun joker n'a été choisi (r0/r1), tout r2 qui
      // n'est NI ce set NI un joker aboutit à un demi-build mort — coupé
      // de toute façon par le repli final, mais en évitant de l'itérer.
      const jokersR01 = (p0.isJoker ? 1 : 0) + (p1.isJoker ? 1 : 0);
      // ⚠️ Élagage SÛR, pas une heuristique — `pairBuckets` écarte toute
      // paire où `bA.jokers + bB.jokers > 1` (une seule rune Intangible
      // équipable par monstre, voir plus bas) : `jokersR01 ≥ 2` ICI garantit
      // qu'AUCUN choix de r2 ne pourra jamais rendre ce demi-build appariable,
      // quelle que soit l'autre moitié — inutile de construire, scorer et
      // retenir un compartiment qui ne sera de toute façon jamais apparié.
      // Mesuré sur un compte réel (Lushen deck 10, Rage/Rage+Blade/Energy+
      // Shield+Guard) : ~11 % des demi-builds construits tombaient dans ce
      // cas, pour 0 effet sur `pairBuckets` (déjà écarté au niveau du
      // compartiment) — voir spec/outils/optimizer/historique-dimensionnement.md,
      // « Suite — élagage jokers≥2 ».
      if (jokersR01 >= 2) continue;
      const mustRescue = hasFourPieceRequirement && jokersR01 === 0 && fourPieceKeys.some((is4p, k) => is4p && haveR01[k] === 0);
      const total2 = mustRescue ? rescueIdxI2.length : filtered[i2].length;
      for (let j2 = 0; j2 < total2; j2++) {
        const idx2 = mustRescue ? rescueIdxI2[j2] : j2;
        const r2 = filtered[i2][idx2];
        const p2 = precompI2[idx2];
        // Même raisonnement que ci-dessus : cas où jokersR01 ≤ 1 mais r2 lui
        // -même est un joker qui fait passer le total à 2.
        if (jokersR01 + (p2.isJoker ? 1 : 0) >= 2) continue;
        const runes: [RuneDetail, RuneDetail, RuneDetail] = [r0, r1, r2];
        // ⚠️ Réutilise `haveR01` (déjà accumulé pour `stillFeasible`) au
        // lieu de recalculer via `runes.filter(...)` — même résultat, sans
        // reparcourir les 3 runes une deuxième fois.
        const counts = haveR01.map((c, k) => c + (r2.set === distinctKeys[k] ? 1 : 0));
        const jokers = (p0.isJoker ? 1 : 0) + (p1.isJoker ? 1 : 0) + (p2.isJoker ? 1 : 0);

        // Élagage EXACT (pas une heuristique) — demi-build MORT pour un set
        // demandé À PLUS DE 3 PIÈCES (ex. Violent, 4 pièces) : avec
        // seulement 3 emplacements par moitié, 0 pièce de ce set ICI ne
        // peut JAMAIS être compensée par l'autre moitié, MÊME avec un
        // joker — preuve : un joker occupe l'un des 3 emplacements de la
        // moitié qui le porte, donc si c'est l'AUTRE moitié qui porte le
        // joker, elle ne peut fournir que 2 pièces réelles du set (pas 3),
        // soit 2+1(joker)=3 au total, jamais 4. Le joker ne peut compléter
        // la 4ᵉ pièce QUE s'il est dans la moitié qui a 0 pièce ELLE-MÊME
        // (elle fournit alors 0+1(joker)=… complété par les 3 pièces
        // réelles de l'autre moitié = 4 exactement). D'où le repli sur CE
        // demi-build LUI-MÊME (`jokers`, pas le `jokerCredit` global du
        // pool entier) — pas un choix conservateur, la SEULE configuration
        // physiquement possible. Trouvé sur un compte réel (Camilla,
        // violent 4p + nemesis 2p) — une tranche entière de compartiments à
        // 0 pièce violent, aucun n'ayant de joker propre, gaspillait tout
        // son quota de candidats en pairing parallèle faute de pouvoir
        // s'apparier avec QUOI QUE CE SOIT (voir spec/outils/optimizer/
        // historique-acceleration-et-outillage.md, « Chantier D »).
        let demiBuildMort = false;
        for (let k = 0; k < distinctKeys.length; k++) {
          if (requiredPieces[k] > 3 && counts[k] === 0 && jokers === 0) {
            demiBuildMort = true;
            break;
          }
        }
        if (demiBuildMort) continue;

        const pct: Record<string, number> = {};
        const flat: Record<string, number> = {};
        let score = (p0.eff + p1.eff + p2.eff) / 1000;
        for (let j = 0; j < trackedKeys.length; j++) {
          pct[trackedKeys[j]] = p0.contribPct[j] + p1.contribPct[j] + p2.contribPct[j];
          flat[trackedKeys[j]] = p0.contribFlat[j] + p1.contribFlat[j] + p2.contribFlat[j];
        }

        const key = bucketKeyOf(counts, jokers);
        let b = buckets.get(key);
        let bucketSlices = slices.get(key);
        if (!b) {
          b = { counts, jokers, combos: [], maxPct: {}, maxFlat: {}, potential: 0 };
          buckets.set(key, b);
          // [générique, combinée éventuelle, une par retentionKey…] — même
          // ordre que la boucle d'insertion ci-dessous.
          bucketSlices = [[], ...(hasCombined ? [[]] : []), ...retentionKeys.map(() => [])];
          slices.set(key, bucketSlices);
        }
        // ⚠️ Les bornes s'étendent avec CHAQUE combinaison vue, y compris
        // celles qu'on ne retient pas au final : une combinaison écartée
        // (pas assez pertinente sur l'ensemble) peut quand même repousser le
        // maximum atteignable sur une stat en particulier. Rester large ici
        // ne coûte rien et ne peut jamais écarter une paire à tort — voir
        // `pairFeasible`.
        for (const k of constrainedKeys) {
          if (pct[k] > (b.maxPct[k] ?? 0)) b.maxPct[k] = pct[k];
          if (flat[k] > (b.maxFlat[k] ?? 0)) b.maxFlat[k] = flat[k];
        }
        const combo: HalfCombo = { runes, counts, jokers, pct, flat, relevanceScore: score };
        heapPush(bucketSlices![0], { item: combo, score }, genericCap);
        const retentionOffset = hasCombined ? 2 : 1;
        if (hasCombined) {
          heapPush(bucketSlices![1], { item: combo, score: combinedRetentionScore(base, pct, flat, minEntries) }, perOtherSliceCap);
        }
        for (let i = 0; i < retentionKeys.length; i++) {
          const cap = adaptiveTrancheWeighting ? reallocatedCap[retentionKeys[i]] : perOtherSliceCap;
          heapPush(bucketSlices![retentionOffset + i], { item: combo, score: retentionScore(base, pct, flat, retentionKeys[i]) }, cap);
        }
        if (skylines) {
          let skyline = skylines.get(key);
          if (!skyline) {
            skyline = [];
            skylines.set(key, skyline);
          }
          insertIntoSkyline(skyline, combo, skylineKeys!);
        }
      }
    }
  }
  // Fusion des tranches, une fois le flux terminé : `combos` doit rester une
  // liste DÉDUPLIQUÉE (un même demi-build peut survivre dans PLUSIEURS
  // tranches — générique ET une ou plusieurs stats — sans qu'on veuille le
  // compter deux fois). La déduplication se fait par IDENTITÉ d'objet : un
  // même `combo` est réutilisé (jamais copié) d'une tranche à l'autre, seul
  // le `score` de l'entrée de tas diffère.
  //
  // ⚠️ Au passage, le MEILLEUR score de CHAQUE tranche est retenu par
  // compartiment (`bestBySlice`), pour l'ordonnancement ci-dessous — les tas
  // sont des tas MIN (la racine `slice[0]` est la PIRE entrée gardée, pas la
  // meilleure), donc il faut bien parcourir chaque tranche pour trouver son
  // maximum, pas juste lire son premier élément.
  const out = Array.from(buckets.values());
  const sliceCount = 1 + (hasCombined ? 1 : 0) + retentionKeys.length;
  const bucketBestBySlice = new Map<string, number[]>();
  const bucketSeen = new Map<string, HalfCombo[]>();
  const globalBestBySlice = new Array(sliceCount).fill(-Infinity);
  for (const b of out) {
    const key = bucketKeyOf(b.counts, b.jokers);
    const bucketSlices = slices.get(key)!;
    const seen = new Set<HalfCombo>();
    const bestBySlice = new Array(sliceCount).fill(-Infinity);
    for (let s = 0; s < bucketSlices.length; s++) {
      for (const entry of bucketSlices[s]) {
        seen.add(entry.item);
        if (entry.score > bestBySlice[s]) bestBySlice[s] = entry.score;
      }
      if (bestBySlice[s] > globalBestBySlice[s]) globalBestBySlice[s] = bestBySlice[s];
    }
    bucketBestBySlice.set(key, bestBySlice);
    bucketSeen.set(key, Array.from(seen));
  }
  // ⚠️ Deuxième passe, UNE FOIS `globalBestBySlice` COMPLET (le maximum de
  // chaque tranche, tous compartiments confondus) : trie maintenant CHAQUE
  // demi-build DANS son compartiment par le même principe que l'ordre des
  // compartiments plus bas — son propre meilleur score NORMALISÉ, toutes
  // tranches confondues, pas seulement `relevanceScore`. Sans cette seconde
  // passe, `combos` restait trié par la seule efficience générique : un
  // demi-build qui n'a survécu à `bucketCap` que grâce à la tranche combinée
  // ou une tranche par stat (pas grâce à son efficience — précisément le cas
  // d'un build spécialisé sur des stats non meulables, voir « Suite —
  // ordonnancement conscient des tranches » dans spec/outils/optimizer/)
  // se retrouvait trié vers la FIN de la liste — la boucle d'appariement
  // (`for comboA of bA.combos` dans searchBuildsSteps) ne l'atteignait donc
  // qu'après des milliers de demi-builds génériquement bons mais hors sujet,
  // avec un vrai risque de ne jamais l'atteindre si la recherche
  // s'interrompait avant la fin — confirmé en usage réel (recherche « Dégâts »
  // sur un vrai compte : les bons résultats n'apparaissaient qu'à la toute
  // fin de plusieurs millions de paires explorées).
  for (const b of out) {
    const key = bucketKeyOf(b.counts, b.jokers);
    const combos = bucketSeen.get(key)!;
    const scored = combos.map((combo) => {
      const combined = hasCombined ? combinedRetentionScore(base, combo.pct, combo.flat, minEntries) : null;
      const objectiveVal = objectiveKeys.length > 0 ? objectiveRetentionScore(base, combo.pct, combo.flat, objectiveKeys) : null;
      const sliceScores: number[] = [combo.relevanceScore];
      if (combined != null) sliceScores.push(combined);
      for (const k of retentionKeys) sliceScores.push(retentionScore(base, combo.pct, combo.flat, k));
      let potential = -Infinity;
      for (let s = 0; s < sliceCount; s++) {
        const g = globalBestBySlice[s];
        const normalized = g > 0 ? sliceScores[s] / g : sliceScores[s];
        if (normalized > potential) potential = normalized;
      }
      return { combo, potential, combined, objectiveVal };
    });
    if (combosOrderMode === 'relevance') {
      scored.sort((x, y) => y.combo.relevanceScore - x.combo.relevanceScore);
    } else if (combosOrderMode === 'combined') {
      // PROTOTYPE (forge/order-as-weight-contrib) — trie UNIQUEMENT par
      // combinedRetentionScore (Σ contribution/seuil sur TOUS les minimums
      // posés à la fois), jamais par relevanceScore ni par une tranche par
      // stat isolée. Repli sur relevanceScore si aucun minimum n'est posé
      // (`combined` vaut alors `null` pour tous les demi-builds — rien à
      // comparer sinon, un tri par `undefined - undefined` serait instable).
      scored.sort((x, y) => (y.combined ?? y.combo.relevanceScore) - (x.combined ?? x.combo.relevanceScore));
    } else if (combosOrderMode === 'objective') {
      // PROTOTYPE (forge/order-as-weight-contrib) — trie UNIQUEMENT par
      // objectiveRetentionScore (Σ contribution réelle sur les stats de
      // L'OBJECTIF choisi, ex. ATQ+Dmg Crit pour Dégâts) — jamais les
      // minimums posés, jamais l'efficience générique. Repli sur
      // relevanceScore si aucun objectif n'est choisi (« Efficience »,
      // `objectiveVal` vaut alors `null` pour tout le monde).
      scored.sort((x, y) => (y.objectiveVal ?? y.combo.relevanceScore) - (x.objectiveVal ?? x.combo.relevanceScore));
    } else {
      scored.sort((x, y) => y.potential - x.potential);
    }
    b.combos = scored.map((s) => s.combo);
    if (skylines) b.skyline = skylines.get(key) ?? [];
  }
  // ⚠️ Compartiments triés par POTENTIEL décroissant — le meilleur score
  // NORMALISÉ (rapporté au maximum atteint par N'IMPORTE QUEL compartiment
  // sur CETTE MÊME tranche) parmi TOUTES les tranches, pas seulement la
  // générique. Les tranches ne sont PAS sur la même échelle (`relevanceScore`
  // ~0-1, le score combiné en unités de seuil, un score par stat en valeur
  // brute pct+flat, potentiellement des centaines pour une stat plate) — les
  // comparer directement mélangerait des grandeurs incomparables. Normaliser
  // chacune par son propre maximum GLOBAL les ramène à un repère commun
  // avant de prendre le meilleur. Remplace l'ancien tri par seul
  // `relevanceScore` : un compartiment plein de demi-builds structurellement
  // désavantagés en efficience générique (le biais meulable/non-meulable —
  // une stat plafonnée type Taux Crit/Dmg Crit n'est jamais poussée vers son
  // max via une meule, contrairement à PV/ATQ/DEF) mais forts sur une stat
  // protégée par une tranche dédiée n'est plus exploré en dernier par
  // défaut, dès que `maxCollected`/`maxNodes` interrompt la recherche avant
  // de tout explorer (le cas courant, voir « Suite — augmenter le budget de
  // recherche » dans spec/outils/optimizer/).
  // PROTOTYPE (ordre d'appariement) — calculé UNE FOIS par compartiment ici
  // (au lieu d'être recalculé à chaque comparaison puis jeté) et conservé sur
  // `Bucket.potential` : sert à `pairBuckets` pour ordonner les PAIRES de
  // compartiments, pas seulement chaque moitié séparément.
  for (const b of out) {
    const bx = bucketBestBySlice.get(bucketKeyOf(b.counts, b.jokers))!;
    let pot = -Infinity;
    for (let s = 0; s < sliceCount; s++) {
      const g = globalBestBySlice[s];
      const nx = g > 0 ? bx[s] / g : bx[s];
      if (nx > pot) pot = nx;
    }
    b.potential = pot;
  }
  out.sort((x, y) => y.potential - x.potential);
  return out;
}

// ⚠️ Vérifie si deux moitiés PEUVENT ensemble satisfaire le combo de sets, à
// partir des seuls COMPTES agrégés (pas des runes réelles). C'est un
// PRÉ-FILTRE, volontairement plus optimiste que la réalité : le calcul réel
// (`activeSets` sur les 6 vraies runes) peut faire concourir des jokers avec
// des runes de sets HORS combo demandé (un « Shield » isolé, par exemple), ce
// que cette version simplifiée ignore. C'est SÛR dans le sens qui compte :
// si la vraie combinaison (avec cette concurrence en plus) parvient à
// satisfaire le combo, alors cette version simplifiée (sans concurrence)
// réussit forcément aussi — donc `false` ici garantit `false` en réalité, et
// permet d'écarter une paire de compartiments sans jamais en écarter une à
// tort. La décision d'ACCEPTER, elle, repasse toujours par le calcul réel sur
// les runes effectivement choisies (voir `searchBuilds`).
function satisfiesSets(
  countsA: number[],
  jokersA: number,
  countsB: number[],
  jokersB: number,
  distinctKeys: string[],
  requirement: BuildRequirement
): boolean {
  if (requirement.sets.length === 0) return true;
  const synthetic: string[] = [];
  for (let i = 0; i < distinctKeys.length; i++) {
    const n = countsA[i] + countsB[i];
    for (let j = 0; j < n; j++) synthetic.push(distinctKeys[i]);
  }
  for (let j = 0; j < jokersA + jokersB; j++) synthetic.push('intangible');
  return missingSets(requirement.sets, activeSets(synthetic)).length === 0;
}

// Taille RÉELLE de l'espace de recherche une fois les deux moitiés
// construites — le nombre de paires (comboA, comboB) qu'il faudrait visiter
// pour l'épuiser, PAS l'estimation brute affichée avant la recherche
// (`estimateSearchSpace`, un simple produit des tailles de pool par
// emplacement, calculée AVANT le meet-in-the-middle). Ne compte QUE les
// paires de compartiments structurellement compatibles (même filtre bon
// marché qu'au tout début de la boucle d'appariement, voir `pairBuckets` :
// au plus un joker à eux deux, et le combo de sets demandé atteignable) —
// une paire de compartiments incompatible ne contribue jamais une seule
// paire de combos au total, aussi grands soient ses deux compartiments.
// ⚠️ Reste une borne SUPÉRIEURE, pas le compte exact de paires réellement
// visitées : `pairFeasibleMin`/`comboAOk`/`quickOk` (voir `pairBuckets`)
// élaguent ENCORE, combo par combo, une fois DANS une paire de
// compartiments compatible — les recalculer ici referait le travail de la
// boucle elle-même. « Taille de l'espace à épuiser » au sens où l'entend
// cette fonction : ce que l'algorithme visiterait AU PIRE, pas ce qu'il
// visite RÉELLEMENT en pratique (presque toujours bien moins, voir le
// budget de nœuds qui suffit largement dans les cas mesurés).
// Borne optimiste (sûre) pour les MINIMUMS, à partir des bornes de deux
// compartiments — factorisée pour être réutilisée à l'IDENTIQUE par
// `pairBuckets` (élagage réel pendant l'appariement) ET `totalPairCount`
// (estimation de la taille de l'espace, voir plus bas) : les deux doivent
// appliquer EXACTEMENT le même filtre, sous peine de désaccord entre ce qui
// est annoncé et ce qui est réellement visité.
function bucketPairFeasibleMin(
  bA: { maxPct: Record<string, number>; maxFlat: Record<string, number> },
  bB: { maxPct: Record<string, number>; maxFlat: Record<string, number> },
  minEntries: { k: StatKey; min: number }[],
  guaranteedMin: { pct: Record<string, number>; flat: Record<string, number> },
  relPct: Record<string, number>,
  artFlat: Record<string, number>,
  totalOf: (k: StatKey, pct: number, flat: number) => number
): boolean {
  for (const { k, min } of minEntries) {
    const optPct = (bA.maxPct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteedMin.pct[k] ?? 0) + (relPct[k] ?? 0);
    const optFlat = (bA.maxFlat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteedMin.flat[k] ?? 0) + (artFlat[k] ?? 0);
    if (totalOf(k, optPct, optFlat) < min) return false;
  }
  return true;
}

// Repli rapide côté MINIMUM ET MAXIMUM pour un comboA précis, une fois
// apparié à une moitié B DONNÉE — factorisé pour être réutilisé à
// l'IDENTIQUE par `pairBuckets` (élagage réel) ET `totalPairCount`
// (estimation), même raison que `bucketPairFeasibleMin` juste au-dessus.
// MINIMUM : même comboA + le MEILLEUR cas de bB (ses bornes de compartiment)
// suffit-il encore ? MAXIMUM : comboA seul (le contexte fixe) dépasse-t-il
// déjà — un comboB ne peut jamais RETIRER, donc B n'a pas besoin d'être
// consulté ici.
function comboAFeasible(
  comboA: HalfCombo,
  bB: { maxPct: Record<string, number>; maxFlat: Record<string, number> },
  minEntries: { k: StatKey; min: number }[],
  maxEntries: { k: StatKey; max: number }[],
  guaranteed: { pct: Record<string, number>; flat: Record<string, number> },
  guaranteedMin: { pct: Record<string, number>; flat: Record<string, number> },
  relPct: Record<string, number>,
  artFlat: Record<string, number>,
  totalOf: (k: StatKey, pct: number, flat: number) => number
): boolean {
  for (const { k, min } of minEntries) {
    const p = (comboA.pct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteedMin.pct[k] ?? 0) + (relPct[k] ?? 0);
    const f = (comboA.flat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteedMin.flat[k] ?? 0) + (artFlat[k] ?? 0);
    if (totalOf(k, p, f) < min) return false;
  }
  for (const { k, max } of maxEntries) {
    const p = (comboA.pct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
    const f = (comboA.flat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
    if (totalOf(k, p, f) > max) return false;
  }
  return true;
}

// ⚠️ Suite — affine l'estimation pour qu'elle reste HONNÊTE, en DEUX temps.
// La première version ne filtrait que sur les sets/joker (bon marché, mais
// bien plus large que ce que l'algorithme visite réellement) : signalé en
// usage réel (Sonia, deck 6 offense) — « espace total » annoncé à 652M,
// recherche achevée EXHAUSTIVEMENT (pas tronquée) à ~87M, laissant croire à
// tort qu'il restait ~85 % du travail alors qu'il n'y avait plus rien à
// visiter. `pairFeasibleMin` AJOUTÉ D'ABORD (élimine toute une paire de
// compartiments dont même le meilleur cas combiné ne peut pas atteindre les
// minimums) — mesuré sur ce même cas réel : 652M → 638M SEULEMENT, cette
// borne au niveau BUCKET est trop optimiste pour rejeter grand-chose sur un
// pool large et varié (chaque stat atteint son maximum quelque part, même
// si aucun VRAI demi-build ne les atteint tous à la fois). Le vrai écart
// venait d'ailleurs : `comboAOk` (voir `pairBuckets`), qui élimine un comboA
// PRÉCIS (pas une borne de compartiment agrégée) — AJOUTÉ ENSUITE, vérifié
// directement sur le cas Sonia : les deux filtres combinés donnent
// EXACTEMENT 86 818 232, identique au nombre RÉELLEMENT exploré par la
// recherche exhaustive sur ce cas. Coût : O(Σ comboA par paire de
// compartiments compatible) — jamais la boucle B, donc toujours bien moins
// cher que la recherche elle-même (143 099 comboA vérifiés sur ce cas,
// contre 86,8M paires que la vraie recherche visite).
// ⚠️ Parallélisation de l'appariement (voir runeBuildOptim.worker.ts,
// `runParallelPairing`, et spec/outils/optimizer/pistes.md, point 9) —
// réparti GLOUTONNEMENT par charge réelle (LPT — Longest Processing Time
// first : les plus gros compartiments d'abord, toujours au worker le moins
// chargé), PAS par rang. Mesuré (`scripts/pairing-parallel-diag.ts`) :
// n'importe quel découpage statique de `bucketsA` donne un résultat
// identique au séquentiel UNIQUEMENT quand rien n'est tronqué (recherche
// exhaustive, budget infini par tranche) — c'est la SEULE garantie que cette
// fonction suppose déjà vraie côté appelant, elle ne la vérifie pas
// elle-même. Exportée (plutôt que privée au Worker) pour être testable
// directement en Node, sans dépendre de l'API Worker du navigateur — voir
// tests/rune-optim-parallel-pairing.test.ts.
// ⚠️ OPTION E (voir spec/outils/optimizer/pistes.md, point 9 — comparaison
// à 3 branches) : l'équilibrage par charge (LPT) reste IDENTIQUE à la
// version de base, mais chaque tranche est retriée EN PLUS dans l'ordre
// d'origine de `bucketsA` (déjà par potentiel décroissant, voir
// `buildBuckets`) avant d'être retournée. Coût quasi nul (un tri sur au
// plus quelques compartiments par tranche), ne change RIEN à la répartition
// de charge déjà mesurée — corrige uniquement l'ORDRE DE PARCOURS de chaque
// worker (redevient « meilleur d'abord » au lieu de « plus gros d'abord »).
export function partitionBucketsALPT(bucketsA: Bucket[], workerCount: number): Bucket[][] {
  const withWorkload = bucketsA.map((b, originalIndex) => ({ b, workload: b.combos.length, originalIndex }));
  withWorkload.sort((a, b) => b.workload - a.workload);
  const sliceEntries: { b: Bucket; originalIndex: number }[][] = Array.from({ length: workerCount }, () => []);
  const sliceWorkload = new Array(workerCount).fill(0);
  for (const { b, workload, originalIndex } of withWorkload) {
    let target = 0;
    for (let i = 1; i < workerCount; i++) if (sliceWorkload[i] < sliceWorkload[target]) target = i;
    sliceEntries[target].push({ b, originalIndex });
    sliceWorkload[target] += workload;
  }
  for (const entries of sliceEntries) entries.sort((a, b) => a.originalIndex - b.originalIndex);
  return sliceEntries.map((entries) => entries.map((e) => e.b));
}

export function totalPairCount(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[]): number {
  const { distinctKeys, requirement, minEntries, maxEntries, guaranteed, guaranteedMin, relPct, artFlat, totalOf } = prepared;
  let total = 0;
  for (const bA of bucketsA) {
    for (const bB of bucketsB) {
      if (bA.jokers + bB.jokers > 1) continue;
      if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) continue;
      if (!bucketPairFeasibleMin(bA, bB, minEntries, guaranteedMin, relPct, artFlat, totalOf)) continue;
      for (const comboA of bA.combos) {
        if (!comboAFeasible(comboA, bB, minEntries, maxEntries, guaranteed, guaranteedMin, relPct, artFlat, totalOf)) continue;
        total += bB.combos.length;
      }
    }
  }
  return total;
}

// Pool par slot, après la SEULE contrainte de statistique principale — pas
// encore le pré-filtrage heuristique. Factorisé pour être réutilisé tel quel
// par `searchBuildsSteps` (qui y ajoute ensuite dominance + faisabilité,
// voir plus bas) et par `estimateSearchSpace`.
export function mainStatFilteredBySlot(pool: RuneDetail[], requirement: BuildRequirement): RuneDetail[][] {
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of pool) {
    if (r.slot < 1 || r.slot > 6) continue;
    // ⚠️ **Verrou de rune, appliqué ICI et nulle part ailleurs** — le point
    // le plus AMONT du pipeline, traversé par TOUS les chemins (recherche
    // réelle, estimation du pool affichée avant de lancer, diagnostics de
    // faisabilité) : un seul endroit à toucher, aucun risque qu'un chemin
    // l'oublie et travaille sur un pool différent de celui annoncé.
    // Le slot verrouillé ne garde QUE la rune choisie ; tout le reste du
    // moteur (dominance, faisabilité, pré-filtrage, meet-in-the-middle)
    // continue sur un pool simplement plus petit, sans rien savoir de la
    // notion de verrou.
    const locked = requirement.lockedRunes?.[r.slot];
    if (locked != null && r.id !== locked) continue;
    const allowed = requirement.mainStats?.[r.slot as 2 | 4 | 6];
    if (allowed && allowed.length > 0 && !allowed.includes(r.main.code)) continue;
    bySlot[r.slot - 1].push(r);
  }
  return bySlot;
}

// Pool par slot, après la contrainte de statistique principale PUIS le
// pré-filtrage par pertinence — factorisé pour être réutilisé tel quel par
// `estimateSearchSpace` (l'indication du nombre de builds affichée AVANT de
// lancer la recherche, voir OptimizerSection.tsx). ⚠️ `searchBuildsSteps`
// n'appelle PLUS cette fonction : elle intercale dominance + faisabilité
// entre les deux étapes (voir plus bas) — l'estimation, elle, reste au niveau
// heuristique seul, un ordre de grandeur légèrement PLUS LARGE que ce que la
// recherche explore réellement, jamais trompeur dans le sens dangereux.
function buildFilteredBySlot(
  pool: RuneDetail[],
  requirement: BuildRequirement,
  base: BaseStats,
  slotCap: number,
  objective?: Objective,
  objectiveStats?: StatKey[]
): RuneDetail[][] {
  const bySlot = mainStatFilteredBySlot(pool, requirement);
  return bySlot.map((list) => filterSlot(list, requirement, base, slotCap, slotCap, objective, objectiveStats));
}

// Estimation, AVANT de lancer la recherche, du nombre de combinaisons brutes
// que le pré-filtrage laisse en jeu — un ordre de grandeur, pas le nombre
// réellement exploré (le meet-in-the-middle n'énumère jamais ce produit en
// entier, voir l'en-tête du fichier), mais un repère utile pour savoir si les
// critères actuels sont trop larges ou trop stricts avant d'attendre un
// résultat.
export function estimateSearchSpace(
  pool: RuneDetail[],
  requirement: BuildRequirement,
  base: BaseStats,
  slotCap: number,
  objective?: Objective,
  objectiveStats?: StatKey[]
): { perSlot: number[]; product: number } {
  const filtered = buildFilteredBySlot(pool, requirement, base, slotCap, objective, objectiveStats);
  const perSlot = filtered.map((l) => l.length);
  const product = perSlot.reduce((a, b) => a * b, 1);
  return { perSlot, product };
}

// ⚠️ **VOLONTAIREMENT PAS AFFICHÉE À L'ÉCRAN** — mesurée
// (`scripts/pair-bound-diag.ts`) sur les 7 cas réels connus avant d'être
// branchée dans l'UI, comme toute constante de ce moteur : l'écart à
// `totalPairCount` va de ×6 (le cas le plus serré) à **×300 000 000** (Ciri,
// une recherche à conditions très précises — 784 paires réellement
// explorées, borne à 236 milliards). Le majorant est structurellement
// dominé par `bucketCap × nombre de tas`, une quantité qui ignore la RARETÉ
// réelle des runes dans le pool — justement ce qui rend une recherche
// serrée rapide en pratique. Utile comme brique interne prouvée (garde-fou
// testé, réutilisable si le calcul est affiné un jour), pas comme chiffre
// affiché : annoncer « au pire » un nombre couramment 100 à 100 000 000×
// trop grand tromperait l'utilisateur plus qu'il ne l'informerait.
//
// Borne SUPÉRIEURE (majorant) du nombre de paires (comboA, comboB) qu'une
// recherche pourrait examiner à l'appariement — calculable AVANT
// `buildBuckets`, contrairement à `totalPairCount` qui a besoin des
// compartiments déjà construits (voir son commentaire, plus haut dans ce
// fichier) : c'est précisément la raison d'être de cette fonction, savoir
// « au pire, combien ? » sans payer le coût de la construction elle-même.
// ⚠️ Un MAJORANT, pas une estimation : suppose que CHAQUE compartiment
// théoriquement atteignable est rempli à ras bord (`bucketCap` × le nombre
// de tas parallèles par compartiment — voir `buildBuckets`, `genericCap`/
// `perOtherSliceCap` : un générique, un combiné si des minimums sont posés,
// un par `retentionKey`), et ignore tout élagage de faisabilité par les
// stats (`bucketPairFeasibleMin`/`comboAFeasible`, voir `pairBuckets`) — SEULE
// la compatibilité de sets (`satisfiesSets`, la MÊME fonction que
// `pairBuckets`, jamais une réimplémentation qui pourrait diverger) filtre
// les paires de clés de compartiment. Ignorer ces élagages ne peut que faire
// GRANDIR la borne, jamais la réduire sous la vraie valeur — c'est ce qui en
// fait un majorant sûr, vérifié par test différentiel contre `totalPairCount`
// sur des recherches réelles (voir tests/rune-optim.test.ts).
// ⚠️ Peut être TRÈS au-dessus de la réalité (attendu, pas un bug à
// resserrer) : `bucketCap` est lui-même une valeur de sécurité rarement
// atteinte en usage courant — voir spec/outils/optimizer/, « BUCKET_CAP mis
// à l'échelle ». Le nombre affiché à l'écran doit rester lisible comme
// « au pire », pas comme une prédiction.
export function estimatePairBound(
  requirement: BuildRequirement,
  slotFilterCap: number,
  objective?: Objective,
  objectiveStats?: StatKey[]
): number {
  const bucketCap = bucketCapFor(slotFilterCap);
  const minKeys = ALL_STAT_KEYS.filter((k) => (requirement.minStats[k] ?? 0) > 0);
  const retentionKeys = Array.from(new Set<StatKey>([...minKeys, ...objectiveKeysOf(objective, objectiveStats)]));
  const numHeaps = 1 + (minKeys.length > 0 ? 1 : 0) + retentionKeys.length;
  const maxPerBucket = bucketCap * numHeaps;

  // Toutes les clés de compartiment THÉORIQUEMENT atteignables par une
  // moitié de 3 emplacements — un compte de pièces par set demandé (0 à 3)
  // plus un joker (0 ou 1), sous la seule contrainte physique (au plus 3
  // pièces au total) — indépendant du pool réel, donc calculable sans lui,
  // et bon marché (au plus quelques dizaines de clés en pratique : le
  // nombre de sets DISTINCTS demandés dépasse rarement 2 ou 3).
  const distinctKeys = Array.from(new Set(requirement.sets));
  const keys: { counts: number[]; jokers: number }[] = [];
  const counts: number[] = [];
  function enumerate(idx: number, remaining: number): void {
    if (idx === distinctKeys.length) {
      for (const jokers of [0, 1]) {
        if (jokers <= remaining) keys.push({ counts: [...counts], jokers });
      }
      return;
    }
    for (let c = 0; c <= Math.min(3, remaining); c++) {
      counts.push(c);
      enumerate(idx + 1, remaining - c);
      counts.pop();
    }
  }
  enumerate(0, 3);

  let compatiblePairs = 0;
  for (const a of keys) {
    for (const b of keys) {
      if (a.jokers + b.jokers > 1) continue;
      if (!satisfiesSets(a.counts, a.jokers, b.counts, b.jokers, distinctKeys, requirement)) continue;
      compatiblePairs++;
    }
  }

  return compatiblePairs * maxPerBucket * maxPerBucket;
}

// Regroupe ce que `diagnoseFeasibility`, `rankBlockingConditions` ET
// `searchBuildsSteps` calculent CHACUN à partir de `minStats`/`maxStats` —
// factorisé ici pour ne plus le tripler (c'était déjà dupliqué entre les
// deux premiers avant ce correctif). ⚠️ Dépend maintenant AUSSI de `pool`
// (pour `guaranteedMin`, voir `additionalSetActivationHeadroom`) — seul
// `pool` lui-même reste traité à part par chaque appelant, sur SA propre
// étape du pipeline (pré-filtrage par emplacement, dominance, etc.).
interface MinMaxContext {
  minEntries: { k: StatKey; min: number }[];
  maxEntries: { k: StatKey; max: number }[];
  constrainedKeys: StatKey[];
  requiredKeys: Set<string>;
  maxKeys: Set<StatKey>;
  guaranteed: { pct: Record<string, number>; flat: Record<string, number> };
  // Réservé aux vérifications de MINIMUM — `guaranteed` + le bonus qu'un set
  // NON demandé, OU DÉJÀ demandé mais activable PLUS de fois que le minimum,
  // pourrait apporter (voir `additionalSetActivationHeadroom`). Ne JAMAIS
  // utiliser pour un maximum : voir son commentaire.
  guaranteedMin: { pct: Record<string, number>; flat: Record<string, number> };
  artFlat: Record<string, number>;
  relPct: Record<string, number>;
  totalOf: (k: StatKey, pct: number, flat: number) => number;
}

function deriveMinMaxContext(
  base: BaseStats,
  artifacts: ArtifactDetail[],
  relic: RelicDetail | undefined,
  requirement: BuildRequirement,
  pool: RuneDetail[]
): MinMaxContext {
  const minEntries = ALL_STAT_KEYS
    .map((k) => ({ k, min: requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
  const maxEntries = ALL_STAT_KEYS
    .map((k) => ({ k, max: requirement.maxStats?.[k] }))
    .filter((e): e is { k: StatKey; max: number } => e.max != null && e.max > 0);
  const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));
  const requiredKeys = new Set(requirement.sets);
  const maxKeys = new Set(maxEntries.map((e) => e.k));
  const guaranteed = guaranteedSetBonus(requirement, base);
  const guaranteedMin = mergeBonus(guaranteed, additionalSetActivationHeadroom(pool, requirement, base));
  const artFlat = artifactFlatBonus(artifacts);
  const relPct = relicPctBonus(relic);
  const baseRec = base as unknown as Record<string, number>;
  function totalOf(k: StatKey, pct: number, flat: number): number {
    const b = baseRec[k] ?? 0;
    return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
  }
  return { minEntries, maxEntries, constrainedKeys, requiredKeys, maxKeys, guaranteed, guaranteedMin, artFlat, relPct, totalOf };
}

// Verdict de faisabilité, PAR STAT PRISE ISOLÉMENT — pour une condition (min
// ou max), calcule le meilleur cas STRICTEMENT ATTEIGNABLE avec le pool
// réellement possédé (même borne que `computeSlotMaxBounds`/
// `eliminateInfeasible`, ici agrégée sur les 6 emplacements plutôt
// qu'appliquée rune par rune), et compare au seuil demandé.
export interface StatFeasibility {
  key: StatKey;
  kind: 'min' | 'max';
  requested: number;
  // Minimum : meilleur TOTAL atteignable (plafond). Maximum : plancher
  // INCOMPRESSIBLE, atteignable même en choisissant des runes qui
  // n'apportent RIEN à cette stat (les runes ne peuvent jamais RETIRER).
  bound: number;
  // `true` = rien ne prouve que ce soit impossible en isolant CETTE stat
  // (n'importe pas dire qu'un build existe : les autres contraintes, prises
  // ensemble, peuvent encore être infaisables — voir le commentaire de
  // `diagnoseFeasibility`). `false` = preuve mathématique d'impossibilité,
  // aucune recherche ne pourra jamais satisfaire cette condition seule.
  satisfiable: boolean;
}

// ⚠️ Prouve une IMPOSSIBILITÉ, ne prouve JAMAIS une possibilité — dissymétrie
// volontaire. Chaque borne est calculée en ISOLANT sa propre stat (le
// meilleur emplacement par slot pour CETTE stat, potentiellement une rune
// DIFFÉRENTE de celle qui serait la meilleure pour une autre stat en même
// temps) : si le seuil demandé dépasse cette borne optimiste, AUCUNE
// combinaison de 6 runes ne peut jamais l'atteindre — une preuve, pas une
// heuristique (même raisonnement que `eliminateInfeasible`, qui l'applique
// déjà rune par rune ; ici agrégé pour un diagnostic lisible). Mais
// l'inverse n'est PAS garanti : `satisfiable=true` sur CHAQUE stat prise
// isolément ne prouve pas qu'un build satisfaisant TOUTES à la fois existe
// — c'est exactement le piège documenté dans spec/outils/optimizer/
// (« l'aiguille dans une botte de foin » du deck 10 Lushen) : chaque
// contrainte était individuellement large, leur CONJONCTION était rare.
// Sert de premier palier de diagnostic quand une recherche ne trouve rien
// (voir OptimizerSection.tsx) : gratuit (une passe O(pool), pas une
// recherche), et permet de distinguer au moins UN cas sans ambiguïté —
// « cette stat précise est mathématiquement hors de portée » — du reste,
// où l'absence de résultat peut venir de la conjonction des contraintes ou
// d'une troncature heuristique (`filterSlot`/`buildBuckets`), indiscernables
// sans recherche complète.
export function diagnoseFeasibility(params: SearchParams): StatFeasibility[] {
  const { base, artifacts, relic, pool, requirement } = params;
  const ctx = deriveMinMaxContext(base, artifacts, relic, requirement, pool);
  if (ctx.minEntries.length === 0 && ctx.maxEntries.length === 0) return [];

  const bySlot = mainStatFilteredBySlot(pool, requirement);
  const slotMax = computeSlotMaxBounds(bySlot, ctx.constrainedKeys);

  const out: StatFeasibility[] = [];
  for (const { k, min } of ctx.minEntries) {
    const bestPct = slotMax.reduce((s, b) => s + (b[k]?.pct ?? 0), 0) + (ctx.guaranteedMin.pct[k] ?? 0) + (ctx.relPct[k] ?? 0);
    const bestFlat = slotMax.reduce((s, b) => s + (b[k]?.flat ?? 0), 0) + (ctx.guaranteedMin.flat[k] ?? 0) + (ctx.artFlat[k] ?? 0);
    const bound = ctx.totalOf(k, bestPct, bestFlat);
    out.push({ key: k, kind: 'min', requested: min, bound, satisfiable: bound >= min });
  }
  for (const { k, max } of ctx.maxEntries) {
    // Plancher incompressible : AUCUNE rune ne contribue à cette stat (le
    // pire cas le plus favorable pour un maximum) — base, bonus de set
    // garanti, artéfacts et relique restent, eux, incontournables.
    const floorPct = (ctx.guaranteed.pct[k] ?? 0) + (ctx.relPct[k] ?? 0);
    const floorFlat = (ctx.guaranteed.flat[k] ?? 0) + (ctx.artFlat[k] ?? 0);
    const bound = ctx.totalOf(k, floorPct, floorFlat);
    out.push({ key: k, kind: 'max', requested: max, bound, satisfiable: bound <= max });
  }
  return out;
}

// Palier 2 du diagnostic (voir `diagnoseFeasibility` pour le palier 1,
// gratuit mais limité à une preuve d'impossibilité PAR STAT ISOLÉE) : quand
// AUCUNE stat n'est individuellement hors de portée mais que la recherche
// trouve quand même 0 résultat, identifie laquelle des conditions posées
// libère le PLUS de candidats si on la retire — un indice, pas une preuve
// (voir plus bas). ⚠️ **Jamais une recherche complète** — proposé par un
// avis externe comme « retirer une condition et recompter » ; retenu sous
// cette forme précise pour rester bon marché : on ne relance QUE le
// pré-filtrage SÛR (`mainStatFilteredBySlot` → `pruneDominated` →
// `eliminateInfeasible`), jamais `filterSlot`/`buildBuckets`/l'appariement
// (le vrai coût combinatoire) — coût O(N × pool), N = nombre de conditions
// posées, jamais O(pool³). Coûte donc un ordre de grandeur de plus que le
// palier 1 (N passes au lieu d'une seule), mais reste sans commune mesure
// avec une recherche — d'où le réglage dédié dans l'écran (« Options
// avancées ») pour le rendre optionnel plutôt que systématique.
// ⚠️ **Un INDICE, pas une preuve** : contrairement à `diagnoseFeasibility`,
// ce palier ne s'appuie que sur le pré-filtrage SÛR, pas sur une recherche —
// une condition qui libère peu de candidats ICI peut quand même être, une
// fois combinée aux autres via `filterSlot`/`buildBuckets`, la vraie
// responsable (ou l'inverse). Un signal utile pour orienter où desserrer en
// premier, pas un verdict définitif.
export interface BlockingConditionImpact {
  key: StatKey;
  kind: 'min' | 'max';
  requested: number;
  // Taille du pool le plus restreint (le minimum des 6 tailles de slot,
  // après pré-filtrage SÛR) EN RETIRANT UNIQUEMENT cette condition — toutes
  // les autres conditions posées restent en place.
  poolMinSlotWithout: number;
}
export interface BlockingConditionsDiagnosis {
  // Même mesure, avec TOUTES les conditions actuellement posées — le repère
  // auquel chaque `poolMinSlotWithout` doit être comparé.
  baselineMinSlot: number;
  // Triés par IMPACT décroissant (`poolMinSlotWithout`) — la condition dont
  // le retrait libère le plus de candidats apparaît en premier.
  impacts: BlockingConditionImpact[];
}
export function rankBlockingConditions(params: SearchParams): BlockingConditionsDiagnosis {
  const { base, artifacts, relic, pool, requirement } = params;
  const ctx = deriveMinMaxContext(base, artifacts, relic, requirement, pool);
  if (ctx.minEntries.length === 0 && ctx.maxEntries.length === 0) return { baselineMinSlot: 0, impacts: [] };

  function poolMinSlot(req: BuildRequirement): number {
    const reqCtx = deriveMinMaxContext(base, artifacts, relic, req, pool);
    let bySlot = mainStatFilteredBySlot(pool, req);
    bySlot = bySlot.map((list) => pruneDominated(list, reqCtx.requiredKeys, reqCtx.maxKeys));
    bySlot = eliminateInfeasible(
      bySlot,
      reqCtx.minEntries,
      reqCtx.maxEntries,
      reqCtx.constrainedKeys,
      reqCtx.guaranteed,
      reqCtx.artFlat,
      reqCtx.relPct,
      reqCtx.totalOf,
      reqCtx.guaranteedMin
    );
    return Math.min(...bySlot.map((l) => l.length));
  }

  const baselineMinSlot = poolMinSlot(requirement);
  const impacts: BlockingConditionImpact[] = [];
  for (const { k, min } of ctx.minEntries) {
    const nextMinStats = { ...requirement.minStats };
    delete nextMinStats[k];
    const poolMinSlotWithout = poolMinSlot({ ...requirement, minStats: nextMinStats });
    impacts.push({ key: k, kind: 'min', requested: min, poolMinSlotWithout });
  }
  for (const { k, max } of ctx.maxEntries) {
    const nextMaxStats = { ...requirement.maxStats };
    delete nextMaxStats[k];
    const poolMinSlotWithout = poolMinSlot({ ...requirement, maxStats: nextMaxStats });
    impacts.push({ key: k, kind: 'max', requested: max, poolMinSlotWithout });
  }
  impacts.sort((a, b) => b.poolMinSlotWithout - a.poolMinSlotWithout);
  return { baselineMinSlot, impacts };
}

/* --------------------------------------------------------------------------
 * Recherche
 * ----------------------------------------------------------------------- */

// Étape intermédiaire : ce qu'on a trouvé JUSQU'ICI, pas encore le résultat
// final (`truncated` n'a pas de sens tant que la recherche n'est pas arrêtée
// — voir SearchResult). Sert à l'arrêt manuel (bouton « Arrêter ») : on
// ressort ce dernier point de passage, converti en résultat définitif.
// ⚠️ Deux PHASES distinctes, pas une seule forme : la construction des
// compartiments (`buildBucketsSteps`, avant même de savoir combien de paires
// il y aura à explorer) peut à elle seule prendre de quelques secondes à
// ~1 minute sur un compte réel avec beaucoup de conditions à la fois (voir
// spec/outils/optimizer/, « Suite — la phase de préparation restait
// muette ») — sans un point de passage PENDANT cette phase, l'utilisateur
// n'avait aucune information et le bouton Arrêter ne réagissait pas avant la
// toute première paire évaluée. `phase: 'pairing'` est l'ancien
// comportement (inchangé) ; `phase: 'building'` est nouveau.
export interface BuildingProgress {
  phase: 'building';
  half: 'A' | 'B';
  scanned: number;
  total: number;
}
export interface PairingProgress {
  phase: 'pairing';
  candidates: BuildCandidate[];
  explored: number;
}
export type SearchProgress = BuildingProgress | PairingProgress;

// Fréquence des points de passage (`yield`) : assez souvent pour qu'un temps
// limite ou un arrêt manuel réagissent vite (quelques centaines de ms au
// pire, voir scripts/benchmark-optim.ts), assez rare pour ne pas payer le
// coût d'un `yield` de générateur à chaque paire évaluée.
// ⚠️ Exportée : l'orchestrateur d'une escalade de budget (voir `NodeBudget`
// ci-dessous et runeBuildOptim.worker.ts) doit relever `nodeBudget.max`
// avec une marge d'AU MOINS un point de passage, pour être sûr d'agir avant
// que la boucle ne s'arrête d'elle-même.
export const CHECKPOINT_EVERY = 500;

// ⚠️ Objet MUTABLE, pas un simple nombre — c'est ce qui permet d'ESCALADER
// le budget de nœuds SANS relancer `pairBuckets` depuis le début. Le budget
// « figé » historique (`prepared.maxNodes`, toujours calculé une fois par
// `prepareSearch`/`adaptiveMaxNodes`) reste la valeur INITIALE — un appelant
// qui n'a pas besoin d'escalade (recherche simple, tests, scripts) construit
// un `NodeBudget` qu'il ne mute jamais, comportement STRICTEMENT identique à
// avant. Un appelant qui PEUT surveiller la progression ENTRE deux points de
// passage (le Worker, voir runeBuildOptim.worker.ts) peut à tout moment
// augmenter `.max` avant que la boucle n'atteigne ce plafond — le générateur
// continue alors EXACTEMENT là où il en était (même compartiments, mêmes
// combos, `explored` jamais remis à zéro), sans jamais revisiter une paire
// déjà explorée.
export interface NodeBudget {
  max: number;
}

// ⚠️ Escalade automatique du budget de nœuds, factorisée ici plutôt que
// dupliquée par chaque appelant qui pilote `pairBuckets` pas à pas
// (runeBuildOptim.worker.ts, scripts/perf-battery.ts, et tout script
// diagnostic à venir) — trois copies indépendantes de cette même condition
// existaient avant cette factorisation, et un script diagnostic écrit sans
// elle a silencieusement exploré <0,0001 % de l'espace réel (38,4M paires
// au lieu de 600M+ sur 10 min), produisant un faux « 0 résultat » pris pour
// un bug du moteur — voir le skill `algo-verify`, section « Fidélité des
// scripts diagnostics ». `adaptiveMaxNodes` (le plafond INITIAL) est
// calibré pour le cas TYPIQUE ; sans cette escalade, un compte avec
// beaucoup de runes peut épuiser ce plafond en quelques secondes alors que
// le vrai budget-temps (`maxMs`, 10 min à l'écran) reste très largement
// inutilisé.
export const ESCALATION_FACTOR = 2;
// Marge de sécurité sous `maxMs` : inutile d'escalader dans les toutes
// dernières secondes, `overBudget()` (déjà vérifié par `pairBuckets`
// lui-même) va de toute façon arrêter la recherche au prochain point de
// passage — le budget-temps reste l'arbitre final, jamais contourné.
export const ESCALATION_TIME_SAFETY = 0.95;

// Mute `nodeBudget.max` EN PLACE si les trois conditions d'escalade sont
// réunies (budget de paires presque épuisé, du temps encore disponible,
// pas encore assez de candidats collectés) — sinon ne fait rien. À appeler
// à CHAQUE point de passage (`step.value`) entre deux `gen.next()` d'un
// générateur `pairBuckets`, avec une marge d'au moins `CHECKPOINT_EVERY`
// pour être sûr d'agir avant que la boucle ne s'arrête d'elle-même.
export function maybeEscalateNodeBudget(nodeBudget: NodeBudget, prepared: PreparedSearch, progress: PairingProgress, now: number): void {
  if (
    nodeBudget.max - progress.explored <= CHECKPOINT_EVERY &&
    now - prepared.startedAt < prepared.maxMs * ESCALATION_TIME_SAFETY &&
    progress.candidates.length < prepared.maxCollected
  ) {
    nodeBudget.max *= ESCALATION_FACTOR;
  }
}

/**
 * Cœur du moteur, sous forme de GÉNÉRATEUR : produit un {@link SearchProgress}
 * à intervalles réguliers plutôt que de tourner jusqu'au bout d'un seul bloc.
 * ⚠️ Ce n'est pas une seconde implémentation à maintenir en double :
 * `searchBuilds` (l'API historique, utilisée par les tests/le benchmark) ne
 * fait que DRAINER ce générateur jusqu'à son `return`. Le Worker, lui,
 * pilote le générateur pas à pas, ce qui permet de rendre la main entre deux
 * points de passage — condition nécessaire pour recevoir un message
 * d'arrêt pendant que la recherche tourne (voir
 * src/workers/runeBuildOptim.worker.ts).
 */
// ⚠️ Budget de paires ADAPTATIF, plus une constante fixe dimensionnée pour le
// pire cas — sans ça, TOUTE recherche paie le coût du cas le plus exigeant,
// même une recherche LÂCHE (peu de conditions) qui trouve déjà des milliers
// de bons candidats en quelques millions de paires (vérifié : un seul
// minimum posé, ~2500-3500 candidats trouvés dès 4-12M paires, sans que ça
// change quoi que ce soit d'y consacrer les 32M par défaut — pur gaspillage
// de temps, signalé en usage réel après le calibrage précédent). Ancré sur
// `sliceCount` (même quantité que `buildBuckets`, voir son commentaire) :
// PROPORTIONNEL, avec un plancher bas (recherches lâches) et pas de plafond
// haut (continue de croître au-delà de l'ancre, plutôt que de rester bloqué
// à une valeur qui s'est déjà montrée insuffisante pour un cas encore plus
// exigeant — voir « Limites connues » pour le cas à 7 conditions où même
// cette croissance ne suffit pas encore). Ancre choisie sur MESURE, pas
// devinée : deck 10 Lushen (3 minimums, 5 tranches) a besoin d'AU MOINS
// ~28M paires pour être retrouvé exactement (échoue à 24M) — 32M à
// `sliceCount=5` garde une marge raisonnable, cohérent avec le calibrage
// validé pour Sonia deck 14 (4 minimums, 6 tranches, MOINS que ce que la
// proportionnalité donnerait ici : 38,4M contre 32M testés — marge
// supplémentaire, pas un recul).
// ⚠️ Exportée (pas juste locale à `searchBuildsSteps`) : le Worker en a
// besoin pour estimer une progression cohérente (`explored`/`maxNodes`) sans
// deviner une constante fixe qui ne correspondrait plus à la vraie valeur
// utilisée par CETTE recherche précise — voir `estimatePct` dans
// runeBuildOptim.worker.ts.
export function adaptiveMaxNodes(params: SearchParams): number {
  if (params.maxNodes != null) return params.maxNodes;
  const minEntries = ALL_STAT_KEYS
    .map((k) => ({ k, min: params.requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
  const retentionKeys = Array.from(
    new Set<StatKey>([...minEntries.map((e) => e.k), ...objectiveKeysOf(params.objective, params.objectiveStats)])
  );
  const sliceCount = 1 + (minEntries.length > 0 ? 1 : 0) + retentionKeys.length;
  const ADAPTIVE_ANCHOR_SLICE_COUNT = 5;
  const ADAPTIVE_ANCHOR_MAX_NODES = 32_000_000;
  const ADAPTIVE_MIN_MAX_NODES = 8_000_000;
  return Math.max(ADAPTIVE_MIN_MAX_NODES, Math.round((ADAPTIVE_ANCHOR_MAX_NODES * sliceCount) / ADAPTIVE_ANCHOR_SLICE_COUNT));
}

// Tout ce que `buildBuckets` (les DEUX moitiés) ET la phase d'appariement
// (`pairBuckets`) doivent partager — factorisé pour que les deux moitiés
// puissent être construites INDÉPENDAMMENT (en parallèle, potentiellement
// dans deux Workers distincts, voir runeBuildOptim.worker.ts et
// spec/outils/optimizer/ « Suite — parallélisation… ») sans dupliquer la
// préparation (mainStatFilteredBySlot → pruneDominated → eliminateInfeasible
// → filterSlot), qui elle reste séquentielle et bon marché en comparaison.
// `null` en retour de `prepareSearch` = un emplacement est vide après
// filtrage : aucune combinaison possible, inutile d'aller plus loin.
export interface PreparedSearch {
  base: BaseStats;
  artifacts: ArtifactDetail[];
  relic?: RelicDetail;
  requirement: BuildRequirement;
  metric: OptimMetric;
  maxNodes: number;
  maxCollected: number;
  maxMs: number;
  startedAt: number;
  minEntries: { k: StatKey; min: number }[];
  maxEntries: { k: StatKey; max: number }[];
  constrainedKeys: StatKey[];
  retentionKeys: StatKey[];
  // PROTOTYPE (combosOrderMode='objective') — voir son commentaire dans
  // prepareSearch : UNIQUEMENT les stats de l'objectif, jamais les minimums
  // posés (contrairement à retentionKeys, qui mélange les deux).
  objectiveKeys: StatKey[];
  distinctKeys: string[];
  guaranteed: { pct: Record<string, number>; flat: Record<string, number> };
  guaranteedMin: { pct: Record<string, number>; flat: Record<string, number> };
  artFlat: Record<string, number>;
  relPct: Record<string, number>;
  totalOf: (k: StatKey, pct: number, flat: number) => number;
  filtered: RuneDetail[][];
  requiredPieces: number[];
  jokerCredit: number;
  maxSetsForA: number[];
  maxSetsForB: number[];
  bucketCap: number;
}

export function prepareSearch(params: SearchParams): PreparedSearch | null {
  const { base, artifacts, relic, pool, requirement, metric } = params;
  const maxNodes = adaptiveMaxNodes(params);
  const maxCollected = params.maxCollected ?? MAX_COLLECTED;
  const maxMs = params.maxMs ?? DEFAULT_MAX_MS;
  const slotCap = params.slotFilterCap ?? MAX_PER_SLOT_MATCH;
  const startedAt = Date.now();

  const ctx = deriveMinMaxContext(base, artifacts, relic, requirement, pool);
  const { minEntries, maxEntries, constrainedKeys, requiredKeys, maxKeys, guaranteed, guaranteedMin, artFlat, relPct, totalOf } = ctx;
  // ⚠️ Dimensions protégées à la RÉTENTION par compartiment (voir
  // buildBuckets) : les minimums demandés, PLUS les stats propres à
  // l'objectif choisi. JAMAIS les maximums — sur une stat plafonnée, « plus »
  // n'est pas sûrement « meilleur » pour un tri après coup (le même piège
  // que la dominance directionnelle abandonnée cette session, voir
  // spec/outils/optimizer/) : un utilisateur qui pose un maximum peut
  // vouloir ensuite trier PAR cette stat pour voir les valeurs les plus
  // proches du plafond, pas les plus basses. Se limiter aux minimums garde
  // la protection strictement sûre.
  const retentionKeys = Array.from(
    new Set<StatKey>([...minEntries.map((e) => e.k), ...objectiveKeysOf(params.objective, params.objectiveStats)])
  );
  // PROTOTYPE (forge/order-as-weight-contrib, combosOrderMode='objective') —
  // UNIQUEMENT les stats de l'objectif choisi, contrairement à
  // `retentionKeys` ci-dessus qui mélange aussi les minimums posés (même
  // hors sujet par rapport à l'objectif). Vide si aucun objectif choisi
  // (« Efficience ») — voir objectiveRetentionScore, qui retombe alors sur
  // relevanceScore.
  const objectiveKeys: StatKey[] = objectiveKeysOf(params.objective, params.objectiveStats);

  const distinctKeys = Array.from(new Set(requirement.sets));

  // ⚠️ Contrainte de statistique principale (slots 2/4/6 seulement), PUIS
  // deux élagages SÛRS (jamais un faux rejet — voir leurs en-têtes plus haut
  // dans le fichier) avant même le pré-filtrage heuristique : dominance
  // (une rune strictement moins bonne qu'une autre du même slot ne sert
  // jamais à rien) puis faisabilité (une rune dont même le meilleur des 5
  // autres emplacements, pris dans le pool réellement possédé, ne suffirait
  // pas à atteindre un minimum demandé — ou qui dépasse déjà seule un
  // maximum — ne peut jamais entrer dans un build valide). Enfin le
  // pré-filtrage heuristique par pertinence, orienté par l'objectif choisi
  // le cas échéant. Cet ordre réduit le pool réel dès le départ, ce qui
  // atténue aussi le coût mémoire/temps de tout ce qui suit — voir
  // spec/outils/optimizer/.
  let bySlot = mainStatFilteredBySlot(pool, requirement);
  bySlot = bySlot.map((list) => pruneDominated(list, requiredKeys, maxKeys));
  bySlot = eliminateInfeasible(bySlot, minEntries, maxEntries, constrainedKeys, guaranteed, artFlat, relPct, totalOf, guaranteedMin);
  const filtered = bySlot.map((list) => filterSlot(list, requirement, base, slotCap, slotCap, params.objective, params.objectiveStats));
  if (filtered.some((list) => list.length === 0)) {
    return null;
  }

  // ⚠️ Nombre RÉEL de pièces exigées par set demandé (pas simplement
  // `setPieces(key)` : `requirement.sets` peut répéter une clé — ex.
  // `['fight','fight']` = 2× Fight = 4 pièces au total, pas 2).
  const requiredPieces = distinctKeys.map((key) => setPieces(key) * requirement.sets.filter((s) => s === key).length);
  const jokerCredit = anyJokerAvailable(filtered) ? 1 : 0;
  const maxSetsForA = maxSetCountsForSlots(filtered, [3, 4, 5], distinctKeys);
  const maxSetsForB = maxSetCountsForSlots(filtered, [0, 1, 2], distinctKeys);
  const bucketCap = params.bucketCap ?? bucketCapFor(slotCap);

  return {
    base, artifacts, relic, requirement, metric,
    maxNodes, maxCollected, maxMs, startedAt,
    minEntries, maxEntries, constrainedKeys, retentionKeys, objectiveKeys, distinctKeys,
    guaranteed, guaranteedMin, artFlat, relPct, totalOf,
    filtered, requiredPieces, jokerCredit, maxSetsForA, maxSetsForB, bucketCap,
  };
}

// PROTOTYPE (ordre d'appariement) — visite les paires de compartiments
// (bA,bB) par potentiel COMBINÉ décroissant (bA.potential+bB.potential) au
// lieu du balayage séquentiel `for bA { for bB } }` (bA#1 croisé avec TOUTE
// la moitié B avant bA#2). Même mécanique que `bestFeasiblePair`
// (scripts/optimum-retention-rate.ts, « k plus grandes sommes ») portée un
// cran plus haut — compartiments au lieu de demi-builds — mais SANS son
// arrêt à la première paire faisable : ici on veut visiter TOUTES les
// paires, juste dans un meilleur ordre, pour rester compatible avec le
// produit actuel (collecter jusqu'à maxCollected sur tout l'espace, pas une
// preuve d'optimalité avec arrêt anticipé — voir spec/outils/optimizer/
// pistes.md, « Branch & Bound au niveau des paires », gated derrière une
// décision produit non prise). `bucketsA`/`bucketsB` DOIVENT déjà être
// triés par potentiel décroissant (comportement existant de `buildBuckets`,
// inchangé).
function* orderedCompartmentPairs(bucketsA: Bucket[], bucketsB: Bucket[]): Generator<readonly [Bucket, Bucket], void, void> {
  interface Entry { i: number; j: number; sum: number }
  const heap: Entry[] = [];
  const seen = new Set<string>();
  function push(i: number, j: number): void {
    if (i >= bucketsA.length || j >= bucketsB.length) return;
    const key = `${i},${j}`;
    if (seen.has(key)) return;
    seen.add(key);
    const entry: Entry = { i, j, sum: bucketsA[i].potential + bucketsB[j].potential };
    heap.push(entry);
    let idx = heap.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[parent].sum >= heap[idx].sum) break;
      [heap[parent], heap[idx]] = [heap[idx], heap[parent]];
      idx = parent;
    }
  }
  function pop(): Entry {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let idx = 0;
      for (;;) {
        const l = 2 * idx + 1;
        const r = 2 * idx + 2;
        let largest = idx;
        if (l < heap.length && heap[l].sum > heap[largest].sum) largest = l;
        if (r < heap.length && heap[r].sum > heap[largest].sum) largest = r;
        if (largest === idx) break;
        [heap[largest], heap[idx]] = [heap[idx], heap[largest]];
        idx = largest;
      }
    }
    return top;
  }
  push(0, 0);
  while (heap.length > 0) {
    const { i, j } = pop();
    yield [bucketsA[i], bucketsB[j]] as const;
    push(i + 1, j);
    push(i, j + 1);
  }
}

// Phase d'appariement : reprend EXACTEMENT le comportement historique de
// `searchBuildsSteps`, une fois les deux moitiés déjà construites (par
// `buildBuckets`, séquentiellement OU en parallèle — cette fonction ne sait
// pas laquelle, et ça n'a pas d'importance pour elle). `startedAt` vient de
// `prepared` (pas un nouveau `Date.now()` ici) : le budget de TEMPS
// (`overBudget`) doit courir depuis le tout début de la recherche, y
// compris le temps passé à construire les moitiés — sinon paralléliser leur
// construction reculerait silencieusement l'échéance du filet de sécurité.
export function* pairBuckets(
  prepared: PreparedSearch,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  // ⚠️ Optionnel : par défaut, un budget FIGÉ à `prepared.maxNodes` — le
  // comportement historique exact, pour tout appelant qui n'a pas besoin
  // d'escalade (voir `NodeBudget`).
  nodeBudget: NodeBudget = { max: prepared.maxNodes }
): Generator<PairingProgress, SearchResult, void> {
  const {
    base, artifacts, relic, requirement, metric, maxCollected, maxMs, startedAt,
    minEntries, maxEntries, guaranteed, guaranteedMin, artFlat, relPct, totalOf, distinctKeys,
  } = prepared;
  const overBudget = () => Date.now() - startedAt > maxMs;

  // Borne optimiste (sûre) pour les MINIMUMS, à partir des bornes de deux
  // compartiments — même principe que dans l'ancien moteur slot-par-slot,
  // appliqué ici au niveau d'une paire de compartiments de 3 runes.
  function pairFeasibleMin(bA: { maxPct: Record<string, number>; maxFlat: Record<string, number> }, bB: typeof bA): boolean {
    return bucketPairFeasibleMin(bA, bB, minEntries, guaranteedMin, relPct, artFlat, totalOf);
  }

  const candidates: BuildCandidate[] = [];
  let explored = 0;
  let truncated = false;

  outer: for (const [bA, bB] of orderedCompartmentPairs(bucketsA, bucketsB)) {
    {
      if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) continue;
      // ⚠️ Une seule rune Intangible peut être sertie par monstre (règle du
      // jeu, voir activeSets dans effects.ts) : deux jokers répartis entre
      // les deux moitiés (1+1, ou 2 dans une seule) ne pourraient jamais être
      // équipés ensemble en jeu, même si `activeSets` calculerait quand même
      // des stats (il plafonne lui-même à 1 joker effectif). `bA.jokers`/
      // `bB.jokers` sont des comptes EXACTS (définissent le compartiment,
      // voir bucketKeyOf) : ce test ne peut jamais écarter une paire à tort.
      if (bA.jokers + bB.jokers > 1) continue;
      if (!pairFeasibleMin(bA, bB)) continue;

      for (const comboA of bA.combos) {
        // Repli rapide côté MINIMUM ET MAXIMUM pour ce comboA précis, avant
        // d'ouvrir la boucle B en entier — voir `comboAFeasible` (factorisée
        // pour être réutilisée à l'identique par `totalPairCount`).
        if (!comboAFeasible(comboA, bB, minEntries, maxEntries, guaranteed, guaranteedMin, relPct, artFlat, totalOf)) continue;

        for (const comboB of bB.combos) {
          explored++;
          if (explored % CHECKPOINT_EVERY === 0) {
            yield { phase: 'pairing', candidates, explored };
          }
          if (explored > nodeBudget.max || overBudget()) {
            truncated = true;
            break outer;
          }

          // ⚠️ Repli EXACT, pas juste une borne optimiste comme `comboAOk`/
          // `pairFeasibleMin` plus haut — AVANT les deux opérations les plus
          // chères de cette boucle (`activeSets` + `computeStats`, l'une et
          // l'autre appelées à CHAQUE paire jusqu'ici, même celles vouées à
          // échouer). `comboA.pct[k] + comboB.pct[k]` (+ `flat`) est
          // EXACTEMENT ce que `computeStats` calculerait pour cette stat —
          // même formule (`totalOf`), mêmes 6 runes, `pct`/`flat` déjà
          // accumulés par moitié sur les mêmes clés (`trackedKeys` ⊇
          // `constrainedKeys`, voir `buildBuckets`). Sur une recherche serrée
          // (le cas qui prend 1-2 minutes), l'écrasante majorité des paires
          // explorées échouent déjà CE test — leur épargner l'allocation du
          // tableau de runes, `activeSets` et `computeStats` est le principal
          // gain mesuré. ⚠️ Ne remplace PAS la revérification finale sur les
          // VRAIES stats plus bas : `guaranteedMin` (contrairement à
          // `guaranteed`, utilisé pour le maximum juste en dessous) inclut
          // `additionalSetActivationHeadroom` — le bonus qu'un set NON
          // demandé, ou DÉJÀ demandé mais activé PLUS de fois que le
          // minimum, pourrait apporter en s'activant sur les emplacements
          // « libres » — mais reste une borne GLOBALE, pas garantie
          // atteignable par CETTE paire précise de demi-builds (voir son
          // commentaire) ; seule la revérification via `computeStats` reste
          // la décision finale.
          let quickOk = true;
          for (const { k, min } of minEntries) {
            const p = (comboA.pct[k] ?? 0) + (comboB.pct[k] ?? 0) + (guaranteedMin.pct[k] ?? 0) + (relPct[k] ?? 0);
            const f = (comboA.flat[k] ?? 0) + (comboB.flat[k] ?? 0) + (guaranteedMin.flat[k] ?? 0) + (artFlat[k] ?? 0);
            if (totalOf(k, p, f) < min) {
              quickOk = false;
              break;
            }
          }
          if (quickOk) {
            for (const { k, max } of maxEntries) {
              const p = (comboA.pct[k] ?? 0) + (comboB.pct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
              const f = (comboA.flat[k] ?? 0) + (comboB.flat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
              if (totalOf(k, p, f) > max) {
                quickOk = false;
                break;
              }
            }
          }
          if (!quickOk) continue;

          const runes: RuneDetail[] = [...comboA.runes, ...comboB.runes];
          // ⚠️ Vérification AUTHENTIQUE sur les runes réelles — le groupage
          // par compte est un pré-filtre sûr mais optimiste (voir
          // `satisfiesSets`), jamais la décision finale.
          const active = activeSets(runes.map((r) => r.set));
          if (missingSets(requirement.sets, active).length > 0) continue;

          const gear: GearSet = { base, runes, artifacts, relic };
          const stats = computeStats(gear);
          let ok = true;
          for (const { k, min } of minEntries) {
            const row = stats.find((r) => r.key === k);
            if (!row || row.total < min) {
              ok = false;
              break;
            }
          }
          if (ok) {
            for (const { k, max } of maxEntries) {
              const row = stats.find((r) => r.key === k);
              if (row && row.total > max) {
                ok = false;
                break;
              }
            }
          }
          if (!ok) continue;

          const effTotal = runes.reduce((sum, r) => sum + valueOf(r, metric), 0);
          candidates.push({ runeIds: runes.map((r) => r.id), stats, effTotal });
          if (candidates.length >= maxCollected) {
            truncated = true;
            break outer;
          }
        }
      }
    }
  }

  return { candidates, explored, truncated };
}

// Fusionne les résultats des N workers de l'appariement PARALLÈLE
// (`runParallelPairing`, runeBuildOptim.worker.ts) en un `SearchResult`
// unique — factorisé ici pour rester testable SANS `worker_threads` (pure
// agrégation sur des `SearchResult[]` déjà calculés, voir `algo-verify`
// point 6 : vérifier au bon étage, pas besoin de rejouer une vraie
// parallélisation pour tester CETTE décision).
//
// ⚠️ `truncated` par worker (`pairBuckets`, ci-dessus) se déclenche pour
// DEUX raisons distinctes, jamais distinguées avant ce correctif : (a) ce
// worker a rempli SON PROPRE `perWorkerMaxCollected` (une tranche riche,
// pas forcément le signe que la recherche GLOBALE est incomplète) ou (b)
// il a épuisé son budget de nœuds/temps (`overBudget()`) AVANT même
// d'atteindre son quota (une vraie troncature — de l'exploration
// planifiée n'a jamais eu lieu). Un simple `results.some(r => r.truncated)`
// (l'ancien comportement) confondait les deux : un worker sur une tranche
// exceptionnellement riche pouvait à lui seul faire annoncer « recherche
// tronquée » alors que le total agrégé restait très en-deçà du plafond
// GLOBAL demandé et que les autres workers avaient fini leur exploration
// au complet. Trouvé par une revue de code externe (2026-08-19, point 4).
//
// Distinction FIABLE (pas une heuristique) : `pairBuckets` vérifie
// toujours le budget nœuds/temps AVANT de pousser un candidat, et ne
// tronque par quota qu'APRÈS un push — au moment où `truncated` sort
// `true`, `candidates.length` vaut EXACTEMENT `perWorkerMaxCollected` si
// la cause est (a), et STRICTEMENT MOINS si la cause est (b) (sinon la
// troncature par quota aurait déjà eu lieu à une itération précédente).
export function combineParallelPairingResults(
  results: SearchResult[],
  perWorkerMaxCollected: number,
  globalMaxCollected: number
): SearchResult {
  const candidates = results.flatMap((r) => r.candidates);
  const explored = results.reduce((s, r) => s + r.explored, 0);
  const realBudgetExhausted = results.some((r) => r.truncated && r.candidates.length < perWorkerMaxCollected);
  const truncated = candidates.length >= globalMaxCollected || realBudgetExhausted;
  return { candidates, explored, truncated };
}

// ⚠️ Simple ORCHESTRATION de `prepareSearch` → `buildBuckets` (×2) →
// `pairBuckets` — plus de logique propre depuis le découpage ci-dessus.
// Conservée telle quelle (comportement IDENTIQUE, vérifié par le harnais
// différentiel existant) pour tout appelant qui n'a pas besoin de paralléliser
// les deux moitiés : `searchBuilds` (tests, scripts, benchmark), et c'est
// aussi ce que `runeBuildOptim.worker.ts` appelait avant sa propre
// parallélisation — désormais il appelle `prepareSearch`/`buildBuckets`/
// `pairBuckets` directement pour pouvoir construire A et B dans deux Workers
// séparés, voir spec/outils/optimizer/ « Suite — parallélisation… ».
export function* searchBuildsSteps(params: SearchParams): Generator<SearchProgress, SearchResult, void> {
  const prepared = prepareSearch(params);
  if (!prepared) {
    return { candidates: [], explored: 0, truncated: false };
  }
  const bucketsA = yield* buildBuckets(
    'A', [0, 1, 2], prepared, prepared.maxSetsForA,
    undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  const bucketsB = yield* buildBuckets(
    'B', [3, 4, 5], prepared, prepared.maxSetsForB,
    undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  return yield* pairBuckets(prepared, bucketsA, bucketsB);
}

// API historique : drainer le générateur jusqu'au bout en un seul appel
// synchrone. C'est ce que testent tests/rune-optim.test.ts,
// tests/rune-optim-differential.test.ts et scripts/benchmark-optim.ts — le
// comportement est identique à avant la restructuration en générateur, seuls
// les points de passage internes ont changé.
export function searchBuilds(params: SearchParams): SearchResult {
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

/* --------------------------------------------------------------------------
 * Exclusion des runes déjà portées par un AUTRE monstre — générique : ne
 * connaît que des ids de runes et une notion d'« à soi », pas la box en
 * particulier. Cette fonction précise (côté box) construit l'ensemble à
 * exclure ; le moteur ci-dessus ne prend que le `pool` déjà filtré.
 * ----------------------------------------------------------------------- */
export function excludedRuneIds(
  allGear: { unitKey: string; com2usId: number | null; gear?: GearSet }[],
  ownCom2usId: number | null
): Set<number> {
  const out = new Set<number>();
  for (const item of allGear) {
    if (ownCom2usId != null && item.com2usId === ownCom2usId) continue; // « à soi »
    for (const r of item.gear?.runes ?? []) out.add(r.id);
  }
  return out;
}
