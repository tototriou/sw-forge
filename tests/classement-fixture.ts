import type { SearchParams } from '../src/lib/runeBuildOptim';
import type { VueClassement } from '../src/lib/classementCompact';
import { contexteResultat } from '../src/lib/contexteResultat';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
const BASE = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export function demandeClassementTest(partiel: Partial<SearchParams> = {}, optimiser = false) {
  const params: SearchParams = { base: BASE, pool: [], artifacts: [], requirement: { sets: [], minStats: {} }, metric: 'eff', objective: 'efficience', ...partiel };
  const fiche = { base: params.base, runes: [], artifacts: params.artifacts, relic: params.relic };
  const setup = DEFAULT_DAMAGE_SETUP;
  const exclusive = { setup, element: 'fire' as const };
  const photo = contexteResultat({ params, fiche, realDamage: null, damageSetup: setup, exclusive,
    signature: 'fixture', idInventaire: 0, idEspece: null,
    resolution: optimiser ? { fiche, artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire: [], equipes: [], principaleParSorte: {}, lignesVerrouillees: [] },
      regime: 'aucun', degats: null, exclusive, requirement: params.requirement, relicContext: params.relicContext } : null });
  const vue: VueClassement = { tri: params.objective ?? 'efficience', metric: params.metric, page: 1, adapterArtefactsAuTri: true, toutVerifier: false };
  return { params, photo, vue };
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
