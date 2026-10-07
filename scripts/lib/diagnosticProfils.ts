// Les PROFILS DE POOL SYNTHÉTIQUE NOMMÉS (spec/outils/optimizer/harnais.md,
// « Deux sources : une recette ou un pool synthétique »).
//
// ⚠️ **Un profil n'est PAS « la version rapide d'un cas réel ».** C'est la
// seule configuration où l'oracle du différentiel est
// comparable du tout : sur un cas réel la recherche tronque, et elle tronque
// PAR LE TEMPS — or l'instant de coupe varie de 3,65 % à 32 % d'un run à
// l'autre, ce qui rend NON_COMPARABLES le verdict, la population, le
// classement et le near-miss. **La vitesse n'est donc PAS le critère : la
// NATURE de la troncature l'est.** Un profil court mais tronqué par `maxMs`
// ne servirait à rien.
//
// ⚠️ **Construits À CÔTÉ des variantes de `randomPool` qui ne sont pas
// migrées, jamais en les migrant** : migrer
// changerait leur séquence de tirage, donc le pool qu'elles mesurent — et
// « le point dur n'était pas l'extraction mais la PREUVE d'équivalence ».
// Ces profils n'en touchent aucune : ils passent par le générateur PARTAGÉ
// (`scripts/lib/randomPool.ts`), qui leur suffit — voir « Ce qu'il n'a pas
// fallu construire » plus bas.
//
// ─────────────────────────────────────────────────────────────────────────
// Un profil est une valeur de `ConfigHarnais`, PAS un bouquet d'arguments
// de ligne de commande — et c'est un choix MESURÉ, pas un goût
//
// La question se tranche par deux
// constats, tous deux vérifiés plutôt que supposés :
//
// 1. **La surface du TYPE est plus large que celle du CLI.**
//    `SourceHarnais.synthetique` porte le `BuildRequirement` ENTIER (donc
//    `mainStats`, les principales autorisées par emplacement) et un
//    `objective` — le CLI n'expose ni l'un ni l'autre (il s'arrête à
//    `--sets --min --max --verrous`). Un profil écrit en TypeScript atteint
//    ces champs sans qu'il faille élargir la ligne de commande.
// 2. **Et cette différence MORD.** Mesuré ici : sur un profil sans
//    `objective`, les QUATRE valeurs de `combosOrderMode` rendent
//    exactement le même résultat — même `totalPairs`, même population, même
//    rang. Ce n'est pas un hasard, c'est écrit dans le moteur : les modes
//    `objective` et `combined` REPLIENT sur `relevanceScore` quand aucun
//    objectif n'est choisi (`runeBuildOptim.ts`, tri de `buildBuckets`).
//    Or `combosOrderMode` est précisément l'axe de
//    `combos-order-mode-real-account-diag`, que le différentiel doit pouvoir
//    mesurer. Un profil réduit aux arguments du CLI serait donc
//    INERTE sur cet axe-là, en silence.
//
// ⚠️ **Ce qu'il n'a PAS fallu construire, et pourquoi c'est une bonne
// nouvelle** : aucun générateur nouveau. Le régime `sparse` de
// `filterslot-topk-diag` (peu de sous-stats, donc beaucoup d'égalités à 0)
// en exigerait un — mais aucune promesse d'un profil (`AttenduProfil`) ne le réclame, et
// les variantes existantes ne se touchent pas. Le
// générateur partagé suffit à les tenir.
//
// ─────────────────────────────────────────────────────────────────────────
// Le PIÈGE DE TÊTE, et comment chaque profil s'en défend
//
// `maxNodes` n'existe plus : `maxMs` est désormais la SEULE borne
// pouvant tronquer. Un profil synthétique tronquerait donc par le TEMPS par
// défaut — c'est-à-dire violerait sans rien dire la préférence pour des bras COMPLETS. Deux
// défenses, dans cet ordre :
//
// - **Rester COMPLET** (qui prime sur la vitesse : un run
//   complet supprime le portier, le préfixe, le plancher et le bruit d'un
//   seul coup) ;
// - **à défaut, tronquer par QUOTA** — `maxCollected` fixé explicitement.
//   ⚠️ Et VÉRIFIÉ sur le `motif` rendu, jamais demandé puis supposé : un
//   profil à faible rendement n'atteint JAMAIS son quota, et le run retombe
//   alors sur `maxMs` EN SILENCE. C'est exactement ce que `attendu.motif`
//   fige, et ce que `tests/diagnostic-profils.test.ts` relit.
//
// ⚠️ Un `maxCollected` explicite est un OVERRIDE, donc un run MARQUÉ
// « DIVERGE DE LA PROD ». C'est voulu et assumé : le différentiel le
// demande nommément, et la marque voyage avec le résultat.

