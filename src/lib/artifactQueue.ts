// File d'optimisation d'artéfacts alimentée AU FIL DE L'EAU.
//
// ⚠️ **Pourquoi au fil de l'eau, et pas en passe finale.** Un premier
// raisonnement concluait « passe finale obligatoire » : les candidats arrivent
// dans l'ordre d'APPARIEMENT, pas dans celui du classement, donc on ne saurait
// qu'à la fin lesquels méritent d'être optimisés. La prémisse est juste, la
// conclusion ne l'est pas :
//
//  - `combosOrderMode` vaut `'objective'` (runeBuildOptim.ts) : l'ordre
//    d'appariement EST piloté par l'objectif, et les bons builds sortent tôt —
//    quelques secondes, là où la recherche s'écoule sur plusieurs minutes ;
//  - le travail perdu sur un build évincé plus tard ne coûte RIEN s'il a été
//    fait pendant que les Workers cherchaient. Attendre la fin, si.
//
// ⚠️ Ce module ne planifie rien : il dit seulement QUI traiter, dans quel
// ordre, et par quelle voie (`voieDeLaFile` : la page affichée sans attendre,
// le fond sur l'inactivité). Le « quand » vit dans `useArtifactOptimQueue`
// (fil principal), le « comment » dans `artifactOptim.ts`. Trois
// responsabilités séparées, dont celle-ci est la seule testable sans
// navigateur.

import { BuildCandidate, BuildRequirement, Objective, OptionsDeClassement, sortCandidates } from './runeBuildOptim';
import { StatKey } from './effects';
import { StatRow } from './stats';
import { ArtifactDetail, RelicDetail } from '../types';
import { PaireArtefacts } from './artifactOptim';
import { RelicContext } from './relicOptim';

/**
 * Identité d'un build, pour ne pas l'optimiser deux fois.
 *
 * ⚠️ **Triée.** Deux candidats portant les mêmes runes dans un ordre différent
 * sont le MÊME build — l'emplacement d'une rune est porté par la rune, pas par
 * sa position dans le tableau. Sans le tri, le cache raterait et on paierait
 * deux fois le même travail.
 */
// ⚠️ **Mémoïsée par IDENTITÉ d'objet.** `cleBuild` copie, trie et joint un
// tableau de 6 identifiants : négligeable pour un candidat, ruineux appliqué
// aux 100 000 d'une recherche lâche — et le classement d'affichage le fait à
// CHAQUE build optimisé, soit K fois. Mesuré : c'est ce qui maintenait le retri
// à 240 ms quand le tri de base était retombé à 85.
//
// ⚠️ `WeakMap` et non `Map` : les candidats d'une recherche périmée doivent
// pouvoir être ramassés. Une `Map` les retiendrait indéfiniment — 100 000
// entrées par recherche, à vie.
const CLES = new WeakMap<BuildCandidate, string>();

export function cleBuild(c: BuildCandidate): string {
  const memo = CLES.get(c);
  if (memo !== undefined) return memo;
  const cle = [...c.runeIds].sort((a, b) => a - b).join(',');
  CLES.set(c, cle);
  return cle;
}

export interface ResultatArtefacts {
  paire: PaireArtefacts | null;
  artefacts: ArtifactDetail[];
  /**
   * Les stats du build RECALCULÉES avec sa vraie paire.
   *
   * ⚠️ **Pas seulement le total.** `BuildCandidate.stats` a été calculé avec la
   * paire SUPPOSÉE ; si la paire retenue porte une autre stat principale — cas
   * courant avec le cran « Libre » —, les stats affichées ne correspondent plus
   * aux artéfacts affichés à côté d'elles. Et un tri par ATQ porterait alors sur
   * une valeur périmée.
   */
  stats: StatRow[];
  // `null` quand le coût n'a pas été demandé — voir `avecCoutDesVerrous`.
  meilleurSansVerrous: number | null;
  /**
   * Ce build tient-il encore ses minimums avec une VRAIE paire ?
   *
   * ⚠️ **Ce n'est pas une précaution, c'est la moitié d'une correction.** La
   * recherche de runes valide désormais les minimums contre `artifactBounds`,
   * une borne calculée PAR STAT ISOLÉE (voir `bornesArtefacts`). Avec des
   * minimums sur PV, ATQ et DEF à la fois, elle suppose les trois maxima
   * réunis — alors qu'une paire ne porte que deux principales. Des builds
   * survivent donc sans qu'aucune paire réelle ne les rende équipables :
   * mesuré sur un cas réel, 99 sur 105.
   *
   * `false` = à ne PAS afficher. Un build affiché qui viole la condition
   * demandée est pire qu'un build manquant : l'utilisateur ne le vérifie pas.
   * Voir spec/outils/optimizer/artefacts.md, §12.5.
   *
   * ⚠️ Depuis le lot 5b (implementation-relique), en mode `recherche` de la
   * relique, `false` signifie « aucun couple (paire, relique) faisable » :
   * minimums ET maximums, avec la relique réelle (`respecteConditionsAvecRelique`).
   */
  conforme: boolean;
  /**
   * La relique RETENUE pour ce build, résolue ENSEMBLE avec la paire
   * (`resoudreEquipementDuBuild`, relicQueue.ts — lot 5b). Présente en mode
   * `recherche` seulement : hors de ce mode la relique portée est fixe
   * (`SearchParams.relic`), rien n'est résolu et le champ reste absent.
   * `stats` ci-dessus l'INCLUT : c'est elle qui classe, et c'est son `id`
   * (`rid`) que la carte affiche.
   */
  relique?: RelicDetail;
  // Régime `aucun` (Efficience, Vitesse…) : toute candidate faisable a le
  // même score, la relique choisie n'a pas d'effet sur le tri — transporté
  // jusqu'à la carte (contrat de B.3, `bestRelicForBuild`).
  sansEffetSurLeTri?: true;
}

