/// <reference lib="webworker" />
import { CorpsClassement, reprendreSurMemoire } from '../lib/classementCompact';
import { ARRET_MEMOIRE } from '../lib/candidatsCompacts';
import { Relance } from '../lib/cession';
import type { BlocCandidats } from '../lib/candidatsCompacts';
import type { SearchResult } from '../lib/runeBuildOptim';
import type { ReponseResolution } from './resolutionBody';
import type { MessageVersClassement, ReponseClassement } from './classementDistant';

export type MessageRechercheClassement =
  | { type: 'candidats'; idRecherche: number; sequence: number; bloc: BlocCandidats }
  | { type: 'activer'; idRecherche: number }
  | { type: 'sceller'; idRecherche: number; nombre: number; derniereSequence: number; bilan: Omit<SearchResult, 'candidates'> };
// `portResolution` : un seul résolveur ; `portsResolution` : le pool, un canal par
// Worker, la voie étant l'indice du canal.
type Branchement = { type: 'portRecherche'; idRecherche: number; port: MessagePort }
  | { type: 'portResolution'; port: MessagePort } | { type: 'portsResolution'; ports: MessagePort[] };

let generation = 0;
let recherche: MessagePort | null = null;
let resolutions: (MessagePort | null)[] = [];
function poster(r: ReponseClassement) { self.postMessage(r); }
const corps = creerCorps();
function creerCorps(): CorpsClassement {
  // L'instantané de la page est petit : il se clone, rien n'est transféré.
  return new CorpsClassement({ publier: (publication) => poster({ type: 'publication', versionSchema: 1, publication }),
    resoudre: (m, voie) => { const port = resolutions[voie]; if (!port) throw new Error('Canal de résolution absent'); port.postMessage(m); },
    incident: (raison, detail, voie) => {
      // Une voie : ce Worker seul quitte le pool ; sinon tout le pool.
      if (voie !== undefined) { resolutions[voie]?.close(); resolutions[voie] = null; }
      else { for (const p of resolutions) p?.close(); resolutions = []; }
      poster({ type: 'incidentResolution', versionSchema: 1, idRecherche: generation, raison, detail, ...(voie !== undefined ? { voie } : {}) });
    } }, true);
}
function brancherResolveurs(ports: MessagePort[]): void {
  for (const p of resolutions) p?.close();
  resolutions = [...ports];
  ports.forEach((port, voie) => {
    port.onmessage = (e: MessageEvent<ReponseResolution>) => proteger(() => { if (resolutions[voie] !== port) return; corps.recevoirResolution(e.data, performance.now()); programmer(); });
    port.onmessageerror = () => proteger(() => { if (resolutions[voie] !== port) return; corps.panneResolution('Réponse du résolveur illisible', null, voie); programmer(); });
    port.start();
  });
  corps.brancherVoies(ports.length);
}
// Tranches de 4 ms relancées par message de canal : des `setTimeout(0)`
// enchaînés sont bridés à ~4 ms par Chromium, le classeur passait la moitié
// de son temps à attendre. La relance prend son tour derrière les messages
// déjà reçus (annulation, crédits, réponses du résolveur).
// Le contenu d'une tranche (tâche, pompe, travail au fil, temps mort) est
// `CorpsClassement.tranche`, que les tests mènent sur une horloge virtuelle.
const relance = new Relance(() => proteger(() => {
  if (corps.tranche(() => performance.now())) relance.programmer();
}));
function proteger(f: () => void): void {
  try { f(); } catch (e) {
    // Une allocation refusée : arrêt propre, une fois par recherche (l'index
    // déjà construit reste servi) ; la recherche, si elle collecte encore, est
    // priée de s'arrêter et de sceller ce qu'elle a. Une seconde panne, ou
    // toute autre erreur, perd le propriétaire.
    const arret = reprendreSurMemoire(corps, e);
    if (arret) {
      if (arret.collecteEnCours) recherche?.postMessage(ARRET_MEMOIRE);
      programmer();
      return;
    }
    relance.annuler(); recherche?.close(); recherche = null;
    poster({ type: 'erreur', versionSchema: 1, idRecherche: generation, message: e instanceof Error ? e.message : String(e) });
  }
}
const programmer = () => relance.programmer();
self.onmessage = (e: MessageEvent<MessageVersClassement | Branchement>) => proteger(() => {
  const m = e.data;
  if (m.type === 'portResolution') { brancherResolveurs([m.port]); return; }
  if (m.type === 'portsResolution') {
    if (!Array.isArray(m.ports) || m.ports.length < 1) throw new Error('Pool de résolution vide');
    brancherResolveurs(m.ports); return;
  }
  if (m.type === 'portRecherche') {
    if (m.idRecherche !== generation) { m.port.close(); return; }
    recherche?.close(); recherche = m.port;
    const port = m.port;
    port.onmessage = (e: MessageEvent<MessageRechercheClassement>) => proteger(() => {
      const r = e.data;
      if (r.idRecherche !== generation) return;
      // Le crédit part avant tout travail sur le bloc : la recherche n'attend jamais la notation.
      if (r.type === 'candidats') { corps.ajouter(r.idRecherche, r.sequence, r.bloc); port.postMessage({ credit: true }); if (corps.travailAuFil) programmer(); return; }
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
  if (m.type === 'vue') {
    corps.changerVue(m.vue, m.idVue, m.idDemande);
    poster({ type: 'vueRecue', versionSchema: 1, idRecherche: generation, idDemande: m.idDemande, idVue: m.idVue }); programmer();
  }
  if (m.type === 'panneResolution') { corps.panneResolution(m.raison, m.detail, m.voie); programmer(); }
  if (m.type === 'liberer') {
    relance.annuler(); recherche?.close(); recherche = null; corps.liberer();
    poster({ type: 'liberee', versionSchema: 1, idRecherche: generation, idDemande: m.idDemande });
  }
});
