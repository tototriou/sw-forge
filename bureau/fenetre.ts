// L'état mémorisé de la fenêtre — chantier application-bureau, lot 1 bis
// (décision 7 : taille et position mémorisées, fond au thème dès
// l'ouverture).
//
// Ce module est PUR (aucun import d'Electron) : `tests/bureau-fenetre.test.ts`.
//
// ⚠️ **Le fichier se relit avec méfiance** : il vient du disque, il peut dater
// d'un autre écran (portable débranché de son moniteur), d'une autre version,
// ou être corrompu. Tout ce qui ne tient pas est remplacé par un défaut — une
// fenêtre qui s'ouvrirait HORS de tout écran serait introuvable.

// La barre du haut de l'app fait 3 rem (48 px, `TopBar.tsx`), filet du bas
// COMPRIS. Les boutons de Windows dessinés par-dessus en prennent 47 : à 48,
// ils recouvraient ce filet, qui s'interrompait sous eux (vu à la capture du
// lot 1 bis).
export const HAUTEUR_BARRE = 47;

// `lg` de Tailwind : en dessous, l'app passe au format téléphone, qui n'a
// rien à faire dans une fenêtre de bureau.
export const MINIMUM = { largeur: 1024, hauteur: 640 };
export const DEFAUT = { largeur: 1440, hauteur: 900 };

// Les trois couleurs que la fenêtre dessine elle-même, en `#rrggbb`.
export interface CouleursFenetre {
  fond: string; // `--bg` : derrière la page, avant qu'elle soit peinte
  barre: string; // `--bar` : fond des boutons réduire / agrandir / fermer
  symboles: string; // `--ink` : leurs symboles
}

export interface EtatFenetre {
  x?: number;
  y?: number;
  largeur: number;
  hauteur: number;
  agrandie: boolean;
  couleurs?: CouleursFenetre;
}

// La zone utile d'un écran (`workArea` : sans la barre des tâches).
export interface Ecran {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const COULEUR = /^#[0-9a-f]{6}$/i;
const nombre = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);

export function couleursValides(v: unknown): CouleursFenetre | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const ok = (c: unknown): c is string => typeof c === 'string' && COULEUR.test(c);
  return ok(o.fond) && ok(o.barre) && ok(o.symboles) ? { fond: o.fond, barre: o.barre, symboles: o.symboles } : undefined;
}

// Assez de la fenêtre sur l'écran pour la saisir par sa barre : 120 × 48 px.
function saisissable(x: number, y: number, largeur: number, e: Ecran): boolean {
  const gauche = Math.max(x, e.x);
  const droite = Math.min(x + largeur, e.x + e.largeur);
  const haut = Math.max(y, e.y);
  const bas = Math.min(y + HAUTEUR_BARRE, e.y + e.hauteur);
  return droite - gauche >= 120 && bas - haut >= HAUTEUR_BARRE;
}

// L'état à appliquer à l'ouverture, d'après le fichier lu (`brut`) et les
// écrans présents. `ecrans[0]` est l'écran principal.
export function lireEtat(brut: unknown, ecrans: Ecran[]): EtatFenetre {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const principal = ecrans[0] ?? { x: 0, y: 0, largeur: DEFAUT.largeur, hauteur: DEFAUT.hauteur };
  let largeur = Math.max(MINIMUM.largeur, nombre(o.largeur) ?? DEFAUT.largeur);
  let hauteur = Math.max(MINIMUM.hauteur, nombre(o.hauteur) ?? DEFAUT.hauteur);
  const x = nombre(o.x);
  const y = nombre(o.y);
  const ecran = x !== undefined && y !== undefined ? ecrans.find((e) => saisissable(x, y, largeur, e)) : undefined;
  // Jamais plus grande que l'écran qui l'accueille (sans descendre sous le
  // minimum : un écran plus petit que 1024 px la verra déborder, pas rétrécir).
  const cadre = ecran ?? principal;
  largeur = Math.max(MINIMUM.largeur, Math.min(largeur, cadre.largeur));
  hauteur = Math.max(MINIMUM.hauteur, Math.min(hauteur, cadre.hauteur));
  return {
    // Position gardée seulement si la fenêtre reste saisissable ; sinon elle
    // s'ouvre centrée sur l'écran principal (x, y absents).
    ...(ecran ? { x, y } : {}),
    largeur,
    hauteur,
    agrandie: o.agrandie === true,
    ...(couleursValides(o.couleurs) ? { couleurs: couleursValides(o.couleurs) } : {}),
  };
}
