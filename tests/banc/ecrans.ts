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

// Les deux formats de premier rang (docs/04-decisions/adr/deux-formats-de-premier-rang.md). Le téléphone est tactile :
// les variantes `coarse:`, `compact:`, `no-hover:` et `hoverable:` de l'app
// dépendent du pointeur, pas de la largeur (tailwind.config.js).
export const FORMATS: Record<Format, DefinitionFormat> = {
  telephone: { libelle: 'téléphone', largeur: 360, hauteur: 800, tactile: true },
  ordinateur: { libelle: 'ordinateur', largeur: 1400, hauteur: 1000, tactile: false },
};

export const ORDRE_FORMATS: Format[] = ['telephone', 'ordinateur'];

/** Une taille de fenêtre ; le format continue de décider du pointeur et des étapes. */
export interface Taille extends DefinitionFormat {
  id: string;
  format: Format;
  preparation?: Etape[];
  optimizer?: {
    agencement: 'A1' | 'A2' | 'A3';
    conteneur: [number, number];
    fiche: 'repliee' | 'depliee';
    colonnes: 'page' | 'superposees' | 'une-inseree' | 'deux-inserees';
    set?: 'compact' | 'deplie';
    volet?: true;
  };
}

export const TAILLES_PAR_DEFAUT: Taille[] = ORDRE_FORMATS.map((format) => ({ id: format, format, ...FORMATS[format] }));

/**
 * Rôles ARIA qu'une étape peut viser, ou `texte` : un élément dont le texte est
 * exactement `nom` (ce que le contenu montre sans rôle : ligne d'artéfact, note).
 */
export type Role = 'button' | 'dialog' | 'switch' | 'tab' | 'link' | 'heading' | 'combobox' | 'option' | 'textbox' | 'texte' | 'repere';

/**
 * Un élément visé par son rôle et son nom accessible, comme Playwright
 * `getByRole`. Le nom est comparé EXACTEMENT. Une cible doit désigner un seul
 * élément visible : zéro ou plusieurs, et l'état est déclaré non atteint,
 * plutôt que de cliquer le premier venu.
 */
export interface Cible {
  role: Role;
  /** Pour `repere`, sélecteur CSS des attributs de repérage de l'app. */
  nom: string;
  /** Contenant CSS unique et visible : une option de la liste ouverte, par exemple. */
  dans?: string;
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
  /** Cliquer la cible ; avec `siPresse`, seulement dans cet état aria-pressed. */
  | { cliquer: Cible; siPresse?: boolean }
  /** Remplacer le texte d'un champ. */
  | { saisir: Cible; texte: string }
  /** Faire défiler jusqu'à la cible pour que la capture montre ce qui est mesuré. */
  | { montrer: Cible }
  /**
   * Charger un fichier par le bouton d'import de l'interface (sélecteur de
   * fichier de la page). `fichier` est un nom de `tests/fixtures/`. Un import
   * que l'app refuse rend l'état non atteint, avec la cause. `confirme`
   * remplace le compte rendu générique par une postcondition propre au fichier.
   */
  | { importer: Cible; fichier: string; confirme?: Cible }
  /** Attendre que la cible soit visible (bornée). */
  | { attendre: Cible; delaiMs?: number };

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
  /** Restriction explicite à certaines tailles, sans multiplier les écrans. */
  tailles?: string[];
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
  tailles?: Taille[];
  etats: Etat[];
}

export function taillesPour(ecran: Ecran): Taille[] {
  return ecran.tailles ?? TAILLES_PAR_DEFAUT;
}

const DEFAUT: Etat = { id: 'defaut', libelle: 'à l’ouverture', preparation: [], atteint: [] };

/**
 * Motifs qui sélectionnent TOUS les écrans : la librairie d'interface, la
 * feuille de style, la configuration Tailwind et le coquillage (App, barres
 * et panneaux de navigation, palette) enveloppent chaque page.
 */
export const MOTIFS_TOUS: string[] = [
  'src/ui/',
  'src/index.css',
  'tailwind.config.js',
  'src/App',
  'src/components/Sidebar',
  'src/components/TopBar',
  'src/components/MobileTabs',
  'src/components/MobileNavSheet',
  'src/components/Palette',
  'src/components/palette/',
];

