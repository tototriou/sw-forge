// Couleur de SIGNATURE de chaque section et sous-section de l'app.
//
// ⚠️ **Une seule source pour l'accueil ET la navigation.** L'accueil peint ses
// cartes de cette couleur (HomePage), et la navigation (barre latérale, onglets
// du bas, panneau mobile, barre supérieure) peint l'icône de la MÊME. Deux
// listes de hex auraient divergé au premier ajustement — exactement le piège
// « plusieurs constructeurs » du CLAUDE.md : un accent changé d'un côté aurait
// laissé l'autre en arrière, sans que `tsc` n'y voie rien.
//
// ⚠️ **Des hex, pas des tokens — et c'est voulu.** Ce sont des accents
// DÉCORATIFS d'identité, hors du système de tokens (bg/panel/ink/accent…) : ils
// ne portent aucun ÉTAT (l'état actif reste marqué par le contour d'accent,
// spec/shared/design.md « un seul marqueur »), ne changent pas avec le thème,
// et ne sont donc pas soumis à la règle « tout passe par les tokens ». C'est
// l'extraction des couleurs déjà écrites en dur dans HomePage, pas une nouvelle
// entorse.

// Sections de premier niveau, indexées par `Route` (voir App.tsx).
export const COULEUR_SECTION = {
  home: '#5B9DE0',
  rta: '#A15FE0',
  siege: '#E4463A',
  compte: '#4AD8D8',
  outils: '#FFA94D',
  arene: '#F2C24C',
  bestiary: '#2FA0E0',
  mecaniques: '#8890B8',
  releases: '#C79BFF',
} as const;

// Sous-sections de RTA, indexées par `RtaSub`.
// (`prepa` reprend l'accent de la section — c'est l'écran principal ; `ami`
// prend une teinte voisine, assez proche pour rester de la famille RTA, assez
// distincte pour qu'on ne confonde pas sa prépa avec celle d'un autre.)
export const COULEUR_RTA_SUB = {
  prepa: '#A15FE0',
  ami: '#D07FD8',
} as const;

// Sous-sections du Siège, indexées par `SiegeTab`.
export const COULEUR_SIEGE_SUB = {
  defense: '#E4463A',
  offense: '#F2884C',
  recos: '#5EDB8F',
} as const;

// Inventaires de « Mon compte », indexés par `AccountSub`.
// (`runes` et `artefacts` reprennent les accents des cartes de l'accueil ;
// `monstres`, absent de l'accueil, reçoit sa propre teinte.)
export const COULEUR_COMPTE_SUB = {
  monstres: '#E86A8C',
  runes: '#4AD8D8',
  artefacts: '#E08A3C',
} as const;
