import { useEffect } from 'react';
import type { ResultatArtefacts } from '../lib/artifactQueue';
import type { BuildCandidate } from '../lib/runeBuildOptim';
import type { VueClassement } from '../lib/classementCompact';
import type { useBuildOptimSearch } from './useBuildOptimSearch';

export interface UseArtifactOptimQueue {
  parBuild: ReadonlyMap<string, ResultatArtefacts>;
  enAttente: number;
}
const VIDE: ReadonlyMap<string, ResultatArtefacts> = new Map();
const AUCUN_CANDIDAT: BuildCandidate[] = [];

/** Adaptateur de l'interface actuelle ; il ne possède ni cache ni travail de résolution. */
export function useArtifactOptimQueue(opts: {
  search: Pick<ReturnType<typeof useBuildOptimSearch>, 'classement' | 'changerVue'>;
  vue: VueClassement;
}): UseArtifactOptimQueue & { base: BuildCandidate[]; affichees: BuildCandidate[]; vue: VueClassement } {
  const { search, vue } = opts;
  const { changerVue } = search;
  const { tri, metric, page, adapterArtefactsAuTri, toutVerifier } = vue;
  useEffect(() => {
    changerVue({ tri, metric, page, adapterArtefactsAuTri, toutVerifier });
  }, [changerVue, tri, metric, page, adapterArtefactsAuTri, toutVerifier]);
  const p = search.classement;
  return { parBuild: p?.parBuild ?? VIDE, enAttente: p?.enAttente ?? 0,
    base: p?.base ?? AUCUN_CANDIDAT, affichees: p?.affichees ?? AUCUN_CANDIDAT, vue: p?.vue ?? vue };
}
