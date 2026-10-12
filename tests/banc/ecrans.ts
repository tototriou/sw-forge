// Table des écrans et des états du banc d'affichage (tests/banc/run.mjs).
//
// Un écran = une adresse de l'app. Un état = ce que l'écran montre après une
// PRÉPARATION courte et déclarée : ouvrir un panneau, une modale. La
// préparation est une suite d'étapes, interprétées par la session du banc
// (session.mjs) ; elle ne simule pas un usage, elle amène l'écran dans l'état
// à mesurer.
//
// ⚠️ Ce fichier n'importe ni Playwright ni la session : il est lu par Node
// (le lanceur, qui exécute le TypeScript directement) et par esbuild (les
// vérifications). D'où : aucun import, aucun `enum`, rien que des types
// effaçables.
//
// Chaque état part d'une page neuve sur le compte importé, sans rien hériter
// de l'état mesuré avant lui : la session restaure, pour chaque état, le
// stockage pris juste après l'import.

export type Format = 'telephone' | 'ordinateur';

export interface DefinitionFormat {
  libelle: string;
  largeur: number;
  hauteur: number;
  /** Pointeur grossier et écran tactile (contexte Playwright `isMobile` et `hasTouch`). */
  tactile: boolean;
}

// Les deux formats de premier rang (CLAUDE.md). Le téléphone est tactile :
// les variantes `coarse:`, `compact:`, `no-hover:` et `hoverable:` de l'app
// dépendent du pointeur, pas de la largeur (tailwind.config.js).
export const FORMATS: Record<Format, DefinitionFormat> = {
  telephone: { libelle: 'téléphone', largeur: 360, hauteur: 800, tactile: true },
  ordinateur: { libelle: 'ordinateur', largeur: 1400, hauteur: 1000, tactile: false },
};

export const ORDRE_FORMATS: Format[] = ['telephone', 'ordinateur'];

/** Rôles ARIA qu'une étape peut viser. */
export type Role = 'button' | 'dialog' | 'switch' | 'tab' | 'link' | 'heading';

/**
 * Un élément visé par son rôle et son nom accessible, comme Playwright
 * `getByRole`. Le nom est comparé EXACTEMENT. Une cible doit désigner un seul
 * élément visible : zéro ou plusieurs, et l'état est déclaré inatteignable,
 * plutôt que de cliquer le premier venu.
 */
export interface Cible {
  role: Role;
  nom: string;
}

export type Etape =
  /** Cliquer la cible. */
  | { cliquer: Cible }
  /** Attendre que la cible soit visible (bornée). */
  | { attendre: Cible };

/** Un format où l'état n'est pas exercé, avec son motif. */
export interface NonExerce {
  nonExerce: string;
}

export interface Etat {
  id: string;
  libelle: string;
  /** Étapes communes aux deux formats, ou une suite par format. */
  preparation: Etape[] | Record<Format, Etape[] | NonExerce>;
}

export interface Ecran {
  id: string;
  libelle: string;
  /** Adresse dans l'app (routage par `#`). */
  hash: string;
  etats: Etat[];
}

const DEFAUT: Etat = { id: 'defaut', libelle: 'à l’ouverture', preparation: [] };

export const ECRANS: Ecran[] = [
  { id: 'accueil', libelle: 'Accueil', hash: '#/', etats: [DEFAUT] },
  {
    id: 'optimizer',
    libelle: 'Optimizer',
    hash: '#/outils/optimizer',
    etats: [
      DEFAUT,
      {
        id: 'reglages-avances',
        libelle: 'réglages avancés ouverts',
        // Au téléphone, « Réglages avancés » vit dans le panneau « Options de
        // recherche », ouvert par le bouton de la barre d'onglets ; à
        // l'ordinateur, c'est une carte repliée qui s'ouvre d'un clic.
        preparation: {
          telephone: [
            { cliquer: { role: 'button', nom: 'Filtres et actions de la page' } },
            { attendre: { role: 'dialog', nom: 'Options de recherche' } },
          ],
          ordinateur: [{ cliquer: { role: 'button', nom: 'Réglages avancés' } }],
        },
      },
      {
        id: 'degats-reels',
        libelle: 'modale « Dégâts réels » ouverte',
        // Choisir l'objectif « Dégâts réels » ouvre la fenêtre du combat
        // (OptimizerSection.tsx, `setSetupOuvert(true)`).
        preparation: [
          { cliquer: { role: 'button', nom: 'Dégâts réels' } },
          { attendre: { role: 'dialog', nom: 'Dégâts réels' } },
        ],
      },
    ],
  },
];

/** La suite d'étapes d'un état pour un format, ou son motif de non-exercice. */
export function preparationPour(etat: Etat, format: Format): Etape[] | NonExerce {
  return Array.isArray(etat.preparation) ? etat.preparation : etat.preparation[format];
}
