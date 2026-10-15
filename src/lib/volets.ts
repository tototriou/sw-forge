// Écran partagé : deux pages côte à côte, au bureau seulement
// (docs/02-app/transverse/feat-navigation/ecran-partage.md).
//
// ⚠️ **L'adresse décrit le volet ACTIF, et lui seul.** Tout ce qui navigue
// (barre latérale, palette, liens des pages, précédent du navigateur) passe
// par l'adresse : en la faisant suivre le volet actif, chaque chemin va au bon
// volet sans rien savoir de l'écran partagé. L'autre volet garde sa page ici.
//
// ⚠️ L'autre volet contient toujours une page qui a ÉTÉ active : il la reçoit
// quand elle cède la place (activation, verrou, page déjà ouverte). Son fil
// d'Ariane est donc mémorisé avec elle, au lieu d'être recalculé hors de la
// navigation qui le produit.
//
// ⚠️ **Un volet VIDE attend sa page** : c'est ainsi que s'ouvre l'écran
// partagé. Tant qu'il est vide, la prochaine page ouverte (sélecteur du volet,
// barre latérale, palette, lien) va dans ce volet.
//
// Calcul pur : l'écran applique les transitions (adresse, historique).

export type Cote = 'gauche' | 'droite';

/**
 * Clé de l'état des volets (`useStickyState`). ⚠️ Hors de la sauvegarde de
 * session : c'est une disposition de la FENÊTRE, comme le repli de la barre
 * latérale — rouverte sur un autre écran, elle n'aurait peut-être pas la place.
 */
export const CLE_ECRAN_PARTAGE = 'ecranPartage.volets';

/** Une page tenue par un volet : son adresse et le fil qui la nomme. */
export type PageVolet = { adresse: string; fil: string[] };

export type EtatVolets = {
  /** Deux volets affichés (si la fenêtre a la place). */
  partage: boolean;
  /** Le côté du volet que décrit l'adresse. */
  actif: Cote;
  /** La page de l'autre volet ; `null` hors écran partagé, ou quand il est VIDE. */
  autre: PageVolet | null;
  /** Un seul volet verrouillé à la fois : sinon une navigation n'aurait nulle part où aller. */
  verrou: Cote | null;
  /** Largeur du volet de gauche, en pourcentage. */
  taille: number;
};

/** Le résultat d'un geste : le nouvel état et, si elle change, l'adresse du volet actif. */
export type Transition = { etat: EtatVolets; adresse?: string };

/** Deux adresses mènent-elles au même écran ? (`#/rta` et `#/rta/` par exemple). */
export type MemePage = (a: string, b: string) => boolean;

export const ETAT_VOLETS_INITIAL: EtatVolets = {
  partage: false,
  actif: 'gauche',
  autre: null,
  verrou: null,
  taille: 50,
};

export function oppose(cote: Cote): Cote {
  return cote === 'gauche' ? 'droite' : 'gauche';
}

/** Le côté du volet vide, ou `null` s'il n'y en a pas. */
export function coteVide(e: EtatVolets): Cote | null {
  return e.partage && !e.autre ? oppose(e.actif) : null;
}

/** La page d'un côté : celle de l'adresse pour le volet actif, la mémorisée pour l'autre. */
export function pageDuCote(e: EtatVolets, courant: PageVolet, cote: Cote): PageVolet | null {
  return cote === e.actif ? courant : e.autre;
}

/**
 * L'adresse vient de changer (lien, barre latérale, palette, précédent) : à
 * quel volet revient la nouvelle page ?
 *
 * - un volet vide → elle le remplit, et il devient actif ;
 * - déjà ouverte dans l'autre volet → c'est lui qui devient actif, la page ne
 *   s'ouvre jamais deux fois (deux miroirs d'un même état) ;
 * - volet actif verrouillé → elle s'ouvre dans l'autre, qui devient actif.
 */
export function naviguer(e: EtatVolets, courant: PageVolet, cible: string, meme: MemePage): EtatVolets {
  if (!e.partage || meme(cible, courant.adresse)) return e;
  if (!e.autre || meme(cible, e.autre.adresse) || e.verrou === e.actif) {
    return { ...e, actif: oppose(e.actif), autre: courant };
  }
  return e;
}

