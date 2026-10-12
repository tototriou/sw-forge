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
export type Role = 'button' | 'dialog' | 'switch' | 'tab' | 'link' | 'heading' | 'combobox' | 'option';

/**
 * Un élément visé par son rôle et son nom accessible, comme Playwright
 * `getByRole`. Le nom est comparé EXACTEMENT. Une cible doit désigner un seul
 * élément visible : zéro ou plusieurs, et l'état est déclaré non atteint,
 * plutôt que de cliquer le premier venu.
 */
export interface Cible {
  role: Role;
  nom: string;
  /** `aria-expanded` exigé (Playwright `expanded`). */
  etendu?: boolean;
  /**
   * Deux éléments portent le même rôle et le même nom : on garde celui qui
   * partage le plus petit contenant avec ce REPÈRE (lui-même une cible
   * unique). Égalité : ambiguïté, état non atteint.
   */
  pres?: Cible;
}

export type Etape =
  /** Cliquer la cible. */
  | { cliquer: Cible }
  /** Remplacer le texte d'un champ. */
  | { saisir: Cible; texte: string }
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
  /**
   * Postcondition : ce que l'état doit montrer une fois la page posée, chaque
   * cible unique et visible — sinon l'état est « non atteint » et rien n'est
   * mesuré. Liste vide : l'état n'ouvre rien ; le lanceur vérifie toujours
   * que le compte est chargé.
   */
  atteint: Cible[] | Record<Format, Cible[]>;
}

export interface Ecran {
  id: string;
  libelle: string;
  /** Adresse dans l'app (routage par `#`). */
  hash: string;
  /**
   * Autres adresses qui mènent au MÊME écran (route tronquée, retombée par
   * défaut de `parseHash`). Documentaire : un écran = une route distincte,
   * ses alias ne sont pas mesurés deux fois. Les entrées de navigation qui
   * portent le même hash (`#/rta` dans `NAV` et `RTA_SUBS`, `#/siege/defense`
   * dans `NAV` et `SIEGE_SUBS`) sont fusionnées sans alias à écrire.
   */
  alias?: string[];
  /**
   * Motifs de chemins (depuis la racine du dépôt, séparateur `/`) dont la
   * modification peut changer cet écran. Un fichier sélectionne TOUS les
   * écrans dont un motif le couvre : un motif partagé (une page qui sert
   * plusieurs écrans, un dossier de composants commun) est écrit dans chacun
   * d'eux, et `motifsPartages()` (selection.ts) les liste. Forme d'un motif :
   * `dossier/` (tout ce qui est dessous), `chemin/nom` (ce fichier, sans son
   * extension), `chemin/prefixe*` (les fichiers dont le nom commence ainsi).
   */
  motifs: string[];
  etats: Etat[];
}

const DEFAUT: Etat = { id: 'defaut', libelle: 'à l’ouverture', preparation: [], atteint: [] };

/**
 * Motifs qui sélectionnent TOUS les écrans : la librairie d'interface, la
 * feuille de style et la configuration Tailwind touchent chaque page.
 */
export const MOTIFS_TOUS: string[] = ['src/ui/', 'src/index.css', 'tailwind.config.js'];

/** Écran sans état préparé : l'état unique « à l'ouverture ». */
function ouverture(id: string, libelle: string, hash: string, motifs: string[], alias?: string[]): Ecran {
  return { id, libelle, hash, ...(alias ? { alias } : {}), motifs, etats: [DEFAUT] };
}

