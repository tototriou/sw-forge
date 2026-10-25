import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchParams, SearchResult } from '../lib/runeBuildOptim';
import type { RelicContext, RelicVide } from '../lib/relicOptim';
import { coeursPhysiques } from '../lib/bureau';
import type { ContexteResultat } from '../lib/contexteResultat';
import type { InstantaneClassement, VueClassement } from '../lib/classementCompact';
import { ClassementDistant, type ReponseClassement } from '../workers/classementDistant';
import type { DemandeDeRecherche, WorkerResponse } from '../workers/runeBuildOptim.worker';

export type BuildOptimStatus = 'idle' | 'running' | 'done' | 'error' | 'refused';
export interface HalfBuildProgress { scanned: number; total: number; pct: number }
export type BuildOptimProgress =
  | { phase: 'building'; halves: { A: HalfBuildProgress | null; B: HalfBuildProgress | null } }
  | { phase: 'pairing'; explored: number; found: number; pct: number; totalPairs: number };
/** Le bilan d'une recherche finie, sans ses candidats : ils restent dans le classeur. */
export type BilanRecherche = Omit<SearchResult, 'candidates'> & { nombre: number };
type Classement = { worker: Worker; resolution: Worker | null; pilote: ClassementDistant };

/** Propriétaire remonté dans App : la navigation ne termine aucun de ces Workers. */
export function useBuildOptimSearch() {
  const workerRef = useRef<Worker | null>(null);
  const classementRef = useRef<Classement | null>(null);
  const runIdRef = useRef(0);
  const demarrerRef = useRef<((idRecherche: number) => void) | null>(null);
  const arretDemandeRef = useRef(false);
  const publicationRef = useRef<InstantaneClassement | null>(null);
  const vueRef = useRef<VueClassement | null>(null);
  const [status, setStatus] = useState<BuildOptimStatus>('idle');
  const [result, setResult] = useState<BilanRecherche | null>(null);
  const [progress, setProgress] = useState<BuildOptimProgress | null>(null);
  const [refusal, setRefusal] = useState<{ motif: 'relique-pool-vide'; vide: RelicVide } | null>(null);
  const [relicContext, setRelicContext] = useState<RelicContext | undefined>(undefined);
  const [contexte, setContexte] = useState<ContexteResultat | null>(null);
  const [classement, setClassement] = useState<InstantaneClassement | null>(null);
  // Le propriétaire est perdu : le dernier instantané reste montré, non actionnable.
  const [classementInterrompu, setClassementInterrompu] = useState(false);
  const coeursPhysiquesRef = useRef<number | null>(null);
  useEffect(() => {
    let actif = true;
    void coeursPhysiques().then((n) => { if (actif) coeursPhysiquesRef.current = n; });
    return () => { actif = false; };
  }, []);
  const terminerRecherche = useCallback(() => {
    runIdRef.current++; demarrerRef.current = null;
    arretDemandeRef.current = false;
    const worker = workerRef.current;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); }
    workerRef.current = null;
  }, []);
  const detruireClassement = useCallback(() => {
    const d = classementRef.current; classementRef.current = null;
    if (!d) return;
    d.worker.onmessage = null; d.worker.onerror = null; d.worker.onmessageerror = null;
    d.worker.terminate(); d.resolution?.terminate();
  }, []);
  const echouer = useCallback((erreur: unknown) => {
    console.error('Recherche de runes interrompue :', erreur);
    terminerRecherche(); detruireClassement();
    // Aucune reconstitution : la dernière page reçue reste, marquée interrompue.
    setClassementInterrompu(publicationRef.current !== null);
    setProgress(null); setStatus('error');
  }, [terminerRecherche, detruireClassement]);

  const run = useCallback((params: SearchParams, photo: ContexteResultat, vue: VueClassement) => {
    params = photo.recherche;
    terminerRecherche();
    const myRunId = runIdRef.current;
    setStatus('running'); setResult(null); setProgress(null); setRefusal(null); setClassementInterrompu(false);
    setRelicContext(params.relicContext); setContexte(photo); vueRef.current = vue;
    publicationRef.current = null; setClassement(null);
    try {
      let d = classementRef.current;
      if (!d) {
        const worker = new Worker(new URL('../workers/classement.worker.ts', import.meta.url), { type: 'module' });
        const pilote = new ClassementDistant({ envoyer: (m) => worker.postMessage(m),
          publier: (p) => {
            const precedent = publicationRef.current;
            publicationRef.current = p; setClassement(p);
            if (!p?.bilan) return;
            if (!precedent?.bilan || precedent.versions.idRecherche !== p.versions.idRecherche) {
              setResult({ ...p.bilan, nombre: p.comptes.recus }); setProgress(null); setStatus('done');
            }
          }, ouverte: (id) => demarrerRef.current?.(id), erreur: echouer,
          incident: (raison, detail) => {
            console.error(`File de résolution : ${raison} — repli dans le classeur.`, detail);
            classementRef.current?.resolution?.terminate();
            if (classementRef.current) classementRef.current.resolution = null;
          } });
        d = { worker, resolution: null, pilote }; classementRef.current = d;
        worker.onmessage = (e: MessageEvent<ReponseClassement>) => {
          if (classementRef.current?.worker !== worker) return;
          try { pilote.recevoir(e.data); } catch (err) { pilote.panne(err); }
        };
        worker.onerror = (e) => pilote.panne(e.message || e);
        worker.onmessageerror = (e) => pilote.panne(e);
        try {
          const resolution = new Worker(new URL('../workers/resolution.worker.ts', import.meta.url), { type: 'module' });
          d.resolution = resolution;
          const canal = new MessageChannel();
          worker.postMessage({ type: 'portResolution', port: canal.port1 }, [canal.port1]);
          resolution.postMessage({ type: 'port', port: canal.port2 }, [canal.port2]);
          const panne = (detail: string) => {
            if (classementRef.current?.worker !== worker) return;
            resolution.terminate();
            worker.postMessage({ type: 'panneResolution', versionSchema: 1, idRecherche: pilote.idRecherche, raison: 'Résolveur interrompu', detail });
          };
          resolution.onerror = (e) => panne(e.message);
          resolution.onmessageerror = () => panne('Réponse du résolveur illisible');
        } catch (err) {
          // Le premier besoin de résolution déclenchera le repli dans le classeur.
          console.error('Worker de résolution impossible à créer :', err);
        }
      }
      const distant = d;
      demarrerRef.current = (idRecherche) => {
        if (runIdRef.current !== myRunId) return;
        try {
          const worker = new Worker(new URL('../workers/runeBuildOptim.worker.ts', import.meta.url), { type: 'module' });
          workerRef.current = worker;
          worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            if (runIdRef.current !== myRunId) return;
            const data = e.data;
            if (data.type === 'progress') {
              if (publicationRef.current?.bilan) return;
              if (data.phase === 'building') setProgress((prev) => ({ phase: 'building', halves: {
                ...(prev?.phase === 'building' ? prev.halves : { A: null, B: null }),
                [data.half]: { scanned: data.scanned, total: data.total, pct: data.pct },
              } }));
              else setProgress({ phase: 'pairing', explored: data.explored, found: data.found, pct: data.pct, totalPairs: data.totalPairs });
            } else if (data.type === 'refus') {
              distant.pilote.liberer(); setRefusal({ motif: data.motif, vide: data.vide }); setProgress(null); setStatus('refused');
            } else if (data.type === 'error') echouer(new Error(data.message));
            // Le bilan arrive dans la publication atomique du classeur.
          };
          worker.onerror = (e) => { if (runIdRef.current === myRunId) echouer(e.message || e); };
          worker.onmessageerror = (e) => { if (runIdRef.current === myRunId) echouer(e); };
          const canal = new MessageChannel();
          distant.worker.postMessage({ type: 'portRecherche', idRecherche, port: canal.port1 }, [canal.port1]);
          const demande: DemandeDeRecherche = { type: 'recherche', params, coeursPhysiques: coeursPhysiquesRef.current,
            classement: { port: canal.port2, idRecherche } };
          worker.postMessage(demande, [canal.port2]);
          if (arretDemandeRef.current) worker.postMessage({ stop: true });
        } catch (err) { echouer(err); }
      };
      d.pilote.ouvrir(photo, vue);
    } catch (err) { echouer(err); }
  }, [terminerRecherche, echouer]);

  const changerVue = useCallback((vue: VueClassement) => {
    if (JSON.stringify(vueRef.current) === JSON.stringify(vue)) return;
    vueRef.current = vue; classementRef.current?.pilote.changerVue(vue);
  }, []);
  const stop = useCallback(() => { arretDemandeRef.current = true; workerRef.current?.postMessage({ stop: true }); }, []);
  const cancel = useCallback(() => { terminerRecherche(); classementRef.current?.pilote.liberer(); }, [terminerRecherche]);
  const reset = useCallback(() => {
    cancel(); publicationRef.current = null; setClassement(null); setClassementInterrompu(false);
    setStatus('idle'); setResult(null); setProgress(null); setRefusal(null); setRelicContext(undefined); setContexte(null);
  }, [cancel]);
  useEffect(() => () => { terminerRecherche(); detruireClassement(); }, [terminerRecherche, detruireClassement]);
  return { status, result, progress, refusal, relicContext, contexte, classement, classementInterrompu, changerVue, run, stop, cancel, reset };
}