/** Écran sans état préparé : l'état unique « à l'ouverture ». */
function ouverture(id: string, libelle: string, hash: string, motifs: string[], alias?: string[]): Ecran {
  return { id, libelle, hash, ...(alias ? { alias } : {}), motifs, etats: [DEFAUT] };
}

// Motifs communs à plusieurs écrans (docs/01-presentation/02-architecture.md
// § Par écran : une page, un dossier de composants et des hooks pour
// plusieurs routes).
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

const repere = (nom: string): Cible => ({ role: 'repere', nom });
const bouton = (nom: string): Cible => ({ role: 'button', nom });
// Le titre d'aide « Artéfacts et relique » porte aussi un bouton : les
// onglets se repèrent par leur rangée, sans dépendre de l'ordre du DOM.
const onglet = (nom: string): Cible => ({ ...bouton(nom), pres: repere('[data-zone="onglets"]') });
const OPT_LISTE: Etape[] = [
  { cliquer: bouton('Aucune liste — choisir ou créer') },
  { cliquer: bouton('Nouvelle liste…') },
  { saisir: { role: 'textbox', nom: 'Nom de la liste' }, texte: 'Banc Optimizer' },
  { cliquer: { role: 'combobox', nom: 'Contenu de la liste' } },
  { cliquer: { role: 'option', nom: 'Arène', dans: '[role="listbox"][aria-label="Contenu de la liste"]' } },
  { cliquer: bouton('Créer') },
  { saisir: { role: 'combobox', nom: 'Rechercher un monstre…' }, texte: 'Vanessa' },
  { cliquer: { role: 'option', nom: 'Vanessa fire Vanessa' } },
  { saisir: { role: 'combobox', nom: 'Rechercher un monstre…' }, texte: 'Cassie' },
  { cliquer: { role: 'option', nom: 'Cassie dark Cassie' } },
];
const OPT_MEMBRES = [repere('[data-membre-optimizer="13812"]'), repere('[data-membre-optimizer="19315"]')];
const OPT_IMPORT: Etape = {
  importer: bouton('Importer les paramètres de recherche'), fichier: 'optimizer-banc-recette.json',
  confirme: { role: 'texte', nom: 'Réglages importés pour Cassie — monstre sélectionné automatiquement.' },
};
// Les panneaux superposés peuvent couvrir l'import et la recherche : on les
// ferme par leurs onglets avant ces gestes, puis l'état mesuré les rouvre.
const OPT_FERMER: Etape[] = ['Artéfacts et relique', 'Aura, exclusion, avancés'].map((nom) => ({ cliquer: onglet(nom), siPresse: true }));
const OPT_RESULTATS: Etape[] = [
  ...OPT_LISTE, ...OPT_FERMER, OPT_IMPORT,
  { cliquer: bouton('Rechercher') },
  { attendre: repere('[data-carte-resultat]:nth-child(2)'), delaiMs: 30000 },
  { attendre: bouton('Rechercher'), delaiMs: 30000 },
  { montrer: repere('[data-carte-resultat]:first-child') },
];
const OPT_CARTES = [...OPT_MEMBRES, repere('[data-carte-resultat]:first-child'), repere('[data-carte-resultat]:nth-child(2)')];

function tailleOptimizer(id: string, largeur: number, hauteur: number, optimizer: Taille['optimizer']): Taille {
  return {
    id, libelle: `${largeur}×${hauteur}${optimizer?.volet ? ' volet' : ''}`, format: 'ordinateur',
    largeur, hauteur, tactile: false, optimizer,
    ...(optimizer?.volet ? { preparation: [{ cliquer: bouton('Écran partagé') }] } : {}),
  };
}

