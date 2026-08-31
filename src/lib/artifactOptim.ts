// Choix de la meilleure PAIRE d'artéfacts pour un build DONNÉ.
//
// ⚠️ **Rien à voir avec `runeBuildOptim.ts`, et c'est voulu.** Toute la
// machinerie des runes (meet-in-the-middle, compartiments, plafonds de
// rétention, budget de nœuds) existe parce qu'elles forment un espace de 6
// emplacements sous contraintes de sets. Ici : DEUX emplacements, et la règle
// d'éligibilité ramène chacun à ~200 candidats sur un inventaire réel. Une
// **double boucle exhaustive** suffit — elle est exacte, et c'est elle la
// référence, il n'y a aucune heuristique à valider.
//
// ⚠️ Le build de runes est FIXE. Ce module ne cherche pas les deux ensemble :
// un artéfact amplifie un build, il n'en déplace pas la cible (voir
// spec/outils/degats-reels.md, « Ces lignes n'entrent PAS dans
// `damageRelevantStats` »).

import { ARTIFACT_KINDS, ArtifactDetail, ArtifactKind, MAX_ARTIFACT_SUBS } from '../types';
import {
  ARTIFACT_SUB_MAX,
  PorteurArtefact,
  artifactFitsMonster,
  artifactPairAllowed,
  eligibleArtifacts,
} from './artifacts';
import { ARTIFACT_SUB, artifactSubKinds, valeurArtefactPropre } from './effects';

// Ce qu'on impose à la stat principale d'un emplacement.
//
// ⚠️ Superset d'`ArtifactMainChoice` (hooks/useOptimizerState.ts), qui n'a pas
// encore `'libre'` : cette valeur n'a de sens QU'AVEC une recherche
// d'artéfacts, et l'ajouter au sélecteur avant que celle-ci existe y poserait
// une option morte.
export type ChoixPrincipale =
  | 'equipped' // ne PAS chercher cet emplacement : garder ce qui est porté
  | 'none' // laisser l'emplacement vide
  | 'libre' // chercher parmi TOUS les éligibles
  | 100 // … ou seulement ceux dont la principale est PV
  | 101 // … ATQ
  | 102; // … DEF

/* --------------------------------------------------------------------------
 * Lignes VERROUILLÉES — « je veux au moins X % de cette sous-propriété »
 * ----------------------------------------------------------------------- */

/**
 * Une sous-propriété exigée, avec son minimum.
 *
 * ⚠️ **Le minimum se lit sur la PAIRE, pas sur une pièce.** Une même ligne peut
 * tomber sur les deux artéfacts et ses valeurs s'additionnent — relevé en jeu
 * (les 2 % de PV de Jessica étaient le cumul du type et de l'attribut, alors
 * que 1,5 % est le maximum d'UNE pièce). Exiger 35 % d'une ligne plafonnée à
 * 30 % est donc satisfiable, mais seulement si les deux pièces la portent.
 */
export interface LigneVerrouillee {
  code: number;
  min: number;
}

/**
 * Plafond de la ligne **sur la paire** — la borne haute du champ de saisie.
 *
 * ⚠️ **Le doublement ne vaut PAS pour toutes les lignes.** Les codes 300-399
 * n'existent que sur l'artéfact d'ATTRIBUT et les 400-499 que sur celui de
 * TYPE : une seule pièce peut les porter, leur plafond reste simple. Seuls les
 * 200-299, communs aux deux sortes, se cumulent. Les plages viennent
 * d'`artifactSubKinds` (effects.ts), vérifiées sur 2 120 artéfacts d'un compte
 * réel — aucune ne débordait.
 *
 * Rend `0` pour un code sans fourchette connue (203, 207, 211-213 : d'anciennes
 * lignes devenues inobtenables). Zéro plutôt qu'un plafond deviné — un maximum
 * inventé laisserait saisir une exigence que rien ne peut satisfaire.
 */
export function plafondLigne(code: number): number {
  const parPiece = ARTIFACT_SUB_MAX[code];
  if (!parPiece) return 0;
  return artifactSubKinds(code).length === 2 ? parPiece * 2 : parPiece;
}

// Valeur CUMULÉE d'une ligne sur la paire.
function valeurLigne(artefacts: ArtifactDetail[], code: number): number {
  let total = 0;
  for (const art of artefacts) for (const sub of art.subs) if (sub.code === code) total += sub.value;
  return total;
}

