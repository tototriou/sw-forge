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
//   ni artéfact, ni relique ; avec `diagnostic` (CLI, harnais), le calcul
//   exhaustif lui-même.
//
// ⚠️ **Lignes verrouillées avec `avecCoutDesVerrous`** : `meilleurSansVerrous`
// lit TOUTES les notes ; la relique (ou la paire fixe) y est notée entière
// par `pairesParScore`, comme le calcul exhaustif (exact, NaN compris).
//
// ⚠️ **Aucune borne ni heuristique** : aucune paire faisable n'est écartée sur
// une note. Le choix entre reliques reste `bestRelicForBuild` ; les caches
// partagés sont ceux de la file (`CachesResolution`), représentants des
// formes compris (`caches.rapide`).
//
// Hors mode `recherche` (relique portée fixe) : le prédicat
// `respecteConditions` est mémoïsé par forme de paire, au premier jugement
// d'une paire de cette forme (précondition : il ne lit des artéfacts que
// leurs principales — vrai pour son seul producteur,
// `entreeResolutionDuBuild`).

import { ARTIFACT_KINDS, ArtifactDetail, ArtifactKind, RelicDetail } from '../types';
import {
  ArtifactSearchParams,
  MemoPreFiltre,
  PaireArtefacts,
  analyserPertinence,
  candidatsParSorte,
  paireRespecteLignes,
  pairesParScore,
} from './artifactOptim';
import { artifactPairAllowed } from './artifacts';
import { RechercheRefusee, respecteConditionsAvecRelique, respecteMinEtMax } from './runeBuildOptim';
import { aurasPropresDesRunes } from './damage';
import { bestRelicForBuild } from './relicOptim';
import type { ResultatArtefacts } from './artifactQueue';
// Type seul : relicQueue.ts importe ce module (son point d'entrée et ses
// caches), un import de valeur ferait un cycle.
import type { EntreeResolution } from './relicQueue';
import { resoudreEquipementDuBuildExhaustif } from './resolutionExhaustive';
import { StatRow, computeStats, statsParPaire } from './stats';

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
}

export function compteursVides(): CompteursResolutionRapide {
  return {
    builds: 0, reliques: 0, reliquesSansFormeFaisable: 0, reliquesNotees: 0, reliquesNoteesSansCouple: 0,
    noteesEntieres: 0, notesFaisables: 0, diagnostics: 0, replisNaN: 0, formesJugees: 0,
  };
}

export interface OptionsResolutionRapide {
  // Un build rejeté porte le diagnostic du calcul exhaustif (le CLI, le
  // harnais). Absent ou faux : le chemin de l'app, sans diagnostic.
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
export class CachesResolutionRapide {
  private entrees: unknown[] | null = null;
  private formes: FormesDePaire | null = null;

  representants(params: ArtifactSearchParams): FormesDePaire {
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
function coutDesVerrous(params: ArtifactSearchParams): boolean {
  return !!params.avecCoutDesVerrous && (params.lignesVerrouillees?.some((l) => l.min > 0) ?? false);
}

const NAN = Symbol('note NaN');

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
    return { paire: null, artefacts: [], stats: computeStats({ ...e.gear, artifacts: [], relic: relique }), meilleurSansVerrous: null, conforme: false };
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
  const tables = new Map<string, boolean[]>();
  const tableDe = (relique: RelicDetail) => {
    const cle = `${relique.main.code}:${relique.main.value}`;
    let t = tables.get(cle);
    if (!t) {
      t = [];
      const statsAvec = statsParPaire({ ...e.gear, relic: relique });
      for (const pe of formes.element) {
        for (const pa of formes.archetype) {
          const arts = [pe, pa].filter((a): a is ArtifactDetail => a != null);
          t.push(respecteMinEtMax(statsAvec(arts), e.requirement, propres));
          if (compteurs) compteurs.formesJugees++;
        }
      }
      tables.set(cle, t);
    }
    return t;
  };
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

  const meilleure = bestRelicForBuild(
    candidates,
    (relique) => {
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
        const q = meilleurePaireFaisable(params, e.caches?.preFiltre, formes, (ie, ia, el, ar) => verdict(table, ie, ia, el, ar), compteurs);
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
    },
    { regimeAucun: e.regimeAucun, equipee: ctx.equipee, departagePortee: e.regimeDeStat }
  );

  if (nanVu) return avertirNaN(e, compteurs);

  if (!meilleure) {
    if (options?.diagnostic) {
      if (compteurs) compteurs.diagnostics++;
      return resoudreEquipementDuBuildExhaustif(e);
    }
    // Ce que le calcul exhaustif rend quand aucune éligible n'a de paire.
    return {
      paire: null,
      artefacts: [],
      stats: computeStats({ ...e.gear, relic: undefined }),
      meilleurSansVerrous: null,
      conforme: false,
      relique: undefined,
    };
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