import {
  ConfigHarnais,
  OverridesHarnais,
  RegimeAppariement,
  SourceHarnais,
} from './diagnosticTypes';
import { SETS_JOKER } from './randomPool';

/** La source d'un profil — toujours synthétique, par définition. */
type SourceSynthetique = Extract<SourceHarnais, { type: 'synthetique' }>;

/**
 * Ce qu'un profil PROMET, et que le test relit à chaque exécution.
 *
 * ⚠️ **Chacune de ces valeurs a été MESURÉE, aucune n'est affirmée.** C'est
 * la règle du harnais : un profil dont une seule de ces grandeurs serait
 * supposée n'est pas livré. Elles jouent deux rôles distincts — documenter
 * ce que le profil fait, et servir d'alarme le jour où un changement du
 * moteur les déplace en silence.
 */
export interface AttenduProfil {
  /** Bras COMPLETS, de préférence. */
  complet: boolean;
  /**
   * Troncature par quota — `undefined` sur un run complet. ⚠️ `maxCollected`
   * attendu et `maxMs` obtenu, c'est le repli silencieux :
   * le test échoue alors au lieu de laisser passer un profil qui tronque
   * par le temps.
   */
  motif?: 'maxCollected' | 'maxMs';
  /** Exigence n° 3 — vérifiée PAR BRAS, voir `axesVerifies`. */
  regime: RegimeAppariement;
  totalPairs: number;
  /** Exigence n° 4 : le build cible existe et se situe. */
  rang: number;
  population: number;
  /**
   * Indicatif SEULEMENT, jamais vérifié par le test — une machine plus
   * lente ne doit pas faire échouer une vérification de justesse. Relevé
   * sur le `temps.total` du harnais (hors démarrage de `tsx`).
   */
  tempsMsIndicatif: number;
}

export interface ProfilSynthetique {
  nom: string;
  /** Une ligne : ce que ce profil rend possible, pas ce qu'il contient. */
  resume: string;
  source: SourceSynthetique;
  overrides?: OverridesHarnais;
  /**
   * Le BUILD CIBLE. Six identifiants de rune, un par
   * emplacement : sans lui, `rang.population` (élément 3 de l'oracle) et
   * tout l'élément 1 sont indisponibles.
   *
   * ⚠️ **Jamais au rang 1.** Une cible en tête masque toute
   * la sensibilité du classement — `verdict` et `rang` restent identiques
   * pendant que la population varie de 32 % (mesuré), donc un
   * différentiel incapable de détecter quoi que ce soit.
   */
  cible: number[];
  attendu: AttenduProfil;
  /**
   * Les bras RÉELLEMENT essayés pendant la calibration, avec ce qu'ils ont
   * donné. ⚠️ C'est la trace de la vérification du régime PAR BRAS :
   * c'est la configuration comparée qui peut faire basculer le régime, donc
   * un profil ne peut pas se contenter de son bras nominal.
   */
  axesVerifies: string[];
  /**
   * Les axes sur lesquels une divergence de l'ORACLE a été **MESURÉE** sur
   * ce profil — jamais supposée, jamais déduite de la rétention affichée.
   *
   * ⚠️ **Tenu en code, pas seulement en prose.** Un
   * profil COMPLET peut être totalement INSENSIBLE à la configuration, et
   * `limites` le dit — mais en PROSE, que rien ne peut lire. Sans ce champ,
   * un différentiel rendrait « aucune divergence » sur un profil incapable
   * d'en produire une, c'est-à-dire un silence livré avec l'autorité d'un
   * résultat. Il ne fait PAS refuser l'exécution : il QUALIFIE l'absence de
   * divergence, ce qui n'est pas la même chose.
   *
   * ⚠️ Un axe absent d'ici n'est pas « insensible » : il est **non mesuré**.
   * La distinction est celle de `NON_OBSERVABLE` du verdict, et elle vaut d'être
   * tenue — remplacer « je n'ai pas mesuré » par « il ne se passe rien »
   * serait exactement l'erreur que tout ce harnais combat.
   */
  axesSensibles: (keyof import('./diagnosticTypes').OverridesHarnais)[];
  /**
   * ⚠️ Ce que le profil NE permet PAS de détecter. Écrit noir sur blanc
   * plutôt que laissé à découvrir : un profil employé hors de son domaine
   * rendrait « aucune divergence » avec l'autorité d'un résultat.
   */
  limites: string;
}