/**
 * Tolérance de comparaison sur une valeur d'artéfact.
 *
 * ⚠️ **Le bruit de virgule flottante vient de com2us**, pas d'un calcul à nous :
 * l'export contient tel quel `0.8999999999999998` ou `1.4000000000000001` (le
 * jeu accumule ses rolls en flottant). Sans tolérance, une paire cumulant
 * 0,8999999999999998 + 0,5 = 1,3999999999999997 serait REJETÉE face à un
 * minimum de 1,4 — alors que l'écran affiche 1,4 des deux côtés. Un refus
 * invisible et incompréhensible.
 *
 * 1e-6 : très au-dessus du bruit observé (~1e-16), très en dessous du plus
 * petit écart réel entre deux valeurs (0,1 sur les lignes proportionnelles).
 */
const EPSILON_VALEUR = 1e-6;

// Cette paire satisfait-elle TOUTES les lignes verrouillées ?
export function paireRespecteLignes(artefacts: ArtifactDetail[], lignes: LigneVerrouillee[] | undefined): boolean {
  if (!lignes?.length) return true;
  for (const l of lignes) {
    if (l.min <= 0) continue;
    if (valeurLigne(artefacts, l.code) < l.min - EPSILON_VALEUR) return false;
  }
  return true;
}

/**
 * Combien d'emplacements de sous-propriété les verrous réservent, par sorte.
 *
 * ⚠️ **Un artéfact ne porte que 4 sous-propriétés**, soit 8 sur la paire, en
 * deux moitiés de 4 qui ne communiquent pas. Verrouiller 5 lignes réservées au
 * type est donc impossible d'avance, quelle que soit la richesse de
 * l'inventaire.
 *
 * ⚠️ Une ligne cumulable dont le minimum dépasse le plafond d'UNE pièce exige
 * la ligne sur les DEUX : elle consomme un emplacement de chaque côté, pas un
 * seul « libre ». C'est le cas qu'une simple somme raterait.
 *
 * ⚠️ **`impossible` ne prouve QUE le dépassement d'emplacements.** Il ne dit
 * rien de ce que l'inventaire contient : une combinaison qui tient dans les 8
 * emplacements peut parfaitement n'être satisfaite par aucune paire réelle.
 * Ce diagnostic-là se lit sur le balayage, jamais sur une déduction — voir
 * `meilleurCumulParLigne`.
 */
export interface BudgetEmplacements {
  attribut: number; // emplacements réservés côté attribut
  type: number; // … côté type
  libres: number; // lignes plaçables indifféremment d'un côté ou de l'autre
  impossible: boolean;
}

export function budgetEmplacements(lignes: LigneVerrouillee[]): BudgetEmplacements {
  let attribut = 0;
  let type = 0;
  let libres = 0;
  for (const l of lignes) {
    if (l.min <= 0) continue;
    const sortes = artifactSubKinds(l.code);
    if (sortes.length === 1) {
      if (sortes[0] === 'element') attribut++;
      else type++;
    } else if (l.min > (ARTIFACT_SUB_MAX[l.code] ?? 0)) {
      // Au-delà du plafond d'une pièce : les DEUX doivent la porter.
      attribut++;
      type++;
    } else {
      libres++;
    }
  }
  // Les `libres` se répartissent dans ce qui reste des deux moitiés — d'où la
  // troisième condition, qui n'est PAS impliquée par les deux premières.
  const impossible =
    attribut > MAX_ARTIFACT_SUBS ||
    type > MAX_ARTIFACT_SUBS ||
    attribut + type + libres > MAX_ARTIFACT_SUBS * 2;
  return { attribut, type, libres, impossible };
}

