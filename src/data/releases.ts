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
//
// ⚠️ **Style : une phrase courte, lisible par un joueur.** Ce qui change POUR
// LUI, jamais comment c'est fait. Pas de nom de fonction, pas de formule, pas de
// détail d'implémentation — tout ça vit dans les commits et dans `spec/`.
// Si une ligne dépasse ~15 mots, c'est qu'elle raconte l'implémentation.
export const RELEASES: Release[] = [
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