/**
 * ⚠️ Ordre de lecture : du moins cher au plus cher, et c'est aussi l'ordre
 * dans lequel un différentiel devrait les essayer.
 */
export const PROFILS: ProfilSynthetique[] = [
  {
    nom: 'fumee',
    resume:
      'Le plus court qui existe : run COMPLET en ~0,13 s. Vérifie qu’une boucle de comparaison tourne, jamais qu’elle détecte.',
    source: {
      type: 'synthetique',
      seed: 7,
      runesParEmplacement: 4,
      sets: SETS_JOKER,
      requirement: { sets: [], minStats: {} },
      slotFilterCap: 80,
    },
    cible: [3, 6, 9, 14, 18, 23],
    attendu: {
      complet: true,
      regime: 'sequentiel',
      totalPairs: 4096,
      rang: 11,
      population: 4096,
      tempsMsIndicatif: 130,
    },
    axesVerifies: [
      'nominal : complet, 4 096 / 4 096 paires, cible #11 / 4 096 — l’ancrage mesuré',
    ],
    // ⚠️ VIDE — et c'est le résultat le plus utile de ce profil : la mesure établit
    // qu'AUCUN axe n'y change quoi que ce soit. Un différentiel lancé ici rend
    // donc « sensibilité non établie », jamais « aucune divergence ».
    axesSensibles: [],
    limites:
      '⚠️ AUCUN plafond ne mord ici : 4 runes/emplacement passent sous `slotFilterCap`, et les 64 demi-builds par moitié sont très en dessous de `bucketCap`. Faire varier `slotFilterCap`, `bucketCap` ou `combosOrderMode` sur ce profil ne change RIEN — ni les paires, ni la population, ni le rang. Il ne peut donc RIEN détecter : c’est un test de fumée pour la mécanique du différentiel, jamais un instrument de mesure. ⚠️ Sa rétention de construction affichée (100 %) ne dit pas le contraire — le produit brut est un MAJORANT de l’énumération, pas l’énumération.',
  },
  {
    nom: 'complet-sensible',
    resume:
      'Le profil de référence : les deux bras restent COMPLETS ET la configuration mord vraiment — la population bouge quand `bucketCap` bouge.',
    source: {
      type: 'synthetique',
      seed: 7,
      runesParEmplacement: 25,
      sets: SETS_JOKER,
      // ⚠️ Un seul set demandé, et il est le pivot du profil : c'est lui qui
      // porte le groupage à SIX compartiments par moitié. Le nombre de
      // compartiments est la grandeur qui décide de tout le reste (voir
      // `quota-parallele`, dont la marge de régime en dépend entièrement).
      requirement: { sets: ['violent'], minStats: { spd: 240, cr: 95, cd: 240 } },
      slotFilterCap: 80,
    },
    cible: [9, 39, 62, 81, 112, 150],
    attendu: {
      complet: true,
      regime: 'sequentiel',
      totalPairs: 6752131,
      rang: 1424,
      population: 27449,
      tempsMsIndicatif: 1480,
    },
    axesVerifies: [
      'nominal (bucketCap 6000 dérivé) : COMPLET, 6 752 131 paires, cible #1424 / 27 449',
      'bucketCap 3000 : COMPLET, 6 747 981 paires, cible #1424 / 27 449 — demi-builds A 10 389 → 10 194',
      'bucketCap 1000 : COMPLET, 5 692 192 paires, cible #1424 / 26 714 — demi-builds A 10 389 → 7 875',
      'bucketCap 500 : COMPLET, 3 639 627 paires, cible #1424 / 24 108 — demi-builds A 10 389 → 5 461',
      'slotFilterCap 40 : COMPLET, 6 747 981 paires, cible #1424 / 27 449',
      'régime : 6,7 M paires, soit ×15 SOUS le seuil de 100 M — et ×27 sous, même à bucketCap 500. Aucun bras ne peut basculer',
    ],
    // ⚠️ `bucketCap` SEUL — et `slotFilterCap` en est ABSENT sur une mesure,
    // pas par prudence. Le bras `slotFilterCap 40` de la calibration
    // rendait 6 747 981 paires au lieu de 6 752 131, ce qui ressemblait à un
    // effet propre du pré-filtrage : c'était la CASCADE (`bucketCap` dérivé
    // tombant de 6000 à 3000). À `bucketCap` FIGÉ des deux
    // côtés, `slotFilterCap` 80 → 40 laisse l'oracle IDENTIQUE élément par
    // élément, `explored` compris.
    axesSensibles: ['bucketCap'],
    limites:
      '⚠️ Le RANG de la cible ne bouge pas sous `bucketCap` (#1424 sur les quatre bras) — seule la POPULATION bouge (27 449 → 24 108). C’est cohérent : `bucketCap` élague des demi-builds moins pertinents, donc des candidats classés APRÈS la cible, qui ne peuvent pas la déplacer. Un différentiel qui ne lirait que le rang ne verrait rien sur ce profil ; c’est exactement pourquoi l’oracle est multi-éléments. ⚠️ `combosOrderMode` y est INERTE, faute d’objectif : les quatre valeurs rendent le même résultat (voir l’en-tête).',
  },
  {
    nom: 'quota-parallele',
    resume:
      'Le versant « franchement AU-DESSUS » du seuil des 100 M : régime PARALLÈLE sur tous les bras, troncature par QUOTA, et un rang qui bouge.',
    source: {
      type: 'synthetique',
      seed: 7,
      runesParEmplacement: 80,
      sets: SETS_JOKER,
      requirement: { sets: ['violent'], minStats: { spd: 150 } },
      slotFilterCap: 80,
    },
    // ⚠️ Le quota est l'instrument du profil, pas un réglage de confort : il
    // remplace une troncature par le TEMPS (bruitée, mesures E/G/H/N) par
    // une troncature déterministe. VÉRIFIÉ : 5 runs successifs rendent le
    // même `explored` (60 806), le même top-1 et le même top-20.
    overrides: { maxCollected: 2000 },
    cible: [9, 104, 173, 308, 390, 444],
    attendu: {
      complet: false,
      motif: 'maxCollected',
      regime: 'parallele',
      totalPairs: 939420310,
      rang: 179,
      population: 2000,
      tempsMsIndicatif: 1540,
    },
    axesVerifies: [
      'nominal (bucketCap 6000 dérivé) : quota, 939 420 310 paires (×9,4 le seuil), cible #179 / 2 000',
      'bucketCap 3000 + slotFilterCap 40 (le PIRE cas) : quota, 347 904 750 paires (×3,5 le seuil) — reste PARALLÈLE, cible #178 / 2 000',
      'bucketCap 12000 : quota, 2 240 624 849 paires (×22 le seuil), cible #179 / 2 000',
      'reproductibilité : 5 runs successifs, `explored` = 60 806 les 5 fois, top-1 et top-20 identiques',
    ],
    // ⚠️ Les deux axes ont d'abord été mesurés CONJOINTEMENT (bucketCap 3000
    // + slotFilterCap 40, cible #178) : ça ne permettait d'attribuer la
    // divergence à aucun des deux pris seul. En isolant
    // `bucketCap` — 6000 → 3000, sur 3 passages ENTRELACÉS : `explored` tombe
    // de 60 806 à 39 846 (−34,47 %) avec un plancher MESURÉ à 0,00 % des deux
    // côtés. ⚠️ Et c'est le SEUL élément lisible : le quota fixant la
    // population à 2 000 et le rang à #179 des deux côtés, ces valeurs sont
    // égales sur des PRÉFIXES différents — donc `NON_COMPARABLE`, jamais
    // « identique ».
    axesSensibles: ['bucketCap'],
    limites:
      '⚠️ La marge de régime tient parce que ce profil a SIX compartiments par moitié, pas parce que son pool est gros. `totalPairs` croît comme le CARRÉ de `bucketCap` (≈ (k × bucketCap)²) : à deux compartiments, un pool même trois fois plus gros SATURE et retombe sous les 100 M dès que `bucketCap` est divisé par deux — mesuré (assortiment `varies`, 150 runes/emplacement : 104 M au pire cas, soit +4 % seulement). ⚠️ Corollaire général : AUCUN profil ne peut être robuste à une variation arbitraire de `bucketCap`, puisque `bucketCap = 1` ramène toujours sous le seuil. Un profil porte une marge MESURÉE sur un axe NOMMÉ, jamais une garantie universelle.',
  },
];

