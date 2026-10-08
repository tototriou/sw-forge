// Ce que la PAGE sait de l'application de bureau
// (docs/02-app/bureau/).
//
// ⚠️ **Sur le site, tout ceci est inerte** : `estBureau()` y vaut `false`, et
// rien n'est posé ni écouté. Le site ne change pas.

// L'objet exposé par le préchargement (bureau/preload.ts), seul pont vers le
// processus principal.
interface PontBureau {
  bureau: true;
  plateforme: string;
  couleurs: (c: { fond: string; barre: string; symboles: string }) => void;
  miseAJour: {
    etat: () => Promise<EtatMiseAJour | null>;
    surChangement: (rappel: (etat: EtatMiseAJour) => void) => () => void;
    rechercher: () => void;
    telecharger: () => void;
    redemarrer: () => void;
  };
  swex: {
    etat: () => Promise<EtatSwex | null>;
    choisirDossier: () => Promise<EtatSwex | null>;
    choisirInvocateur: (fichier: string) => Promise<EtatSwex | null>;
    oublier: () => Promise<EtatSwex | null>;
    surEtat: (rappel: (etat: EtatSwex) => void) => () => void;
    surExport: (rappel: (exp: ExportSwex) => void) => () => void;
    pret: (pageSansCompte: boolean) => void;
    lu: (modifie: number) => void;
  };
  session: {
    etat: () => Promise<EtatSession | null>;
    surEtat: (rappel: (etat: EtatSession) => void) => () => void;
    retenir: (oui: boolean) => Promise<EtatSession | null>;
    sauvegarder: (texte: string, nomPropose: string) => Promise<IssueSession | null>;
    sauvegarderSous: (texte: string, nomPropose: string) => Promise<IssueSession | null>;
    choisirDossier: () => Promise<EtatSession | null>;
    oublierDossier: () => Promise<EtatSession | null>;
    oublier: () => Promise<EtatSession | null>;
  };
}

// La session en cours (voir bureau/session.ts) : le fichier que
// « Sauvegarder » réécrit, ou aucun ; et le dossier SW Blacksmith, dont le
// sous-dossier `sessions` reçoit les sessions.
export interface EtatSession {
  chemin: string | null;
  nom: string | null;
  dossier: string | null;
}
export type IssueSession =
  | { issue: 'enregistree'; etat: EtatSession }
  | { issue: 'annulee' }
  | { issue: 'echec'; message: string };

// Le pont de la session en cours, ou `null` sur le site (qui télécharge
// toujours un fichier daté).
export function sessionBureau(): PontBureau['session'] | null {
  return pont()?.session ?? null;
}

// Le dossier SW Exporter (voir bureau/swex.ts).
export interface EtatSwex {
  dossier: string | null;
  fichier: string | null;
  exports: { fichier: string; nom: string; id: string; modifie: number }[];
  dernierLu: number | null;
  introuvable: boolean;
}
// Un export donné à la page : son texte, sa date, et s'il est NOUVEAU (à
// annoncer) ou seulement relu (page sans compte, au lancement).
export interface ExportSwex {
  texte: string;
  modifie: number;
  nouveau: boolean;
  fichier: string;
}

// Le pont du dossier SW Exporter, ou `null` sur le site.
export function swex(): PontBureau['swex'] | null {
  return pont()?.swex ?? null;
}

// La mise à jour automatique, phase par phase — voir
// bureau/miseAJour.ts. Rien ne se télécharge sans « Mettre à jour ».
export interface EtatMiseAJour {
  phase: 'aucune' | 'recherche' | 'a-jour' | 'injoignable' | 'disponible' | 'telechargement' | 'prete' | 'echec';
  version: string;
}

function pont(): PontBureau | null {
  const p = (globalThis as { swblacksmithBureau?: PontBureau }).swblacksmithBureau;
  return p?.bureau === true ? p : null;
}

export const estBureau = (): boolean => pont() !== null;

// Un texte qui parle du NAVIGATEUR (« dans ton navigateur », « en fermant
// l'onglet ») est faux dans l'app de bureau : `site` partout, `app`
// dans l'app. ⚠️ Le site ne change pas — on ne réécrit
// jamais le texte du site pour qu'il convienne aux deux.
export function selonSupport<T>(site: T, app: T): T {
  return estBureau() ? app : site;
}

// Les installeurs de la dernière version publiée, que l'accueil du SITE
// propose. ⚠️ Les noms suivent `artifactName` de
// electron-builder.yml — sans numéro de version, seule adresse fixe ;
// tests/bureau-mise-a-jour.test.ts vérifie qu'ils concordent.
export const DEPOT = 'https://github.com/tototriou/sw-forge';
export const TELECHARGEMENTS = {
  windows: `${DEPOT}/releases/latest/download/SW-Blacksmith-Setup.exe`,
  linux: `${DEPOT}/releases/latest/download/SW-Blacksmith.AppImage`,
} as const;

// `rappel` reçoit l'état de la mise à jour — celui qui existe déjà au
// chargement de la page, puis chaque changement. Rend de quoi se désabonner.
// Sur le site : rien.
export function suivreMiseAJour(rappel: (etat: EtatMiseAJour) => void): () => void {
  const p = pont();
  if (!p) return () => {};
  let actif = true;
  // Un changement reçu avant la réponse de `etat()` est plus récent : elle
  // ne l'écrase pas (une phase déjà passée reviendrait à l'écran).
  let change = false;
  void p.miseAJour.etat().then((etat) => {
    if (actif && !change && etat) rappel(etat);
  });
  const desabonner = p.miseAJour.surChangement((etat) => {
    change = true;
    rappel(etat);
  });
  return () => {
    actif = false;
    desabonner();
  };
}

// « Rechercher » (Réglages) : cherche une nouvelle version maintenant.
export function rechercherMiseAJour() {
  pont()?.miseAJour.rechercher();
}

// « Mettre à jour » : télécharge la version proposée (en fond).
export function telechargerMiseAJour() {
  pont()?.miseAJour.telecharger();
}

// « Redémarrer » : installe la mise à jour téléchargée et relance l'app.
export function redemarrerPourMettreAJour() {
  pont()?.miseAJour.redemarrer();
}

// `"27 26 25"` (forme des jetons de `index.css`) → `#1b1a19` ; `null` si ce
// n'est pas un triplet 0–255.
export function tripletVersHex(triplet: string): string | null {
  const parts = triplet.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// ⚠️ Les couleurs se LISENT sur la page (jetons calculés), elles ne sont
// jamais recopiées : un thème retouché dans `index.css` habille la fenêtre
// sans autre changement.
function envoyerCouleurs(p: PontBureau) {
  const style = getComputedStyle(document.documentElement);
  const lire = (jeton: string) => tripletVersHex(style.getPropertyValue(jeton));
  const fond = lire('--bg');
  const barre = lire('--bar');
  const symboles = lire('--ink');
  if (fond && barre && symboles) p.couleurs({ fond, barre, symboles });
}

// À appeler une fois au démarrage (main.tsx). Dans l'app : pose
// `html[data-bureau]` (index.css en fait la barre de la fenêtre) et envoie
// les couleurs du thème au processus principal, puis à chaque changement —
// choix du menu ⚙ (`data-theme`) ou thème du système en mode Auto.
export function habillerBureau() {
  const p = pont();
  if (!p) return;
  const racine = document.documentElement;
  racine.setAttribute('data-bureau', p.plateforme);
  envoyerCouleurs(p);
  new MutationObserver(() => envoyerCouleurs(p)).observe(racine, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => envoyerCouleurs(p));
}
