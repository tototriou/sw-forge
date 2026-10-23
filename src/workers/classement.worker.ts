/// <reference lib="webworker" />
import { CorpsClassement } from '../lib/classementCompact';
import type { BlocCandidats } from '../lib/candidatsCompacts';
import type { SearchResult } from '../lib/runeBuildOptim';
import type { ReponseResolution } from './resolutionBody';
import type { MessageVersClassement, ReponseClassement } from './classementDistant';

export type MessageRechercheClassement =
  | { type: 'candidats'; idRecherche: number; sequence: number; bloc: BlocCandidats }
  | { type: 'activer'; idRecherche: number }
  | { type: 'sceller'; idRecherche: number; nombre: number; derniereSequence: number; bilan: Omit<SearchResult, 'candidates'> };
type Branchement = { type: 'portRecherche'; idRecherche: number; port: MessagePort } | { type: 'portResolution'; port: MessagePort };

let generation = 0;
let recherche: MessagePort | null = null;
let resolution: MessagePort | null = null;
let tache: ReturnType<typeof setTimeout> | null = null;
function poster(r: ReponseClassement) { self.postMessage(r); }
const corps = creerCorps();
function creerCorps(): CorpsClassement {
  return new CorpsClassement({ publier: (publication) => self.postMessage({ type: 'publication', versionSchema: 1, publication },
    [publication.ordreBase.buffer as ArrayBuffer, publication.ordreAffiche.buffer as ArrayBuffer]),
    resoudre: (m) => { if (!resolution) throw new Error('Canal de résolution absent'); resolution.postMessage(m); },
    incident: (raison, detail) => {
      resolution?.close(); resolution = null;
      poster({ type: 'incidentResolution', versionSchema: 1, idRecherche: generation, raison, detail });
    } }, true);
}
function proteger(f: () => void): void {
  try { f(); } catch (e) {
    if (tache !== null) clearTimeout(tache);
    tache = null; recherche?.close(); recherche = null;
    poster({ type: 'erreur', versionSchema: 1, idRecherche: generation, message: e instanceof Error ? e.message : String(e) });
  }
}
function programmer(): void {
  if (tache !== null) return;
  tache = setTimeout(() => proteger(() => {
    tache = null;
    const limite = performance.now() + 4;
    do { corps.avancer(); } while (corps.travailEnCours && performance.now() < limite);
    corps.pomper(performance.now());
    if (corps.travailEnCours || corps.travailEnRepli) programmer();
  }), 0);
}
self.onmessage = (e: MessageEvent<MessageVersClassement | Branchement>) => proteger(() => {
  const m = e.data;
  if (m.type === 'portResolution') {
    resolution?.close(); resolution = m.port;
    const port = resolution;
    resolution.onmessage = (e: MessageEvent<ReponseResolution>) => proteger(() => { if (resolution !== port) return; corps.recevoirResolution(e.data, performance.now()); programmer(); });
    resolution.onmessageerror = () => proteger(() => { corps.panneResolution('Réponse du résolveur illisible', null); programmer(); });
    resolution.start(); return;
  }
  if (m.type === 'portRecherche') {
    if (m.idRecherche !== generation) { m.port.close(); return; }
    recherche?.close(); recherche = m.port;
    const port = m.port;
    port.onmessage = (e: MessageEvent<MessageRechercheClassement>) => proteger(() => {
      const r = e.data;
      if (r.idRecherche !== generation) return;
      if (r.type === 'candidats') { corps.ajouter(r.idRecherche, r.sequence, r.bloc); port.postMessage({ credit: true }); return; }
      if (r.type === 'activer') corps.activer(r.idRecherche);
      else corps.sceller(r.idRecherche, r.nombre, r.derniereSequence, r.bilan);
      programmer();
    });
    port.onmessageerror = () => proteger(() => { throw new Error('Flux de candidats illisible'); });
    port.start(); return;
  }
  if (m.versionSchema !== 1) throw new Error('Schéma de classement inconnu');
  if (m.type === 'ouvrir') {
    generation = m.idRecherche;
    recherche?.close(); recherche = null;
    corps.ouvrir(m.contexte, m.idRecherche, m.vue, m.idDemande);
    poster({ type: 'ouverte', versionSchema: 1, idRecherche: generation, idDemande: m.idDemande }); programmer(); return;
  }
  if (m.idRecherche !== generation) return;
  if (m.type === 'publicationRecue') { corps.acquitter(m.generationCache, m.revisionCache, m.nombre); return; }
  if (m.type === 'vue') {
    corps.changerVue(m.vue, m.idVue, m.idDemande);
    poster({ type: 'vueRecue', versionSchema: 1, idRecherche: generation, idDemande: m.idDemande, idVue: m.idVue }); programmer();
  }
  if (m.type === 'panneResolution') { corps.panneResolution(m.raison, m.detail); programmer(); }
  if (m.type === 'liberer') {
    if (tache !== null) clearTimeout(tache);
    tache = null; recherche?.close(); recherche = null; corps.liberer();
    poster({ type: 'liberee', versionSchema: 1, idRecherche: generation, idDemande: m.idDemande });
  }
});