/** Les noms, pour un message d'erreur qui montre ce qui existe. */
export const NOMS_PROFILS = PROFILS.map((p) => p.nom);

/**
 * ⚠️ Un nom inconnu REFUSE en listant ce qui existe — jamais un repli
 * silencieux sur le premier profil (règle qui vaut aussi pour la
 * ligne de commande).
 */
export function trouverProfil(nom: string): ProfilSynthetique {
  const profil = PROFILS.find((p) => p.nom === nom);
  if (!profil) {
    throw new Error(`--profil : nom inconnu « ${nom} » — attendu ${NOMS_PROFILS.join(' | ')}.`);
  }
  return profil;
}

/**
 * La `ConfigHarnais` d'un profil, prête à exécuter.
 *
 * ⚠️ **La cible est posée dans `suivre` par construction**, jamais laissée à
 * l'appelant : un profil dont on oublierait de suivre la cible rendrait un
 * résultat sans `rang` ni `verdictBuildCible` — c'est-à-dire sans l'élément
 * 1 ni l'élément 3 de l'oracle, donc un profil qui ne tient pas l'exigence
 * n° 4 alors qu'il l'annonce.
 *
 * ⚠️ `commun` peut surcharger les overrides du profil (c'est ce qu'un
 * différentiel FAIT : il compare deux bras), mais jamais sa cible — sans quoi
 * les deux bras ne parleraient plus du même build.
 */
