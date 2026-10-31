// Les textes de l'interface en ANGLAIS. La forme est imposée par `fr.ts`
// (type `Dictionnaire`) : une clé qui manque ou qui est de trop ne compile pas.
//
// ⚠️ Les libellés du jeu sont ceux du client ANGLAIS du jeu, jamais une
// traduction des libellés français.

import type { Dictionnaire } from './fr';

export const en: Dictionnaire = {
  langue: {
    titre: 'Language',
    auto: 'Auto',
    autoNavigateur: 'Follows your browser language',
    autoSysteme: 'Follows your system language',
  },

  theme: {
    auto: 'Auto',
    autoNavigateur: 'Follows your browser theme',
    autoSysteme: 'Follows your system theme',
    clair: 'Light',
    clairAide: 'Atelier — light background, warm ink',
    sombre: 'Dark',
    sombreAide: 'Forge — deep background, ember accent',
  },

  mesure: {
    efficience: 'Efficiency',
    efficienceAide: 'Community efficiency (main stat included, /2.8)',
    score: 'SW score',
    scoreAide: 'Score shown in the game (substats only)',
  },

  navigation: {
    accueil: 'Home',
    rta: 'RTA',
    siege: 'Siege',
    arene: 'Arena',
    prepa: 'My prep',
    ami: 'Friend',
    monstres: 'Monsters',
    runes: 'Runes',
    artefacts: 'Artifacts',
    optimizer: 'Optimizer',
    speedTuning: 'Speed tuning',
    defense: 'Defense',
    offense: 'Offense',
    recommandations: 'Recommendations',
    bestiaire: 'Bestiary',
    mecaniques: 'Mechanics',
    nouveautes: "What's new",
    telecharger: 'Download',
    parametres: 'Settings',
    jouer: 'Play',
    monCompte: 'My account',
    compte: 'Account',
    outils: 'Tools',
    ressources: 'Resources',
    bientot: 'Soon',
    maBox: 'My box',
    resume: 'Summary',
    liste: 'List',
    courbes: 'Curves',
    comparaison: 'Comparison',
    optimisation: 'Optimization',
    meules: 'Grindstones',
    gemmes: 'Gems',
  },

  volet: {
    droite: 'on the right',
    gauche: 'on the left',
    verrouille: 'locked',
  },

  ecranPartage: {
    volet: (actif: boolean, page: string) => `${actif ? 'Active' : 'Inactive'} pane: ${page}`,
    filAriane: 'Pane breadcrumb',
    verrouille: 'Locked',
    options: 'Options',
    optionsAide: 'The page actions, arranged as on a phone in this narrow pane',
    deverrouiller: 'Unlock this pane',
    unSeulVerrou: 'Only one pane can be locked at a time',
    verrouiller: 'Lock this pane: its page will no longer change as you navigate',
    inverser: 'Swap the panes',
    deverrouillerPourFermer: 'Unlock to close',
    fermer: 'Close this pane',
    nouveauVolet: 'New pane',
    ouvrirPage: 'Open a page in this pane',
    rechercherPage: 'Search for a page…',
    rechercherPageAide: 'Try a page name: RTA, Siege, Runes…',
  },

  barreHaut: {
    filAriane: 'Breadcrumb',
    ecranPartage: 'Split screen',
    revenirUnePage: 'Back to a single page',
    ouvrirSecondePage: 'Open a second page alongside',
    fenetreEtroite: 'Window too narrow for two pages: enlarge it or collapse the sidebar',
    sauvegarder: 'Save',
    sauvegarderDans: (fichier: string) => `Save to ${fichier} (Ctrl+S)`,
    sauvegarderFichier: 'Save the session to a file (Ctrl+S)',
    sauvegarderSous: 'Save as…',
    sauvegarderSousAide:
      'Save the session to another file, which becomes the current session (the previous one is no longer changed)',
    sauvegarderSession: 'Save the session (Ctrl+S)',
    deconnexion: 'Sign out',
    deconnexionAide: 'Erase my data from this device',
    rechercher: 'Search',
    rechercherAide: 'Search for a page, a monster, an action',
    parametres: 'Settings',
    fermerParametres: 'Close settings',
  },

  onglets: {
    navigationPrincipale: 'Main navigation',
    actionsPage: 'Page filters and actions',
    options: 'Options',
  },

  barreLaterale: {
    ouvrirACote: (page: string) => `Open “${page}” alongside`,
    deplier: 'Expand the navigation',
    replier: 'Collapse the navigation',
    rechercherPage: 'Search for a page',
    rechercherPageAide: 'Search for a page (⌘K)',
    allerA: 'Go to…',
    raccourci: 'Ctrl K',
  },

  panneauNavigation: {
    vuesDe: (groupe: string) => `${groupe} views`,
    sectionsDe: (section: string) => `${section} sections`,
  },

  carteCompte: {
    aucunCompte: 'No account',
    exportDu: (date: string) => `Exported ${date}`,
    monstres: (n: number) => `${n} monsters`,
    importerExport: 'Import a SWEX export',
    importerCompte: 'Import an account',
    importerAide: 'Import a SWEX account export (processed locally, nothing is sent)',
    changerCompte: 'Switch account',
    importerFichier: 'Import a file…',
  },

  palette: {
    titre: 'Search',
    invite: 'Search for a page, a monster, an action…',
    aide: 'Try a monster, page or action name.',
    echap: 'Esc',
    resultats: 'Results',
    aucunResultat: (saisie: string) => `No results for “${saisie}”`,
    pages: 'Pages',
    monstres: 'Monsters',
    actions: 'Actions',
    fiche: 'Profile',
    speedTuning: (noms: string) => `Speed tuning · ${noms}`,
    equipeDefense: (rang: number) => `Defense · team ${rang}`,
    equipeOffense: (rang: number) => `Offense · team ${rang}`,
    importerCompte: 'Import my account',
    sauvegarderSession: 'Save the session',
    sauvegarderSessionAide: 'The whole app state in a file',
    sauvegarderSous: 'Save as…',
    sauvegarderSousAide: 'Another file, which becomes the current session',
    theme: (theme: string) => `${theme} theme`,
    langue: (langue: string) => `Language: ${langue}`,
    creerRecommandation: 'Create a recommendation',
    mesure: (mesure: string) => `Measure: ${mesure}`,
  },

  parametres: {
    titre: 'Settings',
    intro: 'These settings apply to the whole app and stay on this device.',
    compteCharge: 'Loaded account',
    compte: 'Account',
    aucunCompte: 'No account loaded',
    blocReglages: 'Settings',
    blocDonnees: 'My data',
    blocApplication: 'Application',
    toutVoir: 'See all',
    theme: 'Theme',
    score: 'Score',
    resultatsOptimizer: 'Optimizer results',
    resultatsOptimizerAide:
      'Desktop only. As a table, the Optimizer groups its settings to make room for it; if it is still too narrow, it shows cards.',
    cartes: 'Cards',
    tableau: 'Table',
    buildsRapides: 'Fastest builds',
    choisir: 'Choose…',
    buildsRapidesAide: 'Choose the set combinations and the number of builds',
    resumeBuildsRapides: (combinaisons: number, builds: number) =>
      `${combinaisons} combination${combinaisons > 1 ? 's' : ''} · ${builds} build${builds > 1 ? 's' : ''} per combination, in the runes Summary.`,
    overcap: 'CRI Rate/RES/ACC overcap',
    overcapAide:
      'These three stats are capped at 100% in the game. When off, their displayed TOTAL stops at 100% even if the raw sum of the runes goes beyond — the data itself is never truncated, only the display changes.',
    overcapInterrupteur: 'Show the total beyond 100% for CRI Rate, RES and ACC',
    adversaire: 'Reference opponent (speed tuning)',
    adversaireAide:
      'On every analysis, the tool places a copy of your fastest monster on the other side — same lead, same rune speed, same set, same passive. You then tune against yourself: “does my whole team move before a monster as fast as my fastest?” Without this setting, it is only placed when nobody is on the other side.',
    adversaireInterrupteur: 'Always add my fastest monster on the other side',
    garder: 'Keep my data',
    garderAideNavigateur:
      'Recommended: without it, everything is lost when you close the tab — RTA prep, siege teams, recommendations and account. Everything stays in your browser, on this device: avoid it on a shared computer.',
    garderAideBureau:
      'Recommended: without it, everything is lost when you close the application — RTA prep, siege teams, recommendations and account. Everything stays on this machine: avoid it on a shared computer.',
    garderIndisponible:
      'Your browser does not allow storage (private browsing?). The import stays valid for the session.',
    garderInterrupteur: 'Keep my data on this device',
    session: 'Session',
    sessionAide:
      'The whole app state in a file, saved wherever you want: the account, your work, the settings and the state of the tools.',
    sauvegarder: 'Save',
    sauvegarderAide: 'Save the session to a file',
    dossier: 'SW Blacksmith folder',
    dossierVide: 'Choose the SW Blacksmith folder: sessions are saved in its “sessions” subfolder.',
    retirer: 'Remove',
    retirerAide: 'Stop using this folder: the next session will ask for it again',
    mesDonnees: 'My data',
    toutSupprimer: 'Delete everything',
    toutSupprimerAide:
      'Erases the RTA prep, the siege teams, the recommendations, the custom monsters and the imported account',
  },

  fraicheur: {
    exporteLe: (date: string) => `Account exported on ${date}`,
    rappel: 'export your account again',
    rappelSuite: ' for up-to-date numbers.',
  },
};
