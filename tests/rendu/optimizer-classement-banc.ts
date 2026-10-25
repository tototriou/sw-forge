// Les bancs de rendu posent une publication du vrai propriétaire ; ils ne
// réintroduisent pas le classement local que l'écran ne possède plus.
import type { GearSet, RuneDetail } from '../../src/types';
import type { BuildOptimProgress, useBuildOptimSearch } from '../../src/hooks/useBuildOptimSearch';
import type { BuildCandidate, BuildRequirement, SearchResult } from '../../src/lib/runeBuildOptim';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import { CorpsClassement, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../../src/lib/classementCompact';
import { contexteResultat } from '../../src/lib/contexteResultat';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../../src/lib/damage';
import { computeStats } from '../../src/lib/stats';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../../src/lib/candidatsCompacts';

type Recherche = ReturnType<typeof useBuildOptimSearch>;
/** L'entrée d'un banc : un résultat ou un aperçu avec ses candidats, comme le moteur les rend. */
export type RechercheBanc = Omit<Partial<Recherche>, 'result' | 'progress'> & {
  result?: SearchResult | null;
  progress?: BuildOptimProgress | (Extract<BuildOptimProgress, { phase: 'pairing' }> & { candidates: BuildCandidate[] }) | null;
};
export function rechercheClasseeTest(search: RechercheBanc, e: {
  fiche: GearSet; pool: RuneDetail[]; optimiser: boolean; vue: VueClassement;
  requirement?: BuildRequirement; setup?: DamageSetup; toutVerifier?: boolean;
}, resoudre = false): Partial<Recherche> & { projection: PublicationClassement } {
  const bruts = search.result?.candidates ?? (search.progress?.phase === 'pairing' && 'candidates' in search.progress ? search.progress.candidates : []);
  // Les anciennes fixtures n'avaient qu'une ligne ATQ ; le transport réel
  // porte les huit lignes, y compris celles que l'assertion ne lit pas.
  const stats = computeStats(e.fiche);
  const candidats = bruts.map((c) => ({ ...c, stats: stats.map((s) => c.stats.find((v) => v.key === s.key) ?? s) }));
  const setup = e.setup ?? DEFAULT_DAMAGE_SETUP, exclusive = { setup, element: null };
  const params = { base: e.fiche.base, pool: e.pool, artifacts: e.fiche.artifacts, relic: e.fiche.relic,
    requirement: e.requirement ?? { sets: [], minStats: {} }, metric: e.vue.metric, objective: 'efficience' as const };
  const photo = contexteResultat({ params, fiche: e.fiche, damageSetup: setup, realDamage: null, exclusive,
    signature: 'rendu', idInventaire: 0, idEspece: null, toutVerifier: e.toutVerifier ?? false,
    resolution: e.optimiser ? { fiche: e.fiche,
      artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire: e.fiche.artifacts, equipes: e.fiche.artifacts, principaleParSorte: {}, lignesVerrouillees: [] },
      regime: 'aucun', degats: null, exclusive, requirement: params.requirement, relicContext: undefined } : null });
  let classement!: InstantaneClassement;
  const corps = new CorpsClassement({ publier: (p) => { classement = p; }, resoudre: () => {}, incident: () => {} }, false, 'directe');
  corps.ouvrir(photo, 1, e.vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  if (search.result) {
    const { candidates: _candidats, ...bilan } = search.result;
    corps.sceller(1, candidats.length, lots.length - 1, bilan);
  } else corps.activer(1);
  if (resoudre) { do { corps.pomper(0); } while (corps.travailEnRepli); }
  corps.publier(0, true);
  // La page ne reçoit que le bilan et l'instantané, jamais les candidats.
  const { result, progress, ...reste } = search;
  const sansCandidats = <T extends object>(o: T) => { const { candidates: _c, ...r } = o as T & { candidates?: unknown }; return r; };
  return { ...reste, classement, classementInterrompu: false, contexte: photo, projection: corps.projection(),
    ...(result !== undefined ? { result: result && { ...sansCandidats(result), nombre: candidats.length } } : {}),
    ...(progress !== undefined ? { progress: progress && (sansCandidats(progress) as BuildOptimProgress) } : {}) };
}

/** Observer seulement la recherche ; le classeur et son aller-retour restent réels. */
export function observerRechercheTest(envois: DemandeDeRecherche[]): () => void {
  const WorkerNatif = globalThis.Worker;
  class RechercheObservee {
    onmessage = null; onerror = null; onmessageerror = null;
    private port: MessagePort | null = null;
    postMessage(m: DemandeDeRecherche | { stop: true }) {
      if (!('params' in m)) return;
      if (!m.classement) throw new Error('Recherche observée sans port vers le classeur');
      this.port = m.classement.port; envois.push(m);
    }
    terminate() { this.port?.close(); }
  }
  globalThis.Worker = function(url: string | URL, options?: WorkerOptions) {
    return new URL(url, location.href).pathname.endsWith('/runeBuildOptim.worker.ts')
      ? new RechercheObservee() : new WorkerNatif(url, options);
  } as unknown as typeof Worker;
  return () => { globalThis.Worker = WorkerNatif; };
}

export async function attendreDemandeTest(envois: DemandeDeRecherche[], nombre: number) {
  for (let garde = 0; envois.length < nombre && garde < 100; garde++) await new Promise(r => setTimeout(r, 10));
}
