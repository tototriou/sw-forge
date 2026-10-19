// ⚠️ PROTOTYPE (chantier perf-moteur, lot 2 quater) — résolution de
// l'équipement d'un build, À CÔTÉ de `resoudreEquipementDuBuild`
// (relicQueue.ts), jamais à sa place : aucun écran, aucun Worker ne l'appelle.
// Même entrée (`EntreeResolution`, assemblée par `entreeResolutionDuBuild`),
// même résultat, champ pour champ, que la production.
//
// L'idée : en mode relique `recherche`, la production note TOUTES les paires
// d'artéfacts de CHAQUE relique éligible (`pairesParScore`), puis les
// parcourt par score décroissant jusqu'au premier couple faisable
// (`respecteConditionsAvecRelique`, un `computeStats` par paire examinée).
// Sur la recette Kinki, ~76 % des couples (build, relique) n'ont AUCUNE paire
// faisable : la production y note ~1 100 paires, en trie autant et calcule
// autant de `computeStats` pour conclure « infaisable ».
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
// - **Aucune forme faisable pour une relique** → aucune paire ne l'est, quel
//   que soit l'ordre des paires : la relique est « infaisable » sans qu'aucune
//   paire ne soit notée — ni sonde de pertinence, ni double boucle.
// - **Sinon** → le chemin de la production tel quel (`faireParams`,
//   `pairesParScore`, même parcours), le verdict de chaque paire étant lu
//   dans la table des formes au lieu d'un `computeStats` par paire ; les
//   stats du couple retenu sont recalculées sur ses vraies pièces.
// - **Le build n'a aucun couple faisable** → le diagnostic de la production
//   (le meilleur couple au score de l'éligible de plus petite `id` ayant au
//   moins une paire) est reconstruit par le même `pairesParScore`, sur cette
//   seule relique.
//
// ⚠️ **Exact, sans borne ni heuristique** : aucune paire n'est écartée sur une
// note, seulement des reliques dont AUCUNE paire n'est faisable, ce que la
// production établit en les parcourant toutes. Le choix entre reliques reste
// `bestRelicForBuild`, l'ordre des paires reste `pairesParScore` (scores NaN
// compris : son tri), les caches partagés restent ceux de la file.
//
// Hors mode `recherche` (relique portée fixe) : la structure de
// `resoudreReliqueFixe` ; seul le prédicat `respecteConditions` est mémoïsé
// par forme de paire (précondition : il ne lit des artéfacts que leurs
// principales — vrai pour son seul producteur, `entreeResolutionDuBuild`).
//
// Conception et preuve : notes du lot 2 quater du chantier.

import { ArtifactDetail, ArtifactKind, RelicDetail } from '../types';
import { ArtifactSearchParams, PaireArtefacts, candidatsParSorte, pairesParScore } from './artifactOptim';
import { RechercheRefusee, respecteConditionsAvecRelique } from './runeBuildOptim';
import { bestRelicForBuild } from './relicOptim';
import { ResultatArtefacts } from './artifactQueue';
import { EntreeResolution } from './relicQueue';
import { StatRow, computeStats } from './stats';

/** Ce que le prototype compte, pour le banc (aucun effet sur le résultat). */
export interface CompteursResolutionRapide {
  builds: number;
  // Couples (build, relique) jugés, et ceux écartés sans aucune note.
  reliques: number;
  reliquesSansFormeFaisable: number;
  // Reliques passées par `pairesParScore` (y compris le diagnostic), et
  // celles qui, notées, n'ont donné aucun couple faisable.
  reliquesNotees: number;
  reliquesNoteesSansCouple: number;
  diagnostics: number;
  // `computeStats` de faisabilité : formes jugées (sur-ensemble), et stats
  // recalculées des couples retenus ou du diagnostic.
  formesJugees: number;
}

export function compteursVides(): CompteursResolutionRapide {
  return { builds: 0, reliques: 0, reliquesSansFormeFaisable: 0, reliquesNotees: 0, reliquesNoteesSansCouple: 0, diagnostics: 0, formesJugees: 0 };
}

/**
 * Les représentants des formes de paire : par sorte, une pièce par principale
 * `(code, valeur)` distincte de `candidatsParSorte`, plus l'emplacement vide.
 * Mémoïsés sur les entrées que lit `candidatsParSorte`, par identité (comme
 * `MemoPreFiltre`) : la durée de vie est celle d'une file.
 */
