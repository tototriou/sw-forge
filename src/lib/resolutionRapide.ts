// Résolution RAPIDE de l'équipement d'un build — le chemin de l'app :
// `resoudreEquipementDuBuild` (relicQueue.ts), que l'écran, le Worker de
// résolution et le CLI appellent, passe par elle. Même entrée
// (`EntreeResolution`, assemblée par `entreeResolutionDuBuild`) ; pour un
// build CONFORME, même résultat, champ pour champ, que le calcul exhaustif
// (`resoudreEquipementDuBuildExhaustif`, resolutionExhaustive.ts).
//
// L'idée : en mode relique `recherche`, le calcul exhaustif note TOUTES les
// paires d'artéfacts de CHAQUE relique éligible (`pairesParScore`), puis les
// parcourt par score décroissant jusqu'au premier couple faisable
// (`respecteConditionsAvecRelique`, un `computeStats` par paire examinée).
//
// Or la faisabilité d'un couple ne dépend des artéfacts que par leurs
// PRINCIPALES : `computeStats` ne lit d'un artéfact que `main.code` et
// `main.value` (stats.ts, boucle `gear.artifacts`), d'une relique que
// `main.code` et `main.value` (boucle `gear.relic`), et
// `respecteMinEtMax` ne lit que ces stats et les auras propres des runes. Les
// pièces d'une paire sortent toujours de `candidatsParSorte` (ou sont
// l'emplacement vide : `preFiltrerCandidats` le rajoute) ; d'où un
// SUR-ENSEMBLE fini des formes de paire : (principale distincte d'attribut ou
// vide) × (principale distincte de type ou vide), 16 formes sur Kinki.
//
// Le verdict d'une forme, par principale de relique, est le jugement même de
// `respecteConditionsAvecRelique` (`respecteMinEtMax` sur les stats de la
// paire, auras propres du build) ; ses entrées se calculent une fois : les
// auras propres par build, les stats sans artéfact par principale de relique
// (`statsParPaire`, au bit près le `computeStats` de chaque paire). Une paire
// se juge par l'indice de la forme de chacune de ses pièces (`FormesDePaire`),
// lu une fois par pièce et par relique, jamais une clé construite par paire.
//
// - **Aucune forme faisable pour une relique** → aucune paire ne l'est : la
//   relique est « infaisable » sans qu'aucune paire ne soit notée.
// - **Sinon, seules les paires FAISABLES sont notées** : la double
//   boucle de `collecterPaires`, mêmes entrées, même ordre, mais `evaluer`
//   n'est appelé que sur une paire dont la forme est faisable ; la meilleure
//   est la plus grande note, au PLUS PETIT indice parmi les ex æquo — la
//   première faisable de l'ordre de `pairesParScore` tant qu'aucune note
//   n'est NaN (tri stable décroissant, comparateur cohérent hors NaN).
// - **Une note NaN vue** sur une paire faisable → ce build est résolu par le
//   calcul exhaustif, signalé par `console.warn` une fois. ⚠️ Une note NaN
//   portée par une paire INFAISABLE seule n'est jamais calculée : le calcul
//   exhaustif, qui trie avec elle, peut alors ordonner autrement les
//   faisables ; la résolution rapide rend la meilleure faisable. Écart
//   accepté : la note du build est déjà incohérente.
// - **Le build n'a aucun couple faisable** → sans `diagnostic` (le chemin de
//   l'app : sans le diagnostic d'un build rejeté, jamais montré à l'écran),
//   le résultat du calcul exhaustif quand aucune paire n'existe : ni paire,
//   ni artéfact, ni relique ; avec `diagnostic` (la fonction du CLI,
//   `resoudreEquipementCli`, le banc et les tests), le calcul exhaustif
//   lui-même.
//
// ⚠️ **Lignes verrouillées avec `avecCoutDesVerrous`** : `meilleurSansVerrous`
// lit TOUTES les notes ; la relique (ou la paire fixe) y est notée entière
// par `pairesParScore`, comme le calcul exhaustif (exact, NaN compris).
// Aucun producteur de l'app ne pose ce drapeau dans les paramètres d'une
// résolution (l'écran ne le passe qu'à un `chercherPaires` à part) : ces deux
// branches ne servent pas en production. Gardées parce que le contrat vaut
// pour TOUTE `EntreeResolution` — `faireParams` peut le porter — et que le
// calcul exhaustif rend alors une note dans `meilleurSansVerrous` : sans
// elles, la résolution rapide rendrait `null` à sa place. Le test les
// compare, relique `recherche` comme relique fixe.
//
// ⚠️ **Aucune borne ni heuristique** : aucune paire faisable n'est écartée sur
// une note. En « Dégâts réels », une relique DOMINÉE (`reliquesDominees` :
// une autre, faisable sur chacune de ses formes, a sur chacune au moins ses
// PV, son ATQ, sa DEF et ses dégâts infligés, et gagne l'égalité) n'est pas
// notée — exact par la règle de jeu R (dégâts non décroissants en ces
// canaux, confirmée par l'utilisateur), jamais par une note ; elle l'est à un
// tour de plus si aucune de ses dominantes n'a de couple faisable. Puis, par
// classe de paires (`DominanceParPaire`), une paire faisable n'est pas notée
// si une autre relique la domine sur les seuls canaux que la note de cette
// paire lit (table des lecteurs, `statsDuLanceurLuesParLaNote`). ⚠️ Une note
// NaN d'une relique ou d'une paire dominée n'est alors jamais vue (pas de
// repli).
// Le choix entre reliques reste `bestRelicForBuild` ; les caches
// partagés sont ceux de la file (`CachesResolution`), représentants des
// formes compris (`caches.rapide`).
//
// Hors mode `recherche` (relique portée fixe) : le prédicat
// `respecteConditions` est mémoïsé par forme de paire, au premier jugement
// d'une paire de cette forme (précondition : il ne lit des artéfacts que
// leurs principales — vrai pour son seul producteur,
// `entreeResolutionDuBuild`).

import { ARTIFACT_KINDS, ArtifactDetail, ArtifactKind, RelicDetail } from '../types';
import { ARTIFACT_MAIN } from './effects';
import {
  ArtifactSearchParams,
  MemoPreFiltre,
  PaireArtefacts,
  analyserPertinence,
  candidatsParSorte,
  paireRespecteLignes,
  pairesParScore,
  preFiltrerCandidats,
} from './artifactOptim';
import { artifactPairAllowed } from './artifacts';
import { BuildRequirement, RechercheRefusee, conditionsPaireFixe, respecteConditionsAvecRelique, respecteMinEtMax } from './runeBuildOptim';
import { artifactDamageProfile, aurasPropresDesRunes, statsDesLignesBrutes } from './damage';
import { MeilleureRelique, RelicEvaluation, bestRelicForBuild, prefereeALEgalite } from './relicOptim';
import { ContexteExclusive, apportExclusive, statsAvecApport } from './relicExclusive';
import type { ResultatArtefacts } from './artifactQueue';
// Type seul : relicQueue.ts importe ce module (son point d'entrée et ses
// caches), un import de valeur ferait un cycle.
import type { EntreeResolution } from './relicQueue';
import { resoudreEquipementDuBuildExhaustif } from './resolutionExhaustive';
import { StatRow, computeStats, statsParPaire, statsSelonRelique } from './stats';