/**
 * Un candidat vu à travers sa VRAIE paire, quand elle est connue.
 *
 * ⚠️ **L'ordre peut s'en trouver changé, et c'est voulu.** Optimiser un build
 * ne peut que faire MONTER son score : la paire supposée fait partie des paires
 * candidates, donc le maximum sur cet ensemble lui est toujours supérieur ou
 * égal. Conséquence : un build optimisé monte ou reste, un build non optimisé
 * ne peut qu'être repoussé vers le bas — aucun ne peut ENTRER dans les K
 * premiers du fait de ce mécanisme. La boucle « trier → optimiser → retrier »
 * converge donc, sans emballement : la file lit l'ordre de BASE, que la
 * résolution ne touche pas, et chaque étape résout un build de plus (le cache
 * ne fait que grandir). Depuis degats-et-aura 6bis-b18, sa fenêtre s'allonge
 * d'un build par écarté, jusqu'à K confirmées : au plus autant d'étapes que de
 * builds trouvés.
 *
 * C'est ce qui autorise à laisser un build passer devant dans l'ordre plutôt
 * que d'afficher une inversion visible entre le rang et le total.
 *
 * ⚠️ Lot 5b : en mode `recherche` de la relique, `r.stats` INCLUT la relique
 * retenue (`ResultatArtefacts.relique`) — un candidat non résolu garde ses
 * stats SANS relique (score non exact, « en attente »). L'argument de
 * convergence tient : une principale en % ne fait jamais baisser PV, ATQ ni
 * DEF. La non-régression est CONDITIONNELLE à l'ensemble admissible : si
 * l'équipée est exclue du pool (filtre, seuil), la meilleure admissible peut
 * noter moins que l'équipée — voir `reliqueEquipeeExclue` (relicQueue.ts).
 */
export function candidatAvecSaPaire(c: BuildCandidate, cache: ReadonlyMap<string, ResultatArtefacts>): BuildCandidate {
  const r = cache.get(cleBuild(c));
  return r ? { ...c, stats: r.stats } : c;
}

// Combien de builds la file résout au maximum, hors page affichée. Mesuré :
// le vainqueur final venait du rang initial #1, et il faut les 7 premiers pour
// un top 5 exact — 100 laisse une marge confortable, soit 5 pages de résultats
// entièrement justes. Calibré AVANT le mode relique « recherche ».
export const K_BUILDS_OPTIMISES = 100;

// ⚠️ **En mode relique « recherche », 300** (degats-et-aura 6bis-b8, décision
// utilisateur du 2026-10-01). L'ordre de base y note SANS relique : un build
// au-delà des 100 premiers peut remonter très haut une fois résolu (sur le
// vrai compte, en PV effectifs, les rangs exhaustifs 16, 17 et 19 venaient
// des rangs de base 107 à 117). 300 réduit le manque, ne l'annule pas : le
// top affiché reste une approximation (limites-connues.md).
export const K_BUILDS_RECHERCHE_RELIQUE = 300;

/**
 * La cible de la file pour UNE recherche, en combinaisons CONFIRMÉES —
 * partagée par l'écran (`useArtifactOptimQueue`) et le CLI
 * (`classerApresResolution`).
 *
 * ⚠️ **Des confirmées, plus des rangs** (degats-et-aura 6bis-b18, décision de
 * l'utilisateur du 2026-10-02). La valeur ne change pas (300 / 100) ; son sens,
 * si : la file ne s'arrête plus aux K premiers de l'ordre de base, mais quand
 * K builds y sont résolus ET conformes (voir `prochainsATraiter`).
 *
 * ⚠️ L'entrée est le contexte relique de la recherche LANCÉE
 * (`relicContextRecherche` à l'écran, `params.relicContext` au CLI), jamais
 * l'état courant des réglages : changer un réglage après le lancement ne
 * change pas K. « Équipée » et « Off » gardent 100 (en « Off », il n'y a de
 * toute façon pas de file : l'optimisation d'artéfacts est coupée).
 */
export function kDeLaFile(relicContext: RelicContext | undefined): number {
  return relicContext?.mode === 'recherche' ? K_BUILDS_RECHERCHE_RELIQUE : K_BUILDS_OPTIMISES;
}

