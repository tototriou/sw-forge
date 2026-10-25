import type { ContexteResultat } from '../lib/contexteResultat';
import type { PublicationClassement, PublicationTransport, VueClassement } from '../lib/classementCompact';
import { AdaptateurClassement } from '../lib/adaptateurClassement';

export type MessageVersClassement =
  | { type: 'ouvrir'; versionSchema: 1; idRecherche: number; idDemande: number; contexte: ContexteResultat; vue: VueClassement }
  | { type: 'vue'; versionSchema: 1; idRecherche: number; idDemande: number; idVue: number; vue: VueClassement }
  | { type: 'liberer'; versionSchema: 1; idRecherche: number; idDemande: number }
  | { type: 'publicationRecue'; versionSchema: 1; idRecherche: number; idVue: number; idDemande: number; revisionPubliee: number; generationCache: number; revisionCache: number; nombre: number }
  | { type: 'panneResolution'; versionSchema: 1; idRecherche: number; raison: string; detail: unknown };
export type ReponseClassement =
  | { type: 'ouverte'; versionSchema: 1; idRecherche: number; idDemande: number }
  | { type: 'vueRecue'; versionSchema: 1; idRecherche: number; idDemande: number; idVue: number }
  | { type: 'publication'; versionSchema: 1; publication: PublicationTransport }
  | { type: 'liberee'; versionSchema: 1; idRecherche: number; idDemande: number }
  | { type: 'incidentResolution'; versionSchema: 1; idRecherche: number; raison: string; detail: unknown }
  | { type: 'erreur'; versionSchema: 1; idRecherche: number; message: string };

function suivant(n: number): number {
  if (!Number.isSafeInteger(n) || n >= Number.MAX_SAFE_INTEGER) throw new Error('Compteur de classement épuisé ; recréer le contrôleur');
  return n + 1;
}

/** Pilote de versions ; les ports concrets et les Workers appartiennent au hook. */
export class ClassementDistant {
  private generation = 0;
  private demande = 0;
  private vue = 0;
  private revision = 0;
  private inventaire = 0;
  private actif = false;
  private mort = false;
  private ouverture: number | null = null;
  private adaptateur = new AdaptateurClassement();

  constructor(private readonly ports: {
    envoyer: (m: MessageVersClassement) => void;
    publier: (p: PublicationClassement | null) => void;
    ouverte: (idRecherche: number) => void;
    erreur: (erreur: unknown) => void;
    incident: (raison: string, detail: unknown) => void;
  }) {}

  get idRecherche() { return this.generation; }
  ouvrir(contexte: ContexteResultat, vue: VueClassement): number {
    this.generation = suivant(this.generation); this.demande = suivant(this.demande);
    this.vue = 1; this.revision = 0; this.inventaire = contexte.idInventaire;
    this.actif = true; this.ouverture = this.demande;
    this.ports.publier(null);
    this.envoyer({ type: 'ouvrir', versionSchema: 1, idRecherche: this.generation, idDemande: this.demande, contexte, vue });
    return this.generation;
  }
  changerVue(vue: VueClassement): void {
    if (!this.actif) return;
    this.vue = suivant(this.vue); this.demande = suivant(this.demande);
    this.envoyer({ type: 'vue', versionSchema: 1, idRecherche: this.generation, idDemande: this.demande, idVue: this.vue, vue });
  }
  liberer(): void {
    if (!this.actif) return;
    this.actif = false; this.ouverture = null; this.demande = suivant(this.demande);
    this.envoyer({ type: 'liberer', versionSchema: 1, idRecherche: this.generation, idDemande: this.demande });
    this.ports.publier(null);
    this.adaptateur.detruire();
  }
  private envoyer(m: MessageVersClassement): void {
    try { this.ports.envoyer(m); } catch (e) { this.panne(e); }
  }
  recevoir(r: ReponseClassement): void {
    if (!r || r.versionSchema !== 1) { this.panne(new Error('Schéma de réponse de classement inconnu')); return; }
    // L'incident concerne le résolveur du propriétaire vivant, même après libération de sa recherche.
    if (r.type === 'incidentResolution') { this.ports.incident(r.raison, r.detail); return; }
    // Une faute concerne le propriétaire, même sans recherche active.
    if (r.type === 'erreur') { this.panne(new Error(r.message)); return; }
    if (!this.actif) return;
    if (r.type === 'publication') {
      const v = r.publication.versions;
      if (v.versionSchema !== 1 || v.idRecherche !== this.generation || v.idInventaire !== this.inventaire
        || v.idVue !== this.vue || v.idDemande !== this.demande || !Number.isSafeInteger(v.revisionPubliee) || v.revisionPubliee <= this.revision) return;
      const p = r.publication;
      const publication = this.adaptateur.appliquer(p);
      this.revision = v.revisionPubliee; this.ports.publier(publication);
      this.envoyer({ type: 'publicationRecue', versionSchema: 1, idRecherche: this.generation,
        idVue: v.idVue, idDemande: v.idDemande, revisionPubliee: v.revisionPubliee,
        generationCache: p.generationCache, revisionCache: p.revisionCache, nombre: publication.candidats.length }); return;
    }
    if (r.idRecherche !== this.generation) return;
    if (r.type === 'ouverte' && r.idDemande === this.ouverture) { this.ouverture = null; this.ports.ouverte(this.generation); }
  }
  panne(erreur: unknown): void {
    if (this.mort) return;
    this.mort = true;
    this.actif = false; this.ouverture = null;
    this.adaptateur.detruire();
    this.ports.publier(null); this.ports.erreur(erreur);
  }
}