/** Ce que la résolution rapide compte, pour le banc et les tests (aucun effet sur le résultat). */
export interface CompteursResolutionRapide {
  builds: number;
  // Couples (build, relique) jugés, et ceux écartés sans aucune note.
  reliques: number;
  reliquesSansFormeFaisable: number;
  // Reliques à forme faisable, et celles qui n'ont donné aucun couple faisable.
  reliquesNotees: number;
  reliquesNoteesSansCouple: number;
  // Reliques (ou paires fixes) notées ENTIÈRES (coût des verrous), et les
  // paires notées par le chemin des seules faisables.
  noteesEntieres: number;
  notesFaisables: number;
  // Builds rejetés résolus par le calcul exhaustif (`diagnostic`), et builds
  // repliés sur lui après une note NaN.
  diagnostics: number;
  replisNaN: number;
  // `computeStats` de faisabilité : formes jugées (sur-ensemble).
  formesJugees: number;
  // Reliques écartées sans note par la dominance (`reliquesDominees`) ;
  // elles ne comptent pas dans `reliques`.
  reliquesDominees: number;
  // Paires faisables non notées par la dominance par classe de paires
  // (`DominanceParPaire`), et reliques notées à nouveau en entier faute
  // d'une dominante notée avec un couple faisable (leurs paires évitées au
  // premier tour ne restent pas comptées).
  pairesDominees: number;
  reliquesRenotees: number;
}

export function compteursVides(): CompteursResolutionRapide {
  return {
    reliquesDominees: 0, pairesDominees: 0, reliquesRenotees: 0,
    builds: 0, reliques: 0, reliquesSansFormeFaisable: 0, reliquesNotees: 0, reliquesNoteesSansCouple: 0,
    noteesEntieres: 0, notesFaisables: 0, diagnostics: 0, replisNaN: 0, formesJugees: 0,
  };
}

export interface OptionsResolutionRapide {
  // Un build rejeté porte le diagnostic du calcul exhaustif (la fonction du
  // CLI `resoudreEquipementCli` sur option, le banc, les tests). Absent ou
  // faux : le chemin de l'app, sans diagnostic.
  diagnostic?: boolean;
}

/**
 * Les formes de paire d'une file : par sorte, les représentants (une pièce par
 * principale `(code, valeur)` distincte, l'emplacement vide en tête) et
 * l'indice de chaque forme dans ce tableau. Une paire se juge par le couple
 * d'indices de ses deux pièces : la forme d'une pièce se calcule une fois
 * par pièce et par relique, jamais une fois par paire.
 */
export interface FormesDePaire {
  element: (ArtifactDetail | null)[];
  archetype: (ArtifactDetail | null)[];
  indiceElement: Map<string, number>;
  indiceArchetype: Map<string, number>;
}

/**
 * Les représentants des formes de paire : par sorte, une pièce par principale
 * `(code, valeur)` distincte de `candidatsParSorte`, plus l'emplacement vide.
 * Mémoïsés sur les entrées que lit `candidatsParSorte`, par identité (comme
 * `MemoPreFiltre`) : la durée de vie est celle d'une file, dont ils font
 * partie des caches (`CachesResolution.rapide`, `nouveauxCachesResolution`).
 */
// Les paramètres de paires sans `evaluer` : ce que lisent les formes et les candidats.
type ParamsDePaires = Omit<ArtifactSearchParams, 'evaluer'>;

export class CachesResolutionRapide {
  private entrees: unknown[] | null = null;
  private formes: FormesDePaire | null = null;
  private entreesApports: unknown[] | null = null;
  private apports: Float64Array | null = null;
  private eligibles: readonly RelicDetail[] | null = null;
  private distinctes: RelicDetail[] = [];

  /**
   * Les apports de principales `(PV, ATQ, DEF)` des formes de paire qu'au
   * moins un couple AUTORISÉ réalise (contrainte de paire, lignes
   * verrouillées), sur les candidats de la confirmation
   * (`candidatsSansDominance`) ; distincts, trois nombres par apport, dans
   * l'ordre des formes. Ils ne dépendent que du réglage, jamais du build ni de
   * la relique : mémoïsés sur les entrées qu'ils lisent, par identité.
   */
  apportsRealisables(params: ParamsDePaires): Float64Array {
    const entrees = [params.inventaire, params.equipes, params.porteur, params.principaleParSorte,
      params.lignesVerrouillees, params.avecCoutDesVerrous, params.maxStatsActifs];
    if (!this.apports || !this.entreesApports || entrees.some((v, i) => v !== this.entreesApports![i])) {
      this.apports = calculerApportsRealisables(params, this.representants(params));
      this.entreesApports = entrees;
    }
    return this.apports;
  }

  /** Une relique par principale `(code, valeur)` distincte, la première dans l'ordre des éligibles. */
  reliquesDistinctes(eligibles: readonly RelicDetail[]): RelicDetail[] {
    if (this.eligibles !== eligibles) {
      const vues = new Set<string>();
      this.distinctes = eligibles.filter((r) => {
        const cle = `${r.main.code}:${r.main.value}`;
        if (vues.has(cle)) return false;
        vues.add(cle);
        return true;
      });
      this.eligibles = eligibles;
    }
    return this.distinctes;
  }

  representants(params: ParamsDePaires): FormesDePaire {
    const entrees = [params.inventaire, params.equipes, params.porteur, params.principaleParSorte];
    if (!this.formes || !this.entrees || entrees.some((v, i) => v !== this.entrees![i])) {
      const parSorte = (kind: ArtifactKind) => {
        const vus = new Map<string, ArtifactDetail>();
        for (const a of candidatsParSorte(params, kind)) {
          if (a && !vus.has(formeDe(a))) vus.set(formeDe(a), a);
        }
        // ⚠️ Le vide TOUJOURS : `preFiltrerCandidats` le rajoute même quand
        // `candidatsParSorte` ne le rend pas (« Garder l'artéfact équipé »).
        return [null, ...vus.values()];
      };
      const indices = (formes: (ArtifactDetail | null)[]) => new Map(formes.map((a, i) => [formeDe(a), i]));
      const element = parSorte('element');
      const archetype = parSorte('archetype');
      this.formes = { element, archetype, indiceElement: indices(element), indiceArchetype: indices(archetype) };
      this.entrees = entrees;
    }
    return this.formes;
  }
}

function formeDe(a: ArtifactDetail | null): string {
  return a ? `${a.main.code}:${a.main.value}` : '-';
}

// L'indice de la forme d'une pièce, −1 hors des formes (une paire qui le
// porte se signale au moment où elle est jugée, jamais avant).
function indiceDe(indices: Map<string, number>, a: ArtifactDetail | null): number {
  return indices.get(formeDe(a)) ?? -1;
}

