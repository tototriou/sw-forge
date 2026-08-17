import { ReactNode, forwardRef } from 'react';
import { FondBouton, FormeBouton, PRESSION, TonBouton } from './Bouton';

// LE bouton des rangées : un libellé, une icône **optionnelle** à gauche, et des
// actions **optionnelles** accolées à droite. Une pilule de catégorie (puce +
// nom + éditer + supprimer), une pilule de lead (pourcentage + retirer), un
// filtre (« Sans lead »), un interrupteur d'affichage (« Vitesses »).
//
// ⚠️ **Un seul composant pour ces quatre-là**, alors qu'ils étaient quatre
// écritures différentes. Ce qui les distingue n'est pas leur nature — ce sont
// tous des boutons d'une même rangée, à la même hauteur — mais la seule présence
// ou absence de décorations. Cela se dit avec deux props facultatives, pas avec
// quatre composants ; et une rangée qui mélange les quatre ne fait plus de dents
// de scie, puisque la hauteur est écrite à un seul endroit.
//
// ⚠️ **Le CADRE porte le style, les boutons sont transparents dedans.** C'est
// une contrainte du HTML avant d'être un choix : un `<button>` dans un
// `<button>` est invalide, et les navigateurs en font ce qu'ils veulent. Le
// conteneur n'est donc pas un bouton — il dessine, ses enfants agissent.
// Bénéfice au passage : aucune couture visible entre le bouton principal et ses
// actions, là où trois boutons côte à côte laissent deux traits.
//
// ⚠️ **UN SEUL MARQUEUR d'état : le fond.** Il cumulait fond + bordure teintée +
// ombre — trois signaux pour dire une seule chose : le bouton se surlignait deux
// fois et bavait sur ses voisins. L'ombre part aussi : un bouton actif ne DÉCOLLE
// pas de la page, l'élévation est réservée à ce qui flotte. Voir
// spec/shared/design.md.

export interface BoutonGroupeProps {
  libelle: ReactNode;
  // Posée à GAUCHE du libellé : une puce de couleur, une icône, un portrait.
  icone?: ReactNode;
  // Actions accolées à DROITE. ⚠️ Des `BoutonIcone` en `taille="serre"` — le
  // composant ne les fabrique pas lui-même pour que chacune garde son ton, son
  // infobulle et son `aria-label` propres.
  actions?: ReactNode;
  onClick?: () => void;
  // Passés au bouton PRINCIPAL : c'est lui qu'on décrit, pas le cadre.
  title?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  // Bouton à DEUX ÉTATS (un filtre, une catégorie ouverte, un lead appliqué).
  // Pose `aria-pressed` — sans quoi un lecteur d'écran annonce « bouton » là où
  // l'utilisateur voit un interrupteur. Laisser à `undefined` pour une action
  // ordinaire, qui n'a pas d'état à porter.
  actif?: boolean;
  // Puce pleine (affiché) ou creuse (coupé), à la place de l'icône.
  //
  // ⚠️ C'est le rendu des INTERRUPTEURS D'AFFICHAGE au tactile : un œil ouvert /
  // barré demande de se rappeler s'il montre l'état courant ou l'action à venir.
  // À 12 px sur un téléphone l'ambiguïté ne se lève plus ; un point plein ou
  // creux se lit sans être interprété.
  puce?: boolean;
  ton?: TonBouton;
  fond?: FondBouton;
  taille?: 'xs' | 'sm';
  forme?: FormeBouton;
  // Contour en POINTILLÉS : « contenant pas encore rempli », ce qui distingue
  // « ajouter » des entrées déjà là, sans un mot de plus.
  pointille?: boolean;
  // Habillage complet du cadre à l'état actif, quand la teinte ne vient pas d'un
  // ton d'interface mais d'un CODE du jeu (le dégradé `star` du lead).
  // ⚠️ REMPLACE le jeu par défaut au lieu de s'y ajouter : deux teintes
  // superposées donnent une couleur qui n'est ni l'une ni l'autre.
  classNameActif?: string;
  className?: string;
  disabled?: boolean;
}

const HAUTEURS = { xs: 'h-6', sm: 'h-7' } as const;
const TEXTES = { xs: 'text-micro', sm: 'text-xs' } as const;

// ⚠️ Rembourrage DISSYMÉTRIQUE quand il y a des actions : large à gauche pour le
// texte, mince à droite parce que les actions apportent le leur. Symétrique, le
// groupe paraissait décalé vers la gauche. Sans actions, il redevient égal —
// sinon un simple filtre penche à droite au milieu de ses voisins.
const REMBOURRAGES = {
  xs: { seul: 'px-2', avecActions: 'pl-2 pr-0.5' },
  sm: { seul: 'px-2.5', avecActions: 'pl-2.5 pr-1' },
} as const;

const FORMES: Record<FormeBouton, string> = {
  boite: 'rounded-lg',
  pilule: 'rounded-full',
};

