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
  // ⚠️ Version EN PRÉPARATION (`version: null`) : le numéro se décide à la
  // fusion, d'après ce que la branche contient au final. Remplacer `null` par
  // le numéro au moment de publier, en même temps que `package.json` et le tag.
  {
    version: null,
    date: '2026-08-12',
    title: 'Les artéfacts',
    changes: [],
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