export function configDuProfil(profil: ProfilSynthetique, commun: Partial<ConfigHarnais> = {}): ConfigHarnais {
  return {
    ...commun,
    source: profil.source,
    overrides: { ...profil.overrides, ...commun.overrides },
    suivre: profil.cible,
  };
}

/** Le rendu de `--profils` — ce qui existe, et ce que chacun promet. */
export function rendreProfils(): string {
  const l: string[] = ['Profils de pool synthétique nommés', '─'.repeat(72)];
  for (const p of PROFILS) {
    const a = p.attendu;
    const troncature = a.complet ? 'COMPLET' : `tronqué par ${a.motif}`;
    l.push(
      '',
      `  ${p.nom}`,
      `    ${p.resume}`,
      `    ${troncature} · régime ${a.regime} · ${a.totalPairs.toLocaleString('fr-FR')} paires · ~${a.tempsMsIndicatif} ms`,
      `    cible [${p.cible.join(', ')}] au rang #${a.rang.toLocaleString('fr-FR')} / ${a.population.toLocaleString('fr-FR')}`,
      `    ${p.limites}`
    );
  }
  l.push(
    '',
    '⚠️ Les valeurs ci-dessus sont MESURÉES, et `tests/diagnostic-profils.test.ts` les relit à',
    '   chaque exécution : un changement du moteur qui les déplacerait fait échouer la',
    '   vérification au lieu de laisser un profil promettre ce qu’il ne tient plus.'
  );
  return l.join('\n');
}

