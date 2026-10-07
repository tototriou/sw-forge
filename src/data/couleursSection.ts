// Couleur de SIGNATURE de chaque section et sous-section de l'app.
//
// ⚠️ **Refonte graphique (décision 3, précisée)** : ces teintes ont quitté la
// barre latérale bureau (lot 4), qui est neutre. Elles restent sur l'ACCUEIL
// (tuiles d'icône, halos — le mainteneur l'a demandé au lot 5) et sur la navigation
// du TÉLÉPHONE (onglets, panneau, barre du haut) jusqu'à son lot (11).
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
  // Application de bureau, lot 6 (décision 14) — site seulement.
  telecharger: '#7FD15B',
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

// ⚠️ **Variante THÈME CLAIR de chaque couleur ci-dessus** (refonte graphique,
// lot 14 — le mainteneur, sur une capture de l'accueil en clair : « effectivement
// pas très lisible »). Les couleurs d'origine sont pensées pour le fond
// sombre : en clair, l'icône sur sa tuile tombait à 1.40:1 (arène) — neuf sur
// douze sous 3:1, le seuil d'une icône. Chaque variante est la MÊME teinte,
// assombrie (mélange avec du noir) juste assez pour atteindre 3.2:1 sur la
// carte (`panel`) comme au survol (`panel2`) — pas une dose unique, qui aurait
// terni sans raison celles qui passaient déjà (RTA, Siège). Numéros d'étape,
// texte sur la carte : 4.23 à 4.37.
// Indexée par la couleur d'origine : c'est elle que les composants reçoivent.
// Le choix selon le thème se fait en CSS (`.teinte-section`, index.css).
// ⚠️ Accueil seulement pour l'instant : la navigation du téléphone, qui peint
// ses icônes de ces couleurs en ATTRIBUT SVG (où une variable CSS ne se
// résout pas), relève du lot 11.
export const TEINTE_CLAIRE: Record<string, string> = {
  '#5B9DE0': '#497EB3', // home
  '#A15FE0': '#9C5CD9', // rta, prepa
  '#D07FD8': '#A263A8', // ami
  '#E4463A': '#D94337', // siege, defense
  '#F2884C': '#B66639', // offense
  '#5EDB8F': '#3B8A5A', // recos
  '#4AD8D8': '#2E8686', // compte, runes
  '#E86A8C': '#C15874', // monstres
  '#E08A3C': '#AC6A2E', // artefacts
  '#FFA94D': '#A66E32', // outils
  '#F2C24C': '#94762E', // arene
  '#2FA0E0': '#2682B5', // bestiary
  '#8890B8': '#72799B', // mecaniques
  '#C79BFF': '#8B6DB3', // releases
};