export class CachesResolutionRapide {
  private entrees: unknown[] | null = null;
  private formes: { element: (ArtifactDetail | null)[]; archetype: (ArtifactDetail | null)[] } | null = null;

  representants(params: ArtifactSearchParams): { element: (ArtifactDetail | null)[]; archetype: (ArtifactDetail | null)[] } {
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
      this.formes = { element: parSorte('element'), archetype: parSorte('archetype') };
      this.entrees = entrees;
    }
    return this.formes;
  }
}

function formeDe(a: ArtifactDetail | null): string {
  return a ? `${a.main.code}:${a.main.value}` : '-';
}

// La forme d'une paire : principales de l'attribut puis du type, l'ordre même
// où `artefactsDe` les pose et où `computeStats` les additionne.
function formeDePaire(p: PaireArtefacts): string {
  return `${formeDe(p.element)}|${formeDe(p.archetype)}`;
}

function artefactsDe(p: PaireArtefacts): ArtifactDetail[] {
  return [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
}

interface CoupleFaisable {
  paire: PaireArtefacts;
  artefacts: ArtifactDetail[];
  stats: StatRow[];
  meilleurSansVerrous: number | null;
}

/** Le pendant de `resoudreReliqueFixe` (relicQueue.ts), prédicat mémoïsé par forme. */
function resoudreReliqueFixeRapide(e: EntreeResolution, relique: RelicDetail | undefined): ResultatArtefacts {
  const r = pairesParScore(e.faireParams(relique), e.caches?.preFiltre);
  const verdicts = new Map<string, boolean>();
  let meilleure: PaireArtefacts | null = null;
  let artefactsRetenus: ArtifactDetail[] = [];
  let conforme = false;
  for (const p of r.paires) {
    const arts = artefactsDe(p);
    if (!meilleure) {
      meilleure = p;
      artefactsRetenus = arts;
    }
    let respecte = true;
    if (e.respecteConditions) {
      const forme = formeDePaire(p);
      let v = verdicts.get(forme);
      if (v === undefined) {
        v = e.respecteConditions(arts);
        verdicts.set(forme, v);
      }
      respecte = v;
    }
    if (respecte) {
      meilleure = p;
      artefactsRetenus = arts;
      conforme = true;
      break;
    }
  }
  return {
    paire: meilleure,
    artefacts: artefactsRetenus,
    stats: computeStats({ ...e.gear, artifacts: artefactsRetenus, relic: relique }),
    meilleurSansVerrous: r.meilleurSansVerrous,
    conforme,
  };
}

/**
 * Le pendant exact de `resoudreEquipementDuBuild` : même entrée, même
 * résultat (paire, artéfacts, stats, `meilleurSansVerrous`, conformité,
 * relique, `sansEffetSurLeTri`), mêmes erreurs.
 *
 * `rapide` : les représentants des formes, partagés par les builds d'une file
 * (absent : recalculés à chaque build). `compteurs` : pour le banc.
 */
export function resoudreEquipementDuBuildRapide(
  e: EntreeResolution,
  rapide?: CachesResolutionRapide,
  compteurs?: CompteursResolutionRapide
): ResultatArtefacts {
  if (compteurs) compteurs.builds++;
  const ctx = e.relicContext;
  if (ctx?.mode !== 'recherche') return resoudreReliqueFixeRapide(e, e.gear.relic);

  const candidates = ctx.eligibles;
  if (candidates.length === 0) throw new RechercheRefusee(ctx.vide ?? 'inventaire');

  // Les paramètres de paires d'une relique, construits au plus une fois (la
  // production les construit une fois par relique essayée).
  const parametres = new Map<RelicDetail, ArtifactSearchParams>();
  const paramsDe = (relique: RelicDetail) => {
    let p = parametres.get(relique);
    if (!p) {
      p = e.faireParams(relique);
      parametres.set(relique, p);
    }
    return p;
  };
  const formes = (rapide ?? new CachesResolutionRapide()).representants(paramsDe(candidates[0]!));

  // Le verdict de chaque forme, par principale de relique : `computeStats` ne
  // lit d'une relique que sa principale, deux reliques de même principale
  // ont la même table.
  const tables = new Map<string, Map<string, boolean>>();
  const tableDe = (relique: RelicDetail) => {
    const cle = `${relique.main.code}:${relique.main.value}`;
    let t = tables.get(cle);
    if (!t) {
      t = new Map();
      for (const pe of formes.element) {
        for (const pa of formes.archetype) {
          const arts = [pe, pa].filter((a): a is ArtifactDetail => a != null);
          t.set(`${formeDe(pe)}|${formeDe(pa)}`, respecteConditionsAvecRelique({ ...e.gear, artifacts: arts }, relique, e.requirement).respecte);
          if (compteurs) compteurs.formesJugees++;
        }
      }
      tables.set(cle, t);
    }
    return t;
  };

  const parRelique = new Map<number, CoupleFaisable>();
  // La première paire (au score) de chaque relique notée, ou `null` si elle
  // n'en a aucune : le diagnostic s'en sert.
  const premieres = new Map<RelicDetail, { paire: PaireArtefacts; meilleurSansVerrous: number | null } | null>();

  const meilleure = bestRelicForBuild(
    candidates,
    (relique) => {
      if (compteurs) compteurs.reliques++;
      const table = tableDe(relique);
      let uneFaisable = false;
      for (const v of table.values()) if (v) uneFaisable = true;
      if (!uneFaisable) {
        if (compteurs) compteurs.reliquesSansFormeFaisable++;
        return 'infaisable';
      }
      if (compteurs) compteurs.reliquesNotees++;
      const r = pairesParScore(paramsDe(relique), e.caches?.preFiltre);
      let premiere = true;
      premieres.set(relique, null);
      for (const p of r.paires) {
        if (premiere) {
          premieres.set(relique, { paire: p, meilleurSansVerrous: r.meilleurSansVerrous });
          premiere = false;
        }
        const v = table.get(formeDePaire(p));
        // Une paire hors du sur-ensemble invaliderait l'écart des reliques
        // sans forme faisable : c'est un bug, jamais un cas à absorber.
        if (v === undefined) throw new Error(`resoudreEquipementDuBuildRapide : paire de forme ${formeDePaire(p)} hors des formes de candidatsParSorte — bug.`);
        if (!v) continue;
        const arts = artefactsDe(p);
        const { stats } = respecteConditionsAvecRelique({ ...e.gear, artifacts: arts }, relique, e.requirement);
        parRelique.set(relique.id, { paire: p, artefacts: arts, stats, meilleurSansVerrous: r.meilleurSansVerrous });
        return p.score;
      }
      if (compteurs) compteurs.reliquesNoteesSansCouple++;
      return 'infaisable';
    },
    { regimeAucun: e.regimeAucun, equipee: ctx.equipee, departagePortee: e.regimeDeStat }
  );

  if (!meilleure) {
    // Le diagnostic de la production : l'éligible de plus petite `id` (la
    // première rencontrée à `id` égale) qui a au moins une paire, et son
    // premier couple au score, faisable ou non.
    const ordre = candidates.map((r, i) => [r, i] as const).sort((x, y) => x[0].id - y[0].id || x[1] - y[1]);
    let d: { relique: RelicDetail; couple: CoupleFaisable } | null = null;
    for (const [relique] of ordre) {
      let premiere = premieres.get(relique);
      if (premiere === undefined) {
        if (compteurs) {
          compteurs.diagnostics++;
          compteurs.reliquesNotees++;
        }
        const r = pairesParScore(paramsDe(relique), e.caches?.preFiltre);
        premiere = null;
        for (const p of r.paires) {
          premiere = { paire: p, meilleurSansVerrous: r.meilleurSansVerrous };
          break;
        }
        premieres.set(relique, premiere);
      }
      if (!premiere) continue;
      const arts = artefactsDe(premiere.paire);
      const { stats } = respecteConditionsAvecRelique({ ...e.gear, artifacts: arts }, relique, e.requirement);
      d = { relique, couple: { paire: premiere.paire, artefacts: arts, stats, meilleurSansVerrous: premiere.meilleurSansVerrous } };
      break;
    }
    return {
      paire: d?.couple.paire ?? null,
      artefacts: d?.couple.artefacts ?? [],
      stats: d?.couple.stats ?? computeStats({ ...e.gear, relic: undefined }),
      meilleurSansVerrous: d?.couple.meilleurSansVerrous ?? null,
      conforme: false,
      relique: d?.relique,
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