export interface ArtifactSearchParams {
  porteur: PorteurArtefact;
  // L'inventaire COMPLET : le filtrage d'éligibilité se fait ici, pas chez
  // l'appelant — c'est la règle du jeu, elle n'a pas à être redite ailleurs.
  inventaire: ArtifactDetail[];
  // Ce que le monstre porte AUJOURD'HUI, pour le choix `'equipped'`.
  equipes: ArtifactDetail[];
  // Par sorte ; une sorte absente vaut `'libre'`.
  principaleParSorte: Partial<Record<ArtifactKind, ChoixPrincipale>>;
  // Sous-propriétés exigées, avec leur minimum CUMULÉ sur la paire.
  lignesVerrouillees?: LigneVerrouillee[];
  /**
   * Chiffrer aussi ce que les verrous coûtent SUR CE BUILD.
   *
   * ⚠️ **Ce n'est pas gratuit, et ça ne peut pas l'être** : on ne peut pas à la
   * fois écarter une paire sans l'évaluer et connaître son score. L'activer
   * désactive donc l'élagage par obligation (la déduplication, elle, reste :
   * un doublon inerte ne peut pas être le meilleur non plus).
   *
   * À n'activer que pour les builds réellement AFFICHÉS. Les appels internes
   * (`paireRepresentative`) n'en ont que faire et gardent l'élagage complet.
   */
  avecCoutDesVerrous?: boolean;
  // Score d'une paire. ⚠️ L'appelant recalcule les stats DEDANS : la stat
  // principale d'un artéfact entre dans les stats du monstre, donc changer
  // d'artéfact change le build. Un score qui l'ignorerait comparerait des
  // paires sur des stats fausses.
  evaluer: (artefacts: ArtifactDetail[]) => number;
}

export interface PaireArtefacts {
  element: ArtifactDetail | null;
  archetype: ArtifactDetail | null;
  score: number;
}

/* --------------------------------------------------------------------------
 * Pré-filtrage — écarter ce qui ne peut PAS gagner
 * ----------------------------------------------------------------------- */

/**
 * Ce que CETTE sorte doit obligatoirement porter, et à partir de quelle valeur.
 *
 * ⚠️ **Le seuil n'est pas le minimum demandé.** Il en retranche ce que l'AUTRE
 * pièce peut apporter au mieux : une ligne exclusive à une sorte ne reçoit rien
 * d'en face (seuil = `min`), une ligne cumulable peut compter sur un plafond
 * complet (seuil = `min − plafond d'une pièce`). Prendre `min` dans les deux cas
 * écarterait des paires parfaitement valides.
 *
 * Un seuil ≤ 0 signifie « rien d'obligatoire de ce côté » et n'est pas rendu.
 */
function seuilsObligatoires(lignes: LigneVerrouillee[], kind: ArtifactKind): { code: number; seuil: number }[] {
  const out: { code: number; seuil: number }[] = [];
  for (const l of lignes) {
    if (l.min <= 0) continue;
    const sortes = artifactSubKinds(l.code);
    if (!sortes.includes(kind)) continue;
    // Ce que l'AUTRE pièce peut apporter au maximum : rien si la ligne est
    // exclusive à cette sorte, un plafond entier si elle est cumulable.
    const apportAutre = sortes.length === 2 ? (ARTIFACT_SUB_MAX[l.code] ?? 0) : 0;
    const seuil = l.min - apportAutre;
    if (seuil > 0) out.push({ code: l.code, seuil });
  }
  return out;
}

// Valeur d'une ligne sur UNE pièce.
function valeurSur(art: ArtifactDetail, code: number): number {
  let total = 0;
  for (const s of art.subs) if (s.code === code) total += s.value;
  return total;
}

/* --------------------------------------------------------------------------
 * Pertinence — quelles lignes comptent POUR CE RÉGLAGE
 * ----------------------------------------------------------------------- */

/**
 * Les lignes qui font réellement bouger les dégâts, ici et maintenant.
 *
 * ⚠️ **La pertinence dépend du RÉGLAGE, pas du code.** Une première version
 * testait `artifactDamageProfile` hors contexte et se trompait dans les quatre
 * cas suivants, tous relevés à l'usage :
 *
 *  - « Dmg crit Compétence 2 » ne sert à RIEN quand on optimise le S3 ;
 *  - « Dmg crit cible unique pendant ton tour » ne sert à rien sur une attaque
 *    de ZONE (le S3 de Lushen) ;
 *  - les lignes élémentaires ne servent à rien si l'élément visé est ignoré ;
 *  - en visant le Vent, « dégâts infligés à l'Eau » ne sert toujours à rien.
 *
 * ⚠️ **Sondé contre le VRAI calcul**, jamais contre une table de codes. On
 * évalue un artéfact qui ne porte QUE cette ligne, et on regarde si le score
 * bouge. Une table recopiée ici dériverait au premier changement du modèle de
 * dégâts, et l'écart ne se verrait pas : on écarterait silencieusement des
 * artéfacts devenus utiles. La sonde, elle, suit le modèle par construction.
 *
 * Coût : une évaluation par code connu (~57), UNE fois par recherche — contre
 * des dizaines de milliers de paires. Négligeable.
 */
