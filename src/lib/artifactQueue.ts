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
// ⚠️ Ce module ne planifie rien : il dit seulement QUI traiter et dans quel
// ordre. Le « quand » vit dans `useArtifactOptimQueue` (temps d'inactivité du
// fil principal), le « comment » dans `artifactOptim.ts`. Trois responsabilités
// séparées, dont celle-ci est la seule testable sans navigateur.

import { BuildCandidate, BuildRequirement } from './runeBuildOptim';
import { StatRow } from './stats';
import { ArtifactDetail, RelicDetail } from '../types';
import { PaireArtefacts } from './artifactOptim';

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
 * premiers du fait de ce mécanisme. L'ensemble à traiter ne s'élargit jamais,
 * il rétrécit ; la boucle « trier → optimiser → retrier » converge donc en au
 * plus K étapes, sans emballement.
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

/**
 * Les builds à traiter ensuite : les `K` mieux classés qui n'ont pas encore
 * leur paire, dans l'ordre de priorité.
 *
 * ⚠️ `triees` doit ARRIVER trié par l'objectif (via `sortCandidates`, la source
 * unique). Ce module ne trie pas : un second tri ici finirait par diverger de
 * celui de l'écran, exactement le défaut qui avait fait lire
 * `candidates[0]` comme « le meilleur » alors qu'il ne l'était pas.
 *
 * ⚠️ Le classement se fait sur les dégâts SANS artéfacts optimisés — c'est le
 * seul disponible pendant la recherche. Un build peut donc entrer dans les `K`
 * puis en sortir quand de meilleurs arrivent ; son résultat déjà calculé reste
 * en cache et ne coûte plus rien. C'est le pari du temps masqué, assumé.
 */
export function prochainsATraiter(
  triees: readonly BuildCandidate[],
  deja: ReadonlySet<string>,
  K: number,
  /**
   * La page RÉELLEMENT affichée, traitée EN PRIORITÉ sur le top-K.
   *
   * ⚠️ **Sans elle, aucune page au-delà de la K-ième n'aurait jamais sa
   * paire** — quelle que soit la valeur de K. Le top-K est une avance de fond
   * pour les premières pages ; c'est celle qu'on regarde qui doit être servie
   * d'abord, parce qu'elle est sous les yeux.
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
  const vusDansCeLot = new Set<string>();
  // La page d'abord, puis le top-K — sans dépasser K au total : la file reste
  // bornée, et une page profonde ne déclenche pas un travail illimité.
  const aParcourir = [...pageAffichee, ...triees.slice(0, K)];
  for (let i = 0; i < aParcourir.length; i++) {
    const c = aParcourir[i]!;
    const cle = cleBuild(c);
    // ⚠️ `vusDansCeLot` en plus de `deja` — et ce n'est PLUS une garde
    // défensive depuis que la page affichée précède le top-K : un build de la
    // page figure presque toujours AUSSI dans le top-K, donc deux fois dans
    // `aParcourir`. Sans cette garde, il partirait deux fois en file.
    //
    // ⚠️ Le flux de candidats, lui, n'en produit pas : vérifié plutôt que
    // supposé — le générateur d'appariement n'est jamais relancé en cours de
    // route, les deltas sont découpés par un curseur strictement monotone
    // (`allCandidates.slice(candidatesSent)`, runeBuildOptim.worker.ts), les
    // tranches de `bucketsA` sont disjointes, et la réception est un pur
    // `concat`.
    if (deja.has(cle) || vusDansCeLot.has(cle)) continue;
    vusDansCeLot.add(cle);
    out.push(c);
  }
  return out;
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
}): string {
  // ⚠️ Un minimum à 0 n'exige RIEN : le retenir ferait relancer 100
  // optimisations pour rien dès qu'on tape puis efface une valeur. L'ordre de
  // saisie non plus ne change rien.
  const lignes = [...parts.lignesVerrouillees]
    .filter((l) => l.min > 0)
    .sort((a, b) => a.code - b.code)
    .map((l) => `${l.code}:${l.min}`)
    .join('|');
  return [
    parts.monstreCom2usId,
    JSON.stringify(parts.damageSetup),
    parts.objective,
    parts.ignoreArtifacts ? 'x' : '-',
    JSON.stringify(parts.principaleParSorte),
    lignes,
    JSON.stringify(parts.relique ?? null),
    parts.nbArtefacts,
    parts.empreinteRelique ?? '',
    JSON.stringify(parts.requirement.minStats),
    JSON.stringify(parts.requirement.maxStats ?? {}),
  ].join('§');
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
