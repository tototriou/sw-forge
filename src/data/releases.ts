// Journal des versions de SW Forge, affiché sur `#/releases`.
//
// ⚠️ **Source de vérité du contenu des releases.** Il est tenu À LA MAIN, et
// non dérivé de l'API GitHub : le site est statique et doit rester lisible hors
// ligne, sans dépendre d'un service tiers ni de ses quotas. Une release = une
// entrée ici, ajoutée dans la branche `release/x.y.z` (voir README).
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
  version: string; // « 1.1.0 »
  date: string; // ISO court, « 2026-08-09 »
  title: string; // résumé en une ligne
  highlights?: string[]; // 1 à 3 points mis en avant
  changes: ReleaseChange[];
}

export const CHANGE_META: Record<ChangeKind, { label: string; color: string }> = {
  feat: { label: 'Nouveau', color: 'text-emerald-400' },
  fix: { label: 'Correction', color: 'text-amber-400' },
  docs: { label: 'Doc', color: 'text-ink-dim' },
};

// La plus RÉCENTE en premier — c'est l'ordre d'affichage.
export const RELEASES: Release[] = [
  {
    version: '1.1.0',
    date: '2026-08-09',
    title: 'Recommandations de siège, score SW et calcul de vitesse corrigé',
    highlights: [
      'Partage de recommandations de decks de siège entre joueurs',
      'Choix global entre efficience et score SW officiel',
      'Vitesse de combat enfin identique à celle du jeu',
    ],
    changes: [
      {
        kind: 'feat',
        scope: 'Siège',
        text: "Sous-onglet « Recommandations » : compose un lot de decks avec les sets et les stats à viser, exporte-le en JSON, et vois immédiatement quels decks tu peux jouer.",
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: "Plusieurs runages au choix par monstre (« Violent/Némésis | Violent/Vengeance ») : un seul suffit à valider le deck.",
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: "Le lead du leader est affiché avec l'icône officielle du jeu, sur le monstre et à côté du nom de l'équipe.",
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Bouton « Vérifier mes tick ATB », défilement automatique vers l\'équipe créée et deux équipes par ligne sur grand écran.',
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: "Onglet « Résumé » : vue d'ensemble chiffrée de tout l'inventaire de runes.",
      },
      {
        kind: 'feat',
        scope: 'Réglages',
        text: "Choix global entre l'efficience et le score SW officiel, posé une fois dans le menu ⚙ et appliqué partout.",
      },
      {
        kind: 'feat',
        scope: 'Mon compte',
        text: "Optimisation : filtres par set, par emplacement, et exclusion des runes antiques (leur potentiel ne se compare pas aux runes normales).",
      },
      {
        kind: 'feat',
        scope: 'Interface',
        text: "Portrait du monstre dans toutes les listes de sélection — plusieurs monstres partagent nom et élément, seul le portrait les distingue.",
      },
      {
        kind: 'fix',
        scope: 'Vitesse',
        text: "Le totem, le lead et le Swift sont désormais sommés avant d'être arrondis une seule fois, comme le fait le jeu. Les vitesses de combat étaient fausses d'un point sur certaines bases.",
      },
      {
        kind: 'fix',
        scope: 'Import',
        text: "Le set Swift complété par une rune Intangible n'était pas détecté : le monstre concerné perdait 25 % de sa vitesse de base.",
      },
      {
        kind: 'fix',
        scope: 'Données',
        text: "Les stats de base sont celles du monstre 6★ et non de son grade d'invocation.",
      },
      {
        kind: 'fix',
        scope: 'Import',
        text: "Annuler un import de compte ne dédouble plus toutes les données.",
      },
      {
        kind: 'fix',
        scope: 'Mon compte',
        text: 'Les raretés Magique (vert) et Rare (bleu) étaient interverties.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-20',
    title: 'Première version publique',
    highlights: ['Bestiaire, RTA et Siège', 'Import de compte 100 % local'],
    changes: [
      { kind: 'feat', scope: 'Bestiaire', text: 'Recherche et filtres par élément et étoiles naturelles.' },
      {
        kind: 'feat',
        scope: 'RTA',
        text: "Préparation Real Time Arena : classement par set en glisser-déposer, vitesses et ordre de tour.",
      },
      {
        kind: 'feat',
        scope: 'Siège',
        text: 'Équipes de 3 avec lead déduit automatiquement et vérification des ticks de vitesse.',
      },
      {
        kind: 'feat',
        scope: 'Import',
        text: "Import d'un export SW Exporter, lu dans la page : aucune donnée n'est envoyée.",
      },
      { kind: 'feat', scope: 'Mécaniques', text: 'Documentation des mécaniques de jeu.' },
    ],
  },
];