/** Un appui ou le focus clavier dans un volet le rend actif : l'adresse prend la sienne. */
export function activer(e: EtatVolets, courant: PageVolet, cote: Cote): Transition {
  if (!e.partage || !e.autre || cote === e.actif) return { etat: e };
  return { etat: { ...e, actif: cote, autre: courant }, adresse: e.autre.adresse };
}

/** « Écran partagé » : un volet vide s'ouvre à droite, la page courante passe à gauche. */
export function ouvrirVide(e: EtatVolets): EtatVolets {
  if (e.partage) return e;
  return { ...e, partage: true, actif: 'gauche', autre: null, verrou: null };
}

/**
 * « Ouvrir à côté » : la page va dans l'autre volet (vide ou non), qui devient
 * actif — sauf s'il est verrouillé, auquel cas le volet actif navigue.
 */
export function ouvrirACote(e: EtatVolets, courant: PageVolet, cible: string, meme: MemePage): Transition {
  if (meme(cible, courant.adresse)) return { etat: e };
  if (!e.partage) {
    return { etat: { ...e, partage: true, actif: 'droite', autre: courant, verrou: null }, adresse: cible };
  }
  if (!e.autre) return { etat: { ...e, actif: oppose(e.actif), autre: courant }, adresse: cible };
  if (meme(cible, e.autre.adresse)) return activer(e, courant, oppose(e.actif));
  const cote = oppose(e.actif);
  if (e.verrou === cote) return { etat: e, adresse: cible };
  return { etat: { ...e, actif: cote, autre: courant }, adresse: cible };
}

/**
 * Fermer un volet : l'autre reprend toute la largeur. Un volet verrouillé ne
 * se ferme pas ; avec un volet vide, c'est toujours lui qui part.
 */
export function fermer(e: EtatVolets, courant: PageVolet, cote: Cote): Transition {
  if (!e.partage || e.verrou === cote) return { etat: e };
  const ferme = { ...e, partage: false, actif: 'gauche' as Cote, autre: null, verrou: null };
  if (!e.autre || cote !== e.actif) return { etat: ferme };
  return { etat: ferme, adresse: e.autre.adresse };
}

/** Les deux volets changent de côté ; la largeur, le verrou et l'activité suivent leur page. */
export function inverser(e: EtatVolets): EtatVolets {
  if (!e.partage) return e;
  return {
    ...e,
    actif: oppose(e.actif),
    verrou: e.verrou && oppose(e.verrou),
    taille: 100 - e.taille,
  };
}

/** Verrouiller ou déverrouiller un volet ; refusé si l'autre l'est déjà, ou si ce volet est vide. */
export function basculerVerrou(e: EtatVolets, cote: Cote): EtatVolets {
  if (!e.partage || coteVide(e) === cote || (e.verrou !== null && e.verrou !== cote)) return e;
  return { ...e, verrou: e.verrou === cote ? null : cote };
}

/**
 * Le bouton « Écran partagé » : ouvre un volet vide, ou ferme un volet — le
 * vide s'il y en a un, sinon celui qui n'est pas verrouillé, l'inactif d'abord.
 */
export function basculerPartage(e: EtatVolets, courant: PageVolet): Transition {
  if (!e.partage) return { etat: ouvrirVide(e) };
  const vide = coteVide(e);
  if (vide) return fermer(e, courant, vide);
  const inactif = oppose(e.actif);
  return fermer(e, courant, e.verrou === inactif ? e.actif : inactif);
}

// ---- Largeurs ----

/** Le seuil de la mise en page de bureau (`lg` de Tailwind) : la barre latérale apparaît. */
export const SEUIL_BUREAU = 1024;
/** La barre latérale dépliée. */
const BARRE_DEPLIEE = 248;
/** Les marges de la page hors écran partagé (`sm:px-6`). */
const MARGES_PAGE = 2 * 24;