// La navigation reste dépliée (248 px). Les intervalles portent sur le
// CONTENEUR mesuré, pas la fenêtre ; le volet est ouvert à parts égales.
export const TAILLES_OPTIMIZER: Taille[] = [
  TAILLES_PAR_DEFAUT[0],
  tailleOptimizer('bureau-a1', 1120, 800, { agencement: 'A1', conteneur: [728, 904], fiche: 'depliee', colonnes: 'page', set: 'compact' }),
  tailleOptimizer('bureau-a2', 1200, 900, { agencement: 'A2', conteneur: [904, 952], fiche: 'depliee', colonnes: 'page', set: 'compact' }),
  tailleOptimizer('ordinateur', 1400, 1000, { agencement: 'A3', conteneur: [952, 1160], fiche: 'repliee', colonnes: 'superposees' }),
  tailleOptimizer('bureau-portable', 1536, 730, { agencement: 'A3', conteneur: [1160, 1496], fiche: 'depliee', colonnes: 'superposees', set: 'compact' }),
  tailleOptimizer('bureau-une-colonne', 1920, 940, { agencement: 'A3', conteneur: [1496, 1832], fiche: 'depliee', colonnes: 'une-inseree' }),
  tailleOptimizer('bureau-deux-colonnes', 2560, 1300, { agencement: 'A3', conteneur: [1832, 3000], fiche: 'depliee', colonnes: 'deux-inserees', set: 'deplie' }),
  tailleOptimizer('volet-a1', 1920, 940, { agencement: 'A1', conteneur: [728, 904], fiche: 'depliee', colonnes: 'page', set: 'compact', volet: true }),
  tailleOptimizer('volet-a2', 2200, 1000, { agencement: 'A2', conteneur: [904, 952], fiche: 'depliee', colonnes: 'page', set: 'compact', volet: true }),
  tailleOptimizer('volet-fiche-repliee', 2560, 1300, { agencement: 'A3', conteneur: [952, 1160], fiche: 'repliee', colonnes: 'superposees', volet: true }),
  tailleOptimizer('volet-fiche-depliee', 2880, 1300, { agencement: 'A3', conteneur: [1160, 1496], fiche: 'depliee', colonnes: 'superposees', volet: true }),
  tailleOptimizer('volet-une-colonne', 3840, 1200, { agencement: 'A3', conteneur: [1496, 1832], fiche: 'depliee', colonnes: 'une-inseree', volet: true }),
  tailleOptimizer('volet-deux-colonnes', 5120, 1440, { agencement: 'A3', conteneur: [1832, 3000], fiche: 'depliee', colonnes: 'deux-inserees', set: 'deplie', volet: true }),
];
const OPT_BUREAU = TAILLES_OPTIMIZER.filter((t) => t.format === 'ordinateur').map((t) => t.id);
const OPT_DEUX = TAILLES_OPTIMIZER.filter((t) => t.optimizer?.colonnes === 'deux-inserees').map((t) => t.id);
const OPT_COMPACTS = TAILLES_OPTIMIZER.filter((t) => t.optimizer?.set === 'compact').map((t) => t.id);

