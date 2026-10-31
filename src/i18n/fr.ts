// Les textes de l'interface en FRANÇAIS — la langue SOURCE.
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
//
// ⚠️ **Sa forme fait le type `Dictionnaire`** : chaque autre langue doit avoir
// exactement les mêmes clés (`tsc` refuse une clé absente ou de trop). Un texte
// qui dépend d'une valeur s'écrit comme une fonction, et sa signature est
// imposée aux autres langues de la même façon.
//
// ⚠️ Un texte s'écrit ICI, jamais en dur dans un composant : la règle locale
// d'ESLint `swblacksmith/texte-en-dur` le refuse dans les fichiers migrés.
//
// ⚠️ **Les libellés du jeu sont ceux du jeu dans la langue de l'entrée**, jamais
// une traduction faite par nous.

export const fr = {
  langue: {
    titre: 'Langue',
    auto: 'Auto',
    autoNavigateur: 'Suit la langue de ton navigateur',
    autoSysteme: 'Suit la langue de ton système',
  },

  theme: {
    auto: 'Auto',
    autoNavigateur: 'Suit le thème de ton navigateur',
    autoSysteme: 'Suit le thème de ton système',
    clair: 'Clair',
    clairAide: 'Atelier — fond clair, encre chaude',
    sombre: 'Sombre',
    sombreAide: 'Forge — fond profond, accent braise',
  },

  mesure: {
    efficience: 'Efficience',
    efficienceAide: 'Efficience communautaire (principale incluse, /2,8)',
    score: 'Score SW',
    scoreAide: 'Score affiché dans le jeu (stats secondaires uniquement)',
  },

  // Les destinations de la navigation : barre latérale, onglets du bas, panneau
  // mobile, barre du haut, palette. ⚠️ Des CHAÎNES seulement : les constantes de
  // navigation y pointent par leur clé (`texte`).
  navigation: {
    accueil: 'Accueil',
    rta: 'RTA',
    siege: 'Siège',
    arene: 'Arène',
    prepa: 'Ma prépa',
    ami: 'Ami',
    monstres: 'Monstres',
    runes: 'Runes',
    artefacts: 'Artéfacts',
    optimizer: 'Optimizer',
    speedTuning: 'Speed tuning',
    defense: 'Défense',
    offense: 'Offense',
    recommandations: 'Recommandations',
    bestiaire: 'Bestiaire',
    mecaniques: 'Mécaniques',
    nouveautes: 'Nouveautés',
    telecharger: 'Télécharger',
    parametres: 'Paramètres',
    jouer: 'Jouer',
    monCompte: 'Mon compte',
    compte: 'Compte',
    outils: 'Outils',
    ressources: 'Ressources',
    bientot: 'Bientôt',
    // Les vues des inventaires du compte.
    maBox: 'Ma box',
    resume: 'Résumé',
    liste: 'Liste',
    courbes: 'Courbes',
    comparaison: 'Comparaison',
    optimisation: 'Optimisation',
    meules: 'Meules',
    gemmes: 'Gemmes',
  },

  // La mention du volet qui affiche une page, en écran partagé.
  volet: {
    droite: 'à droite',
    gauche: 'à gauche',
    verrouille: 'verrouillé',
  },

  ecranPartage: {
    volet: (actif: boolean, page: string) => `Volet ${actif ? 'actif' : 'inactif'} : ${page}`,
    filAriane: "Fil d'Ariane du volet",
    verrouille: 'Verrouillé',
    options: 'Options',
    optionsAide: 'Les actions de la page, rangées comme au téléphone dans ce volet étroit',
    deverrouiller: 'Déverrouiller ce volet',
    unSeulVerrou: 'Un seul volet verrouillé à la fois',
    verrouiller: 'Verrouiller ce volet : sa page ne changera plus en naviguant',
    inverser: 'Inverser les volets',
    deverrouillerPourFermer: 'Déverrouiller pour fermer',
    fermer: 'Fermer ce volet',
    nouveauVolet: 'Nouveau volet',
    ouvrirPage: 'Ouvrir une page dans ce volet',
    rechercherPage: 'Rechercher une page…',
    rechercherPageAide: "Essaie le nom d'une page : RTA, Siège, Runes…",
  },

  barreHaut: {
    filAriane: "Fil d'Ariane",
    ecranPartage: 'Écran partagé',
    revenirUnePage: 'Revenir à une seule page',
    ouvrirSecondePage: 'Ouvrir une seconde page à côté',
    fenetreEtroite: 'Fenêtre trop étroite pour deux pages : agrandis-la ou replie la barre latérale',
    sauvegarder: 'Sauvegarder',
    sauvegarderDans: (fichier: string) => `Sauvegarder dans ${fichier} (Ctrl+S)`,
    sauvegarderFichier: 'Sauvegarder la session dans un fichier (Ctrl+S)',
    sauvegarderSous: 'Sauvegarder sous…',
    sauvegarderSousAide:
      'Enregistrer la session dans un autre fichier, qui devient la session en cours (l’ancien n’est plus modifié)',
    sauvegarderSession: 'Sauvegarder la session (Ctrl+S)',
    deconnexion: 'Se déconnecter',
    deconnexionAide: 'Effacer mes données de cet appareil',
    rechercher: 'Rechercher',
    rechercherAide: 'Rechercher une page, un monstre, une action',
    parametres: 'Paramètres',
    fermerParametres: 'Fermer les paramètres',
  },

  onglets: {
    navigationPrincipale: 'Navigation principale',
    actionsPage: 'Filtres et actions de la page',
    options: 'Options',
  },

  barreLaterale: {
    ouvrirACote: (page: string) => `Ouvrir « ${page} » à côté`,
    deplier: 'Déplier la navigation',
    replier: 'Replier la navigation',
    rechercherPage: 'Rechercher une page',
    rechercherPageAide: 'Rechercher une page (⌘K)',
    allerA: 'Aller à…',
    raccourci: 'Ctrl K',
  },

  panneauNavigation: {
    vuesDe: (groupe: string) => `Vues de ${groupe}`,
    sectionsDe: (section: string) => `Sections de ${section}`,
  },

  carteCompte: {
    aucunCompte: 'Aucun compte',
    exportDu: (date: string) => `Export du ${date}`,
    monstres: (n: number) => `${n} monstres`,
    importerExport: 'Importer un export SWEX',
    importerCompte: 'Importer un compte',
    importerAide: "Importer un export de compte SWEX (traité localement, rien n'est envoyé)",
    changerCompte: 'Changer de compte',
    importerFichier: 'Importer un fichier…',
  },

  palette: {
    titre: 'Rechercher',
    invite: 'Rechercher une page, un monstre, une action…',
    aide: "Essaie un nom de monstre, de page ou d'action.",
    echap: 'Échap',
    resultats: 'Résultats',
    aucunResultat: (saisie: string) => `Aucun résultat pour « ${saisie} »`,
    pages: 'Pages',
    monstres: 'Monstres',
    actions: 'Actions',
    fiche: 'Fiche',
    speedTuning: (noms: string) => `Speed tuning · ${noms}`,
    equipeDefense: (rang: number) => `Défense · équipe ${rang}`,
    equipeOffense: (rang: number) => `Offense · équipe ${rang}`,
    importerCompte: 'Importer mon compte',
    sauvegarderSession: 'Sauvegarder la session',
    sauvegarderSessionAide: 'Tout l’état de l’app dans un fichier',
    sauvegarderSous: 'Sauvegarder sous…',
    sauvegarderSousAide: 'Un autre fichier, qui devient la session en cours',
    theme: (theme: string) => `Thème ${theme.toLowerCase()}`,
    langue: (langue: string) => `Langue : ${langue}`,
    creerRecommandation: 'Créer une recommandation',
    mesure: (mesure: string) => `Mesure : ${mesure}`,
  },

  parametres: {
    titre: 'Paramètres',
    intro: "Ces réglages valent pour toute l'application et restent sur cet appareil.",
    compteCharge: 'Compte chargé',
    compte: 'Compte',
    aucunCompte: 'Aucun compte chargé',
    blocReglages: 'Réglages',
    blocDonnees: 'Mes données',
    blocApplication: 'Application',
    toutVoir: 'Tout voir',
    theme: 'Thème',
    score: 'Score',
    resultatsOptimizer: "Résultats de l'Optimizer",
    resultatsOptimizerAide:
      "Au bureau seulement. En tableau, l'Optimizer regroupe ses réglages pour lui laisser la place ; trop étroit malgré tout, il affiche les cartes.",
    cartes: 'Cartes',
    tableau: 'Tableau',
    buildsRapides: 'Builds les plus rapides',
    choisir: 'Choisir…',
    buildsRapidesAide: 'Choisir les combinaisons de sets et le nombre de builds',
    resumeBuildsRapides: (combinaisons: number, builds: number) =>
      `${combinaisons} combinaison${combinaisons > 1 ? 's' : ''} · ${builds} build${builds > 1 ? 's' : ''} par combinaison, au Résumé des runes.`,
    overcap: 'Overcap Taux Crit/RES/Précision',
    overcapAide:
      "Ces trois stats sont plafonnées à 100 % dans le jeu. Désactivé, leur TOTAL affiché s'arrête à 100 % même si la somme brute des runes dépasse — la donnée elle-même n'est jamais tronquée, seul l'affichage change.",
    overcapInterrupteur: 'Afficher le total au-delà de 100 % pour Taux Crit, RES et Précision',
    adversaire: 'Adversaire de référence (speed tuning)',
    adversaireAide:
      "À chaque analyse, l'outil pose en face une copie de ton monstre le plus rapide — même lead, même vitesse de runes, même set, même passif. On tune alors contre soi-même : « est-ce que toute mon équipe joue avant un monstre aussi rapide que mon plus rapide ? » Sans ce réglage, il n'est posé que si personne n'est en face.",
    adversaireInterrupteur: 'Toujours ajouter en face mon monstre le plus rapide',
    garder: 'Garder mes données',
    garderAideNavigateur:
      'Recommandé : sans ça, tout est perdu en fermant l’onglet — prépa RTA, équipes de siège, recommandations et compte. Tout reste dans ton navigateur, sur cet appareil : à éviter sur un ordinateur partagé.',
    garderAideBureau:
      'Recommandé : sans ça, tout est perdu en fermant l’application — prépa RTA, équipes de siège, recommandations et compte. Tout reste sur cette machine : à éviter sur un ordinateur partagé.',
    garderIndisponible:
      "Ton navigateur n'autorise pas le stockage (navigation privée ?). L'import reste valable le temps de la session.",
    garderInterrupteur: 'Garder mes données sur cet appareil',
    session: 'Session',
    sessionAide:
      'Tout l’état de l’app dans un fichier, enregistré où tu veux : le compte, ton travail, les réglages et l’état des outils.',
    sauvegarder: 'Sauvegarder',
    sauvegarderAide: 'Sauvegarder la session dans un fichier',
    dossier: 'Dossier SW Blacksmith',
    dossierVide: 'Choisis le dossier de SW Blacksmith : les sessions s’enregistrent dans son sous-dossier « sessions ».',
    retirer: 'Retirer',
    retirerAide: 'Ne plus utiliser ce dossier : la prochaine session le redemandera',
    mesDonnees: 'Mes données',
    toutSupprimer: 'Tout supprimer',
    toutSupprimerAide:
      'Efface la prépa RTA, les équipes de siège, les recommandations, les monstres perso et le compte importé',
  },

  // La date de l'export chargé, sous « Garder mes données ».
  fraicheur: {
    exporteLe: (date: string) => `Compte exporté le ${date}`,
    rappel: 'réexporte ton compte',
    rappelSuite: ' pour des chiffres à jour.',
  },
};

export type Dictionnaire = typeof fr;