/**
 * ⚠️ **Dans un volet, une page se met en page selon la largeur de son CONTENU,
 * comme hors écran partagé.** Chaque seuil de fenêtre de Tailwind (640, 768,
 * 1 024…) devient la largeur de contenu de page la plus ÉTROITE à laquelle il
 * s'applique aujourd'hui : sous `lg`, la fenêtre moins les marges ; à partir de
 * `lg`, moins aussi la barre latérale dépliée. Un volet ne prend donc jamais
 * une mise en page plus large que celles qui existent déjà pour cette largeur
 * de contenu : pas de défilement horizontal. Appliqué au CSS par
 * scripts/lib/postcssVolets.ts, et à `useMediaQuery` dans un volet.
 */
export function seuilContenu(seuilFenetre: number): number {
  return seuilFenetre - MARGES_PAGE - (seuilFenetre >= SEUIL_BUREAU ? BARRE_DEPLIEE : 0);
}

/**
 * Le plancher d'un volet : la largeur utile d'un téléphone. Sous le seuil de
 * bureau, la page prend sa mise en page de téléphone, faite pour cette largeur
 * (deux-formats.md) ; le plancher n'existe que pour qu'on ne puisse pas écraser
 * un volet jusqu'à rien.
 */
export const LARGEUR_MIN_CONTENU = 348;

/** Marges intérieures d'un volet (`px-6`) et ses deux contours. */
export const MARGE_VOLET = 2 * 24 + 2;
/** Marge autour des volets (`px-3`) et largeur du séparateur. */
export const MARGE_ZONE_VOLETS = 2 * 12;
export const LARGEUR_SEPARATEUR = 12;

/** Largeur minimale d'un volet, la même pour toutes les pages. */
export function largeurMinVolet(): number {
  return LARGEUR_MIN_CONTENU + MARGE_VOLET;
}

/**
 * Largeur de fenêtre à partir de laquelle deux volets tiennent côte à côte :
 * jamais sous le seuil de bureau, où il n'y a ni barre latérale ni écran
 * partagé (le téléphone et la tablette en portrait).
 */
export function seuilPartage(largeurBarre: number): number {
  return Math.max(SEUIL_BUREAU, largeurBarre + MARGE_ZONE_VOLETS + 2 * largeurMinVolet() + LARGEUR_SEPARATEUR);
}

/**
 * Une requête de largeur (`(max-width: 1023px)`, `(min-width: 640px)`) posée
 * DANS un volet dont le contenu fait `largeurContenu` px : la réponse qu'elle
 * aurait hors écran partagé pour ce contenu (voir `seuilContenu`). `null` pour
 * une requête qui ne porte pas sur la largeur (pointeur, thème) : elle reste
 * celle de la fenêtre.
 */
export function requeteDansVolet(requete: string, largeurContenu: number): boolean | null {
  const m = /^\(\s*(min|max)-width:\s*(\d+)px\s*\)$/.exec(requete.trim());
  if (!m) return null;
  const seuil = Number(m[2]);
  return m[1] === 'min' ? largeurContenu >= seuilContenu(seuil) : largeurContenu < seuilContenu(seuil + 1);
}

/** Le seuil de bureau, en largeur de contenu de volet : en dessous, la page est au format téléphone. */
export const SEUIL_CONTENU_BUREAU = seuilContenu(SEUIL_BUREAU);

/**
 * Les seuils de largeur qui comptent pour une page (ceux de Tailwind, et ceux
 * qu'elle lit en JavaScript), ramenés à la largeur du CONTENU d'un volet. Un
 * volet ne prévient sa page qu'en franchissant l'un d'eux : glisser le
 * séparateur ne redessine pas la page à chaque pixel.
 */
export const SEUILS_CONTENU_VOLET = [640, 768, 1024, 1280, 1536].map(seuilContenu);

/** La largeur de contenu retenue pour un volet : le dernier seuil franchi (0 sous le premier). */
export function palierContenu(largeur: number): number {
  return SEUILS_CONTENU_VOLET.filter((s) => largeur >= s).pop() ?? 0;
}
