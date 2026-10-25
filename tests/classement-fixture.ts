import type { BuildCandidate, RealDamageContext, SearchParams } from '../src/lib/runeBuildOptim';
import type { VueClassement } from '../src/lib/classementCompact';
import { contexteResultat } from '../src/lib/contexteResultat';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile, estPrisEnCharge, skillDamageProfile } from '../src/lib/damage';
import { computeStats } from '../src/lib/stats';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import type { ArtifactDetail, RelicDetail, RuneDetail } from '../src/types';
const BASE = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export function demandeClassementTest(partiel: Partial<SearchParams> = {}, optimiser = false, toutVerifier = false) {
  const params: SearchParams = { base: BASE, pool: [], artifacts: [], requirement: { sets: [], minStats: {} }, metric: 'eff', objective: 'efficience', ...partiel };
  const fiche = { base: params.base, runes: [], artifacts: params.artifacts, relic: params.relic };
  const setup = DEFAULT_DAMAGE_SETUP;
  const exclusive = { setup, element: 'fire' as const };
  const photo = contexteResultat({ params, fiche, realDamage: null, damageSetup: setup, exclusive,
    signature: 'fixture', idInventaire: 0, idEspece: null, toutVerifier,
    resolution: optimiser ? { fiche, artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire: [], equipes: [], principaleParSorte: {}, lignesVerrouillees: [] },
      regime: 'aucun', degats: null, exclusive, requirement: params.requirement, relicContext: params.relicContext } : null });
  const vue: VueClassement = { tri: params.objective ?? 'efficience', metric: params.metric, page: 1 };
  return { params, photo, vue };
}

/** Petit corpus avec de vrais canaux de note : paire, auras et exclusive résolue. */
export function fixtureClassementCombat(objective: 'degats_reels' | 'ehp') {
  const setup = { ...DEFAULT_DAMAGE_SETUP, atkBuff: true, enemyDef: 1200 };
  const inventaire: ArtifactDetail[] = [
    { id: 901, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 219, value: 5 }] },
    { id: 902, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 102, value: 100 }, subs: [] },
    { id: 903, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 100, value: 1500 }, subs: [] },
  ];
  const reliques: RelicDetail[] = [
    { id: 701, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } },
    { id: 702, upgrade: 9, main: { code: 100, value: 12 }, unique: { type: 6, tranche: 10000, percent: 1 } },
  ];
  const relicContext = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 }, reliques[0], reliques);
  const pool: RuneDetail[] = [], candidats: BuildCandidate[] = [];
  for (let i = 0; i < 32; i++) {
    const runes: RuneDetail[] = Array.from({ length: 6 }, (_, j) => ({ id: 1000 + i * 6 + j, slot: j + 1, set: j < 2 ? 'fight' : 'violent', rank: 6, rarity: 5, level: 15,
      main: { code: 3, value: 20 + (i * 7) % 35 }, subs: [{ code: 1, value: 100 + i * 19 }, { code: 5, value: (31 - i) * 4 }] }));
    pool.push(...runes);
    candidats.push({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: inventaire.slice(0, 2) }), effTotal: i });
  }
  candidats.push({ ...candidats[7], runeIds: [...candidats[7].runeIds].reverse() });
  const profile = skillDamageProfile({ id: 1, com2usId: 1, nom: 'Test', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 1, formule: '3.0*{ATK}', scale: [], ameliorations: [], icone: null, effets: [] });
  if (!profile || !estPrisEnCharge(profile)) throw new Error('Sort de la fixture non calculable');
  const realDamage: RealDamageContext = { profile, passifs: [], setup, element: 'fire', artefacts: artifactDamageProfile(inventaire.slice(0, 2)),
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {}, bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null };
  const params: SearchParams = { base: BASE, pool, artifacts: inventaire.slice(0, 2), requirement: { sets: [], minStats: {} }, metric: 'eff', objective, relicContext };
  const fiche = { base: BASE, runes: pool.slice(0, 6), artifacts: params.artifacts, relic: reliques[0] };
  const exclusive = { setup, element: 'fire' as const };
  const photo = contexteResultat({ params, fiche, realDamage, damageSetup: setup, exclusive, signature: 'combat', idInventaire: 1, idEspece: 1, toutVerifier: true,
    resolution: { fiche, artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire, equipes: params.artifacts, principaleParSorte: {}, lignesVerrouillees: [] },
      regime: objective, degats: realDamage, exclusive, requirement: params.requirement, relicContext } });
  const vue: VueClassement = { tri: objective, metric: 'eff', page: 1 };
  return { params, photo, vue, candidats };
}

/** Transport de résultat vide pour les bancs d'import ; le propriétaire est conservé. */
export class ClassementVideTest {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror = null;
  onmessageerror = null;
  private ports: { close: () => void }[] = [];
  postMessage(m: any) {
    if (m.port) this.ports.push(m.port);
    if (m.classement?.port) this.ports.push(m.classement.port);
    if (m.type !== 'ouvrir') return;
    queueMicrotask(() => {
      this.onmessage?.(new MessageEvent('message', { data: { type: 'ouverte', versionSchema: 1, idRecherche: m.idRecherche, idDemande: m.idDemande } }));
      this.onmessage?.(new MessageEvent('message', { data: { type: 'publication', versionSchema: 1, publication: {
        versions: { versionSchema: 1, idRecherche: m.idRecherche, idInventaire: m.contexte.idInventaire, idContexteResolution: 1, revisionDonnees: 1,
          idVue: 1, revisionPubliee: 1, idDemande: m.idDemande }, vue: m.vue,
        candidats: [], ordreBase: new Uint32Array(), ordreAffiche: new Uint32Array(), generationCache: 1, revisionCache: 0, changements: [], enAttente: 0,
        bilan: { explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null },
      } } }));
    });
  }
  terminate() { this.onmessage = null; for (const p of this.ports) p.close(); }
}