export interface Pertinence {
  // Codes dont la valeur fait monter les dégâts. Seuls ceux-là servent de
  // dimension à la dominance.
  croissants: Set<number>;
  // ⚠️ Codes qui bougent les dégâts SANS monter (baisse, ou effet non
  // monotone). Un artéfact qui en porte n'est JAMAIS élagué par dominance :
  // comparer sur une dimension dont on ignore le sens produirait des
  // éliminations fausses. Conservateur par choix.
  ambigus: Set<number>;
}

const EPSILON_SONDE = 1e-9;

export function analyserPertinence(params: ArtifactSearchParams): Pertinence {
  const croissants = new Set<number>();
  const ambigus = new Set<number>();
  const sonde = (kind: ArtifactKind, subs: { code: number; value: number }[]): ArtifactDetail =>
    kind === 'element'
      ? { id: 0, kind, element: params.porteur.element, level: 15, rarity: 5, main: { code: 101, value: 0 }, subs }
      : { id: 0, kind, archetype: params.porteur.archetype ?? undefined, level: 15, rarity: 5, main: { code: 101, value: 0 }, subs };

  for (const brut of Object.keys(ARTIFACT_SUB)) {
    const code = Number(brut);
    const plafond = ARTIFACT_SUB_MAX[code];
    // Une ligne sans fourchette connue (203, 207, 211-213 : inobtenables) n'a
    // pas de valeur de sonde crédible — laissée hors dominance.
    if (!plafond) continue;
    const kind = artifactSubKinds(code)[0]!;
    // ⚠️ Référence et sonde ne diffèrent QUE par la ligne : même sorte, même
    // principale à 0. Sans ça, on mesurerait aussi l'effet de la principale.
    const delta = params.evaluer([sonde(kind, [{ code, value: plafond }])]) - params.evaluer([sonde(kind, [])]);
    if (delta > EPSILON_SONDE) croissants.add(code);
    else if (delta < -EPSILON_SONDE) ambigus.add(code);
  }
  return { croissants, ambigus };
}

/**
 * Réduit les candidats d'un emplacement à ceux qui peuvent encore gagner.
 *
 * ⚠️ **Exact, jamais heuristique.** Deux élagages, chacun prouvé :
 *
 * 1. **Obligation.** Si une ligne verrouillée ne peut être servie que par cette
 *    sorte (ou exige les deux pièces), tout candidat qui n'atteint pas son
 *    seuil rend la paire infaisable, quel que soit le vis-à-vis. L'emplacement
 *    VIDE tombe avec eux — il ne porte rien.
 * 2. **Doublon inerte.** `computeStats` ne lit que la stat PRINCIPALE d'un
 *    artéfact (stats.ts), jamais ses sous-propriétés. Deux artéfacts sans aucun
 *    effet sur les dégâts et de même principale `(code, valeur)` produisent donc
 *    exactement le même score : en garder un seul ne peut rien coûter.
 *    ⚠️ La déduplication porte sur `(code, valeur)`, PAS sur le seul code : on
 *    ne suppose nulle part que le score croît avec la principale. Garder « la
 *    plus grosse » exigerait cette monotonie, que rien ne garantit.
 */