/**
 * Les builds à traiter ensuite, dans l'ordre de priorité : la page affichée,
 * puis l'avance de fond, qui vise `K` combinaisons CONFIRMÉES (degats-et-aura
 * 6bis-b18).
 *
 * L'avance de fond parcourt `triees` dans l'ordre et s'arrête dès que les
 * confirmées rencontrées (résolues ET conformes) plus les non résolues
 * rencontrées atteignent `K` : elle rend ces non résolues — celles qu'il faut
 * encore vérifier pour atteindre K confirmées si elles le sont toutes. Une
 * écartée (`conforme: false`) ne compte pas : la fenêtre s'allonge d'autant, et
 * la file continue, dans l'ordre du classement, jusqu'à K confirmées ou
 * jusqu'au dernier build trouvé. **Sans écartée, c'est exactement « les K
 * premiers non résolus »**, la règle d'avant ce lot : rien ne change dans le cas
 * normal (« Dégâts réels » de référence : 300 conformes sur 300).
 *
 * ⚠️ `cache` est le cache de la file lui-même (`cleBuild` → résultat), jamais
 * une copie de ses clés : la conformité de chaque résultat y est lue. Seules
 * les entrées des builds de `triees` comptent — les rejets d'une recherche
 * précédente aux mêmes réglages, restés en cache, n'y figurent pas.
 *
 * ⚠️ `triees` doit ARRIVER trié par l'objectif (via `sortCandidates`, la source
 * unique). Ce module ne trie pas : un second tri ici finirait par diverger de
 * celui de l'écran, exactement le défaut qui avait fait lire
 * `candidates[0]` comme « le meilleur » alors qu'il ne l'était pas.
 *
 * ⚠️ Le classement se fait sur les dégâts SANS artéfacts optimisés — c'est le
 * seul disponible pendant la recherche. Un build peut donc entrer dans la
 * fenêtre puis en sortir quand de meilleurs arrivent ; son résultat déjà
 * calculé reste en cache et ne coûte plus rien. C'est le pari du temps masqué,
 * assumé.
 */
export function prochainsATraiter(
  triees: readonly BuildCandidate[],
  cache: ReadonlyMap<string, { conforme: boolean }>,
  K: number,
  /**
   * La page RÉELLEMENT affichée, traitée EN PRIORITÉ sur l'avance de fond.
   *
   * ⚠️ **Sans elle, aucune page au-delà des K confirmées n'aurait jamais sa
   * paire** — quelle que soit la valeur de K. L'avance de fond sert les
   * premières pages ; c'est celle qu'on regarde qui doit être servie d'abord,
   * parce qu'elle est sous les yeux.
   *
   * ⚠️ Passer la page AFFICHÉE (et non la page de l'ordre de base) crée bien
   * une dépendance de la file envers sa propre sortie. Elle CONVERGE, par le
   * même argument que le reclassement : optimiser ne peut que faire monter un
   * build, donc l'ensemble à traiter rétrécit. Et le cache n'étant
   * qu'accumulé, aucun travail n'est refait.
   */
  pageAffichee: readonly BuildCandidate[] = []
): BuildCandidate[] {
  const out: BuildCandidate[] = [];
  // ⚠️ `vusDansCeLot` en plus du cache — et ce n'est PLUS une garde défensive
  // depuis que la page affichée précède l'avance de fond : un build de la page
  // figure presque toujours AUSSI dans la fenêtre de fond. Sans cette garde, il
  // partirait deux fois en file.
  //
  // ⚠️ Le flux de candidats, lui, n'en produit pas : vérifié plutôt que
  // supposé — le générateur d'appariement n'est jamais relancé en cours de
  // route, les deltas sont découpés par un curseur strictement monotone
  // (`allCandidates.slice(candidatesSent)`, runeBuildOptim.worker.ts), les
  // tranches de `bucketsA` sont disjointes, et la réception est un pur
  // `concat`.
  const vusDansCeLot = new Set<string>();
  const ajouter = (c: BuildCandidate, cle: string) => {
    if (vusDansCeLot.has(cle)) return;
    vusDansCeLot.add(cle);
    out.push(c);
  };
  // La page d'abord : elle est bornée par l'écran (au plus une page).
  for (const c of pageAffichee) {
    const cle = cleBuild(c);
    if (!cache.has(cle)) ajouter(c, cle);
  }
  // Puis l'avance de fond, vers K confirmées. Un build non résolu compte dans
  // la fenêtre même s'il vient d'être pris par la page (il n'est pas ajouté
  // deux fois) : la fenêtre ne dépend que de l'ordre de base et du cache.
  let confirmees = 0;
  let aVerifier = 0;
  for (let i = 0; i < triees.length && confirmees + aVerifier < K; i++) {
    const c = triees[i]!;
    const cle = cleBuild(c);
    const r = cache.get(cle);
    if (r === undefined) {
      aVerifier++;
      ajouter(c, cle);
    } else if (r.conforme) {
      confirmees++;
    }
  }
  return out;
}

