import type { ContexteResultat } from '../lib/contexteResultat';
import type { InstantaneClassement, VueClassement } from '../lib/classementCompact';

export type MessageVersClassement =
  | { type: 'ouvrir'; versionSchema: 1; idRecherche: number; idDemande: number; contexte: ContexteResultat; vue: VueClassement }
  | { type: 'vue'; versionSchema: 1; idRecherche: number; idDemande: number; idVue: number; vue: VueClassement }
  | { type: 'liberer'; versionSchema: 1; idRecherche: number; idDemande: number }
  | { type: 'panneResolution'; versionSchema: 1; idRecherche: number; raison: string; detail: unknown };
export type ReponseClassement =
  | { type: 'ouverte'; versionSchema: 1; idRecherche: number; idDemande: number }
  | { type: 'vueRecue'; versionSchema: 1; idRecherche: number; idDemande: number; idVue: number }
  | { type: 'publication'; versionSchema: 1; publication: InstantaneClassement }
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

  constructor(private readonly ports: {
    envoyer: (m: MessageVersClassement) => void;
    /** L'instantané de la vue courante, ou `null` quand une recherche s'ouvre ou se libère. */
    publier: (p: InstantaneClassement | null) => void;
    ouverte: (idRecherche: number) => void;
    /** Propriétaire perdu : la page garde son dernier instantané, marqué interrompu. */
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
      // Une seule recherche, un seul inventaire, la vue et la demande courantes : jamais un mélange.
      if (v.versionSchema !== 1 || v.idRecherche !== this.generation || v.idInventaire !== this.inventaire
        || v.idVue !== this.vue || v.idDemande !== this.demande || !Number.isSafeInteger(v.revisionPubliee) || v.revisionPubliee <= this.revision) return;
      this.revision = v.revisionPubliee; this.ports.publier(r.publication); return;
    }
    if (r.idRecherche !== this.generation) return;
    if (r.type === 'ouverte' && r.idDemande === this.ouverture) { this.ouverture = null; this.ports.ouverte(this.generation); }
  }
  panne(erreur: unknown): void {
    if (this.mort) return;
    this.mort = true;
    this.actif = false; this.ouverture = null;
    this.ports.erreur(erreur);
  }
}