export function preFiltrerCandidats(
  candidats: (ArtifactDetail | null)[],
  kind: ArtifactKind,
  lignes: LigneVerrouillee[] = [],
  pertinence?: Pertinence
): (ArtifactDetail | null)[] {
  const obligatoires = seuilsObligatoires(lignes, kind);
  const verrous = lignes.filter((l) => l.min > 0);
  const codesVerrouilles = new Set(verrous.map((l) => l.code));

  // ── 1. Obligation : ce qui ne peut plus former de paire faisable.
  const survivants: ArtifactDetail[] = [];
  let videPossible = obligatoires.length === 0;
  for (const art of candidats) {
    if (!art) continue;
    if (obligatoires.some((o) => valeurSur(art, o.code) < o.seuil)) continue;
    survivants.push(art);
  }

  // ── 2. Dominance sur les seules dimensions qui comptent.
  //
  // ⚠️ Les DIMENSIONS sont le cœur de l'exactitude : les lignes qui font
  // monter les dégâts POUR CE RÉGLAGE (`pertinence.croissants` — donc pas
  // « Dmg crit Compétence 2 » quand on optimise le S3, pas les lignes
  // élémentaires quand l'élément est ignoré), les lignes VERROUILLÉES par
  // l'utilisateur, et les TROIS stats principales.
  //
  // ⚠️ **Les trois principales sont retenues inconditionnellement**, même
  // celles qui ne pèsent pas sur les dégâts. Un artéfact peut n'être là que
  // pour satisfaire un minimum de stat demandé à la recherche de runes
  // (`respecteMinimums`), que ce module ne connaît pas. Les élaguer sur les
  // seuls dégâts perdrait ces pièces-là sans que rien ne le signale.
  // ⚠️ **Sans analyse de pertinence, AUCUNE dominance.** Se rabattre sur les
  // seules principales comparerait deux artéfacts en ignorant toutes leurs
  // sous-propriétés : le premier venu éliminerait un artéfact bien meilleur de
  // même principale. Un défaut prudent, pas un défaut « partiel ».
  const dims = pertinence ? [...new Set([...pertinence.croissants, ...codesVerrouilles])] : null;
  const MAINS = [100, 101, 102];
  const vecteur = (a: ArtifactDetail): number[] => [
    ...(dims ?? []).map((c) => valeurSur(a, c)),
    ...MAINS.map((m) => (a.main.code === m ? a.main.value : 0)),
  ];
  const vecteurs = survivants.map(vecteur);
  // ⚠️ Un artéfact portant une ligne AMBIGUË (qui bouge les dégâts sans
  // monter) échappe à la dominance : on ignorerait une dimension dont on ne
  // connaît pas le sens, et l'élimination serait fausse.
  const comparable = survivants.map(
    (a) => pertinence == null || !a.subs.some((s) => pertinence.ambigus.has(s.code))
  );

  const garde: ArtifactDetail[] = [];
  for (let i = 0; i < survivants.length; i++) {
    if (dims == null || !comparable[i]) {
      garde.push(survivants[i]!);
      continue;
    }
    let domine = false;
    for (let j = 0; j < survivants.length && !domine; j++) {
      if (i === j || !comparable[j]) continue;
      // ⚠️ **Un INTANGIBLE n'élimine jamais un artéfact ordinaire.** Il est
      // peut-être meilleur sur toutes les dimensions, mais il traîne une
      // contrainte de PAIRE qu'aucune d'elles ne porte : on ne peut pas en
      // équiper deux. Remplacer l'ordinaire par lui rendrait infaisable toute
      // paire où l'autre emplacement est déjà intangible — un candidat légal
      // perdu, sans que rien ne le signale.
      //
      // ⚠️ L'inverse est SÛR : un intangible dominé par un ordinaire peut
      // disparaître, puisque substituer un ordinaire ne restreint jamais rien.
      if (survivants[j]!.intangible && !survivants[i]!.intangible) continue;
      const vi = vecteurs[i]!;
      const vj = vecteurs[j]!;
      let auMoinsEgal = true;
      let strictementMieux = false;
      for (let d = 0; d < vi.length; d++) {
        if (vj[d]! < vi[d]!) {
          auMoinsEgal = false;
          break;
        }
        if (vj[d]! > vi[d]!) strictementMieux = true;
      }
      // ⚠️ **Le piège des ex æquo.** Deux artéfacts au vecteur IDENTIQUE se
      // dominent l'un l'autre : sans départage, les deux disparaîtraient et
      // l'emplacement se viderait. À égalité parfaite, seul le plus petit
      // indice survit — un ordre total, donc jamais deux éliminations
      // croisées.
      if (auMoinsEgal && (strictementMieux || j < i)) domine = true;
    }
    if (!domine) garde.push(survivants[i]!);
  }

  // ⚠️ `null` reste une option tant qu'aucune ligne n'est obligatoire ici — et
  // il n'est JAMAIS soumis à la dominance : « pas d'artéfact » n'est pas
  // comparable à « un artéfact », c'est un choix que l'utilisateur peut vouloir
  // pour des raisons hors de ce module.
  return videPossible ? [null, ...garde] : garde;
}