/**
 * Par quelle voie la file planifie sa prochaine tranche (degats-et-aura
 * 6bis-b11) : `page` = tâche immédiate, `fond` = temps d'inactivité,
 * `aucune` = rien à planifier.
 */
export type VoieDeLaFile = 'page' | 'fond' | 'aucune';

/**
 * La voie de la prochaine tranche : la PAGE AFFICHÉE tant qu'elle contient un
 * build non résolu, le FOND (vers K confirmées) ensuite, rien quand tout est fait.
 *
 * ⚠️ **Elle ne choisit pas QUI traiter**, seulement QUAND : `restants` est la
 * sortie de `prochainsATraiter`, qui place déjà la page en tête. Le travail
 * total ne change donc pas ; la voie prioritaire est bornée aux builds de la
 * page, et le premier restant en est un dès qu'elle vaut `page`.
 *
 * Pourquoi deux voies : pendant une recherche, l'écran reçoit la progression
 * toutes les 150 ms et retrie l'aperçu. Il est rarement inactif, et chaque
 * build de la page pouvait attendre jusqu'à une seconde (`timeout` de
 * `requestIdleCallback`) — constat de l'utilisateur au navigateur, le
 * 2026-10-02. L'avance de fond, elle, peut attendre.
 *
 * `deja` est lu par `has` seulement : le cache du hook (une `Map`) s'y passe
 * tel quel, sans copier ses clés.
 */
export function voieDeLaFile(
  restants: readonly BuildCandidate[],
  pageAffichee: readonly BuildCandidate[],
  deja: { has(cle: string): boolean }
): VoieDeLaFile {
  if (restants.length === 0) return 'aucune';
  return pageAffichee.some((c) => !deja.has(cleBuild(c))) ? 'page' : 'fond';
}

/**
 * Le cache reste-t-il valable ?
 *
 * ⚠️ **Tout ce qui change le SCORE d'une paire invalide le cache**, pas
 * seulement l'inventaire : changer l'élément visé, une stat principale exigée
 * ou une ligne verrouillée change quelles lignes comptent
 * (`analyserPertinence`) et donc quelle paire gagne. Garder les résultats
 * d'avant afficherait des paires optimales pour un réglage que l'utilisateur
 * a quitté — sans que rien ne le signale.
 */