// Motifs communs à plusieurs écrans (ARCHITECTURE.md § 3 : une page, un
// dossier de composants et des hooks pour plusieurs routes).
const MOTIFS_RTA = ['src/pages/RtaPage', 'src/components/rta/', 'src/hooks/useRta*', 'src/lib/rtaShare'];
const MOTIFS_SIEGE = [
  'src/pages/SiegePage',
  'src/components/siege/',
  // Le siège monte la modale de speed tuning (SiegeBoard) : elle change ses écrans.
  'src/components/outils/SpeedTuneModale',
  'src/hooks/useSiege*',
  'src/lib/reco*',
  'src/lib/ownedBuilds',
  'src/lib/siegeStatut',
];
const MOTIFS_COMPTE = [
  'src/pages/AccountPage',
  'src/components/account/',
  'src/lib/accountStore',
  'src/lib/accountViews',
  'src/lib/runeSort',
  'src/lib/runeOptim',
  'src/lib/monsterSort',
  'src/lib/crafts',
];
const MOTIFS_OUTILS = ['src/pages/OutilsPage', 'src/components/outils/'];
// Les destinations « Nouveautés » et « Accueil » lisent le même journal.
const MOTIF_RELEASES = 'src/data/releases';

// « Dégâts réels » existe deux fois une fois un monstre choisi : objectif de
// recherche et critère des artéfacts. Le bouton d'aide « Objectif de
// recherche » sert de repère au premier.
const OBJECTIF_DEGATS_REELS: Cible = {
  role: 'button',
  nom: 'Dégâts réels',
  pres: { role: 'button', nom: 'Objectif de recherche' },
};