// Candidats d'un emplacement, une fois l'éligibilité ET le filtre de
// principale appliqués. `null` y figure quand l'emplacement peut rester vide.
export function candidatsParSorte(params: ArtifactSearchParams, kind: ArtifactKind): (ArtifactDetail | null)[] {
  const choix = params.principaleParSorte[kind] ?? 'libre';
  if (choix === 'none') return [null];
  if (choix === 'equipped') {
    const porte = params.equipes.find((a) => a.kind === kind) ?? null;
    // ⚠️ Même en `'equipped'`, on vérifie l'éligibilité : un exemplaire dont
    // l'équipement vient d'un import peut ne plus correspondre au monstre
    // (forme changée, donnée ancienne). Mieux vaut un emplacement vide qu'une
    // paire qu'on ne peut pas équiper.
    return [porte && artifactFitsMonster(porte, params.porteur) ? porte : null];
  }
  const eligibles = eligibleArtifacts(params.inventaire, params.porteur, kind);
  const filtres = choix === 'libre' ? eligibles : eligibles.filter((a) => a.main.code === choix);
  // ⚠️ `null` TOUJOURS proposé : un emplacement vide reste une option valide,
  // et c'est parfois la seule (aucun candidat éligible). Sans lui, un monstre
  // sans artéfact d'attribut ne produirait aucune paire du tout.
  //
  // ⚠️ **Aucun pré-filtrage ici.** Il a d'abord été posé à cet endroit, et il y
  // était FAUX : `meilleurCumulParLigne` serait alors parti des candidats déjà
  // élagués et aurait rapporté « au mieux 24 % » sur un inventaire qui monte à
  // 40 %. Un diagnostic qui ment est pire que pas de diagnostic. Cette fonction
  // reste donc la vue COMPLÈTE ; l'élagage vit dans `candidatsPourRecherche`,
  // que seule la boucle de recherche emprunte.
  return [null, ...filtres];
}

// Les candidats effectivement PARCOURUS par la recherche : la vue complète,
// une fois élaguée de ce qui ne peut pas gagner.
//
// ⚠️ `avecCoutDesVerrous` désactive l'élagage par OBLIGATION (pas la
// déduplication, toujours sûre). C'est le prix exact du chiffrage : on ne peut
// pas à la fois écarter une paire sans l'évaluer et connaître son score. Les
// appels internes qui n'ont que faire du coût (`paireRepresentative`) gardent
// donc l'élagage complet et restent rapides.
function candidatsPourRecherche(
  params: ArtifactSearchParams,
  kind: ArtifactKind,
  pertinence: Pertinence
): (ArtifactDetail | null)[] {
  const complets = candidatsParSorte(params, kind);
  const lignes = params.avecCoutDesVerrous ? [] : (params.lignesVerrouillees ?? []);
  return preFiltrerCandidats(complets, kind, lignes, pertinence);
}

// La meilleure paire, ou les `combien` meilleures.
//
// ⚠️ **La contrainte de paire n'est PAS un détail** : deux intangibles ne
// peuvent pas être portés ensemble, alors que chacun est éligible seul.
// Filtrer emplacement par emplacement puis prendre le meilleur de chaque côté
// produirait une paire inéquipable.
export function meilleuresPairesArtefacts(params: ArtifactSearchParams, combien = 1): PaireArtefacts[] {
  return chercherPaires(params, combien).paires;
}

export interface ResultatPaires {
  // Les meilleures paires RESPECTANT les lignes verrouillées. Vide si aucune
  // n'y parvient — un tableau vide, jamais un repli sur une paire qui viole
  // l'exigence : elle serait affichée sans que rien ne le signale.
  paires: PaireArtefacts[];
  /**
   * Le meilleur score TOUTES paires confondues, verrous ignorés.
   *
   * ⚠️ C'est ce qui chiffre **le coût des verrous sur ce build** : le même
   * balayage tient deux accumulateurs au lieu d'un, une comparaison de plus par
   * paire, pas un second parcours.
   *
   * ⚠️ **Coût SUR CE BUILD, jamais coût global.** La recherche de runes ayant
   * elle-même tourné sous le modèle contraint (les verrous s'appliquent aussi à
   * la paire supposée, voir `paireRepresentative`), d'autres builds auraient pu
   * émerger sans eux. Le chiffrer exigerait de relancer toute la recherche.
   * Un libellé qui laisserait croire au contrefactuel global serait faux.
   *
   * `null` quand aucun verrou n'est posé — il n'y a alors rien à comparer.
   */
  meilleurSansVerrous: number | null;
}