// Habillage du cadre au REPOS, par ton et par remplissage.
const REPOS: Record<TonBouton, Record<FondBouton, string>> = {
  neutre: {
    vide: 'border-border bg-transparent text-ink-dim hoverable:border-accent hoverable:text-ink',
    doux: 'border-border bg-panel text-ink-dim hoverable:border-accent hoverable:text-ink',
    plein: 'border-border bg-panel2 text-ink-dim hoverable:border-accent hoverable:text-ink',
  },
  accent: {
    vide: 'border-accent bg-transparent text-ink',
    doux: 'border-accent bg-accent-soft text-ink',
    plein: 'border-accent bg-accent-soft text-ink',
  },
  danger: {
    vide: 'border-bad/50 bg-transparent text-ink-dim hoverable:text-bad',
    doux: 'border-bad/50 bg-bad/10 text-bad',
    plein: 'border-bad/50 bg-bad/20 text-bad',
  },
  // ⚠️ Teinte présente DÈS LE REPOS, immobile au survol : elle signale un état
  // des données, et un signal qui s'allume au passage de la souris n'en est plus
  // un. Voir la note du type dans Bouton.
  alerte: {
    vide: 'border-warn/50 bg-transparent text-warn',
    doux: 'border-warn/50 bg-warn/10 text-warn',
    plein: 'border-warn/50 bg-warn/20 text-warn',
  },
  precieux: {
    vide: 'border-border bg-transparent text-ink-dim hoverable:border-star',
    doux: 'border-border bg-panel/60 text-ink-dim hoverable:border-star',
    plein: 'border-star bg-star/10 text-ink',
  },
};

// Habillage à l'état ACTIF. La bordure reste neutre : elle est déjà là au repos,
// la teinter ne ferait que doubler le fond (voir la note du marqueur unique).
const ACTIFS: Record<TonBouton, string> = {
  neutre: 'border-border bg-accent-soft text-ink',
  accent: 'border-border bg-accent-soft text-ink',
  danger: 'border-bad/50 bg-bad/10 text-bad',
  alerte: 'border-warn/50 bg-warn/10 text-warn',
  // ⚠️ **La bordure teintée SUFFIT** : j'y avais ajouté un `ring-1 ring-star/50`
  // par-dessus, soit deux traits dorés concentriques à 1 px l'un de l'autre. Ils
  // ne se lisent pas comme deux informations mais comme un contour épais et
  // flou. La règle du marqueur unique vaut ici aussi.
  precieux: 'border-star bg-star/10 text-ink',
};

const BoutonGroupe = forwardRef<HTMLDivElement, BoutonGroupeProps>(function BoutonGroupe(
  {
    libelle,
    icone,
    actions,
    onClick,
    title,
    actif,
    puce = false,
    ton = 'neutre',
    fond = 'doux',
    taille = 'sm',
    forme = 'pilule',
    pointille = false,
    classNameActif,
    className = '',
    disabled,
    ...aria
  },
  ref,
) {
  const habillage = actif ? (classNameActif ?? ACTIFS[ton]) : REPOS[ton][fond];

  return (
    <div
      ref={ref}
      // ⚠️ `data-hauteur-fixe` : la hauteur est dessinée ici, la règle du panneau
      // mobile ne doit pas la remplacer par son minimum — une rangée y perdrait
      // sa raison d'être, qui est d'être basse. Voir index.css.
      data-hauteur-fixe
      className={`inline-flex max-w-full flex-none select-none items-center gap-1.5 border
        transition ${HAUTEURS[taille]} ${
          actions ? REMBOURRAGES[taille].avecActions : REMBOURRAGES[taille].seul
        } ${FORMES[forme]} ${pointille ? 'border-dashed' : ''} ${habillage} ${
          disabled ? 'pointer-events-none opacity-40' : ''
        } ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={actif}
        title={title}
        disabled={disabled}
        // ⚠️ **`data-cible-fine`, et c'est le cœur du composant.** La règle
        // tactile globale porte tout `<button>` à 40 px au doigt — ici ce n'est
        // pas lui qui grandirait mais le CADRE qui l'enveloppe, doublant de
        // hauteur sans que rien dans son propre code ne l'explique. Rien n'est
        // perdu : ce bouton occupe toute la surface du groupe sauf les actions,
        // donc la cible reste large. Voir spec/shared/librairie-ui.md.
        data-cible-fine
        className={`flex h-full min-w-0 items-center gap-1.5 font-semibold ${TEXTES[taille]} ${PRESSION}`}
        {...aria}
      >
        {puce ? (
          // `border-current` : la puce emprunte la couleur du texte, donc elle
          // suit l'état sans qu'on ait à le déclarer deux fois.
          <span
            aria-hidden
            className={`h-2 w-2 flex-none rounded-full border border-current transition ${
              actif ? 'bg-current' : 'bg-transparent'
            }`}
          />
        ) : (
          icone
        )}
        <span className="truncate">{libelle}</span>
      </button>
      {actions}
    </div>
  );
});

export default BoutonGroupe;
