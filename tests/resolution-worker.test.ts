// degats-et-aura 6bis-b13bis-a — le corps du Worker de résolution
// (`src/workers/resolutionBody.ts`) et son protocole, sans navigateur.
//
// Ce qui est prouvé ici :
// 1. le corps est NEUTRE (aucune plateforme importée) et importable en Node ;
// 2. ses entrées sont SÉRIALISABLES : aucune fonction, aucune instance de
//    classe, `structuredClone` les transporte à l'identique — alors que les
//    paramètres de paires de l'écran, avec leur `evaluer`, ne passent pas ;
// 3. différentiel : la résolution par le corps, entrées et réponses passées
//    par `structuredClone` (ce que fait `postMessage`), est IDENTIQUE à la
//    résolution directe de production (`entreeResolutionDuBuild` +
//    `resoudreEquipementDuBuild`), build par build — conformité, relique,
//    paire, score, stats — sur le corpus du lot 5a, en mode relique
//    `recherche` et à relique fixe, quatre régimes, verrous, coût des
//    verrous, amplifications et emplacement porté ;
// 4. les caches du corps repartent à neuf à chaque contexte (un inventaire
//    qui réattribue les mêmes identifiants à d'autres pièces) ;
// 5. le protocole : une réponse et une seule par demande, annulation,
//    contexte périmé, erreurs nommées.
//
// Les trois recettes gelées sur le compte réel : script de preuve du lot
// (`controle-6bis-b13bis-a.md`), qui réutilise `nonClonables` et
// `identiques` d'ici.

import { readFileSync } from 'node:fs';
import { ArtifactArchetype, ArtifactDetail, ElementKey, RuneDetail } from '../src/types';
import { ArtifactSearchParams } from '../src/lib/artifactOptim';
import { DegatsContext, RegimeArtefacts } from '../src/lib/artifactEvaluation';
import { ResultatArtefacts, cleBuild } from '../src/lib/artifactQueue';
import { codesAmplificationActifs } from '../src/lib/damage';
import { RelicContext } from '../src/lib/relicOptim';
import { RechercheRefusee, SearchParams, searchBuilds } from '../src/lib/runeBuildOptim';
import { CachesResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import {
  CorpsResolution,
  EntreesResolutionSerialisables,
  MessageVersResolution,
  ReponseResolution,
  entreesSerialisables,
} from '../src/workers/resolutionBody';
import { maxStatsActifsDe, runesDe } from '../scripts/lib/relicDifferentiel';
import { CORPUS_5A } from './relic-search.test';
import { DEGATS_FICHE } from './artifact-fiche.test';
import { inventaire } from './resolution-caches.test';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };

/**
 * Ce que le clonage structuré ne transporte pas à l'identique, chemin par
 * chemin : une fonction ou un symbole (il lève), une instance de classe ou un
 * accesseur (il rendrait un objet nu, comportement perdu). Vide = clonable
 * sans perte. Parcourt aussi les références partagées, une fois chacune.
 */
export function nonClonables(v: unknown, chemin = '$', vus = new Set<object>()): string[] {
  if (typeof v === 'function') return [`${chemin} : fonction`];
  if (typeof v === 'symbol') return [`${chemin} : symbole`];
  if (v === null || typeof v !== 'object') return [];
  if (vus.has(v)) return [];
  vus.add(v);
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
    return [`${chemin} : instance de ${(proto as { constructor?: { name?: string } }).constructor?.name ?? '?'}`];
  }
  const sorties: string[] = [];
  for (const k of Reflect.ownKeys(v)) {
    if (typeof k === 'symbol') {
      sorties.push(`${chemin}[${String(k)}] : clé symbole`);
      continue;
    }
    const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (d.get || d.set) sorties.push(`${chemin}.${k} : accesseur`);
    else sorties.push(...nonClonables(d.value, `${chemin}.${k}`, vus));
  }
  return sorties;
}

/**
 * Égalité profonde STRICTE : mêmes clés dans le même ordre, nombres par
 * `Object.is` (NaN = NaN, 0 ≠ -0), `undefined` distinct d'une clé absente —
 * plus exigeante que la comparaison de `JSON.stringify`.
 */