export function chercherPaires(params: ArtifactSearchParams, combien = 1): ResultatPaires {
  const pertinence = analyserPertinence(params);
  const parSorte = ARTIFACT_KINDS.map(({ key }) => candidatsPourRecherche(params, key, pertinence));
  const [candidatsElement, candidatsArchetype] = parSorte;
  const verrous = params.lignesVerrouillees?.filter((l) => l.min > 0) ?? [];
  const trouvees: PaireArtefacts[] = [];
  // ⚠️ Chiffré SEULEMENT si l'appelant l'a demandé : sans ça, l'élagage par
  // obligation a déjà retiré les paires non conformes, et le « meilleur sans
  // verrous » calculé sur ce qui reste serait FAUX — égal au meilleur
  // conforme, donc un coût de 0 % systématique. Un nombre faux vaut moins que
  // pas de nombre.
  let meilleurSansVerrous = verrous.length && params.avecCoutDesVerrous ? Number.NEGATIVE_INFINITY : null;
  // Réutilisé d'un tour à l'autre : à ~50 000 paires, une allocation par
  // itération se verrait.
  const paire: ArtifactDetail[] = [];
  for (const element of candidatsElement) {
    for (const archetype of candidatsArchetype) {
      if (!artifactPairAllowed(element, archetype)) continue;
      paire.length = 0;
      if (element) paire.push(element);
      if (archetype) paire.push(archetype);
      const score = params.evaluer(paire);
      if (meilleurSansVerrous !== null && score > meilleurSansVerrous) meilleurSansVerrous = score;
      if (!paireRespecteLignes(paire, verrous)) continue;
      trouvees.push({ element, archetype, score });
    }
  }
  // ⚠️ Tri DÉCROISSANT stable : à score égal, l'ordre de l'inventaire départage.
  // Un tri instable rendrait le résultat dépendant du moteur JS.
  trouvees.sort((a, b) => b.score - a.score);
  return {
    paires: trouvees.slice(0, Math.max(1, combien)),
    meilleurSansVerrous:
      meilleurSansVerrous === null || meilleurSansVerrous === Number.NEGATIVE_INFINITY
        ? null
        : meilleurSansVerrous,
  };
}

/**
 * Le meilleur cumul RÉELLEMENT atteignable pour chaque ligne verrouillée.
 *
 * ⚠️ **Observé, jamais déduit.** Quand aucune paire ne passe, il faut dire
 * laquelle bloque et de combien. Un pré-contrôle théorique pourrait annoncer
 * « impossible » sur une combinaison en fait réalisable — bien pire que de se
 * taire. On rapporte donc ce que l'inventaire a réellement produit.
 *
 * ⚠️ Le maximum se prend ligne par ligne, INDÉPENDAMMENT : deux lignes peuvent
 * chacune être atteignable sans qu'aucune paire ne les serve ensemble. C'est un
 * diagnostic pour orienter, pas une preuve de faisabilité conjointe.
 */
export function meilleurCumulParLigne(
  params: ArtifactSearchParams,
  lignes: LigneVerrouillee[]
): { code: number; min: number; auMieux: number; atteint: boolean }[] {
  const [candidatsElement, candidatsArchetype] = ARTIFACT_KINDS.map(({ key }) => candidatsParSorte(params, key));
  const paire: ArtifactDetail[] = [];
  const auMieux = new Map<number, number>(lignes.map((l) => [l.code, 0]));
  for (const element of candidatsElement) {
    for (const archetype of candidatsArchetype) {
      if (!artifactPairAllowed(element, archetype)) continue;
      paire.length = 0;
      if (element) paire.push(element);
      if (archetype) paire.push(archetype);
      for (const l of lignes) {
        const v = valeurLigne(paire, l.code);
        if (v > (auMieux.get(l.code) ?? 0)) auMieux.set(l.code, v);
      }
    }
  }
  return lignes.map((l) => {
    // ⚠️ Même tolérance que le filtre, et la valeur ARRONDIE pour l'affichage :
    // annoncer « 1.3999999999999997 % au mieux » face à « 1.4 % exigé » serait
    // illisible, et pire, ferait croire à un manque là où il n'y en a pas.
    const v = valeurArtefactPropre(auMieux.get(l.code) ?? 0);
    return { code: l.code, min: l.min, auMieux: v, atteint: v >= l.min - EPSILON_VALEUR };
  });
}

