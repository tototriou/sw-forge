// Les caches partagés par la résolution de
// plusieurs builds : le profil de dégâts par paire (`CacheProfilsParPaire`)
// et les candidats élagués par sorte (`MemoPreFiltre`). Ils ne changent
// aucun résultat (différentiel contre la résolution qui recalcule tout, sur
// un inventaire tiré au hasard avec graine fixe) et restent bornés.
//
// Le différentiel contre la copie FIGÉE de l'assemblage d'avant vit dans
// `resolution-partagee.test.ts` (caches partagés par toute une fixture) ; le
// différentiel build par build sur les recettes réelles, ;

import { ArtifactArchetype, ArtifactDetail, ArtifactKind, ElementKey } from '../src/types';
import { ARTIFACT_SUB_MAX } from '../src/lib/artifacts';
import { artifactSubKinds } from '../src/lib/effects';
import { AUCUNE_AURA_PROPRE, artifactDamageProfile } from '../src/lib/damage';
import { BORNE_PROFILS_PAR_PAIRE, CacheProfilsParPaire, evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { BORNE_STATS_PAR_APPORT, StatRow, computeStats, statsParPaire } from '../src/lib/stats';
import { ArtifactSearchParams, BORNE_MEMO_PREFILTRE, MemoPreFiltre, PaireArtefacts as PaireArtefactsT, chercherPaires, pairesParScore } from '../src/lib/artifactOptim';
import { entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { RelicContext } from '../src/lib/relicOptim';
import { SearchParams, searchBuilds, statTotal } from '../src/lib/runeBuildOptim';
import { maxStatsActifsDe, runesDe } from '../scripts/lib/relicDifferentiel';
import { cleBuild } from '../src/lib/artifactQueue';
import { CORPUS_5A } from './relic-search.test';
import { BASE_FICHE, DEGATS_FICHE, relFiche } from './artifact-fiche.test';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };

// Générateur à graine fixe (mulberry32) : le même inventaire à chaque passage.
function aleatoire(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un inventaire « Libre » éligible (fire / attack) : principales PV, ATQ ou
// DEF, quatre sous-propriétés tirées parmi les lignes que la sorte peut
// porter, à une valeur sous leur plafond ; quelques intangibles. Réutilisé
// par `resolution-worker.test.ts`.
export function inventaire(graine: number, parSorte: number): ArtifactDetail[] {
  const r = aleatoire(graine);
  const codesDe = (kind: ArtifactKind) => Object.keys(ARTIFACT_SUB_MAX).map(Number).filter((c) => artifactSubKinds(c).includes(kind));
  const pieces: ArtifactDetail[] = [];
  let id = 1000;
  for (const kind of ['element', 'archetype'] as ArtifactKind[]) {
    const codes = codesDe(kind);
    for (let i = 0; i < parSorte; i++) {
      const choisis = new Set<number>();
      while (choisis.size < 4) choisis.add(codes[Math.floor(r() * codes.length)]!);
      const mainCode = [100, 101, 102][Math.floor(r() * 3)]!;
      pieces.push({
        id: id++, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
        level: 15, rarity: 5, main: { code: mainCode, value: mainCode === 100 ? 1500 : 100 },
        subs: [...choisis].map((code) => ({ code, value: Math.max(1, Math.round(r() * ARTIFACT_SUB_MAX[code]! * 10) / 10) })),
        ...(r() < 0.1 ? { intangible: true } : {}),
      });
    }
  }
  return pieces;
}

export function testResolutionCaches() {
  titre('Caches de la résolution par build — même résultat, mémoire bornée (6bis-b13)');

  /* ── 1. Profil par paire : exact, clé sur les DEUX pièces, borné ──────── */
  const inv = inventaire(13, 6);
  const elements = inv.filter((a) => a.kind === 'element');
  const archetypes = inv.filter((a) => a.kind === 'archetype');
  const cache = new CacheProfilsParPaire();
  const formes: ArtifactDetail[][] = [[]];
  for (const e of elements) formes.push([e]);
  for (const a of archetypes) formes.push([a]);
  for (const e of elements) for (const a of archetypes) formes.push([e, a], [a, e]);
  const ecarts: string[] = [];
  for (const passage of [1, 2]) {
    for (const f of formes) {
      if (JSON.stringify(cache.profil(f)) !== JSON.stringify(artifactDamageProfile(f))) ecarts.push(`${passage} : ${f.map((a) => a.id)}`);
    }
  }
  egal(ecarts, [], `profil en cache = profil recalculé, pour ${formes.length} formes (vide, une pièce, deux pièces dans les deux ordres), au premier passage et relu`);
  egal(cache.taille, formes.length, 'une entrée par forme distincte, emplacement vide compris');
  ok(cache.profil([elements[0]!, archetypes[0]!]) === cache.profil([elements[0]!, archetypes[0]!]), 'une paire déjà vue rend le même objet (lu, pas recalculé)');
  const diffSeconde = archetypes.findIndex((a, i) => i > 0 && JSON.stringify(artifactDamageProfile([elements[0]!, a])) !== JSON.stringify(artifactDamageProfile([elements[0]!, archetypes[0]!])));
  ok(diffSeconde > 0 && cache.profil([elements[0]!, archetypes[diffSeconde]!]) !== cache.profil([elements[0]!, archetypes[0]!]),
    'même première pièce, seconde différente : deux profils distincts (la clé lit les deux pièces)');

  const sonde: ArtifactDetail = { ...elements[0]!, id: 0 };
  const avant = cache.taille;
  egal(JSON.stringify(cache.profil([sonde])), JSON.stringify(artifactDamageProfile([sonde])), 'pièce d’identifiant 0 (sonde) : profil exact');
  egal(cache.taille, avant, 'pièce d’identifiant ≤ 0 : jamais mise en cache');

  const borne = new CacheProfilsParPaire();
  let tailleMax = 0;
  let exacts = true;
  const gabarit = elements[0]!;
  for (let i = 1; i <= BORNE_PROFILS_PAR_PAIRE + 50; i++) {
    const piece = { ...gabarit, id: i, subs: [{ code: 219, value: (i % 40) / 10 }] };
    const p = borne.profil([piece]);
    if (p.brutPctAtk !== (i % 40) / 10) exacts = false;
    tailleMax = Math.max(tailleMax, borne.taille);
  }
  ok(tailleMax <= BORNE_PROFILS_PAR_PAIRE, `${BORNE_PROFILS_PAR_PAIRE + 50} paires distinctes : jamais plus de ${BORNE_PROFILS_PAR_PAIRE} entrées (max observé ${tailleMax})`);
  ok(borne.taille < BORNE_PROFILS_PAR_PAIRE && exacts, `borne atteinte : le cache s’est vidé (${borne.taille} entrées ensuite), chaque profil rendu reste exact`);

  /* ── 2. Préfiltre : même liste, clé sur la pertinence, contexte, borne ── */
  const base: ArtifactSearchParams = {
    porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [],
    evaluer: (arts) => arts.reduce((n, a) => n + a.main.value, 0),
  };
  // Un `evaluer` qui ne compte QUE les lignes de `codes` : la pertinence
  // sondée vaut exactement ces codes, donc une clé par sous-ensemble.
  const evaluerSur = (codes: number[]) => (arts: ArtifactDetail[]) =>
    arts.reduce((n, a) => n + a.main.value / 1000 + a.subs.filter((s) => codes.includes(s.code)).reduce((m, s) => m + s.value, 0), 0);
  const tousCodes = Object.keys(ARTIFACT_SUB_MAX).map(Number);
  const memo = new MemoPreFiltre();
  const ecartsMemo: string[] = [];
  let tailleMemoMax = 0;
  for (let k = 0; k < BORNE_MEMO_PREFILTRE + 10; k++) {
    const codes = tousCodes.filter((_, i) => (k >> (i % 7)) & 1 || i === k % tousCodes.length);
    const p = { ...base, evaluer: evaluerSur(codes) };
    for (const passage of [1, 2]) {
      if (JSON.stringify(chercherPaires(p, Number.MAX_SAFE_INTEGER, memo)) !== JSON.stringify(chercherPaires(p, Number.MAX_SAFE_INTEGER)))
        ecartsMemo.push(`${k}/${passage}`);
    }
    tailleMemoMax = Math.max(tailleMemoMax, memo.taille);
  }
  egal(ecartsMemo, [], `${BORNE_MEMO_PREFILTRE + 10} pertinences différentes, deux passages chacune : mêmes paires, mêmes scores, même ordre qu’sans memo`);
  ok(tailleMemoMax <= BORNE_MEMO_PREFILTRE, `memo du préfiltre : jamais plus de ${BORNE_MEMO_PREFILTRE} listes (max observé ${tailleMemoMax})`);
  const memo2 = new MemoPreFiltre();
  chercherPaires(base, 1, memo2);
  ok(memo2.taille === 2, 'une pertinence : une liste par sorte');
  const autreInventaire = { ...base, inventaire: inv.slice(1) };
  egal(JSON.stringify(chercherPaires(autreInventaire, Number.MAX_SAFE_INTEGER, memo2)), JSON.stringify(chercherPaires(autreInventaire, Number.MAX_SAFE_INTEGER)),
    'inventaire changé (autre tableau) : le memo se vide et rend la liste du nouvel inventaire');
  egal(memo2.taille, 2, '… sans garder les listes de l’ancien inventaire');

  /* ── 3. Différentiel de la résolution, build par build ─────────────────── */
  // Un inventaire plus large (24 pièces par sorte), « Dégâts réels » au
  // critique, sur chaque fixture du corpus relique, en mode relique `recherche` et à
  // relique fixe : UN jeu de caches et UN objet de paramètres de paires pour
  // toute la fixture (une file), contre la résolution qui recalcule tout.
  const invLarge = inventaire(2026, 24);
  const degats = { ...DEGATS_FICHE, setup: { ...DEGATS_FICHE.setup, critMode: 'crit' as const } };
  const exclusive = { setup: degats.setup, element: null };
  let compares = 0;
  for (const fx of Object.values(CORPUS_5A)) {
    const p: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const candidats = searchBuilds(p).candidates;
    const artifactParams = {
      porteur: PORTEUR, inventaire: invLarge, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: maxStatsActifsDe(p),
    };
    const caches = nouveauxCachesResolution();
    const differents: string[] = [];
    for (const [nomCtx, ctx] of [['recherche', fx.ctx], ['relique fixe', undefined]] as [string, RelicContext | undefined][]) {
      for (const c of candidats) {
        const entree = (avecCaches: boolean) => entreeResolutionDuBuild({
          fiche: { base: p.base, runes: [], artifacts: p.artifacts, relic: p.relic }, runes: runesDe(p, c), artifactParams,
          regime: 'degats_reels', degats, exclusive, requirement: p.requirement, relicContext: ctx, caches: avecCaches ? caches : null,
        });
        const sans = resoudreEquipementDuBuild(entree(false));
        const avec = resoudreEquipementDuBuild(entree(true));
        // Conformité, relique, paire (identifiants), score, stats : tout.
        if (JSON.stringify(avec) !== JSON.stringify(sans)) differents.push(`${nomCtx} ${cleBuild(c)}`);
        compares++;
      }
    }
    egal(differents, [], `${fx.nom} : ${candidats.length} candidat(s) × 2 contextes relique, résolution avec caches = sans caches (paire, relique, score, stats, conformité)`);
    if (candidats.length > 0) ok(caches.profils.taille > 0, `${fx.nom} : le cache de profils a servi (${caches.profils.taille} paires)`);
  }
  ok(compares > 100, `${compares} résolutions comparées au total`);

  /* ── 4. Stats et apport par somme de principales ───────────────────────── */
  // `statsParPaire` rend le même tableau aux paires de mêmes principales, et
  // l'évaluateur n'en calcule l'effet unique de la relique qu'une fois. Vérité
  // indépendante : `computeStats` recalculé pour CHAQUE paire (tableau neuf,
  // jamais reconnu), avec trois reliques dont l'effet unique franchit des
  // tranches d'une paire à l'autre (tranche 200 ; 2 000 PV pour Ténacité,
  // dont la réduction doit rester sous 100 %).
  const gear = { base: BASE_FICHE, runes: [], artifacts: [] };
  const paires: ArtifactDetail[][] = [[]];
  for (const e of [null, ...invLarge.filter((a) => a.kind === 'element')]) {
    for (const a of [null, ...invLarge.filter((x) => x.kind === 'archetype')]) {
      const p = [e, a].filter((x): x is ArtifactDetail => x != null);
      if (p.length) paires.push(p);
    }
  }
  const memoStats = statsParPaire(gear);
  ok(memoStats([invLarge[0]!]) === memoStats([invLarge[0]!]) && memoStats([]) === memoStats([]), 'statsParPaire : même somme de principales, même tableau');
  const ecartsApport: string[] = [];
  for (const [nom, relique] of [['Conquête ATQ', relFiche(1, 200, 2)], ['Bravoure DEF', relFiche(8, 200, 2)], ['Ténacité PV', relFiche(6, 2000, 1)]] as const) {
    const avec = { ...gear, relic: relique };
    const exclusiveR = { relique, setup: degats.setup, element: null };
    const frais = (arts: ArtifactDetail[]) => computeStats({ ...avec, artifacts: arts });
    const evals: [string, (a: ArtifactDetail[]) => number, (a: ArtifactDetail[]) => number][] = [
      ['degats_reels', evaluerPourRegime('degats_reels', statsParPaire(avec), AUCUNE_AURA_PROPRE, degats, exclusiveR, new CacheProfilsParPaire()),
        evaluerPourRegime('degats_reels', frais, AUCUNE_AURA_PROPRE, degats, exclusiveR)],
      ['ehp', evaluerPourRegime('ehp', statsParPaire(avec), AUCUNE_AURA_PROPRE, exclusiveR),
        evaluerPourRegime('ehp', frais, AUCUNE_AURA_PROPRE, exclusiveR)],
    ];
    for (const [regime, memo, verite] of evals) {
      const notes = new Set<number>();
      for (const p of paires) {
        const m = memo(p);
        notes.add(m);
        if (m !== verite(p)) ecartsApport.push(`${nom} ${regime} ${p.map((x) => x.id)} : ${m} ≠ ${verite(p)}`);
      }
      // PV effectifs ne lisent que PV et DEF : peu de sommes de principales distinctes.
      ok(notes.size > (regime === 'ehp' ? 3 : 10), `${nom}, ${regime} : les notes varient d’une paire à l’autre (${notes.size} distinctes)`);
    }
  }
  egal(ecartsApport.slice(0, 5), [], `${paires.length} paires × 3 reliques × 2 régimes : note avec stats et apport partagés = note sur computeStats recalculé (égalité exacte)`);
  let tailleStats = 0;
  const pieceMain = (i: number): ArtifactDetail => ({ ...invLarge[0]!, id: 50_000 + i, main: { code: 101, value: i } });
  const borneStats = statsParPaire(gear);
  const tableaux = new Set<StatRow[]>();
  for (let i = 1; i <= BORNE_STATS_PAR_APPORT + 20; i++) tableaux.add(borneStats([pieceMain(i)]));
  tailleStats = tableaux.size;
  ok(tailleStats === BORNE_STATS_PAR_APPORT + 20 && borneStats([pieceMain(1)]) !== [...tableaux][0],
    `statsParPaire : ${BORNE_STATS_PAR_APPORT + 20} sommes distinctes, la mémoire s’est vidée à ${BORNE_STATS_PAR_APPORT} (la première somme est reconstruite)`);
  egal(statTotal(borneStats([pieceMain(1)]), 'atk'), statTotal(computeStats({ ...gear, artifacts: [pieceMain(1)] }), 'atk'), '… et reconstruite à l’identique');

  /* ── 5. Les paires par score, triées seulement au-delà de la première ──── */
  // `pairesParScore` doit rendre EXACTEMENT `chercherPaires(params, ∞).paires`
  // (mêmes objets de pièces, mêmes scores, même ordre), qu'on s'arrête à la
  // première ou qu'on lise tout — ex æquo nombreux (somme des principales :
  // le premier indice gagne, comme au tri stable) et score NaN compris.
  const tete = (it: Iterable<PaireArtefactsT>) => { for (const p of it) return p; return undefined; };
  const cas: [string, ArtifactSearchParams][] = [
    ['principales (ex æquo nombreux)', base],
    ['toutes les paires complètes ex æquo en tête', { ...base, evaluer: (arts) => arts.length }],
    ['dégâts réels', { ...base, inventaire: invLarge, evaluer: evaluerPourRegime('degats_reels', statsParPaire(gear), AUCUNE_AURA_PROPRE, degats) }],
    ['score NaN sur une paire', { ...base, evaluer: (arts) => (arts.length === 2 && arts[0]!.id === inv[1]!.id ? Number.NaN : arts.reduce((n, a) => n + a.main.value, 0)) }],
    ['verrou impossible (aucune paire)', { ...base, lignesVerrouillees: [{ code: 219, min: 999 }] }],
    ...Array.from({ length: 12 }, (_, k) => [`pertinence ${k}`, { ...base, evaluer: evaluerSur(tousCodes.filter((_, i) => (i + k) % 5 === 0)) }] as [string, ArtifactSearchParams]),
  ];
  const ecartsOrdre: string[] = [];
  for (const [nom, p] of cas) {
    const attendu = chercherPaires(p, Number.MAX_SAFE_INTEGER);
    const toutes = pairesParScore(p);
    if (JSON.stringify([...toutes.paires]) !== JSON.stringify(attendu.paires) || toutes.meilleurSansVerrous !== attendu.meilleurSansVerrous) ecartsOrdre.push(`${nom} : liste`);
    const premiere = tete(pairesParScore(p).paires);
    if (attendu.paires.length === 0 ? premiere !== undefined : JSON.stringify(premiere) !== JSON.stringify(attendu.paires[0])) ecartsOrdre.push(`${nom} : première`);
  }
  egal(ecartsOrdre, [], `${cas.length} cas : pairesParScore rend la liste de chercherPaires (lue en entier, ou arrêtée à la première)`);
  const exAequo = chercherPaires({ ...base, evaluer: (arts) => arts.length }, Number.MAX_SAFE_INTEGER).paires;
  ok(exAequo.length > 1 && exAequo[0]!.score === exAequo[1]!.score, `précondition : la tête de liste est ex æquo (${exAequo[0]?.score} = ${exAequo[1]?.score}), le départage par l’ordre de l’inventaire est donc exercé`);
}
