// Journal des versions de SW Forge, affiché sur `#/releases`.
//
// ⚠️ **Source de vérité du contenu des releases.** Il est tenu À LA MAIN, et
// non dérivé de l'API GitHub : le site est statique et doit rester lisible hors
// ligne, sans dépendre d'un service tiers ni de ses quotas. Une release = une
// entrée ici, ajoutée dans la branche `forge/<sujet>` (voir README).
//
// La version affichée dans le pied de page vient, elle, de `package.json`
// (`__APP_VERSION__`, injecté par Vite) : les deux doivent rester alignées.

export type ChangeKind = 'feat' | 'fix' | 'docs';

export interface ReleaseChange {
  kind: ChangeKind;
  scope: string; // « Siège », « Mon compte »… en français, comme l'interface
  text: string; // ce que ça change POUR LE JOUEUR, pas le détail technique
}

export interface Release {
  // ⚠️ `null` tant que le numéro n'est PAS DÉCIDÉ. Une version se développe
  // sans savoir si elle sortira en corrective ou en mineure — c'est ce qu'elle
  // contient à la fin qui tranche. Écrire un numéro d'avance oblige à le
  // corriger en route ; `null` dit simplement « pas encore fixé », et la page
  // affiche « En préparation ». Le numéro s'écrit ici au moment de publier.
  version: string | null; // « 1.1.0 »
  date: string; // ISO court, « 2026-08-09 »
  title: string; // résumé en une ligne
  highlights?: string[]; // 1 à 3 points mis en avant
  changes: ReleaseChange[];
  // ⚠️ `false` quand AUCUN tag Git ne correspond : le lien « GitHub ↗ » est
  // alors masqué au lieu de mener à un 404. C'est le cas de la 1.0.0, publiée
  // avant que le dépôt existe. Une version en préparation (`version: null`) n'a
  // pas de tag non plus : le lien est masqué sans avoir à le préciser.
  tag?: boolean;
}

// Ce qu'on affiche à la place du numéro tant qu'il n'est pas tranché.
export const VERSION_EN_PREPARATION = 'En préparation';

// Libellé d'une version pour l'interface : « v1.4.0 », ou « En préparation ».
// ⚠️ Le « v » est porté ICI et non par l'appelant : préfixé en dur, il donnait
// « vEn préparation ».
export function libelleVersion(version: string | null): string {
  return version === null ? VERSION_EN_PREPARATION : `v${version}`;
}

export const CHANGE_META: Record<ChangeKind, { label: string; color: string }> = {
  feat: { label: 'Nouveau', color: 'text-good' },
  fix: { label: 'Correction', color: 'text-warn' },
  docs: { label: 'Doc', color: 'text-ink-dim' },
};