/**
 * La paire à SUPPOSER pendant une recherche de RUNES, quand les artéfacts
 * seront choisis après coup.
 *
 * ⚠️ **Corrige une asymétrie qui faussait le classement.** Un artéfact
 * « hypothéqué » par le sélecteur de stat principale était fabriqué avec
 * `subs: []` — donc AUCUNE ligne d'effet. Choisir « ATQ » faisait calculer
 * les dégâts sans les +30 % de renforcement d'ATQ ni les points de Dgts Crit
 * conditionnels, alors que « Comme équipé » les comptait. Deux réglages
 * voisins, deux modèles de dégâts différents, sans que rien ne le signale.
 *
 * Ici, la paire supposée est celle que le Mode A choisirait **pour le build
 * courant**, sous la même contrainte de principale : de vrais artéfacts, avec
 * leurs vraies lignes. Ce n'est pas la paire finale (elle dépend du build que
 * la recherche va trouver), mais c'est un représentant honnête plutôt qu'une
 * coquille vide.
 *
 * ⚠️ La paire finale peut différer — d'où `respecteMinimums`, à repasser sur
 * le build trouvé une fois ses vrais artéfacts choisis.
 *
 * ⚠️ **Les lignes verrouillées s'appliquent ICI aussi**, et c'est délibéré.
 * Chaque verrou mange un emplacement de sous-propriété qui aurait pu porter une
 * ligne de dégâts — jusqu'à 8 sur 8. Une paire supposée qui les ignorerait
 * serait OPTIMISTE : elle noterait les 100 000 builds sur un potentiel que la
 * paire finale ne pourra jamais atteindre, et le classement retomberait dans
 * l'asymétrie que cette fonction existe pour corriger.
 *
 * ⚠️ Rend un tableau VIDE si aucune paire ne satisfait les verrous. L'appelant
 * doit alors REFUSER de lancer la recherche et montrer le diagnostic
 * (`meilleurCumulParLigne`) : chercher quand même noterait tous les builds sans
 * aucun artéfact, ce qui est précisément le bug `subs: []`.
 */
export function paireRepresentative(params: ArtifactSearchParams): ArtifactDetail[] {
  const meilleure = meilleuresPairesArtefacts(params)[0];
  if (!meilleure) return [];
  return [meilleure.element, meilleure.archetype].filter((a): a is ArtifactDetail => a != null);
}

/**
 * Un build satisfait-il encore ses minimums, une fois sa VRAIE paire choisie ?
 *
 * ⚠️ **Indispensable dès que les artéfacts sont cherchés après les runes.** La
 * recherche de runes valide les minimums avec la paire SUPPOSÉE ; si la paire
 * finale porte une autre stat principale, un minimum peut être franchi à la
 * baisse sans que rien ne le dise. Un build affiché qui viole la condition
 * demandée est pire qu'un build manquant : l'utilisateur ne le vérifie pas.
 *
 * `stats` = celles du build AVEC sa paire finale.
 */
export function respecteMinimums(stats: { key: string; total: number }[], minStats: Record<string, number | undefined>): boolean {
  for (const [k, min] of Object.entries(minStats)) {
    if (min == null || min <= 0) continue;
    const s = stats.find((x) => x.key === k);
    if (!s || s.total < min) return false;
  }
  return true;
}

// Nombre de paires que la recherche va réellement parcourir — utile pour
// annoncer l'ampleur AVANT de lancer, et pour vérifier que l'éligibilité fait
// bien son travail d'élagage.
export function nombreDePaires(params: ArtifactSearchParams): number {
  const pert = analyserPertinence(params);
  const [e, a] = ARTIFACT_KINDS.map(({ key }) => candidatsPourRecherche(params, key, pert));
  let n = 0;
  for (const x of e) for (const y of a) if (artifactPairAllowed(x, y)) n++;
  return n;
}

/**
 * Combien de paires SURVIVENT aux lignes verrouillées.
 *
 * ⚠️ Distinct de `nombreDePaires`, qui compte ce que la boucle PARCOURT : les
 * verrous n'élaguent pas le parcours, ils écartent au moment de retenir. La
 * carte affiche les deux — « 412 paires éligibles · 38 retenues » — parce que
 * l'écart est précisément ce qui dit si l'exigence est serrée.
 */
export function nombreDePairesRetenues(params: ArtifactSearchParams): number {
  const verrous = params.lignesVerrouillees?.filter((l) => l.min > 0) ?? [];
  if (!verrous.length) return nombreDePaires(params);
  const pert = analyserPertinence(params);
  const [e, a] = ARTIFACT_KINDS.map(({ key }) => candidatsPourRecherche(params, key, pert));
  const paire: ArtifactDetail[] = [];
  let n = 0;
  for (const x of e) {
    for (const y of a) {
      if (!artifactPairAllowed(x, y)) continue;
      paire.length = 0;
      if (x) paire.push(x);
      if (y) paire.push(y);
      if (paireRespecteLignes(paire, verrous)) n++;
    }
  }
  return n;
}