// La forme d'une paire : principales de l'attribut puis du type, l'ordre même
// où `artefactsDe` les pose et où `computeStats` les additionne.
function formeDePaire(element: ArtifactDetail | null, archetype: ArtifactDetail | null): string {
  return `${formeDe(element)}|${formeDe(archetype)}`;
}

function artefactsDe(p: PaireArtefacts): ArtifactDetail[] {
  return [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
}

// Le cas où `meilleurSansVerrous` lit toutes les notes : la condition même
// de `collecterPaires` (`verrous.length && params.avecCoutDesVerrous`).
function coutDesVerrous(params: ParamsDePaires): boolean {
  return !!params.avecCoutDesVerrous && (params.lignesVerrouillees?.some((l) => l.min > 0) ?? false);
}

const NAN = Symbol('note NaN');

// Le résultat d'un build rejeté, sans diagnostic — une seule écriture pour la
// résolution et la confirmation (`confirmerEquipementDuBuild`), qui rendent
// ainsi le MÊME objet, champ pour champ. Relique fixe : ni paire, ni artéfact,
// stats du build avec la relique portée.
function rejetReliqueFixe(e: EntreeResolution, relique: RelicDetail | undefined,
  stats: StatRow[] = computeStats({ ...e.gear, artifacts: [], relic: relique })): ResultatArtefacts {
  return { paire: null, artefacts: [], stats, meilleurSansVerrous: null, conforme: false };
}

// Relique `recherche` : ce que le calcul exhaustif rend quand aucune éligible n'a de paire.
function rejetRecherche(e: EntreeResolution): ResultatArtefacts {
  return { paire: null, artefacts: [], stats: computeStats({ ...e.gear, relic: undefined }), meilleurSansVerrous: null, conforme: false, relique: undefined };
}

/**
 * La meilleure paire FAISABLE de `collecterPaires(params, memo)`, en ne notant
 * que les faisables : la double boucle de `collecterPaires` (mêmes candidats par
 * sorte, même ordre, même contrainte de paire, mêmes lignes verrouillées),
 * `evaluer` appelé seulement si `faisable` le dit. La plus grande note, au
 * plus petit indice parmi les ex æquo ; `null` si aucune paire n'est
 * faisable ; `NAN` dès qu'une note faisable est NaN (l'ordre du calcul
 * exhaustif n'est alors plus reproductible). Hors `coutDesVerrous` seulement :
 * `meilleurSansVerrous` vaut alors `null`, comme dans le calcul exhaustif.
 */
function meilleurePaireFaisable(
  params: ArtifactSearchParams,
  memo: MemoPreFiltre | undefined,
  formes: FormesDePaire,
  // `ie`, `ia` : indices des formes des deux pièces (`formes`), −1 hors des formes.
  faisable: (ie: number, ia: number, element: ArtifactDetail | null, archetype: ArtifactDetail | null, paire: ArtifactDetail[]) => boolean,
  compteurs: CompteursResolutionRapide | undefined
): PaireArtefacts | null | typeof NAN {
  // Les sondes de pertinence restent sur le vrai `evaluer`, à chaque appel.
  const pertinence = analyserPertinence(params);
  // Sans memo de file, un memo neuf rend `candidatsPourRecherche` lui-même.
  const m = memo ?? new MemoPreFiltre();
  const [candidatsElement, candidatsArchetype] = ARTIFACT_KINDS.map(({ key }) => m.candidats(params, key, pertinence));
  // La forme de chaque candidat, une fois par appel (et non une fois par paire).
  const indicesElement = candidatsElement!.map((a) => indiceDe(formes.indiceElement, a));
  const indicesArchetype = candidatsArchetype!.map((a) => indiceDe(formes.indiceArchetype, a));
  const verrous = params.lignesVerrouillees?.filter((l) => l.min > 0) ?? [];
  let meilleure: PaireArtefacts | null = null;
  // Réutilisé d'un tour à l'autre, comme dans `collecterPaires`.
  const paire: ArtifactDetail[] = [];
  // La double boucle de `collecterPaires`, dans le même ordre.
  for (let i = 0; i < candidatsElement!.length; i++) {
    const element = candidatsElement![i] as ArtifactDetail | null;
    const ie = indicesElement[i]!;
    for (let j = 0; j < candidatsArchetype!.length; j++) {
      const archetype = candidatsArchetype![j] as ArtifactDetail | null;
      if (!artifactPairAllowed(element, archetype)) continue;
      paire.length = 0;
      if (element) paire.push(element);
      if (archetype) paire.push(archetype);
      if (!paireRespecteLignes(paire, verrous)) continue;
      if (!faisable(ie, indicesArchetype[j]!, element, archetype, paire)) continue;
      const score = params.evaluer(paire);
      if (compteurs) compteurs.notesFaisables++;
      if (Number.isNaN(score)) return NAN;
      if (!meilleure || score > meilleure.score) meilleure = { element, archetype, score };
    }
  }
  return meilleure;
}

/**
 * Dominance des reliques d'UN build, avant toute note (« Dégâts réels »
 * seulement, `EntreeResolution.dominanceReliques`).
 *
 * Une relique n'agit sur la note d'une paire que par quatre CANAUX : les PV,
 * l'ATQ et la DEF des stats que `evaluerPourRegime('degats_reels')` passe à
 * `computeTotalDamage` (principale en %, plus les points de Bravoure,
 * Éternité ou Origine, `statsAvecApport`) et les dégâts infligés de Conquête
 * (`apport.dmgPct`) ; Ténacité et Régénération n'y apportent rien
 * (`apportExclusive`). Ces quatre valeurs ne lisent des artéfacts que leurs
 * principales (`statsParPaire`) : elles sont constantes sur une FORME de
 * paire (`FormesDePaire`).
 *
 * `a` domine `b` quand, sur chaque forme où `b` est faisable, `a` l'est aussi
 * et a chaque canal au moins égal, et que `a` gagne l'égalité
 * (`prefereeALEgalite`). ⚠️ **Repose sur la règle de jeu R, confirmée par
 * l'utilisateur** (docs/03-developpeur/optimizer/invariants.md) : les dégâts
 * ne baissent jamais quand PV, ATQ, DEF ou les dégâts infligés augmentent ;
 * alors la note de `a` vaut au moins celle de `b` sur toute paire que `b`
 * peut porter, et `bestRelicForBuild` ne choisit jamais `b`. Comparaison
 * EXACTE (aucune tolérance), point par point sur les formes.
 *
 * Rend chaque relique dominée avec la liste de TOUTES celles qui la dominent
 * (la relation est transitive : une dominante dominée a ses propres
 * dominantes dans la liste). Une relique sans forme faisable n'y entre
 * jamais : elle est déjà écartée sans note.
 */
// Par relique : le verdict de chaque forme et ses quatre canaux (PV, ATQ, DEF,
// dégâts infligés), `4 × forme + canal`.
interface CanauxRelique {
  verdicts: boolean[];
  valeurs: Float64Array;
  faisable: boolean;
}

function canauxDesReliques(
  candidates: readonly RelicDetail[],
  formesDe: (relique: RelicDetail) => { verdicts: boolean[]; stats: StatRow[][] },
  exclusive: ContexteExclusive,
  propres: ReturnType<typeof aurasPropresDesRunes>
): CanauxRelique[] {
  return candidates.map((relique) => {
    const { verdicts, stats } = formesDe(relique);
    const valeurs = new Float64Array(verdicts.length * 4);
    for (let f = 0; f < verdicts.length; f++) {
      const apport = apportExclusive(relique, stats[f]!, exclusive.setup, propres, exclusive.element);
      const avec = statsAvecApport(stats[f]!, apport);
      // `total` = base + bonus, base sans relique : comparer `total` suffit.
      valeurs[4 * f] = avec.find((r) => r.key === 'hp')!.total;
      valeurs[4 * f + 1] = avec.find((r) => r.key === 'atk')!.total;
      valeurs[4 * f + 2] = avec.find((r) => r.key === 'def')!.total;
      valeurs[4 * f + 3] = apport.dmgPct;
    }
    return { verdicts, valeurs, faisable: verdicts.some(Boolean) };
  });
}

function reliquesDominees(
  candidates: readonly RelicDetail[],
  canaux: readonly CanauxRelique[],
  departage: { equipee?: RelicDetail; departagePortee?: boolean }
): Map<RelicDetail, RelicDetail[]> {
  const dominees = new Map<RelicDetail, RelicDetail[]>();
  if (candidates.length < 2) return dominees;
  for (let j = 0; j < candidates.length; j++) {
    const b = canaux[j]!;
    if (!b.faisable) continue;
    const dominantes: RelicDetail[] = [];
    for (let i = 0; i < candidates.length; i++) {
      if (i === j || !prefereeALEgalite(candidates[i]!, candidates[j]!, departage)) continue;
      const a = canaux[i]!;
      let domine = true;
      for (let f = 0; domine && f < b.verdicts.length; f++) {
        if (!b.verdicts[f]) continue;
        if (!a.verdicts[f]) domine = false;
        for (let c = 4 * f; domine && c < 4 * f + 4; c++) if (a.valeurs[c]! < b.valeurs[c]!) domine = false;
      }
      if (domine) dominantes.push(candidates[i]!);
    }
    if (dominantes.length > 0) dominees.set(candidates[j]!, dominantes);
  }
  return dominees;
}

/**
 * Les sorts (`skillCom2usId`) dont la note BAISSE quand une stat que la
 * dominance des reliques suppose croissante augmente : ils contredisent la
 * règle de jeu R (dégâts non décroissants en PV, ATQ, DEF, dégâts infligés de
 * relique et lignes d'artéfact, confirmée par l'utilisateur le 2026-10-27).
 * Leurs reliques sont toutes notées (`dominanceReliques` absent, `relicQueue.ts`),
 * au niveau build comme par paire. La liste est dressée par
 * `tests/monotonie-degats-corpus.test.ts` sur le corpus de l'Optimizer, qui
 * échoue si un sort hors liste baisse ou si un sort de la liste ne baisse plus.
 * ⚠️ Une exception se signale, elle ne se corrige pas ici : la valeur est la
 * raison, pour chaque sort.
 */
export const EXCEPTIONS_REGLE_R: ReadonlyMap<number, string> = new Map<number, string>([
  // Ceres, Last Shot : +50 % si les PV de la cible dépassent 2 fois les PV
  // propres (`pvCibleSuperieursPvPropre`, damage.ts) ; monter les PV propres
  // peut éteindre ce bonus et baisser la note.
  [5812, 'PV : le bonus « PV de la cible supérieurs à 2 × les PV propres » s\'éteint quand les PV montent'],
]);

/** Le sort de ce contexte contredit-il la règle R (`EXCEPTIONS_REGLE_R`) ? */
export const estExceptionRegleR = (skillCom2usId: number): boolean => EXCEPTIONS_REGLE_R.has(skillCom2usId);

/**
 * Ce que la dominance des reliques demande à l'entrée (« Dégâts réels »
 * seulement, `EntreeResolution.dominanceReliques`) : le contexte de l'apport
 * des exclusives, et les stats que la note lit hors des lignes de la paire.
 */
export interface DominanceReliques extends ContexteExclusive {
  /**
   * Les PV, ATQ, DEF que la note lit hors des lignes 218-220 de la paire
   * (`statsDuLanceurLuesParLaNote`, damage.ts) : les canaux ACTIFS de toute
   * paire, à qui s'ajoutent ceux de ses lignes et les dégâts infligés. `null`
   * : pas de dominance par classe de paires, le niveau build seul.
   */
  lues: readonly ('hp' | 'atk' | 'def')[] | null;
}

const BIT_CANAL = { hp: 1, atk: 2, def: 4 } as const;
// Dégâts infligés (Conquête) : toujours actif.
const BIT_DEGATS = 8;

// Les canaux PV/ATQ/DEF que lisent les lignes 218-220 d'une pièce
// (`statsDesLignesBrutes`, la table même du calcul). Ceux d'une paire sont
// l'union de ses pièces : la somme de deux lignes nulles est nulle, l'union
// est donc un sur-ensemble des lignes non nulles de la paire (sûr).
const bitsParPiece = new WeakMap<ArtifactDetail, number>();
function bitsDesLignes(a: ArtifactDetail | null): number {
  if (!a) return 0;
  let b = bitsParPiece.get(a);
  if (b === undefined) {
    b = 0;
    for (const k of statsDesLignesBrutes(artifactDamageProfile([a]))) {
      if (k === 'hp' || k === 'atk' || k === 'def') b |= BIT_CANAL[k];
    }
    bitsParPiece.set(a, b);
  }
  return b;
}

/**
 * Dominance des reliques par CLASSE DE PAIRES, d'un build — le second niveau,
 * après `reliquesDominees`. Une paire `p` faisable d'une relique `b` n'est pas
 * notée si une relique `a` gagne l'égalité (`prefereeALEgalite`), n'est pas
 * écartée au niveau build, est faisable sur la forme de `p`, et a sur cette
 * forme chaque canal ACTIF pour `p` au moins égal à celui de `b`. Actifs : les
 * stats que la note lit hors des lignes (`DominanceReliques.lues`), celles des
 * lignes 218-220 de `p`, et les dégâts infligés ; un canal inerte ne change
 * pas la note de `p`.
 *
 * ⚠️ Repose sur la règle de jeu R et sur la table des lecteurs
 * (`statsDuLanceurLuesParLaNote`), règles de jeu confirmées par l'utilisateur :
 * note(a, p) ≥ note(b, p) ; la meilleure note de `a` sur ses propres paires,
 * qui l'est au moins autant (le préfiltre des artéfacts ne retire que des
 * paires qu'une autre égale ou bat, pour `a`), et `a` gagne l'égalité : une
 * paire évitée de `b` n'est jamais celle d'un choix. Le choix final est celui
 * du niveau build seul, champ pour champ.
 *
 * Les dominantes d'une (relique, forme, classe) se calculent au premier
 * besoin, une fois. `utilisees` retient, par relique, les listes de
 * dominantes qui ont évité une de ses paires : chacune doit compter une
 * relique notée avec un couple faisable, sinon la relique est notée à
 * nouveau en entier (`aRenoter`).
 */
class DominanceParPaire {
  private readonly nF: number;
  private readonly memo: (number[] | undefined)[] = [];
  readonly utilisees = new Map<RelicDetail, Set<number>>();
  readonly evitees = new Map<RelicDetail, number>();
  private readonly indice: Map<RelicDetail, number>;
  private readonly base: number;

  constructor(
    private readonly candidates: readonly RelicDetail[],
    private readonly canaux: readonly CanauxRelique[],
    private readonly dominees: ReadonlySet<RelicDetail>,
    private readonly departage: { equipee?: RelicDetail; departagePortee?: boolean },
    lues: readonly ('hp' | 'atk' | 'def')[]
  ) {
    this.nF = canaux[0]?.verdicts.length ?? 0;
    this.indice = new Map(candidates.map((r, i) => [r, i]));
    let base = BIT_DEGATS;
    for (const k of lues) base |= BIT_CANAL[k];
    this.base = base;
  }

  /** La paire (forme `f`, pièces `element`, `archetype`) de `relique` est-elle évitée ? */
  evitee(relique: RelicDetail, f: number, element: ArtifactDetail | null, archetype: ArtifactDetail | null): boolean {
    const j = this.indice.get(relique)!;
    const actif = this.base | bitsDesLignes(element) | bitsDesLignes(archetype);
    // Clé d'une (relique, forme, classe) : la classe tient en ses trois bits PV/ATQ/DEF.
    const cle = (j * this.nF + f) * 8 + (actif & 7);
    let dominantes = this.memo[cle];
    if (dominantes === undefined) {
      dominantes = [];
      const b = this.canaux[j]!;
      for (let i = 0; i < this.candidates.length; i++) {
        const a = this.canaux[i]!;
        if (i === j || !a.verdicts[f] || this.dominees.has(this.candidates[i]!)) continue;
        if (!prefereeALEgalite(this.candidates[i]!, relique, this.departage)) continue;
        let domine = true;
        for (let c = 0; domine && c < 4; c++) {
          if (actif & (1 << c) && a.valeurs[4 * f + c]! < b.valeurs[4 * f + c]!) domine = false;
        }
        if (domine) dominantes.push(i);
      }
      this.memo[cle] = dominantes;
    }
    if (dominantes.length === 0) return false;
    let s = this.utilisees.get(relique);
    if (!s) this.utilisees.set(relique, (s = new Set()));
    s.add(cle);
    this.evitees.set(relique, (this.evitees.get(relique) ?? 0) + 1);
    return true;
  }

  /** Les reliques dont une paire évitée n'a aucune dominante notée avec un couple faisable. */
  aRenoter(aUnCouple: (relique: RelicDetail) => boolean): RelicDetail[] {
    const out: RelicDetail[] = [];
    for (const [relique, cles] of this.utilisees) {
      for (const cle of cles) {
        if (!this.memo[cle]!.some((i) => aUnCouple(this.candidates[i]!))) {
          out.push(relique);
          break;
        }
      }
    }
    return out;
  }

  /** `relique` sera notée en entier : ses paires évitées ne comptent plus. */
  oublier(relique: RelicDetail): number {
    const n = this.evitees.get(relique) ?? 0;
    this.utilisees.delete(relique);
    this.evitees.delete(relique);
    return n;
  }
}

function avertirNaN(e: EntreeResolution, compteurs: CompteursResolutionRapide | undefined): ResultatArtefacts {
  if (compteurs) compteurs.replisNaN++;
  console.warn(
    `resoudreEquipementDuBuildRapide : note NaN d'une paire faisable (runes [${e.gear.runes.map((r) => r.id).join(',')}]) — ` +
      'ce build est résolu par le calcul exhaustif (resoudreEquipementDuBuildExhaustif).'
  );
  return resoudreEquipementDuBuildExhaustif(e);
}

/** Le pendant de `resoudreReliqueFixe` (resolutionExhaustive.ts), prédicat mémoïsé par forme. */
function resoudreReliqueFixeRapide(
  e: EntreeResolution,
  relique: RelicDetail | undefined,
  compteurs: CompteursResolutionRapide | undefined,
  options: OptionsResolutionRapide | undefined
): ResultatArtefacts {
  const params = e.faireParams(relique);
  // Les formes de la file (`caches.rapide`, un jeu par file).
  const formes = (e.caches?.rapide ?? new CachesResolutionRapide()).representants(params);
  // Le verdict de chaque forme de paire, au premier jugement d'une paire de
  // cette forme (indice `ie × nA + ia`) ; une pièce hors des formes garde le
  // verdict par forme écrite (même prédicat, même mémoïsation).
  const nA = formes.archetype.length;
  const verdicts: (boolean | undefined)[] = [];
  const horsFormes = new Map<string, boolean>();
  const respecte = (ie: number, ia: number, element: ArtifactDetail | null, archetype: ArtifactDetail | null, arts: ArtifactDetail[]) => {
    if (!e.respecteConditions) return true;
    if (ie < 0 || ia < 0) {
      const forme = formeDePaire(element, archetype);
      let v = horsFormes.get(forme);
      if (v === undefined) {
        v = e.respecteConditions(arts);
        horsFormes.set(forme, v);
      }
      return v;
    }
    let v = verdicts[ie * nA + ia];
    if (v === undefined) {
      v = e.respecteConditions(arts);
      verdicts[ie * nA + ia] = v;
    }
    return v;
  };
  const rejete = (): ResultatArtefacts => {
    if (options?.diagnostic) {
      if (compteurs) compteurs.diagnostics++;
      return resoudreEquipementDuBuildExhaustif(e);
    }
    return rejetReliqueFixe(e, relique);
  };

  if (coutDesVerrous(params)) {
    // Toutes les notes (`meilleurSansVerrous`) : le parcours du calcul exhaustif.
    if (compteurs) compteurs.noteesEntieres++;
    const r = pairesParScore(params, e.caches?.preFiltre);
    for (const p of r.paires) {
      const arts = artefactsDe(p);
      if (respecte(indiceDe(formes.indiceElement, p.element), indiceDe(formes.indiceArchetype, p.archetype), p.element, p.archetype, arts)) {
        return {
          paire: p, artefacts: arts, stats: computeStats({ ...e.gear, artifacts: arts, relic: relique }),
          meilleurSansVerrous: r.meilleurSansVerrous, conforme: true,
        };
      }
    }
    return rejete();
  }

  const p = meilleurePaireFaisable(params, e.caches?.preFiltre, formes, respecte, compteurs);
  if (p === NAN) return avertirNaN(e, compteurs);
  if (!p) return rejete();
  const arts = artefactsDe(p);
  return { paire: p, artefacts: arts, stats: computeStats({ ...e.gear, artifacts: arts, relic: relique }), meilleurSansVerrous: null, conforme: true };
}

interface CoupleFaisable {
  paire: PaireArtefacts;
  artefacts: ArtifactDetail[];
  stats: StatRow[];
  meilleurSansVerrous: number | null;
}

/**
 * Le pendant de `resoudreEquipementDuBuildExhaustif` : même entrée, mêmes
 * erreurs ; pour un build conforme, même résultat (paire, artéfacts, stats,
 * `meilleurSansVerrous`, relique, `sansEffetSurLeTri`) ; pour un build
 * rejeté, le diagnostic seulement sur demande (`options.diagnostic`).
 * Écart documenté : une note NaN sur une paire infaisable seule.
 *
 * Les représentants des formes sont ceux de la file (`e.caches.rapide`),
 * partagés par ses builds ; sans caches, recalculés à chaque build.
 * `compteurs` : pour le banc et les tests. Sans option, c'est
 * `resoudreEquipementDuBuild` (relicQueue.ts), le point d'entrée de l'app.
 */
export function resoudreEquipementDuBuildRapide(
  e: EntreeResolution,
  compteurs?: CompteursResolutionRapide,
  options?: OptionsResolutionRapide
): ResultatArtefacts {
  if (compteurs) compteurs.builds++;
  const ctx = e.relicContext;
  if (ctx?.mode !== 'recherche') return resoudreReliqueFixeRapide(e, e.gear.relic, compteurs, options);

  const candidates = ctx.eligibles;
  if (candidates.length === 0) throw new RechercheRefusee(ctx.vide ?? 'inventaire');

  // Les paramètres de paires d'une relique, construits au plus une fois (le
  // calcul exhaustif les construit une fois par relique essayée).
  const parametres = new Map<RelicDetail, ArtifactSearchParams>();
  const paramsDe = (relique: RelicDetail) => {
    let p = parametres.get(relique);
    if (!p) {
      p = e.faireParams(relique);
      parametres.set(relique, p);
    }
    return p;
  };
  const formes = (e.caches?.rapide ?? new CachesResolutionRapide()).representants(paramsDe(candidates[0]!));

  // Le verdict de chaque forme, par principale de relique : `computeStats` ne
  // lit d'une relique que sa principale, deux reliques de même principale
  // ont la même table. Indice d'une forme de paire : `ie × nA + ia`.
  const nA = formes.archetype.length;
  // Le jugement même de `respecteConditionsAvecRelique` — `respecteMinEtMax`
  // sur les stats de la paire, la candidate à la place de la portée —, ses
  // deux entrées calculées une fois : les auras propres par build, les stats
  // sans artéfact par principale de relique (`statsParPaire`, qui rend au bit
  // près le `computeStats` de chaque paire, testé).
  const propres = aurasPropresDesRunes(e.gear.runes);
  // Par principale de relique : le verdict de chaque forme et ses stats (sans
  // apport d'exclusive), que la dominance relit.
  const tables = new Map<string, { verdicts: boolean[]; stats: StatRow[][] }>();
  const formesDe = (relique: RelicDetail) => {
    const cle = `${relique.main.code}:${relique.main.value}`;
    let t = tables.get(cle);
    if (!t) {
      t = { verdicts: [], stats: [] };
      const statsAvec = statsParPaire({ ...e.gear, relic: relique });
      for (const pe of formes.element) {
        for (const pa of formes.archetype) {
          const arts = [pe, pa].filter((a): a is ArtifactDetail => a != null);
          const stats = statsAvec(arts);
          t.verdicts.push(respecteMinEtMax(stats, e.requirement, propres));
          t.stats.push(stats);
          if (compteurs) compteurs.formesJugees++;
        }
      }
      tables.set(cle, t);
    }
    return t;
  };
  const tableDe = (relique: RelicDetail) => formesDe(relique).verdicts;
  const departage = { equipee: ctx.equipee, departagePortee: e.regimeDeStat };
  // Les reliques écartées sans note, chacune avec celles qui la dominent ;
  // puis, sur les autres, les paires évitées par classe de paires.
  const dominance = e.dominanceReliques && !e.regimeAucun && candidates.length > 1 ? e.dominanceReliques : null;
  const canaux = dominance ? canauxDesReliques(candidates, formesDe, dominance, propres) : null;
  const dominees = canaux ? reliquesDominees(candidates, canaux, departage) : new Map<RelicDetail, RelicDetail[]>();
  const parPaire = canaux && dominance?.lues
    ? new DominanceParPaire(candidates, canaux, new Set(dominees.keys()), departage, dominance.lues)
    : null;
  // Reliques notées en entier, sans paire évitée (`DominanceParPaire.aRenoter`).
  const entieres = new Set<RelicDetail>();
  // Une paire hors du sur-ensemble invaliderait l'écart des reliques sans
  // forme faisable : c'est un bug, jamais un cas à absorber.
  const verdict = (table: boolean[], ie: number, ia: number, element: ArtifactDetail | null, archetype: ArtifactDetail | null) => {
    if (ie < 0 || ia < 0) {
      throw new Error(`resoudreEquipementDuBuildRapide : paire de forme ${formeDePaire(element, archetype)} hors des formes de candidatsParSorte — bug.`);
    }
    return table[ie * nA + ia]!;
  };

  const parRelique = new Map<number, CoupleFaisable>();
  let nanVu = false;

  // La note de chaque relique, calculée au plus une fois (une relique dominée
  // peut devoir être notée à un second tour, ci-dessous).
  const notes = new Map<RelicDetail, RelicEvaluation>();
  const noter = (relique: RelicDetail): RelicEvaluation => {
    // Une note NaN déjà vue : le build part au calcul exhaustif, rien de plus à noter.
    if (nanVu) return 'infaisable';
    if (compteurs) compteurs.reliques++;
    const table = tableDe(relique);
    let uneFaisable = false;
    for (const v of table) if (v) uneFaisable = true;
    if (!uneFaisable) {
      if (compteurs) compteurs.reliquesSansFormeFaisable++;
      return 'infaisable';
    }
    if (compteurs) compteurs.reliquesNotees++;
    const params = paramsDe(relique);
    let p: PaireArtefacts | null = null;
    let meilleurSansVerrous: number | null = null;
    if (coutDesVerrous(params)) {
      // Toutes les notes (`meilleurSansVerrous`) : le parcours du calcul exhaustif.
      if (compteurs) compteurs.noteesEntieres++;
      const r = pairesParScore(params, e.caches?.preFiltre);
      meilleurSansVerrous = r.meilleurSansVerrous;
      for (const q of r.paires) {
        if (verdict(table, indiceDe(formes.indiceElement, q.element), indiceDe(formes.indiceArchetype, q.archetype), q.element, q.archetype)) {
          p = q;
          break;
        }
      }
    } else {
      const eviter = parPaire && !entieres.has(relique) ? parPaire : null;
      const q = meilleurePaireFaisable(params, e.caches?.preFiltre, formes, (ie, ia, el, ar) => {
        if (!verdict(table, ie, ia, el, ar)) return false;
        if (eviter && eviter.evitee(relique, ie * nA + ia, el, ar)) {
          if (compteurs) compteurs.pairesDominees++;
          return false;
        }
        return true;
      }, compteurs);
      if (q === NAN) {
        nanVu = true;
        return 'infaisable';
      }
      p = q;
    }
    if (!p) {
      if (compteurs) compteurs.reliquesNoteesSansCouple++;
      return 'infaisable';
    }
    const arts = artefactsDe(p);
    const { stats } = respecteConditionsAvecRelique({ ...e.gear, artifacts: arts }, relique, e.requirement);
    parRelique.set(relique.id, { paire: p, artefacts: arts, stats, meilleurSansVerrous });
    return p.score;
  };

  // Une relique dominée reste sans note tant qu'une de celles qui la dominent
  // a un couple faisable : sinon (les candidats de paires de la dominante,
  // filtrés selon SA note, ne lui ont laissé aucun couple), elle est notée à
  // un tour de plus, les notes déjà calculées reprises telles quelles. Une
  // paire évitée par classe est un couple faisable de sa relique (elle sort
  // de ses candidats et sa forme l'est) : une relique dont toutes les paires
  // faisables sont évitées en a donc un.
  const aUnCouple = (a: RelicDetail) => parRelique.has(a.id) || (parPaire?.evitees.has(a) ?? false);
  let meilleure: MeilleureRelique | undefined;
  for (;;) {
    meilleure = bestRelicForBuild(
      candidates,
      (relique) => {
        if (dominees.has(relique)) return 'infaisable';
        let n = notes.get(relique);
        if (n === undefined) {
          n = noter(relique);
          notes.set(relique, n);
        }
        return n;
      },
      { regimeAucun: e.regimeAucun, ...departage }
    );
    if (nanVu) break;
    let relachee = false;
    for (const [b, dominantes] of dominees) {
      if (!dominantes.some(aUnCouple)) {
        dominees.delete(b);
        relachee = true;
      }
    }
    // Une paire évitée sans dominante notée avec un couple faisable : la
    // relique est notée à nouveau, en entier (rien n'est plus évité pour elle).
    for (const b of parPaire ? parPaire.aRenoter(aUnCouple) : []) {
      const n = parPaire!.oublier(b);
      if (compteurs) {
        compteurs.pairesDominees -= n;
        compteurs.reliquesRenotees++;
      }
      entieres.add(b);
      notes.delete(b);
      parRelique.delete(b.id);
      relachee = true;
    }
    if (!relachee) break;
  }
  if (compteurs) compteurs.reliquesDominees += dominees.size;

  if (nanVu) return avertirNaN(e, compteurs);

  if (!meilleure) {
    if (options?.diagnostic) {
      if (compteurs) compteurs.diagnostics++;
      return resoudreEquipementDuBuildExhaustif(e);
    }
    return rejetRecherche(e);
  }

  const retenu = parRelique.get(meilleure.relique.id)!;
  if (!respecteConditionsAvecRelique({ ...e.gear, artifacts: retenu.artefacts }, meilleure.relique, e.requirement).respecte) {
    throw new Error(`resoudreEquipementDuBuildRapide : le couple retenu (relique ${meilleure.relique.id}) viole les conditions après sélection — bug de résolution.`);
  }
  return {
    paire: retenu.paire,
    artefacts: retenu.artefacts,
    stats: retenu.stats,
    meilleurSansVerrous: retenu.meilleurSansVerrous,
    conforme: true,
    relique: meilleure.relique,
    ...(meilleure.sansEffetSurLeTri ? { sansEffetSurLeTri: true as const } : {}),
  };
}

/* --------------------------------------------------------------------------
 * Confirmation sans note : conforme ou rejeté, au premier couple faisable
 * ----------------------------------------------------------------------- */

/**
 * Le verdict d'une CONFIRMATION : conforme, sans note ni équipement ; ou
 * rejeté, avec le résultat même que la résolution rend pour ce build
 * (`rejetReliqueFixe`, `rejetRecherche` : une seule écriture pour les deux).
 */
export type ConfirmationEquipement = { conforme: true } | { conforme: false; rejet: ResultatArtefacts };

// Les candidats d'une sorte que la résolution parcourt (`candidatsPourRecherche`,
// artifactOptim.ts), SANS la dominance : la même vue complète, la même
// obligation des lignes verrouillées, l'emplacement vide aux mêmes conditions.
// La dominance demande la pertinence, sondée contre `evaluer` (un calcul de
// dégâts par sonde) : la confirmation n'en fait aucun. Sans elle, la liste est
// un SUR-ENSEMBLE de celle de la résolution : tout couple faisable de la
// résolution y figure. Dans l'autre sens, `preFiltrerCandidats` n'élimine un
// artéfact que devant un autre d'au moins la même principale (même code, valeur
// au moins égale, égale sous un maximum actif sur sa stat, `maxStatsActifs`),
// d'au moins les mêmes lignes verrouillées, jamais un ordinaire devant un
// Intangible : le dominant tient toute paire que l'éliminé tenait (PV, ATQ et
// DEF ne font que monter, les maximums de PV/ATQ/DEF sont gelés à l'égalité),
// si bien qu'un couple faisable reste faisable après la dominance. Le
// verdict est donc celui de la résolution ; l'oracle est la résolution
// complète (`testResolutionConfirmation`).
function candidatsSansDominance(params: ParamsDePaires, kind: ArtifactKind): (ArtifactDetail | null)[] {
  const lignes = params.avecCoutDesVerrous ? [] : (params.lignesVerrouillees ?? []);
  return preFiltrerCandidats(candidatsParSorte(params, kind), kind, lignes, undefined, params.maxStatsActifs);
}

// Les apports des formes réalisables (`CachesResolutionRapide.apportsRealisables`) :
// la double boucle de `meilleurePaireFaisable` (contrainte de paire, lignes
// verrouillées) une fois par réglage, une forme marquée au premier couple
// autorisé qui la porte. Apport d'une forme : la somme même de `statsParPaire`
// (pièce de l'attribut, puis du type).
function calculerApportsRealisables(params: ParamsDePaires, formes: FormesDePaire): Float64Array {
  const elements = candidatsSansDominance(params, 'element');
  const archetypes = candidatsSansDominance(params, 'archetype');
  const forme = (indices: Map<string, number>, a: ArtifactDetail | null) => {
    const i = indiceDe(indices, a);
    if (i < 0) throw new Error(`confirmerEquipementDuBuild : pièce de forme ${formeDe(a)} hors des formes de candidatsParSorte — bug.`);
    return i;
  };
  const ie = elements.map((a) => forme(formes.indiceElement, a));
  const ia = archetypes.map((a) => forme(formes.indiceArchetype, a));
  const nA = formes.archetype.length;
  const realisables = new Uint8Array(formes.element.length * nA);
  const verrous = params.lignesVerrouillees?.filter((l) => l.min > 0) ?? [];
  const paire: ArtifactDetail[] = [];
  for (let i = 0; i < elements.length; i++) {
    for (let j = 0; j < archetypes.length; j++) {
      const k = ie[i]! * nA + ia[j]!;
      if (realisables[k]) continue;
      const element = elements[i]!, archetype = archetypes[j]!;
      if (!artifactPairAllowed(element, archetype)) continue;
      paire.length = 0;
      if (element) paire.push(element);
      if (archetype) paire.push(archetype);
      if (paireRespecteLignes(paire, verrous)) realisables[k] = 1;
    }
  }
  const apports: number[] = [];
  const vus = new Set<string>();
  for (let k = 0; k < realisables.length; k++) {
    if (!realisables[k]) continue;
    let dHp = 0, dAtk = 0, dDef = 0;
    for (const a of [formes.element[Math.floor(k / nA)]!, formes.archetype[k % nA]!]) {
      if (!a) continue;
      const def = ARTIFACT_MAIN[a.main.code];
      if (def?.stat === 'hp') dHp += a.main.value;
      else if (def?.stat === 'atk') dAtk += a.main.value;
      else if (def?.stat === 'def') dDef += a.main.value;
    }
    const cle = `${dHp}|${dAtk}|${dDef}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    apports.push(dHp, dAtk, dDef);
  }
  return Float64Array.from(apports);
}

// Le verdict d'une résolution complète : sous le coût des verrous, que l'app ne
// pose jamais dans une résolution, la confirmation la délègue telle quelle.
function verdictDe(r: ResultatArtefacts): ConfirmationEquipement {
  return r.conforme ? { conforme: true } : { conforme: false, rejet: r };
}

const STATS_DES_APPORTS: readonly string[] = ['hp', 'atk', 'def'];

// Les conditions en deux parts, dont la conjonction est `respecteMinEtMax`
// sur toutes : celles de PV/ATQ/DEF, que la relique et la paire font varier,
// et les autres, qu'aucune ne touche (jugées une fois par build).
function partagerConditions(r: Pick<BuildRequirement, 'minStats' | 'maxStats' | 'auraResPre'>) {
  const part = (garder: (k: string) => boolean): Pick<BuildRequirement, 'minStats' | 'maxStats' | 'auraResPre'> => ({
    minStats: Object.fromEntries(Object.entries(r.minStats).filter(([k]) => garder(k))),
    maxStats: Object.fromEntries(Object.entries(r.maxStats ?? {}).filter(([k]) => garder(k))),
    auraResPre: r.auraResPre,
  });
  return { apports: part((k) => STATS_DES_APPORTS.includes(k)), autres: part((k) => !STATS_DES_APPORTS.includes(k)) };
}

/**
 * La CONFIRMATION de l'équipement d'un build : un couple (paire, relique)
 * faisable existe-t-il ? Aucune paire notée — aucun appel à `evaluer`,
 * aucune sonde de pertinence. Même entrée que `resoudreEquipementDuBuild` ;
 * même verdict (`conforme`) ; pour un build rejeté, le même résultat, champ
 * pour champ ; mêmes erreurs (pool de reliques vide en mode `recherche`).
 *
 * Le jugement même de la résolution, sans ce qui ne change pas le verdict :
 * - par réglage (`CachesResolutionRapide`, une fois par file) : les apports
 *   des formes de paire qu'un couple autorisé réalise — deux formes de même
 *   apport ont les mêmes stats, donc le même verdict ;
 * - par build : UN calcul de stats (`statsSelonRelique` : runes une fois,
 *   puis la fin de `computeStats` par principale de relique distincte), les
 *   conditions hors PV/ATQ/DEF jugées une fois ;
 * - par (principale de relique, apport) : les totaux de PV/ATQ/DEF plus
 *   l'apport, l'expression de `statsParPaire` (`total + d`, d non nul), jugés
 *   par `respecteMinEtMax` (relique `recherche`, comme `tableDe`) ou par les
 *   conditions de `respecteConditionsPaireFixe` (relique fixe, le prédicat de
 *   `entreeResolutionDuBuild`) ; arrêt au premier faisable.
 *
 * ⚠️ Écart accepté : une note NaN ne se voit pas sans note. La résolution
 * replie alors sur le calcul exhaustif (même verdict) ou lève quand toutes les
 * notes faisables sont NaN ; la confirmation, elle, confirme.
 */
export function confirmerEquipementDuBuild(e: EntreeResolution): ConfirmationEquipement {
  const ctx = e.relicContext;
  const recherche = ctx?.mode === 'recherche';
  if (recherche && ctx.eligibles.length === 0) throw new RechercheRefusee(ctx.vide ?? 'inventaire');
  const params: ParamsDePaires = e.artifactParams ?? e.faireParams(recherche ? ctx.eligibles[0] : e.gear.relic);
  if (coutDesVerrous(params)) return verdictDe(resoudreEquipementDuBuildRapide(e));
  const caches = e.caches?.rapide ?? new CachesResolutionRapide();
  const apports = caches.apportsRealisables(params);
  const reliques = recherche ? caches.reliquesDistinctes(ctx.eligibles) : [e.gear.relic];
  const selon = statsSelonRelique({ ...e.gear, artifacts: [] });
  // Relique fixe : le rejet porte les stats du build sans artéfact avec la portée, `selon` les rend au bit près.
  const rejet = (): ConfirmationEquipement => ({ conforme: false,
    rejet: recherche ? rejetRecherche(e) : rejetReliqueFixe(e, e.gear.relic, selon(e.gear.relic)) });
  if (apports.length === 0) return rejet();
  if (!recherche && !e.respecteConditions) return { conforme: true };
  const propres = aurasPropresDesRunes(e.gear.runes);
  const conditions = partagerConditions(recherche ? e.requirement : conditionsPaireFixe(e.requirement));
  let autresJugees = false;
  const lignes = STATS_DES_APPORTS.map((key) => ({ key, total: 0 }));
  for (const relique of reliques) {
    const stats = selon(relique);
    if (!autresJugees) {
      if (!respecteMinEtMax(stats, conditions.autres, propres)) return rejet();
      autresJugees = true;
    }
    const totaux = STATS_DES_APPORTS.map((k) => stats.find((s) => s.key === k)!.total);
    for (let a = 0; a < apports.length; a += 3) {
      for (let s = 0; s < 3; s++) {
        const d = apports[a + s]!;
        lignes[s]!.total = d === 0 ? totaux[s]! : totaux[s]! + d;
      }
      if (respecteMinEtMax(lignes, conditions.apports, propres)) return { conforme: true };
    }
  }
  return rejet();
}