// La plus RÉCENTE en premier — c'est l'ordre d'affichage.
//
// ⚠️ **Style : une phrase courte, lisible par un joueur.** Ce qui change POUR
// LUI, jamais comment c'est fait. Pas de nom de fonction, pas de formule, pas de
// détail d'implémentation — tout ça vit dans les commits et dans `spec/`.
// Si une ligne dépasse ~15 mots, c'est qu'elle raconte l'implémentation.
export const RELEASES: Release[] = [
  {
    version: '1.10.1',
    date: '2026-08-28',
    title: 'Ne travaille que les runes qui jouent',
    highlights: ['Un filtre « Runes utilisées » dans l’optimisation de tes runes'],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Nouveau filtre « Runes utilisées » : n’affiche que les runes posées sur un monstre qui joue.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Tous tes contenus comptent : decks d’arène, de donjons, de ToA, de siège, et tes presets RTA.',
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08-28',
    title: 'Speed tuning : sais qui joue avant qui, tick par tick',
    highlights: [
      'Un nouvel outil de speed tuning, tick par tick',
      'Il lit les kits tout seul : boosts de barre, buffs de vitesse, passifs',
      'Tes decks de siège disent s’ils sont speed tune',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Nouvel outil « Speed tuning » : vois tick par tick qui remplit sa barre d’action en premier.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Importe un deck de siège dans ton équipe ou en face, avec ses runes et ses artéfacts.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'L’analyse dit si toute ton équipe joue avant l’adversaire, et ce qu’il manque de vitesse sinon.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Les kits sont lus pour toi : boosts de barre, buffs de vitesse, tours supplémentaires et passifs.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Range tes monstres dans l’ordre voulu et choisis le sort de chacun : l’outil donne la fenêtre de vitesse de chaque rang.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Sans adversaire en face, l’outil pose une copie de ton monstre le plus rapide comme repère.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Une équipe en Rapidité est jugée sur son speed tune, plus sur ses ticks : verte quand elle passe.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: '« Voir le speed tune » ouvre l’outil par-dessus ton deck, déjà chargé — ferme et tu es revenu.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Le bouton « Vérifier mes speed » remplace « Vérifier mes tick ATB » : il couvre les deux façons de juger une équipe.',
      },
      {
        kind: 'fix',
        scope: 'Speed tuning',
        text: 'L’artéfact « Effet aug. VIT » multiplie le buff de vitesse au lieu de s’y ajouter — les valeurs changent.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'La vitesse affichée sur un deck est exactement celle du speed tune, lead d’élément compris.',
      },
      {
        kind: 'fix',
        scope: 'Speed tuning',
        text: 'Un retrait de barre adverse ne compte jamais dans un speed tune : ton équipe doit passer sans lui.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Un monstre peut jouer plusieurs fois dans l’ordre des sorts, avec un sort par tour.',
      },
      {
        kind: 'feat',
        scope: 'Speed tuning',
        text: 'Un sort qui vise un allié peut se lancer sur soi-même, comme dans le jeu.',
      },
      {
        kind: 'fix',
        scope: 'Speed tuning',
        text: 'Le buff de vitesse posé sur l’allié visé compte enfin : Racuni, Harg, Dova et huit autres.',
      },
      {
        kind: 'fix',
        scope: 'Speed tuning',
        text: 'À force égale, l’analyse retient le sort le plus fort : quatorze monstres changent.',
      },
      {
        kind: 'fix',
        scope: 'Speed tuning',
        text: 'Deux monstres trop lents à la suite ont chacun leur vitesse à atteindre, et elle est exacte.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Un deck dit si un monstre n’a pas toutes ses runes ou tous ses artéfacts.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Quand le résultat dépend de la cible d’un sort, la card ne tranche pas et t’envoie vérifier.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'Le statut d’une équipe se voit aussi en mode clair, pas seulement en sombre.',
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-27',
    title: 'Dégâts réels, et des listes pour préparer toute une équipe',
    highlights: [
      'Nouvel objectif de recherche « Dégâts réels »',
      'Des listes de travail réservent les runes déjà attribuées à un monstre',
      'Recherche et prépare le runage de n’importe quel monstre, possédé ou non',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Nouvel objectif « Dégâts réels » : la vraie formule d’un sort, pas une estimation générique.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Choisis la compétence, les PV et la DEF de l’adversaire, les buffs et la marque.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Coups, zone, ignore défense et bonus de compétence sont lus dans le jeu — rien à saisir.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Chaque résultat affiche ses dégâts et la part des PV de la cible emportée.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Compte les compétences d’invocateur et le leader skill d’équipe (PV, ATQ, DEF, VIT, Taux Crit, Dégâts Crit) dans les dégâts.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Des dizaines de passifs et d’effets d’équipe comptent en plus dans le calcul (Euldong, Mirinae, Zaiross, et bien d’autres selon le monstre).',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Sur grand écran, les réglages s’organisent en deux colonnes — beaucoup moins de défilement.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'La recherche « Monstre à optimiser » couvre maintenant tout le bestiaire, possédé ou non.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Valide un build trouvé par la recherche : ses runes ne seront plus proposées pour un autre monstre de la même liste.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Crée plusieurs listes de travail (un deck de siège, ton RTA…), chacune avec ses propres runes réservées.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Ajoute à une liste un monstre que tu ne possèdes pas encore, pour préparer son runage à l’avance.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Valide directement le runage déjà équipé sur un monstre, sans lancer de recherche.',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Revois l’équipement réellement porté par un monstre, même après avoir validé un nouveau build pour lui.',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'L’objectif « Speed nuker » est retiré : « Dégâts réels » couvre ce cas avec la vraie formule du sort.',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'L’objectif « Dégâts » (approximatif) est retiré à son tour, entièrement remplacé par « Dégâts réels ».',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'Un monstre assigné à un deck de siège ou à un favori RTA mais pas encore runé apparaît maintenant comme un choix possible.',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'Impossible de valider un build si une de ses runes est déjà réservée pour un autre monstre de la même liste — un message indique lesquelles.',
      },
      {
        kind: 'docs',
        scope: 'Mécaniques',
        text: 'La page détaille en plus la correction Swift, les dégâts fixes et la variance.',
      },
    ],
  },
  {
    version: '1.8.1',
    date: '2026-08-21',
    title: 'Nouvel objectif Speed nuker, et un bug de clics sur mobile corrigé',
    highlights: [
      'Nouvel objectif de recherche « Speed nuker »',
      'Correction d’un bug de clics sur mobile (plusieurs pages)',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Nouvel objectif de recherche « Speed nuker ».',
      },
      {
        kind: 'feat',
        scope: 'Optimiseur',
        text: 'Choisir un pré-filtrage Haut ou Extrême active automatiquement les réglages avancés recommandés.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Sur mobile, certains boutons et cartes (runes, artéfacts, monstres…) pouvaient devenir difficiles ou impossibles à toucher — corrigé.',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'Le calcul de rétention des runes pondère désormais correctement les statistiques en pourcentage — peut légèrement changer les runes retenues pendant la recherche.',
      },
      {
        kind: 'fix',
        scope: 'Optimiseur',
        text: 'Message d’attente et affichage de la mesure sur les cartes de résultat clarifiés.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-19',
    title: 'Une nouvelle navigation',
    changes: [
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Une barre latérale remplace le menu du haut : toutes les sections se voient d’un coup.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Replie la barre pour gagner de la place, elle garde tes repères.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Cherche une page au clavier avec ⌘K, sans quitter ton écran.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Résumé, Liste, Courbes et Comparaison sont dans la navigation, plus cachés dans la page.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Le nom du compte chargé s’affiche : tu sais toujours lequel tu consultes.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Une page Paramètres réunit tous les réglages, avec leurs explications.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Le contenu occupe toute la largeur de l’écran.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Un seul contour au clavier, au lieu de deux emboîtés.',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-19',
    title: 'Protège tes builds : exclus les runes d’un monstre de la recherche',
    highlights: [
      'Exclus les runes d’un monstre précis (box, RTA ou siège) pour ne jamais te faire proposer un build qui les démonterait',
      'L’écran de l’Optimizer se réorganise en cartes claires, plus rapide à remplir',
      'Le moteur de recherche est amélioré : plus fiable (les préréglages larges trouvent plus de résultats) et plus rapide',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Exclus les runes d’un monstre précis (box, RTA ou siège) pour protéger un build que tu ne veux pas démonter.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: '« Exclure les runes déjà utilisées » remplace « Utiliser tout l’inventaire » : choisis le périmètre (RTA, défenses de siège ou box).',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'L’écran se réorganise en cartes claires (Monstre, Critères, Exclusion de runes, Réglages avancés), boutons d’action toujours visibles en bas.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'La grille de sets recherchés est directement dépliée, séparée en 4 pièces / 2 pièces — plus besoin de cliquer pour l’ouvrir.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Exporte tes paramètres de recherche dans un fichier, pour les partager avec d’autres joueurs ou les réimporter plus tard.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Nouveau réglage « Rechercher jusqu’à épuisement complet » pour retirer la limite de temps de 10 minutes.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Les résultats se parcourent maintenant par pages, au lieu de s’arrêter aux 20 meilleurs.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Changer de monstre (ou importer un nouveau compte) réinitialise automatiquement les critères et les résultats affichés.',
      },
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'Les préréglages larges (Haut, Extrême) trouvent maintenant plus de résultats, au lieu d’en perdre en cours de route.',
      },
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'La recherche va plus vite, sans rien changer aux résultats trouvés.',
      },
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'Un combo de 4+2 pièces (ex. Rage+Lame) ne laisse plus passer de runes d’un autre set dans les résultats.',
      },
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'Certains sets demandés à plus de 3 pièces ne font plus manquer un build pourtant valide.',
      },
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'L’exclusion manuelle ne peut plus exclure par erreur les runes du monstre que tu recherches.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Un monstre avec un seul artéfact équipé affiche de nouveau ses deux emplacements.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'La roue de runes s’affiche même si le monstre n’a encore aucune rune.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Le détail d’une rune, d’un artéfact ou de la relique s’ouvre dans une bulle, sans plus faire bouger la fiche.',
      },
      {
        kind: 'fix',
        scope: 'RTA',
        text: 'Un monstre sans rune mais avec des artéfacts est de nouveau cliquable pour voir son équipement.',
      },
    ],
  },
  {
    version: '1.6.3',
    date: '2026-08-16',
    title: 'Tes runes et tes monstres se lisent comme dans le jeu',
    highlights: [
      'Clique un monstre pour voir sa fiche complète : stats, lead et détail de ses sorts',
      'Tes runes s’affichent comme dans le jeu, avec les tris et la recherche de propriétés',
      'Les monstres de collaboration partagent la carte de leur équivalent : « Satoru Gojo, Werner »',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Clique un point de la courbe pour ouvrir la rune correspondante, et navigue de l’une à l’autre.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Tes runes s’affichent comme dans le jeu : propriétés, meules et bonus de set sur chaque carte.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Un clic sur une rune bascule entre le détail des valeurs et leur total.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Trie tes runes avec les critères du jeu : grade, propriété, avant meule, obtention…',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Cherche jusqu’à 4 propriétés secondaires à la fois, avec un minimum et un maximum.',
      },
      {
        kind: 'feat',
        scope: 'Bestiaire',
        text: 'Clique un monstre pour voir sa fiche : ses stats, son lead et le détail de ses sorts.',
      },
      {
        kind: 'feat',
        scope: 'Bestiaire',
        text: 'Les monstres qui se transforment n’ont plus qu’une carte, avec ses deux formes dans la fiche.',
      },
      {
        kind: 'feat',
        scope: 'Bestiaire',
        text: 'Le bestiaire s’affiche par pages : plus de ralentissement à la recherche.',
      },
      {
        kind: 'feat',
        scope: 'Bestiaire',
        text: 'Un monstre de collaboration partage la carte de son équivalent : « Satoru Gojo, Werner ».',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Un bouton remet tes équipes dans l’état de l’import de compte.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Clique une catégorie dans la légende pour l’afficher ou la masquer.',
      },
      {
        kind: 'fix',
        scope: 'Bestiaire',
        text: 'Les monstres sont rangés par élément, puis 2A, nat5, nat4, nat3, du plus récent au plus ancien.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Les cartes de monstre sont les mêmes au bestiaire et dans ta box.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Chaque courbe importée prend une couleur qui n’est encore portée par aucune autre.',
      },
      {
        kind: 'fix',
        scope: 'Bestiaire',
        text: 'Le rechargement d’un sort montre ce qu’il devient une fois la compétence montée.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Tous les leads s’affichent en couleur, aucun n’est plus grisé.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Une croix ferme les fiches qu’on consulte.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Les espaces en trop dans un nom ou une consigne ne sont plus conservés.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Les zéros inutiles disparaissent des champs de saisie chiffrés.',
      },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-08-16',
    title: 'L’Optimiseur cherche plus vite',
    highlights: [
      'La recherche de builds va plus vite — près de deux fois plus rapide sur la construction, sans rien changer aux résultats trouvés',
    ],
    changes: [
      {
        kind: 'fix',
        scope: 'Outils',
        text: 'La recherche de l’Optimiseur va plus vite, sans rien changer aux résultats trouvés.',
      },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-08-15',
    title: 'Dis contre quoi tes decks sont forts',
    highlights: [
      'Associe à chaque deck les défenses qu’il bat, avec une précision si besoin',
      'Cherche jusqu’à 3 monstres : tu vois quels decks les jouent et lesquels les battent',
      'L’analyse liste tous tes decks, les bons compris, et te mène à celui que tu veux voir',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Associe à chaque deck les défenses qu’il bat, avec une précision si besoin.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Cherche jusqu’à 3 monstres : tu vois quels decks les jouent et lesquels les battent.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'L’analyse liste tous tes decks, les jouables compris, avec l’équipe qui les rend jouables.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Filtre l’analyse par verdict : bon, à composer, à revoir, monstre manquant.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Clique une ligne de l’analyse pour aller droit au deck concerné.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Chaque deck dit combien de fois tu peux le monter avec ta réserve de 6★.',
      },
      {
        kind: 'feat',
        scope: 'Recommandations',
        text: 'Les filtres de la page sont réunis en un seul bloc, chacun avec son intitulé.',
      },
      {
        kind: 'fix',
        scope: 'Recommandations',
        text: 'Les boutons Exporter, Éditer et Supprimer restent en haut à droite de chaque carte.',
      },
      {
        kind: 'fix',
        scope: 'Recommandations',
        text: 'Le bouton « Tout exporter » ne change plus de nom selon le filtre actif.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-15',
    title: 'L’Optimiseur de runes',
    highlights: [
      'Nouvel outil : trouve la meilleure combinaison de 6 runes parmi celles que tu possèdes déjà',
      'Les résultats apparaissent au fur et à mesure de la recherche, sans attendre qu’elle se termine',
      'Un réglage pour prioriser les stats les plus difficiles à combiner, si la recherche normale ne trouve rien',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Nouvel outil Optimiseur de runes : cherche la meilleure combinaison de 6 parmi tes runes, pour un monstre, un combo de sets et des minimums donnés.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Par défaut, seules les runes réellement disponibles sont proposées — un réglage permet d’explorer aussi celles déjà portées par un autre monstre.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Les résultats trouvés s’affichent au fur et à mesure de la recherche, triables par n’importe quelle stat.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'Un réglage priorise les stats les plus difficiles à combiner, pour les cas où la recherche normale ne trouve rien.',
      },
      {
        kind: 'feat',
        scope: 'Outils',
        text: 'La recherche peut être arrêtée manuellement en gardant le meilleur trouvé jusque-là.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-15',
    title: 'Tes artéfacts, notés et fouillables',
    highlights: [
      'Le score du jeu et l’efficience de chaque artéfact, calculés sur tout ton stock',
      'Cherche par propriété comme dans le jeu : jusqu’à quatre critères, avec un minimum',
      'Vois d’un coup où est ta réserve : raretés, attributs, types, propriétés les plus portées',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Tes artéfacts ont leur page, avec le score du jeu et l’efficience de chaque pièce.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Un résumé chiffré de ta réserve : raretés, attributs, types et propriétés les plus portées.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Cherche par propriété avec un minimum exigé, jusqu’à quatre à la fois.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'L’ordre des critères fait le tri : le premier classe, le second départage.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Filtre par stat principale : PV, ATQ ou DEF.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'La propriété que tu cherches est mise en avant sur chaque artéfact.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Les quatre propriétés et leurs procs sont lisibles sans ouvrir la pièce.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Les menus, fenêtres et panneaux se posent en douceur au lieu de surgir.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Les propriétés portent les noms du jeu et son ordre de recherche.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Un élément sélectionné ne porte plus deux surbrillances superposées.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-11',
    title: 'Ta prépa RTA se sauvegarde et se partage',
    highlights: [
      'Pose un point de sauvegarde, remanie ta prépa, reviens en arrière si besoin',
      'Consulte la prépa d’un ami et regarde comment il rune chaque monstre',
      'Tape un nom, flèches, Entrée — et le champ est prêt pour le suivant',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Un point de sauvegarde permet d’essayer un autre classement et de revenir en arrière.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Consulte la prépa d’un ami, avec ses runes et ses artéfacts, sans toucher à la tienne.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'L’ordre de tour de ton ami est calculé aussi, avec les mêmes boutons de lead.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'À l’export, trois niveaux : tout, vitesses finales seules, ou ordre de tour seul.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Tes monstres créés à la main partent avec ta prépa, avec leur vitesse et leur lead.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Reprends une prépa exportée : une archive, ou celle d’un autre navigateur.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Les flèches ↑ et ↓ parcourent les résultats de toutes les recherches.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Entrée valide le monstre surligné, vide le champ et attend le suivant.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'On voit quel monstre sera choisi avant d’appuyer sur Entrée.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Échap ferme la liste de résultats, une seconde fois vide le champ.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'La recherche de monstre d’une équipe se pilote comme celle de la RTA.',
      },
      {
        kind: 'fix',
        scope: 'RTA',
        text: 'Le bouton « Catégories » de l’ordre de tour les masque et les réaffiche vraiment.',
      },
      {
        kind: 'fix',
        scope: 'Nouveautés',
        text: 'Le lien GitHub de la version 1.0.0 ne mène plus vers une page introuvable.',
      },
      {
        kind: 'docs',
        scope: 'RTA',
        text: 'La prépa d’un ami s’ouvre en lecture : rien n’est comparé à tes monstres, rien n’est modifié.',
      },
      {
        kind: 'docs',
        scope: 'RTA',
        text: 'Masquer tes runes retire aussi tes vitesses et tes sections : elles révéleraient ton runage.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-11',
    title: 'Un thème clair, et l’app se pilote enfin au clavier',
    highlights: [
      'SW Forge suit le thème de ton navigateur, clair ou sombre',
      'Tout est atteignable au clavier et au doigt',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Apparence',
        text: 'Un thème clair complet, en plus du sombre.',
      },
      {
        kind: 'feat',
        scope: 'Apparence',
        text: 'Le thème suit ton navigateur, et bascule avec lui en cours de route.',
      },
      {
        kind: 'feat',
        scope: 'Réglages',
        text: 'Nouveau réglage « Thème » : Auto, Clair ou Sombre.',
      },
      {
        kind: 'fix',
        scope: 'RTA',
        text: 'Le bouton pour retirer un monstre est atteignable au doigt et au clavier.',
      },
      {
        kind: 'fix',
        scope: 'Général',
        text: 'On voit où l’on est en naviguant au clavier.',
      },
      {
        kind: 'fix',
        scope: 'Général',
        text: 'Les boutons s’enfoncent au clic : on sait que le geste a été pris.',
      },
      {
        kind: 'fix',
        scope: 'Général',
        text: 'Sur mobile, les boutons ne restent plus allumés après un appui.',
      },
      {
        kind: 'fix',
        scope: 'Général',
        text: 'Dans une fenêtre de confirmation, le clavier ne s’échappe plus derrière.',
      },
      {
        kind: 'fix',
        scope: 'Import',
        text: 'Le résultat d’un import est annoncé aux lecteurs d’écran.',
      },
      {
        kind: 'fix',
        scope: 'Accessibilité',
        text: 'Les animations de l’accueil se coupent si tu limites les animations.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'La vérification des ticks ATB se lit correctement en thème clair.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Les couleurs du résumé de runes tiennent sur fond clair.',
      },
      {
        kind: 'fix',
        scope: 'Interface',
        text: 'Les chiffres passent dans une police plus lisible en petite taille.',
      },
    ],
  },
  {
    version: '1.2.4',
    date: '2026-08-10',
    title: 'Ta réserve de meules entre dans l’optimisation',
    highlights: [
      'Ne voir que les runes améliorables avec tes meules et gemmes actuelles',
      'Les recommandations de siège acceptent des propriétés d’artéfacts',
      'Chaque monstre fautif est nommé dans l’alerte de tick',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Un bouton ne garde que les runes que tu peux améliorer tout de suite.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Chaque ligne du plan indique si tu as la meule ou la gemme qu’elle demande.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Le palier se reconvertit quand tu passes de l’efficience au score SW.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Une rune déjà meulée ne se voit plus proposer de perdre son meulage.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Une recommandation peut exiger des propriétés d’artéfacts, vérifiées à l’analyse.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'L’analyse distingue un mauvais runage, un mauvais artéfact et des stats trop basses.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'L’alerte de tick nomme chaque monstre fautif, plus seulement deux.',
      },
      {
        kind: 'fix',
        scope: 'Siège',
        text: 'Supprimer une équipe demande confirmation.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Les artéfacts s’appellent « Attribut » et « Type », comme dans le jeu.',
      },
    ],
  },
  {
    version: '1.2.3',
    date: '2026-08-10',
    title: 'Des repères plus clairs en siège et en RTA',
    highlights: [
      'Le siège dit dans quel sens corriger ton speed tuning',
      'Les leads de l’ordre de tour sont ceux de ta prépa',
      'Fenêtres de confirmation intégrées au site',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Le message précise si ton équipe est trop lente ou trop rapide, et pour quel tick.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: '« Ignorer la recommandation » remplace « Valider l’équipe ».',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Les boutons de lead sont ceux portés par tes monstres, et tu peux en ajouter.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Les confirmations s’affichent dans le site, plus dans une boîte du navigateur.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Un mot sur petit écran : le site se manipule mieux sur ordinateur.',
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Couleurs des filtres de monstres harmonisées.',
      },
    ],
  },
  {
    version: '1.2.2',
    date: '2026-08-10',
    title: 'Fiabilité : les calculs sensibles sont désormais vérifiés',
    changes: [
      {
        kind: 'docs',
        scope: 'Fiabilité',
        text: 'Vérifications automatiques sur les vitesses, l’import et la conservation.',
      },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-10',
    title: 'Le choix de conservation est reposé à chaque import',
    changes: [
      {
        kind: 'fix',
        scope: 'Import',
        text: 'La question « garder mes données ? » revient à chaque import.',
      },
      {
        kind: 'feat',
        scope: 'Import',
        text: 'Case pour ne plus voir le message jusqu’à la fin de ta session.',
      },
      {
        kind: 'fix',
        scope: 'Import',
        text: 'Confirmation avant d’effacer des données déjà conservées.',
      },
      {
        kind: 'fix',
        scope: 'Accueil',
        text: 'Le bouton « Importer mon compte » en bas de page fonctionne enfin.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-10',
    title: 'Tes données restent d’une visite à l’autre',
    highlights: [
      'Ton compte aussi est conservé, plus besoin de le redéposer',
      'Tu choisis : tout garder, ou ne rien garder',
      'Import nettement plus rapide',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Ton compte importé est conservé entre deux visites, comme le reste.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Après un import, tu choisis de garder ou non tes données sur cet appareil.',
      },
      {
        kind: 'feat',
        scope: 'Réglages',
        text: 'Un seul bouton pour tout conserver ou tout effacer, modifiable à tout moment.',
      },
      {
        kind: 'feat',
        scope: 'Réglages',
        text: 'La date de ton dernier export est affichée, avec un rappel si elle date.',
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: 'Une attente s’affiche pendant la lecture de ton fichier.',
      },
      { kind: 'fix', scope: 'Import', text: 'Import de compte quatre fois plus rapide.' },
    ],
  },
  {
    version: '1.1.2',
    date: '2026-08-09',
    title: 'Comparaison de courbes de runes remaniée',
    highlights: [
      'Deux onglets : comparer des courbes, ou comparer des comptes',
      'Bouton pour tout retirer d’un coup',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'La comparaison sépare les courbes partagées des fichiers de compte.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Filtres par set, slot et rareté sur la comparaison de comptes.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Bouton « Tout retirer » : il ne touche ni ton compte, ni tes recommandations.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Le nom de chaque courbe s’affiche dans l’infobulle du graphe.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Icônes du jeu sur les onglets Monstres, Runes et Artéfacts.',
      },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-09',
    title: 'Nouvelle page d’accueil et repères de vitesse en RTA',
    highlights: [
      'Dépose ton export directement sur l’accueil',
      'Alerte quand tes runes ne suivent plus la vitesse saisie',
      'Moyennes d’efficience calculées sur ton top 400',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Accueil',
        text: 'Page refaite : dépose ton fichier dessus, et retrouve tes équipes en un clic.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Alerte sur les monstres dont les runes ne suivent plus la vitesse saisie.',
      },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Boutons pour masquer les vitesses, les catégories ou les monstres modifiés.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Les moyennes d’efficience portent sur ton top 400, pas sur tout l’inventaire.',
      },
      { kind: 'feat', scope: 'Navigation', text: 'Champ pour aller directement à une page dans les listes.' },
      { kind: 'feat', scope: 'Interface', text: 'Champs numériques avec boutons − et +.' },
      { kind: 'feat', scope: 'Contact', text: 'Lien vers le serveur Discord dans le pied de page.' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-09',
    title: 'Recommandations de siège, score SW et vitesses corrigées',
    highlights: [
      'Partage de decks de siège entre joueurs',
      'Choix entre efficience et score SW officiel',
      'Vitesse de combat identique à celle du jeu',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Recommandations de decks : compose, partage, et vois ce que tu peux jouer.',
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Plusieurs runages possibles par monstre — un seul suffit à valider le deck.',
      },
      { kind: 'feat', scope: 'Siège', text: 'Lead du leader affiché avec l’icône du jeu.' },
      { kind: 'feat', scope: 'Siège', text: 'Bouton « Vérifier mes tick ATB ».' },
      { kind: 'feat', scope: 'Mon compte', text: 'Résumé chiffré de tout l’inventaire de runes.' },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: 'Optimisation filtrable par set, emplacement et runes antiques.',
      },
      {
        kind: 'feat',
        scope: 'Réglages',
        text: 'Efficience ou score SW officiel, au choix, partout sur le site.',
      },
      { kind: 'feat', scope: 'Interface', text: 'Portrait du monstre dans les listes de choix.' },
      {
        kind: 'feat',
        scope: 'RTA',
        text: 'Catégories de couleur (« Striper », « Lead SPD »…) à poser sur tes monstres.',
      },
      { kind: 'feat', scope: 'Nouveautés', text: 'Cette page : le journal des versions du site.' },
      { kind: 'fix', scope: 'Vitesse', text: 'Les vitesses de combat collent enfin à celles du jeu.' },
      { kind: 'fix', scope: 'Import', text: 'Le Swift complété par une rune Intangible est reconnu.' },
      { kind: 'fix', scope: 'Import', text: 'Annuler un import ne dédouble plus les données.' },
      { kind: 'fix', scope: 'Données', text: 'Stats de base corrigées : valeurs 6★.' },
      { kind: 'fix', scope: 'Mon compte', text: 'Couleurs de rareté remises dans le bon ordre.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-20',
    title: 'Première version publique',
    // Publiée avant l'existence du dépôt : aucun tag Git ne lui correspond.
    tag: false,
    highlights: ['Bestiaire, RTA et Siège', 'Import de compte 100 % local'],
    changes: [
      { kind: 'feat', scope: 'Bestiaire', text: 'Recherche et filtres par élément et par étoiles.' },
      { kind: 'feat', scope: 'RTA', text: 'Préparation RTA : sections, vitesses et ordre de tour.' },
      { kind: 'feat', scope: 'Siège', text: 'Équipes de 3, lead automatique et ticks de vitesse.' },
      { kind: 'feat', scope: 'Import', text: 'Import d’un export de compte, lu sans rien envoyer.' },
      { kind: 'feat', scope: 'Mécaniques', text: 'Aide-mémoire des règles de jeu.' },
    ],
  },
];