export const ECRANS: Ecran[] = [
  {
    id: 'accueil',
    libelle: 'Accueil',
    hash: '#/',
    motifs: ['src/pages/HomePage', 'src/components/ElementIcon', MOTIF_RELEASES],
    etats: [DEFAUT],
  },
  {
    id: 'optimizer',
    libelle: 'Optimizer',
    hash: '#/outils/optimizer',
    alias: ['#/outils'],
    motifs: [
      ...MOTIFS_OUTILS,
      'src/lib/runeBuildOptim',
      'src/workers/',
      'src/hooks/useOptimizer*',
      'src/hooks/useBuildOptimSearch',
    ],
    etats: [
      DEFAUT,
      {
        id: 'reglages-avances',
        libelle: 'réglages avancés ouverts',
        // Au téléphone, « Réglages avancés » vit dans le panneau « Options de
        // recherche », ouvert par le bouton de la barre d'onglets ; à
        // l'ordinateur, c'est une carte repliée qui s'ouvre d'un clic.
        preparation: {
          telephone: [{ cliquer: { role: 'button', nom: 'Filtres et actions de la page' } }],
          ordinateur: [{ cliquer: { role: 'button', nom: 'Réglages avancés' } }],
        },
        atteint: {
          telephone: [{ role: 'dialog', nom: 'Options de recherche' }],
          ordinateur: [{ role: 'button', nom: 'Réglages avancés', etendu: true }],
        },
      },
      {
        id: 'degats-reels',
        libelle: 'modale « Dégâts réels » ouverte',
        // Choisir l'objectif « Dégâts réels » ouvre la fenêtre du combat
        // (OptimizerSection.tsx, `setSetupOuvert(true)`). Sans monstre
        // choisi, elle ne dit que « aucun sort calculable ».
        preparation: [{ cliquer: OBJECTIF_DEGATS_REELS }],
        atteint: [{ role: 'dialog', nom: 'Dégâts réels' }],
      },
      {
        id: 'degats-reels-rempli',
        libelle: 'modale « Dégâts réels » remplie (Cassie)',
        // Cassie est le monstre du compte d'exemple qui a des sorts ; la
        // fenêtre montre alors le sort, l'adversaire et le critique.
        preparation: [
          { saisir: { role: 'combobox', nom: 'Rechercher un monstre…' }, texte: 'Cassie' },
          { cliquer: { role: 'option', nom: 'Cassie dark Cassie' } },
          { cliquer: OBJECTIF_DEGATS_REELS },
        ],
        // « Non critique » n'existe que dans la fenêtre remplie (choix du
        // traitement du critique) : sans sort, elle n'en a pas.
        atteint: [
          { role: 'dialog', nom: 'Dégâts réels' },
          { role: 'button', nom: 'Non critique' },
        ],
      },
    ],
  },
  ouverture('speed-tuning', 'Speed tuning', '#/outils/speed-tuning', [
    ...MOTIFS_OUTILS,
    'src/lib/speedTune*',
    'src/hooks/useSpeedTune',
  ]),
  ouverture('rta', 'RTA — Ma prépa', '#/rta', MOTIFS_RTA),
  ouverture('rta-ami', 'RTA — Ami', '#/rta/ami', MOTIFS_RTA),
  ouverture('siege-defense', 'Siège — Défense', '#/siege/defense', MOTIFS_SIEGE, ['#/siege']),
  ouverture('siege-offense', 'Siège — Offense', '#/siege/offense', MOTIFS_SIEGE),
  ouverture('siege-recommandations', 'Siège — Recommandations', '#/siege/recommandations', MOTIFS_SIEGE),
  ouverture('compte-monstres', 'Mon compte — Monstres, Ma box', '#/compte/monstres/liste', MOTIFS_COMPTE, [
    '#/compte',
    '#/compte/monstres',
  ]),
  ouverture('compte-runes-resume', 'Mon compte — Runes, Résumé', '#/compte/runes/resume', MOTIFS_COMPTE, ['#/compte/runes']),
  ouverture('compte-runes-liste', 'Mon compte — Runes, Liste', '#/compte/runes/liste', MOTIFS_COMPTE),
  ouverture('compte-runes-courbes', 'Mon compte — Runes, Courbes', '#/compte/runes/courbes', MOTIFS_COMPTE),
  ouverture('compte-runes-comparaison', 'Mon compte — Runes, Comparaison', '#/compte/runes/comparaison', MOTIFS_COMPTE),
  ouverture('compte-runes-optimisation', 'Mon compte — Runes, Optimisation', '#/compte/runes/optimisation', MOTIFS_COMPTE),
  ouverture('compte-runes-meules', 'Mon compte — Runes, Meules', '#/compte/runes/meules', MOTIFS_COMPTE),
  ouverture('compte-runes-gemmes', 'Mon compte — Runes, Gemmes', '#/compte/runes/gemmes', MOTIFS_COMPTE),
  ouverture('compte-artefacts-resume', 'Mon compte — Artéfacts, Résumé', '#/compte/artefacts/resume', MOTIFS_COMPTE, [
    '#/compte/artefacts',
  ]),
  ouverture('compte-artefacts-liste', 'Mon compte — Artéfacts, Liste', '#/compte/artefacts/liste', MOTIFS_COMPTE),
  ouverture('bestiaire', 'Bestiaire', '#/bestiary', [
    'src/pages/BestiaryPage',
    'src/components/MonsterGrid',
    'src/components/FilterBar',
    'src/components/SearchBar',
    'src/components/MonsterDetailDialog',
    'src/components/account/Pager',
  ]),
  ouverture('mecaniques', 'Mécaniques', '#/mecaniques', ['src/pages/MechanicsPage']),
  ouverture('nouveautes', 'Nouveautés', '#/releases', ['src/pages/ReleasesPage', MOTIF_RELEASES]),
  ouverture('telecharger', 'Télécharger (site seulement)', '#/telecharger', [
    'src/pages/TelechargerPage',
    'src/lib/bureau',
    'src/components/IconesSystemes',
  ]),
  ouverture('parametres', 'Paramètres', '#/parametres', [
    'src/pages/SettingsPage',
    'src/components/SettingsMenu',
    'src/components/AccountImportControl',
  ]),
  ouverture('arene', 'Arène', '#/arene', ['src/pages/ComingSoon']),
];

/** La suite d'étapes d'un état pour un format, ou son motif de non-exercice. */
export function preparationPour(etat: Etat, format: Format): Etape[] | NonExerce {
  return Array.isArray(etat.preparation) ? etat.preparation : etat.preparation[format];
}

/** La postcondition d'un état pour un format. */
export function atteintPour(etat: Etat, format: Format): Cible[] {
  return Array.isArray(etat.atteint) ? etat.atteint : etat.atteint[format];
}
