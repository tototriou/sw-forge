// 6bis-b5b : le harnais ne propose pas l'axe « évaluateur représentatif ».
// API publique searchBuilds, sans réimplémenter ses phases. L'oracle énumère
// le pool brut ; sa NOTE est scoreDeReference, indépendante du nouveau
// producteur et vérifiée contre des attentes chiffrées dans artifact-fiche.
import type { ArtifactDetail, GearSet, RuneDetail } from '../src/types';
import { artifactDamageProfile, aurasPropresDesRunes } from '../src/lib/damage';
import { activeSets } from '../src/lib/effects';
import { computeStats, statsParPaire } from '../src/lib/stats';
import { evaluerPourRegime, type DegatsContext } from '../src/lib/artifactEvaluation';
import { evaluateursArtefactsFiche } from '../src/lib/artifactFiche';
import { bornesArtefacts, paireRepresentative, type ArtifactSearchParams } from '../src/lib/artifactOptim';
import { candidatAvecSaPaire, cleBuild, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { etatReliqueDuBuild, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { aurasPropresParRunes, optionsDeClassement, respecteConditionsPaireFixe,
  scoreDeReference, scoreDuCandidat, searchBuilds, sortCandidates,
  type SearchParams, type SearchResult } from '../src/lib/runeBuildOptim';
import { mulberry32 } from '../scripts/lib/randomPool';
import { BASE_FICHE, DEGATS_FICHE, REF_FICHE, CONTEXTE_FICHE, artFiche, gearFiche, relFiche } from './artifact-fiche.test';
import { egal, ok, titre } from './outils';

// Le chemin final de l'écran, avec ses vrais producteurs de note et de paire.
// Limité aux reliques fixes : la résolution CLI en recherche appartient à b5c.
export function classerFicheCollectee(params: SearchParams, resultat: SearchResult,
  paires: Omit<ArtifactSearchParams, 'evaluer'>, degats: DegatsContext) {
  if (params.relicContext?.mode === 'recherche') throw new Error('Ce contrôle porte sur la relique fixe');
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const parBuild = new Map<string, ResultatArtefacts>();
  for (const c of resultat.candidates) {
    const gear: GearSet = { base: params.base, runes: c.runeIds.map((id) => runeById.get(id)!),
      artifacts: paires.equipes, relic: params.relic };
    const propres = aurasPropresDesRunes(gear.runes);
    parBuild.set(cleBuild(c), resoudreEquipementDuBuild({
      gear, faireParams: (relique) => ({ ...paires,
        evaluer: evaluerPourRegime('degats_reels', statsParPaire({ ...gear, relic: relique }), propres,
          degats, { relique, setup: degats.setup, element: degats.element }) }),
      respecteConditions: (arts) => respecteConditionsPaireFixe(computeStats({ ...gear, artifacts: arts }), params.requirement, propres),
      requirement: params.requirement, regimeAucun: false, regimeDeStat: false, relicContext: params.relicContext,
    }));
  }
  const opts = optionsDeClassement({
    realDamage: { ...degats, artefacts: artifactDamageProfile(params.artifacts) }, damageSetup: degats.setup,
    runeById, metric: params.metric, aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: (c) => artifactDamageProfile(parBuild.get(cleBuild(c))!.artefacts),
    etatReliqueDe: (c) => etatReliqueDuBuild(parBuild.get(cleBuild(c)), params.relicContext, params.relic),
    contexteExclusive: { setup: degats.setup, element: degats.element },
  });
  const candidats = resultat.candidates.filter((c) => parBuild.get(cleBuild(c))!.conforme)
    .map((c) => candidatAvecSaPaire(c, parBuild));
  return sortCandidates(candidats, 'degats_reels', opts).map((c) => ({
    cle: cleBuild(c), stats: c.stats, note: scoreDuCandidat(c, 'degats_reels', opts)!,
    arts: parBuild.get(cleBuild(c))!.artefacts,
  }));
}

export function casFicheRecherche(seed: number) {
  const hasard = mulberry32(seed);
  const pool: RuneDetail[] = [];
  for (let slot = 1; slot <= 6; slot++) for (let i = 0; i < 2; i++) {
    pool.push({ id: slot * 10 + i, slot, set: slot <= 2 ? 'fight' : 'violent', rank: 6, rarity: 5,
      level: 15, main: { code: 8, value: 0 }, subs: [
        { code: 3, value: 10 + Math.floor(hasard() * 25) },
        { code: 5, value: 10 + Math.floor(hasard() * 25) },
      ] });
  }
  const gear = gearFiche(relFiche(2, 700, 50));
  const inventaire = [artFiche(101, 101, 100), artFiche(102, 102, 100)];
  const paires = { porteur: { element: 'wind' as const, archetype: 'attack' as const }, inventaire,
    equipes: [], principaleParSorte: {}, maxStatsActifs: ['def' as const] };
  const ancien = evaluerPourRegime('degats_reels', statsParPaire(gear), aurasPropresDesRunes(gear.runes), DEGATS_FICHE);
  const nouveau = evaluateursArtefactsFiche(gear, 'degats_reels', aurasPropresDesRunes(gear.runes),
    DEGATS_FICHE, CONTEXTE_FICHE, []).representatif;
  const avant = paireRepresentative({ ...paires, evaluer: ancien });
  const apres = paireRepresentative({ ...paires, evaluer: nouveau });
  const bornes = bornesArtefacts({ ...paires, evaluer: nouveau }, ['atk', 'def'], ['def']);
  const params: SearchParams = { pool, base: BASE_FICHE, artifacts: avant, relic: gear.relic,
    requirement: { sets: ['violent', 'fight'], minStats: { atk: 1130 + seed % 5 * 10, def: 630 }, maxStats: { def: 900 } },
    objective: 'degats_reels', objectiveStats: ['atk'], metric: 'eff', slotFilterCap: 40, maxMs: Infinity };
  return { params, paires, avant, apres, bornes };
}

function oracle(p: SearchParams, pairesAdmises: ArtifactDetail[][]) {
  const admissibles = new Set<string>();
  const gear = { base: p.base, relic: p.relic, runes: [] as RuneDetail[], artifacts: [] as ArtifactDetail[] };
  let optimum = -Infinity;
  const respecte = (arts: ArtifactDetail[]) => {
    const stats = computeStats({ ...gear, artifacts: arts });
    return Object.entries(p.requirement.minStats).every(([k, v]) => !v || stats.find((s) => s.key === k)!.total >= v)
      && Object.entries(p.requirement.maxStats ?? {}).every(([k, v]) => !v || stats.find((s) => s.key === k)!.total <= v);
  };
  function visiter(slot: number) {
    if (slot === 7) {
      const actifs = activeSets(gear.runes.map((r) => r.set));
      if (!p.requirement.sets.every((s) => actifs.includes(s)) || !pairesAdmises.some(respecte)) return;
      admissibles.add(gear.runes.map((r) => r.id).sort((a, b) => a - b).join(','));
      // La note finale ne dépend pas de la représentative : vraies paires.
      for (const arts of [[], [artFiche(101, 101, 100)], [artFiche(102, 102, 100)]]) {
        if (respecte(arts)) optimum = Math.max(optimum,
          scoreDeReference('degats_reels', { ...gear, artifacts: arts }, REF_FICHE)!);
      }
      return;
    }
    for (const r of p.pool.filter((r) => r.slot === slot)) { gear.runes.push(r); visiter(slot + 1); gear.runes.pop(); }
  }
  visiter(1);
  return { admissibles, optimum };
}

export function testArtefactsFicheDifferentiel() {
  titre('Fiche — différentiel recherche, 24 seeds × bornes / absence / artFlatFige');
  const bilan = { recherches: 0, volumeChange: 0, statsChangees: 0, notesControlees: 0, admissibles: 0 };
  for (let seed = 1; seed <= 24; seed++) {
    const c = casFicheRecherche(seed);
    egal([c.avant.map((a) => a.id), c.apres.map((a) => a.id)], [[101], [102]], `seed ${seed} : représentative ATQ → DEF`);
    for (const mode of ['bornes', 'absence', 'artFlatFige'] as const) {
      const bounds = mode === 'bornes' ? c.bornes : mode === 'artFlatFige' ? { ...c.bornes, possibles: [] } : undefined;
      const bras = [c.avant, c.apres].map((artifacts) => {
        const p = { ...c.params, artifacts, artifactBounds: bounds };
        const r = searchBuilds(p);
        const o = oracle(p, mode === 'bornes' ? [[], ...c.paires.inventaire.map((a) => [a])] : [artifacts]);
        const classes = classerFicheCollectee(p, r, c.paires, DEGATS_FICHE);
        bilan.recherches++; bilan.admissibles += o.admissibles.size;
        ok(!r.truncated && r.candidates.every((x) => o.admissibles.has(cleBuild(x))),
          `seed ${seed}/${mode}/${artifacts[0].id} : ${r.candidates.length} collectés ⊆ ${o.admissibles.size} admissibles exhaustifs, non tronqué`);
        ok(o.optimum === -Infinity ? classes.length === 0 : Math.abs(classes[0].note - o.optimum) < 1e-8,
          `seed ${seed}/${mode}/${artifacts[0].id} : optimum final ${classes[0]?.note.toFixed(6) ?? 'vide'}, oracle ${o.optimum.toFixed(6)}`);
        for (const x of classes) {
          const gear = { base: p.base, runes: x.cle.split(',').map((id) => p.pool.find((r) => r.id === Number(id))!),
            artifacts: x.arts, relic: p.relic };
          if (Math.abs(x.note - scoreDeReference('degats_reels', gear, REF_FICHE)!) > 1e-8) throw new Error('Note finale différente de la production');
          bilan.notesControlees++;
        }
        return { r, classes };
      });
      const [a, b] = bras;
      if (a.r.candidates.length !== b.r.candidates.length) bilan.volumeChange++;
      const avant = new Map(a.r.candidates.map((x) => [cleBuild(x), JSON.stringify(x.stats)]));
      bilan.statsChangees += b.r.candidates.filter((x) => avant.has(cleBuild(x)) && avant.get(cleBuild(x)) !== JSON.stringify(x.stats)).length;
      if (mode === 'bornes') {
        egal(a.r.candidates.map(cleBuild).sort(), b.r.candidates.map(cleBuild).sort(), `seed ${seed} : candidats identiques avec bornes explicites`);
        egal(a.classes, b.classes, `seed ${seed} : classement final identique après résolution`);
      }
    }
  }
  ok(bilan.statsChangees > 0, 'le différentiel exerce vraiment le changement de stats provisoires');
  console.log('BILAN_FICHE ' + JSON.stringify(bilan));
}