export function signatureReglages(parts: {
  monstreCom2usId: number;
  // ⚠️ **Le réglage de dégâts ENTIER, jamais quelques champs choisis à la
  // main.** Une première version ne prenait que `skillCom2usId` et l'élément
  // visé : changer le buff ATQ, les PV restants de la cible ou sa défense
  // laissait alors la signature IDENTIQUE, donc le cache intact — l'écran
  // affichait des paires optimisées pour un réglage abandonné, et le « gain »
  // comparait un score d'avant à un total d'après. Bug rapporté à l'usage.
  //
  // ⚠️ Choisir les champs un par un est ici la même faute que la règle des
  // « plusieurs constructeurs » (CLAUDE.md) : `tsc` ne signalera JAMAIS un
  // champ oublié dans une clé de cache. On sérialise donc tout l'objet, ce qui
  // reste juste quand `DamageSetup` gagne un champ.
  damageSetup: unknown;
  compterAurasResPre?: boolean;
  objective: string;
  ignoreArtifacts: boolean;
  principaleParSorte: Record<string, unknown>;
  lignesVerrouillees: { code: number; min: number }[];
  // Ce que l'ÉQUIPEMENT apporte hors runes et hors artéfacts — la relique
  // entre dans les stats, donc dans le score d'une paire. Change quand
  // l'utilisateur bascule d'exemplaire (box / RTA / deck de siège).
  relique: unknown;
  nbArtefacts: number;
  /**
   * L'empreinte du contexte relique de la recherche (`RelicContext.empreinte`,
   * relicOptim.ts — lot 5b), `null` sans contexte. Elle est STABLE et
   * SÉMANTIQUE : mode, pool éligible (`rid`, principale, upgrade, exclusive),
   * choix de principale, de type et seuil — un `rid` réimporté avec une autre
   * valeur la change. Elle vaut « signature complète » de la dimension
   * relique (plan § 2.4 point 3, T5) ; le régime effectif est `objective`
   * ci-dessus (D7 : un seul régime pour l'équipement complet), les données de
   * combat `damageSetup`.
   */
  empreinteRelique: string | null;
  /**
   * Les conditions ENTIÈRES (minimums ET maximums) que le résolveur consomme
   * depuis le lot 5b (`respecteConditionsAvecRelique`, `resoudreEquipementDuBuild`)
   * — jamais un sous-ensemble choisi à la main, même règle que `damageSetup`
   * (CLAUDE.md, « plusieurs constructeurs »). Sans ce champ, relancer avec le
   * même contexte et un autre maximum gardait un couple devenu infaisable en
   * cache (bloquant 2, revue du lot 5b, `revue-diff-lot5b-2026-09-21.md`).
   */
  requirement: Pick<BuildRequirement, 'minStats' | 'maxStats'>;
  /**
   * Les artéfacts RÉSERVÉS par les autres builds validés de la liste active
   * (`otherValidatedArtifactIds`, optimizerExclusion.ts) : ils sortent de
   * l'inventaire de la paire (`parametresArtefactsFiche`, artifactFiche.ts).
   * Sans ce champ, « Libérer les artéfacts » sur la ligne d'un autre monstre
   * de la liste, ou un changement de liste active, laissait en cache des
   * paires calculées avec l'ancien inventaire — même après une nouvelle
   * recherche aux mêmes réglages (degats-et-aura 6bis-b17, défaut relevé par
   * la revue du Worker).
   *
   * ⚠️ **Obligatoire**, pour que `tsc` signale un appelant qui l'oublierait :
   * optionnel, l'oubli resterait parfaitement typé (CLAUDE.md, « plusieurs
   * constructeurs »). Le CLI n'a pas de liste de travail
   * (`AUCUN_ARTEFACT_RESERVE`) et n'appelle pas cette signature.
   */
  artefactsReserves: Iterable<number>;
  /**
   * Les pièces des emplacements figés sur « Garder l'artéfact équipé »
   * (`piecesFigeesDe`, artifactFiche.ts) : pour un tel emplacement, la pièce
   * portée par la fiche EST le seul candidat (`candidatsParSorte`). Valider
   * un build de ce monstre, « Voir le runage réellement porté » ou changer
   * d'exemplaire de la même espèce la remplacent sans rien changer d'autre
   * ici (degats-et-aura 6bis-b17). Sérialisées ENTIÈRES, comme la relique.
   * Obligatoire, pour la même raison qu'`artefactsReserves`.
   */
  piecesFigees: readonly unknown[];
}): string {
  // ⚠️ Un minimum à 0 n'exige RIEN : le retenir ferait relancer 100
  // optimisations pour rien dès qu'on tape puis efface une valeur. L'ordre de
  // saisie non plus ne change rien.
  const lignes = [...parts.lignesVerrouillees]
    .filter((l) => l.min > 0)
    .sort((a, b) => a.code - b.code)
    .map((l) => `${l.code}:${l.min}`)
    .join('|');
  // ⚠️ Un ENSEMBLE trié : l'inventaire filtré ne dépend ni de l'ordre de la
  // liste ni d'un doublon. Vide, le composant est OMIS — sans réservation, la
  // signature reste exactement celle d'avant 6bis-b17, et rien n'est vidé
  // pour rien. Son préfixe le distingue de tout autre composant facultatif.
  const reserves = [...new Set(parts.artefactsReserves)].sort((a, b) => a - b).join(',');
  return [
    parts.monstreCom2usId,
    JSON.stringify(parts.damageSetup),
    parts.compterAurasResPre ?? true,
    parts.objective,
    parts.ignoreArtifacts ? 'x' : '-',
    JSON.stringify(parts.principaleParSorte),
    lignes,
    JSON.stringify(parts.relique ?? null),
    parts.nbArtefacts,
    parts.empreinteRelique ?? '',
    JSON.stringify(parts.requirement.minStats),
    JSON.stringify(parts.requirement.maxStats ?? {}),
    ...(reserves ? [`reserves:${reserves}`] : []),
    // Même règle : sans emplacement figé, composant omis, signature d'avant.
    ...(parts.piecesFigees.length > 0 ? [`figees:${JSON.stringify(parts.piecesFigees)}`] : []),
  ].join('§');
}

/**
 * La signature de cache de LA CARTE « Artéfacts » de l'écran — la closure
 * `signatureArtefacts` d'`OptimizerSection.tsx` (implementation-relique,
 * B.5c) sortie ici pour être testable : elle ne fait qu'assembler les
 * réglages de l'écran dans les noms génériques de `signatureReglages`
 * ci-dessus, mais c'est CET assemblage qui a déjà divergé une fois
 * (B.5b bis, contrôle 4 : `objective` recevait le régime BRUT au lieu du
 * régime EFFECTIF, `regimeEquipement` — voir `regimeEquipementDe`,
 * artifactEvaluation.ts). `regimeEquipement` est déjà résolu par l'appelant
 * (une seule dérivation, jamais recopiée ici).
 */
export function signatureArtefacts(parts: {
  monstreCom2usId: number;
  damageSetup: unknown;
  compterAurasResPre?: boolean;
  regimeEquipement: string;
  ignoreArtifacts: boolean;
  principaleParSorte: Record<string, unknown>;
  lignesVerrouillees: { code: number; min: number }[];
  relique: unknown;
  nbArtefacts: number;
  empreinteRelique: string | null;
  requirement: Pick<BuildRequirement, 'minStats' | 'maxStats'>;
  // Les artéfacts réservés par les autres builds validés de la liste active
  // (`artefactsReserves` de l'écran) — voir `signatureReglages`.
  artefactsReserves: Iterable<number>;
  // Les pièces des emplacements figés (`piecesFigeesDe`) — voir `signatureReglages`.
  piecesFigees: readonly unknown[];
}): string {
  return signatureReglages({
    monstreCom2usId: parts.monstreCom2usId,
    damageSetup: parts.damageSetup,
    compterAurasResPre: parts.compterAurasResPre,
    objective: parts.regimeEquipement,
    ignoreArtifacts: parts.ignoreArtifacts,
    principaleParSorte: parts.principaleParSorte,
    lignesVerrouillees: parts.lignesVerrouillees,
    relique: parts.relique,
    nbArtefacts: parts.nbArtefacts,
    empreinteRelique: parts.empreinteRelique,
    requirement: parts.requirement,
    artefactsReserves: parts.artefactsReserves,
    piecesFigees: parts.piecesFigees,
  });
}