export function identiques(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => identiques((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// Les arguments de `entreeResolutionDuBuild` hors runes et caches — ce que
// l'écran (`resoudreEquipement`) et le CLI (`resoudreEquipementCli`) lui
// passent, `artifactParams` AVEC son `evaluer` comme à l'écran.
type ArgumentsResolution = Parameters<typeof entreesSerialisables>[0];

interface Build {
  cle: string;
  runes: RuneDetail[];
}

/** La référence : la résolution directe de production, un jeu de caches pour tous les builds (une file). */
function resolutionDirecte(args: ArgumentsResolution, builds: Build[], caches: CachesResolution | null = nouveauxCachesResolution()): ResultatArtefacts[] {
  return builds.map((b) => resoudreEquipementDuBuild(entreeResolutionDuBuild({ ...args, runes: b.runes, caches })));
}

/** Le corps, comme derrière `postMessage` : chaque message et chaque réponse passent par `structuredClone`. */
function envoyer(corps: CorpsResolution, m: MessageVersResolution): ReponseResolution[] {
  return corps.recevoir(structuredClone(m)).map((r) => structuredClone(r));
}
function etape(corps: CorpsResolution): ReponseResolution | null {
  const r = corps.etape();
  return r ? structuredClone(r) : null;
}
function resolutionParLeCorps(corps: CorpsResolution, idContexte: number, entrees: EntreesResolutionSerialisables, builds: Build[]): ReponseResolution[] {
  const immediates = envoyer(corps, { type: 'contexte', idContexte, entrees });
  if (immediates.length) throw new Error('contexte : réponse inattendue');
  return builds.map((b, i) => {
    if (envoyer(corps, { type: 'resoudre', idContexte, idDemande: i, cle: b.cle, runes: b.runes }).length) throw new Error('demande : réponse immédiate inattendue');
    return etape(corps)!;
  });
}

/** Écarts build par build entre le corps et la référence directe. */
function ecarts(args: ArgumentsResolution, builds: Build[], idContexte = 1): string[] {
  const directs = resolutionDirecte(args, builds);
  const reponses = resolutionParLeCorps(new CorpsResolution(), idContexte, entreesSerialisables(args), builds);
  const sorties: string[] = [];
  reponses.forEach((r, i) => {
    const b = builds[i]!;
    if (r.type !== 'resultat') sorties.push(`${b.cle} : ${r.type}`);
    else if (r.idContexte !== idContexte || r.idDemande !== i || r.cle !== b.cle) sorties.push(`${b.cle} : identifiants`);
    else if (!identiques(r.resultat, directs[i])) sorties.push(`${b.cle} : résultat`);
  });
  return sorties;
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function testResolutionWorker() {
  titre('Worker de résolution — corps neutre, entrées sérialisables, résultat identique à la résolution directe (6bis-b13bis-a)');

  /* ── 1. Neutralité ───────────────────────────────────────────────────── */
  const corpsSource = sansCommentaires(readFileSync('src/workers/resolutionBody.ts', 'utf8'));
  const imports = [...corpsSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  ok(imports.length > 0 && imports.every((i) => i.startsWith('../lib/') || i === '../types'),
    `corps : n'importe que la bibliothèque pure (${imports.join(', ')}) — ni worker_threads, ni React, ni module de plateforme`);
  ok(!/\b(self|postMessage|importScripts|window|document|parentPort|workerData)\b/.test(corpsSource),
    'corps : aucune référence à self, postMessage, window, document ni aux fils Node (hors commentaires)');
  const coquille = sansCommentaires(readFileSync('src/workers/resolution.worker.ts', 'utf8'));
  const importsCoquille = [...coquille.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  egal(importsCoquille, ['./resolutionBody'], 'coquille : n’importe que le corps');
  ok(/self\.onmessage/.test(coquille) && /corps\.recevoir\(/.test(coquille) && /corps\.etape\(\)/.test(coquille),
    'coquille : branche self.onmessage sur recevoir/etape, sans logique de résolution propre');

  /* ── 2. Sérialisabilité ──────────────────────────────────────────────── */
  ok(identiques(nonClonables({ a: [1, { b: () => 1 }], c: new Map() }), ['$.a.1.b : fonction', '$.c : instance de Map']),
    'contrôle du détecteur : une fonction et une instance de classe imbriquées sont signalées avec leur chemin');
  const fx0 = CORPUS_5A.A;
  const p0: SearchParams = { ...fx0.p0, relicContext: fx0.ctx };
  const invPetit = inventaire(31, 12);
  const avecEvaluer: ArtifactSearchParams = {
    porteur: PORTEUR, inventaire: invPetit, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: maxStatsActifsDe(p0),
    evaluer: (arts) => arts.reduce((n, a) => n + a.main.value, 0),
  };
  let leve = false;
  try {
    structuredClone(avecEvaluer);
  } catch (e) {
    leve = (e as Error).name === 'DataCloneError';
  }
  ok(leve, 'les paramètres de paires de l’écran, avec leur evaluer, ne passent pas structuredClone (DataCloneError) : un type à part est nécessaire');
  const argsEchantillon: ArgumentsResolution = {
    fiche: { base: p0.base, runes: [], artifacts: p0.artifacts, relic: p0.relic },
    artifactParams: avecEvaluer,
    regime: 'degats_reels',
    degats: DEGATS_FICHE,
    exclusive: { setup: DEGATS_FICHE.setup, element: 'fire' },
    requirement: p0.requirement,
    relicContext: fx0.ctx,
  };
  const entreesEchantillon = entreesSerialisables(argsEchantillon);
  ok(!('evaluer' in entreesEchantillon.artifactParams), 'entreesSerialisables retire evaluer des paramètres de paires…');
  egal(Object.keys(entreesEchantillon.artifactParams), Object.keys(avecEvaluer).filter((k) => k !== 'evaluer'), '… et garde tous les autres champs');
  egal(nonClonables(entreesEchantillon), [], 'entrées sérialisables : aucune fonction, aucune instance de classe, aucun accesseur, à aucune profondeur');
  ok(identiques(structuredClone(entreesEchantillon), entreesEchantillon), 'structuredClone rend les entrées à l’identique (égalité stricte)');

  /* ── 3. Différentiel : corps = résolution directe, build par build ───── */
  const setupCrit = { ...DEGATS_FICHE.setup, critMode: 'crit' as const };
  const degatsCrit: DegatsContext = { ...DEGATS_FICHE, setup: setupCrit };
  const setupBuff = { ...setupCrit, atkBuff: true };
  const degatsBuff: DegatsContext = { ...DEGATS_FICHE, setup: setupBuff };
  // Un verrou qui contraint vraiment : la ligne la plus fréquente de
  // l'inventaire, au-dessus de la meilleure valeur d'une seule pièce.
  const parCode = new Map<number, number[]>();
  for (const a of invPetit) for (const s of a.subs) parCode.set(s.code, [...(parCode.get(s.code) ?? []), s.value]);
  const [codeVerrou, valeurs] = [...parCode.entries()].sort((x, y) => y[1].length - x[1].length)[0]!;
  const verrou = { code: codeVerrou, min: Math.max(...valeurs) + 0.1 };
  const elementPorte = invPetit.find((a) => a.kind === 'element' && !a.intangible)!;
  type Reglage = { nom: string; params: Omit<ArtifactSearchParams, 'evaluer' | 'maxStatsActifs'>; artefactsFiche: ArtifactDetail[]; regimes: RegimeArtefacts[]; degats: DegatsContext };
  const reglages: Reglage[] = [
    { nom: 'Libre', params: { porteur: PORTEUR, inventaire: invPetit, equipes: [], principaleParSorte: {}, lignesVerrouillees: [] },
      artefactsFiche: [], regimes: ['degats_reels', 'ehp', 'atk', 'aucun'], degats: degatsCrit },
    { nom: 'verrou, coût des verrous, amplification de buff', params: {
      porteur: PORTEUR, inventaire: invPetit, equipes: [], principaleParSorte: {}, lignesVerrouillees: [verrou],
      avecCoutDesVerrous: true, codesAmplification: codesAmplificationActifs(setupBuff) },
      artefactsFiche: [], regimes: ['degats_reels', 'ehp'], degats: degatsBuff },
    { nom: 'élément porté, archétype libre', params: {
      porteur: PORTEUR, inventaire: invPetit, equipes: [elementPorte], principaleParSorte: { element: 'equipped' }, lignesVerrouillees: [] },
      artefactsFiche: [elementPorte], regimes: ['degats_reels', 'hp'], degats: degatsCrit },
  ];
  const argsDe = (p: SearchParams, r: Reglage, regime: RegimeArtefacts, ctx: RelicContext | undefined): ArgumentsResolution => ({
    fiche: { base: p.base, runes: [], artifacts: r.artefactsFiche, relic: p.relic },
    artifactParams: { ...r.params, maxStatsActifs: maxStatsActifsDe(p), evaluer: (arts) => arts.reduce((n, a) => n + a.main.value, 0) },
    regime,
    degats: regime === 'degats_reels' ? r.degats : null,
    exclusive: { setup: r.degats.setup, element: 'fire' },
    requirement: p.requirement,
    relicContext: ctx,
  });
  let compares = 0;
  let conformes = 0;
  let rejetes = 0;
  let reliques = 0;
  for (const fx of Object.values(CORPUS_5A)) {
    const p: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const builds: Build[] = searchBuilds(p).candidates.map((c) => ({ cle: cleBuild(c), runes: runesDe(p, c) }));
    for (const r of reglages) {
      for (const regime of r.regimes) {
        for (const [nomCtx, ctx] of [['recherche', fx.ctx], ['relique fixe', undefined]] as [string, RelicContext | undefined][]) {
          const args = argsDe(p, r, regime, ctx);
          egal(ecarts(args, builds), [], `${fx.nom}, ${r.nom}, ${regime}, ${nomCtx} : ${builds.length} build(s), corps = résolution directe`);
          for (const d of resolutionDirecte(args, builds)) {
            compares++;
            if (d.conforme) conformes++;
            else rejetes++;
            if (d.relique) reliques++;
          }
        }
      }
    }
  }
  ok(compares > 500 && conformes > 0 && rejetes > 0 && reliques > 0,
    `${compares} résolutions comparées (${conformes} conformes, ${rejetes} rejetées, ${reliques} avec relique retenue) : les deux issues et la dimension relique sont exercées`);
  // Précondition de sensibilité : les champs que la mutation du lot oublie
  // changent bien le résultat — sinon le différentiel ne prouverait rien.
  const fxV = CORPUS_5A.B;
  const pV: SearchParams = { ...fxV.p0, relicContext: fxV.ctx };
  const buildsV: Build[] = searchBuilds(pV).candidates.map((c) => ({ cle: cleBuild(c), runes: runesDe(pV, c) }));
  const avecVerrou = resolutionDirecte(argsDe(pV, reglages[1]!, 'degats_reels', fxV.ctx), buildsV);
  const sansVerrou = resolutionDirecte({ ...argsDe(pV, reglages[1]!, 'degats_reels', fxV.ctx), artifactParams: { ...argsDe(pV, reglages[1]!, 'degats_reels', fxV.ctx).artifactParams, lignesVerrouillees: [] } }, buildsV);
  ok(avecVerrou.some((d, i) => !identiques(d, sansVerrou[i])), `précondition : le verrou (code ${verrou.code} ≥ ${verrou.min}) change la résolution d’au moins un build sur ${buildsV.length}`);
  const sansContexte = resolutionDirecte(argsDe(pV, reglages[0]!, 'degats_reels', undefined), buildsV);
  const avecContexte = resolutionDirecte(argsDe(pV, reglages[0]!, 'degats_reels', fxV.ctx), buildsV);
  ok(avecContexte.some((d, i) => !identiques(d, sansContexte[i])), 'précondition : le contexte relique change la résolution d’au moins un build');

  /* ── 4. Caches neufs à chaque contexte ───────────────────────────────── */
  // Deux inventaires aux MÊMES identifiants (1000…) mais d'autres pièces :
  // un profil de dégâts rangé sous l'identifiant serait faux si les caches
  // survivaient au changement de contexte.
  const inv1 = inventaire(77, 10);
  const inv2 = inventaire(78, 10);
  ok(inv1.every((a, i) => a.id === inv2[i]!.id) && inv1.some((a, i) => JSON.stringify(a.subs) !== JSON.stringify(inv2[i]!.subs)),
    'précondition : mêmes identifiants, autres sous-propriétés');
  // G : 64 candidats (C n'en rend aucun).
  const fxC = CORPUS_5A.G;
  const pC: SearchParams = { ...fxC.p0, relicContext: fxC.ctx };
  const buildsC: Build[] = searchBuilds(pC).candidates.map((c) => ({ cle: cleBuild(c), runes: runesDe(pC, c) }));
  const argsInv = (inv: ArtifactDetail[]) => argsDe(pC, { ...reglages[0]!, params: { ...reglages[0]!.params, inventaire: inv } }, 'degats_reels', fxC.ctx);
  const corps = new CorpsResolution();
  resolutionParLeCorps(corps, 1, entreesSerialisables(argsInv(inv1)), buildsC);
  const apres = resolutionParLeCorps(corps, 2, entreesSerialisables(argsInv(inv2)), buildsC);
  const frais = resolutionDirecte(argsInv(inv2), buildsC);
  ok(buildsC.length > 0 && apres.every((r, i) => r.type === 'resultat' && r.idContexte === 2 && identiques(r.resultat, frais[i])),
    `second contexte (même corps) : ${buildsC.length} build(s) identiques à une résolution aux caches neufs`);
  const cachesPerimes = nouveauxCachesResolution();
  resolutionDirecte(argsInv(inv1), buildsC, cachesPerimes);
  const perimes = resolutionDirecte(argsInv(inv2), buildsC, cachesPerimes);
  ok(perimes.some((d, i) => !identiques(d, frais[i])), 'précondition : des caches gardés d’un contexte à l’autre auraient changé au moins un résultat (le contrôle a du pouvoir)');

  /* ── 5. Protocole ────────────────────────────────────────────────────── */
  const b0 = buildsC[0]!;
  const entreesC = entreesSerialisables(argsInv(inv1));
  const p = new CorpsResolution();
  egal(envoyer(p, { type: 'resoudre', idContexte: 1, idDemande: 1, cle: b0.cle, runes: b0.runes }),
    [{ type: 'annule', idContexte: 1, idDemande: 1, cle: b0.cle, motif: 'contexte' }], 'demande avant tout contexte : annulée, motif contexte');
  egal(envoyer(p, { type: 'contexte', idContexte: 5, entrees: entreesC }), [], 'contexte : aucune réponse immédiate');
  egal(envoyer(p, { type: 'resoudre', idContexte: 4, idDemande: 2, cle: b0.cle, runes: b0.runes }),
    [{ type: 'annule', idContexte: 4, idDemande: 2, cle: b0.cle, motif: 'contexte' }], 'demande d’un contexte périmé : annulée, reconnaissable à son idContexte');
  envoyer(p, { type: 'resoudre', idContexte: 5, idDemande: 3, cle: b0.cle, runes: b0.runes });
  envoyer(p, { type: 'resoudre', idContexte: 5, idDemande: 4, cle: 'autre', runes: b0.runes });
  egal(p.demandesEnAttente, 2, 'deux demandes en attente, rien de résolu à la réception');
  egal(envoyer(p, { type: 'annuler', idDemande: 3 }), [{ type: 'annule', idContexte: 5, idDemande: 3, cle: b0.cle, motif: 'demande' }], 'annulation d’une demande en attente : réponse annule, motif demande');
  const r4 = etape(p);
  ok(r4?.type === 'resultat' && r4.idDemande === 4 && r4.cle === 'autre', 'étape : la demande restante est résolue, ses identifiants recopiés');
  egal(etape(p), null, 'plus rien en attente : étape rend null');
  egal(envoyer(p, { type: 'annuler', idDemande: 4 }), [], 'annuler une demande déjà résolue : sans effet (sa réponse est partie)');
  envoyer(p, { type: 'resoudre', idContexte: 5, idDemande: 6, cle: 'a', runes: b0.runes });
  envoyer(p, { type: 'resoudre', idContexte: 5, idDemande: 7, cle: 'b', runes: b0.runes });
  egal(envoyer(p, { type: 'contexte', idContexte: 6, entrees: entreesC }).map((r) => [r.type, r.idDemande, r.type === 'annule' ? r.motif : '']),
    [['annule', 6, 'contexte'], ['annule', 7, 'contexte']], 'nouveau contexte : chaque demande en attente reçoit sa réponse « annulée, motif contexte »');
  envoyer(p, { type: 'resoudre', idContexte: 6, idDemande: 8, cle: 'c', runes: b0.runes });
  envoyer(p, { type: 'resoudre', idContexte: 6, idDemande: 9, cle: 'd', runes: b0.runes });
  egal(envoyer(p, { type: 'annuler' }).map((r) => r.idDemande), [8, 9], 'annuler sans identifiant : toutes les demandes en attente');
  // Une réponse et une seule par demande, sur une séquence mêlée.
  const q = new CorpsResolution();
  const reponses: ReponseResolution[] = [];
  const demandes: number[] = [];
  const demande = (idContexte: number, idDemande: number) => {
    demandes.push(idDemande);
    reponses.push(...envoyer(q, { type: 'resoudre', idContexte, idDemande, cle: String(idDemande), runes: b0.runes }));
  };
  demande(1, 1);
  reponses.push(...envoyer(q, { type: 'contexte', idContexte: 1, entrees: entreesC }));
  demande(1, 2); demande(1, 3); demande(0, 4);
  reponses.push(...envoyer(q, { type: 'annuler', idDemande: 3 }));
  demande(1, 5);
  reponses.push(...envoyer(q, { type: 'contexte', idContexte: 2, entrees: entreesC }));
  demande(2, 6); demande(1, 7);
  for (let r = etape(q); r; r = etape(q)) reponses.push(r);
  egal(reponses.map((r) => r.idDemande).sort((a, b) => a - b), demandes.sort((a, b) => a - b), 'séquence mêlée : chaque demande reçoit exactement une réponse');
  egal(reponses.filter((r) => r.type === 'resultat').map((r) => r.idDemande), [6], '… et seule celle du contexte courant, non annulée, est résolue');

  /* ── 6. Erreurs nommées, et le corps continue ────────────────────────── */
  const e = new CorpsResolution();
  envoyer(e, { type: 'contexte', idContexte: 1, entrees: { ...entreesC, regime: 'degats_reels', degats: null } });
  envoyer(e, { type: 'resoudre', idContexte: 1, idDemande: 1, cle: b0.cle, runes: b0.runes });
  const r1 = etape(e);
  ok(r1?.type === 'erreur' && r1.nom === 'Error' && /sans contexte de dégâts/.test(r1.message) && r1.vide === undefined,
    `« Dégâts réels » sans contexte de dégâts : réponse erreur, message de la production (${r1?.type === 'erreur' ? r1.message.slice(0, 60) : r1?.type}…)`);
  const ctxVide: RelicContext = { ...fxC.ctx, eligibles: [], vide: 'seuil' };
  envoyer(e, { type: 'contexte', idContexte: 2, entrees: { ...entreesC, relicContext: ctxVide } });
  envoyer(e, { type: 'resoudre', idContexte: 2, idDemande: 2, cle: b0.cle, runes: b0.runes });
  const r2 = etape(e);
  let messageDirect = '';
  try {
    resolutionDirecte({ ...argsInv(inv1), relicContext: ctxVide }, [b0]);
  } catch (err) {
    if (err instanceof RechercheRefusee) messageDirect = err.message;
  }
  ok(r2?.type === 'erreur' && r2.nom === 'RechercheRefusee' && r2.vide === 'seuil' && r2.message === messageDirect && messageDirect !== '',
    'pool de reliques vide en mode recherche : erreur RechercheRefusee, motif « seuil » et message identiques à la résolution directe');
  envoyer(e, { type: 'contexte', idContexte: 3, entrees: entreesC });
  envoyer(e, { type: 'resoudre', idContexte: 3, idDemande: 3, cle: b0.cle, runes: b0.runes });
  const r3 = etape(e);
  ok(r3?.type === 'resultat' && identiques(r3.resultat, resolutionDirecte(argsInv(inv1), [b0])[0]), 'après deux erreurs, le corps résout normalement le contexte suivant');
  egal(nonClonables(r3), [], 'une réponse est clonable sans perte (résultat compris)');
}
