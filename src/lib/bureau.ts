// Ce que la PAGE sait de l'application de bureau — chantier
// application-bureau (spec/chantiers/application-bureau.md).
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
    telecharger: () => void;
    redemarrer: () => void;
  };
}

// La mise à jour automatique (lot 5), phase par phase — voir
// bureau/miseAJour.ts. Rien ne se télécharge sans « Mettre à jour ».
export interface EtatMiseAJour {
  phase: 'disponible' | 'telechargement' | 'prete' | 'echec';
  version: string;
}

function pont(): PontBureau | null {
  const p = (globalThis as { swblacksmithBureau?: PontBureau }).swblacksmithBureau;
  return p?.bureau === true ? p : null;
}

export const estBureau = (): boolean => pont() !== null;

// `rappel` reçoit l'état de la mise à jour — celui qui existe déjà au
// chargement de la page, puis chaque changement. Rend de quoi se désabonner.
// Sur le site : rien.
export function suivreMiseAJour(rappel: (etat: EtatMiseAJour) => void): () => void {
  const p = pont();
  if (!p) return () => {};
  let actif = true;
  void p.miseAJour.etat().then((etat) => {
    if (actif && etat) rappel(etat);
  });
  const desabonner = p.miseAJour.surChangement(rappel);
  return () => {
    actif = false;
    desabonner();
  };
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