/**
 * Départage CANONIQUE à score égal : `rid` de la relique retenue croissant,
 * puis `cleBuild` — la convention du contrat (B.5b bis, mineur de la revue),
 * la même que l'oracle (`bestRelicForBuild`, `relicOptim.ts`).
 *
 * ⚠️ **Un tri PRÉALABLE, pas un comparateur de plus dans `sortCandidates`.**
 * `sortCandidates` reste un tri STABLE (ES2019, garanti par la spec) sur le
 * seul score : lui faire suivre un ordre déjà départagé par `rid`/`cleBuild`
 * suffit à rendre la sortie déterministe à score égal, sans apprendre à
 * `sortCandidates` — générique, partagé avec le harnais — la notion de
 * relique. `ridDe` absent (candidat pas encore résolu) va en dernier, par
 * construction (`Number.POSITIVE_INFINITY`) : l'ordre entre candidats non
 * résolus reste déterministe (par `cleBuild`), sans prétendre à un rang exact.
 */
export function ordonnerParDepartage<T extends BuildCandidate>(candidats: readonly T[], ridDe: (c: T) => number | undefined): T[] {
  return [...candidats].sort((a, b) => {
    const ra = ridDe(a) ?? Number.POSITIVE_INFINITY;
    const rb = ridDe(b) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    const ca = cleBuild(a);
    const cb = cleBuild(b);
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

/**
 * Le classement RÉEL : chaque build vu à travers son équipement résolu dès
 * qu'il est connu (`parBuild`, le cache de la file), puis retrié — le
 * producteur du classement affiché de l'écran (`affichees`,
 * OptimizerSection.tsx) et du CLI (`optimizer-search.ts`), pour que les deux
 * classent un même cache de la même façon (degats-et-aura 6bis-b5c).
 *
 * - `base` : l'ordre de BASE (paire supposée), déjà trié par
 *   `sortCandidates` ; rendu tel quel tant que rien n'est résolu.
 * - Les builds qu'AUCUN couple réel ne rend équipables (`conforme: false`)
 *   sont écartés ICI (§12.5) ; un build absent du cache reste, car on ne sait
 *   pas encore.
 * - Départage canonique AVANT le tri stable (`ordonnerParDepartage`), puis
 *   stats remplacées par celles de l'équipement retenu (`candidatAvecSaPaire`,
 *   relique retenue comprise en mode `recherche`).
 * - `options` : celles du classement affiché (`optionsDeClassement`), dont
 *   le profil d'artéfacts et la relique de CHAQUE build lus dans ce même
 *   cache.
 *
 * ⚠️ **Un build optimisé peut donc passer devant, et c'est le comportement
 * voulu** — voir `candidatAvecSaPaire` pour l'argument de convergence.
 */
export function classementResolu(
  base: BuildCandidate[],
  parBuild: ReadonlyMap<string, ResultatArtefacts>,
  sortBy: StatKey | Objective,
  options: OptionsDeClassement
): BuildCandidate[] {
  if (parBuild.size === 0) return base;
  const conformes = ordonnerParDepartage(
    base.filter((c) => parBuild.get(cleBuild(c))?.conforme !== false),
    (c) => parBuild.get(cleBuild(c))?.relique?.id
  );
  return sortCandidates(conformes.map((c) => candidatAvecSaPaire(c, parBuild)), sortBy, options);
}

export interface CompteAffichable {
  // Builds affichables : trouvés par le moteur, moins les écartés.
  compte: number;
  // Écartés par la résolution exacte (`conforme: false`) parmi les reçus.
  ecartes: number;
  // La ligne qui explique un zéro dû aux seuls écartés ; `null` sinon.
  raison: string | null;
}

/**
 * Le compte des builds TROUVÉS moins les écartés connus — l'unique source de la
 * ligne de progression (« … · Z trouvée(s) ») et de la ligne de raison sous un
 * zéro dû aux écartés (degats-et-aura 6bis-b10).
 *
 * ⚠️ Depuis 6bis-b18, l'en-tête des résultats et le nombre de pages ne lisent
 * plus ce compte, mais celui des CONFIRMÉES (`compteConfirme`) : celui-ci est
 * une borne optimiste, qui baisse à mesure que la vérification écarte des
 * builds.
 *
 * - `trouves` : le compte du MOTEUR — `result.candidates.length` à la fin,
 *   `progress.found` pendant l'appariement (il n'est pas plafonné, l'aperçu
 *   l'est : `PREVIEW_CANDIDATES_CAP`).
 * - `recus` / `affichables` : les longueurs de l'ordre de base
 *   (`fullSortedCandidates`) et du classement affiché (`affichees`, sortie de
 *   `classementResolu`) — leur différence est le nombre d'écartés, recalculée
 *   à chaque publication du cache de la file, pendant et après la recherche.
 *   Un build pas encore résolu reste dans les deux : il est compté.
 *
 * ⚠️ **Jamais les entrées `conforme: false` du cache.** Il n'est vidé qu'au
 * changement de signature : une recherche relancée aux mêmes réglages garde
 * les rejets de la précédente, y compris pour des builds qu'elle n'a pas
 * (encore) trouvés. La différence des deux longueurs ne compte que les
 * candidats de CETTE recherche.
 *
 * ⚠️ `modeRecherche` : relique « recherche » de la recherche LANCÉE — la ligne
 * de raison parle alors de la paire ET de la relique ; sinon la relique est
 * celle de la fiche, et seule la paire est en cause.
 */
export function compteAffichable(e: {
  trouves: number;
  recus: number;
  affichables: number;
  modeRecherche: boolean;
}): CompteAffichable {
  const ecartes = Math.max(0, e.recus - e.affichables);
  const compte = Math.max(0, e.trouves - ecartes);
  const raison =
    compte === 0 && ecartes > 0
      ? `${ecartes.toLocaleString('fr-FR')} ${
          ecartes === 1
            ? 'combinaison trouvée par la recherche a été écartée'
            : 'combinaisons trouvées par la recherche ont été écartées'
        } : ${
          e.modeRecherche
            ? "aucune paire d'artéfacts ni relique réelles ne tient toutes les conditions."
            : "aucune paire d'artéfacts réelle ne tient toutes les conditions."
        }`
      : null;
  return { compte, ecartes, raison };
}

export interface CompteConfirme {
  /**
   * Les combinaisons CONFIRMÉES : les builds de CETTE recherche (les reçus)
   * résolus ET conformes. Sans file, tous les trouvés : l'équipement est alors
   * celui de la fiche, que le moteur a déjà jugé exactement.
   */
  confirmees: number;
  // Les reçus pas encore résolus — ni confirmés ni écartés. 0 sans file.
  nonVerifies: number;
  /**
   * Les pages : celles des confirmées, plus une tant qu'il reste des builds non
   * vérifiés qui n'ont pas de place sur la dernière ; au moins 1. Sans file,
   * les pages des reçus, comme avant.
   */
  pages: number;
  // Recherche finie, tout vérifié, aucune confirmée : « Aucune combinaison ne
  // répond à ces critères ».
  aucune: boolean;
}

/**
 * Le compte des combinaisons CONFIRMÉES — l'unique source de l'en-tête des
 * résultats, du nombre de pages et des contrôles masqués sous « Aucune
 * combinaison… » (degats-et-aura 6bis-b18, décision de l'utilisateur du
 * 2026-10-02 : « ne compter qu'après vérification »).
 *
 * - `recus` : l'ordre de base (`fullSortedCandidates`), les candidats de CETTE
 *   recherche. Seules leurs entrées du cache comptent : les rejets d'une
 *   recherche précédente aux mêmes réglages, restés en cache, n'y sont pas.
 * - `parBuild` : le cache PUBLIÉ de la file, `null` sans file.
 * - `trouves` : le compte du moteur, lu seulement sans file.
 *
 * ⚠️ **Le compte ne baisse jamais pendant une recherche** : le cache ne fait que
 * grandir (une entrée n'est jamais retirée ni réécrite sous une même
 * signature) et l'aperçu des reçus aussi (`PREVIEW_CANDIDATES_CAP` arrête ses
 * ajouts, ne retire rien). Seul un changement de signature, qui vide le cache,
 * le remet à zéro : la vérification recommence avec les nouveaux réglages.
 *
 * ⚠️ **Les pages restent cohérentes avec `compositionDePage`** : la page k
 * montre les confirmées de rang 20 (k − 1) + 1 à 20 k, puis des places
 * « Vérification… » tant qu'il reste des non vérifiés. Le nombre de pages vaut
 * `min(⌈(confirmées + non vérifiés) / taille⌉, ⌈confirmées / taille⌉ + 1)` :
 * jamais une page vide, et une seule page au-delà des confirmées — l'ouvrir
 * les vérifie (6bis-b16).
 */
export function compteConfirme(e: {
  recus: readonly BuildCandidate[];
  parBuild: ReadonlyMap<string, { conforme: boolean }> | null;
  trouves: number;
  taillePage: number;
  termine: boolean;
}): CompteConfirme {
  if (e.parBuild === null) {
    return {
      confirmees: e.trouves,
      nonVerifies: 0,
      pages: Math.max(1, Math.ceil(e.recus.length / e.taillePage)),
      aucune: e.termine && e.trouves === 0,
    };
  }
  let confirmees = 0;
  let resolus = 0;
  for (const c of e.recus) {
    const r = e.parBuild.get(cleBuild(c));
    if (r === undefined) continue;
    resolus++;
    if (r.conforme) confirmees++;
  }
  const nonVerifies = e.recus.length - resolus;
  const pagesConfirmees = Math.ceil(confirmees / e.taillePage);
  const pages = Math.max(1, Math.min(Math.ceil((confirmees + nonVerifies) / e.taillePage), pagesConfirmees + 1));
  return { confirmees, nonVerifies, pages, aucune: e.termine && confirmees === 0 && nonVerifies === 0 };
}

export interface CompositionDePage {
  /**
   * Les cartes de la page : les builds VÉRIFIÉS — résolus ET conformes —, de
   * rang `premierRang` à `premierRang + taillePage − 1` PARMI LES VÉRIFIÉS,
   * dans l'ordre du classement réel. Jamais un build non résolu, jamais un
   * écarté.
   */
  cartes: BuildCandidate[];
  // Le rang de la première place de la page (1 en page 1).
  premierRang: number;
  // Les places « Vérification… » qui suivent les cartes : cartes + places ≤ taille de page.
  placesEnAttente: number;
  /**
   * Les builds qui rempliront ces places : les premiers non résolus du
   * classement, au plus une page — la « page affichée » que la file sert
   * AVANT l'avance de fond (`prochainsATraiter`). Vide quand la page est
   * complète, ou sans file.
   */
  aVerifier: BuildCandidate[];
}

/**
 * La composition d'UNE page de résultats (degats-et-aura 6bis-b16) — l'unique
 * source des cartes affichées, des places « Vérification… » et de la page que
 * la file résout en priorité.
 *
 * ⚠️ **Une carte n'apparaît qu'une fois vérifiée.** Avant ce lot, un build reçu
 * de la recherche s'affichait tout de suite avec sa paire SUPPOSÉE, puis
 * disparaissait à la résolution s'il n'atteignait pas les minimums : avec le
 * Worker, qui résout vite, les retraits s'enchaînaient sous les yeux (essai de
 * l'utilisateur, 2026-10-02). Désormais la page montre les vérifiés seuls, dans
 * l'ordre réel ; un build vérifié plus tard prend sa place dans ce classement
 * — une carte peut donc DESCENDRE sous un meilleur build vérifié, jamais
 * disparaître faute de conformité.
 *
 * - `classement` : le classement affiché (`affichees`, sortie de
 *   `classementResolu`) — les écartés y sont déjà absents ; s'il en restait
 *   un, il serait ignoré ici aussi, ni carte, ni place, ni à vérifier.
 * - `parBuild` : le cache PUBLIÉ de la file ; `null` sans file (optimisation
 *   d'artéfacts coupée) : rien n'est à vérifier, la page est la tranche du
 *   classement, comme avant.
 * - Les places attendues se comptent sur le classement (reçus moins écartés) :
 *   une page au-delà des vérifiés — page profonde, ou page 1 avant toute
 *   résolution — montre toutes ses places en attente. Le nombre de pages
 *   (`compteConfirme`, 6bis-b18) n'en ouvre qu'une au-delà des confirmées.
 * - `aVerifier` : pour remplir la page, il faut `début + attendues` vérifiés ;
 *   il en manque `manque`, pris dans l'ordre du classement parmi les non
 *   résolus — au plus une page à la fois. La file les résout, publie, l'écran
 *   recompose : la suivante part à son tour, jusqu'à la page complète. Même
 *   convergence que `prochainsATraiter` : le cache ne fait que grandir.
 */
export function compositionDePage(e: {
  classement: readonly BuildCandidate[];
  parBuild: ReadonlyMap<string, ResultatArtefacts> | null;
  page: number;
  taillePage: number;
}): CompositionDePage {
  const debut = Math.max(0, (e.page - 1) * e.taillePage);
  const fin = debut + e.taillePage;
  const premierRang = debut + 1;
  if (e.parBuild === null) {
    return { cartes: e.classement.slice(debut, fin), premierRang, placesEnAttente: 0, aVerifier: [] };
  }
  const cartes: BuildCandidate[] = [];
  const nonResolus: BuildCandidate[] = [];
  let verifies = 0;
  let retenus = 0;
  for (const c of e.classement) {
    const r = e.parBuild.get(cleBuild(c));
    // Écarté : jamais montré, jamais compté dans les places.
    if (r?.conforme === false) continue;
    retenus++;
    if (r === undefined) {
      if (nonResolus.length < e.taillePage) nonResolus.push(c);
      continue;
    }
    if (verifies >= debut) cartes.push(c);
    verifies++;
    // Page complète : plus rien n'attend ici, inutile de lire la suite.
    if (verifies === fin) return { cartes, premierRang, placesEnAttente: 0, aVerifier: [] };
  }
  const attendues = Math.min(e.taillePage, Math.max(0, retenus - debut));
  const placesEnAttente = attendues - cartes.length;
  const manque = debut + attendues - verifies;
  return {
    cartes,
    premierRang,
    placesEnAttente,
    aVerifier: placesEnAttente > 0 ? nonResolus.slice(0, Math.min(manque, e.taillePage)) : [],
  };
}