// Écran des recommandations rempli : le fichier synthétique
// `tests/fixtures/recommandations-banc.json` (3 listes, 6 decks), chargé par le
// bouton « Importer » de l'interface. Au téléphone, ce bouton vit dans le
// panneau « Actions — recommandations », que l'import laisse ouvert : on le ferme.
const RECO_FICHIER = 'recommandations-banc.json';
const RECO_LISTES_NOMS = [
  "Défenses de guilde — banc d'affichage",
  "Offenses de siège — banc d'affichage",
  'Idées à tester',
];
const RECO_IMPORT: Etape = { importer: { role: 'button', nom: 'Importer' }, fichier: RECO_FICHIER };
const RECO_OPTIONS: Cible = { role: 'button', nom: 'Filtres et actions de la page' };
const RECO_FERMER_PANNEAU: Etape = {
  cliquer: { role: 'button', nom: 'Fermer', pres: { role: 'heading', nom: 'Actions — recommandations' } },
};
const RECO_IMPORT_TELEPHONE: Etape[] = [{ cliquer: RECO_OPTIONS }, RECO_IMPORT, RECO_FERMER_PANNEAU];
// Chaque liste s'ouvre par son bouton « Consulter », repéré par son titre ; au
// téléphone, le titre lui-même est le bouton.
const RECO_CONSULTER: Record<Format, Etape[]> = {
  ordinateur: RECO_LISTES_NOMS.map((nom) => ({
    cliquer: { role: 'button', nom: 'Consulter', pres: { role: 'heading', nom } },
  })),
  telephone: RECO_LISTES_NOMS.map((nom) => ({ cliquer: { role: 'button', nom } })),
};
// Les listes à plusieurs decks ont « Déplier tous les decks » ; celle d'un seul deck, son chevron.
const RECO_DEPLIER: Etape[] = [
  ...RECO_LISTES_NOMS.slice(0, 2).map((nom): Etape => ({
    cliquer: { role: 'button', nom: 'Déplier tous les decks', pres: { role: 'heading', nom } },
  })),
  { cliquer: { role: 'button', nom: 'Déplier ce deck', pres: { role: 'heading', nom: RECO_LISTES_NOMS[2] } } },
];
const RECO_IMPORTEES: Cible = { role: 'texte', nom: '3 recommandation(s) · 6 deck(s) · 18 monstre(s) importés.' };
const RECO_LISTES: Cible[] = RECO_LISTES_NOMS.map((nom) => ({ role: 'heading', nom }));
// Lignes d'artéfacts propres à un seul deck du fichier.
const RECO_DETAIL: Cible[] = [
  { role: 'texte', nom: 'Dgts de bombe +X%' },
  { role: 'texte', nom: 'Effet aug. VIT +X%' },
];
// Notes de contres propres à une seule défense visée du fichier.
const RECO_CONTRES: Cible[] = [
  { role: 'texte', nom: '— défense de départ, sans bouclier' },
  { role: 'texte', nom: '— défense lente' },
];

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
    tailles: TAILLES_OPTIMIZER,
    motifs: [
      ...MOTIFS_OUTILS,
      'src/lib/runeBuildOptim',
      'src/workers/',
      'src/hooks/useOptimizer*',
      'src/hooks/useBuildOptimSearch',
      'src/lib/optimizerColonnes',
      'tests/fixtures/optimizer-banc-recette',
    ],
    etats: [
      DEFAUT,
      {
        id: 'reglages-avances',
        libelle: 'réglages avancés ouverts',
        // Au téléphone, « Réglages avancés » vit dans le panneau « Options de
        // recherche », ouvert par le bouton de la barre d'onglets ; à
        // l'ordinateur, en ligne dans la colonne repliable « Aura, exclusion,
        // avancés », ouverte par son onglet.
        preparation: {
          telephone: [{ cliquer: { role: 'button', nom: 'Filtres et actions de la page' } }],
          ordinateur: [{ cliquer: { role: 'button', nom: 'Aura, exclusion, avancés' } }],
        },
        atteint: {
          telephone: [{ role: 'dialog', nom: 'Options de recherche' }],
          ordinateur: [{ role: 'switch', nom: "Rechercher jusqu'à épuisement complet" }],
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
        preparation: {
          telephone: [{ cliquer: bouton('Gérer mes listes') }, ...OPT_LISTE, { cliquer: OBJECTIF_DEGATS_REELS }],
          ordinateur: [...OPT_LISTE, ...OPT_FERMER, { cliquer: OBJECTIF_DEGATS_REELS }],
        },
        // « Non critique » n'existe que dans la fenêtre remplie (choix du
        // traitement du critique) : sans sort, elle n'en a pas.
        atteint: [
          { role: 'dialog', nom: 'Dégâts réels' },
          { role: 'button', nom: 'Non critique' },
        ],
      },
      {
        id: 'liste-remplie', libelle: 'liste de travail : Vanessa et Cassie', tailles: OPT_BUREAU,
        preparation: OPT_LISTE, atteint: OPT_MEMBRES,
      },
      {
        id: 'resultats', libelle: 'recherche Rapide terminée, cartes de résultats', tailles: OPT_BUREAU,
        preparation: OPT_RESULTATS, atteint: OPT_CARTES,
      },
      {
        // Le tableau à partir de sa largeur minimale, les cartes en dessous :
        // la ligne de comptes est présente dans les deux formes.
        id: 'resultats-tableau', libelle: 'résultats en tableau (cartes sous la largeur du tableau)', tailles: OPT_BUREAU,
        preparation: [...OPT_RESULTATS, { cliquer: bouton('Tableau') }],
        atteint: [...OPT_MEMBRES, repere('[data-ligne-comptes]'), repere('[data-forme-resultats="tableau"]')],
      },
      {
        id: 'resultats-filtres', libelle: 'résultats, flottant « Filtrer l’affichage » ouvert', tailles: OPT_BUREAU,
        preparation: [...OPT_RESULTATS, { cliquer: bouton("Filtrer l'affichage") }],
        atteint: [...OPT_CARTES, { role: 'dialog', nom: "Filtrer l'affichage" }],
      },
      {
        id: 'artefacts', libelle: 'résultats et colonne Artéfacts et relique ouverte', tailles: OPT_BUREAU,
        preparation: [...OPT_RESULTATS, { cliquer: onglet('Artéfacts et relique'), siPresse: false }],
        atteint: [...OPT_CARTES, repere('[data-colonne="artefacts"]')],
      },
      {
        id: 'complements', libelle: 'résultats et colonne Aura, exclusion, avancés ouverte', tailles: OPT_BUREAU,
        preparation: [...OPT_RESULTATS, { cliquer: onglet('Aura, exclusion, avancés'), siPresse: false }],
        atteint: [...OPT_CARTES, repere('[data-colonne="complements"]'), { role: 'switch', nom: "Rechercher jusqu'à épuisement complet" }],
      },
      {
        id: 'deux-colonnes', libelle: 'résultats et deux colonnes insérées', tailles: OPT_DEUX,
        preparation: [...OPT_RESULTATS, ...['Artéfacts et relique', 'Aura, exclusion, avancés'].map((nom): Etape => ({ cliquer: onglet(nom), siPresse: false }))],
        atteint: [...OPT_CARTES, repere('[data-colonne="artefacts"]'), repere('[data-colonne="complements"]')],
      },
      {
        id: 'set-flottant', libelle: 'liste remplie et coffre du set compact ouvert', tailles: OPT_COMPACTS,
        preparation: [...OPT_LISTE, { cliquer: bouton('Set de runes recherché : Aucun') }],
        atteint: [...OPT_MEMBRES, repere('[data-set-optimizer="compact"] button[aria-expanded="true"]'), { role: 'texte', nom: 'Set principal' }],
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
  {
    id: 'siege-recommandations',
    libelle: 'Siège — Recommandations',
    hash: '#/siege/recommandations',
    motifs: [...MOTIFS_SIEGE, 'tests/fixtures/recommandations-banc'],
    etats: [
      DEFAUT,
      {
        id: 'reco-attaque-repliee',
        libelle: 'recommandations importées, vue Attaque, decks repliés',
        preparation: {
          telephone: [...RECO_IMPORT_TELEPHONE, ...RECO_CONSULTER.telephone],
          ordinateur: [RECO_IMPORT, ...RECO_CONSULTER.ordinateur],
        },
        atteint: [RECO_IMPORTEES, ...RECO_LISTES],
      },
      {
        id: 'reco-attaque',
        libelle: 'recommandations importées, vue Attaque, decks dépliés',
        preparation: {
          telephone: [...RECO_IMPORT_TELEPHONE, ...RECO_CONSULTER.telephone, ...RECO_DEPLIER],
          ordinateur: [RECO_IMPORT, ...RECO_CONSULTER.ordinateur, ...RECO_DEPLIER],
        },
        atteint: [RECO_IMPORTEES, ...RECO_LISTES, ...RECO_DETAIL],
      },
      {
        id: 'reco-defense',
        libelle: 'recommandations importées, vue Défense',
        preparation: {
          telephone: [
            { cliquer: RECO_OPTIONS },
            RECO_IMPORT,
            { cliquer: { role: 'button', nom: 'Défense' } },
            RECO_FERMER_PANNEAU,
            ...RECO_CONSULTER.telephone,
          ],
          ordinateur: [RECO_IMPORT, { cliquer: { role: 'button', nom: 'Défense' } }, ...RECO_CONSULTER.ordinateur],
        },
        atteint: [RECO_IMPORTEES, ...RECO_LISTES, ...RECO_CONTRES],
      },
    ],
  },
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
