import { forwardRef, ReactNode } from 'react';

// LE bouton de l'app. Toute pression qui n'est pas une pastille de filtre passe
// par ici — voir [Pastille](Pastille.tsx) pour celles-là.
//
// ⚠️ **C'est un COMPOSANT, pas une constante de classes.** L'app avait déjà
// [buttonStyles.ts](../components/buttonStyles.ts), et il n'a jamais pris : sept
// fichiers l'importaient sur quarante qui dessinaient des boutons. Une constante
// se contourne d'un `className` — on en ajoute un bout « juste pour ce cas », et
// la divergence est repartie. Un composant impose sa structure : la taille, la
// hauteur tactile, la pression au clic et l'état désactivé ne sont plus
// négociables au point d'appel.
//
// ⚠️ **Des AXES INDÉPENDANTS, pas un catalogue de variantes.** Le premier jet
// offrait quatre variantes nommées par intention (`principal`, `discret`…) : dès
// qu'un écran voulait un bouton d'ajout en pointillés, il fallait une cinquième
// entrée, puis une sixième pour la même chose en rouge. Ici le ton (`ton`), le
// remplissage (`fond`) et le tracé (`trait`) se choisissent SÉPARÉMENT et se
// combinent — trois axes couvrent ce que douze variantes n'auraient pas couvert.
//
// ⚠️ **Le libellé se masque au doigt, il ne DISPARAÎT pas.** `icone` + `libelle`
// plutôt qu'un `children` libre : c'est ce qui permet à la règle du panneau
// mobile de rendre les mots quand la place existe (voir `data-tiroir` dans
// index.css). Un bouton qui écrit son texte en dur dans `children` ne peut plus
// le reprendre, et la rangée d'icônes nues du panneau redevient un rébus.

// COULEUR de l'action, indépendante de sa forme.
//
// ⚠️ `danger` n'est pas « rouge » : c'est « cette action perd quelque chose ».
// Elle n'est JAMAIS le bouton mis en avant d'un dialogue — voir spec/README.md,
// le défaut ne perd jamais rien.
export type TonBouton = 'neutre' | 'accent' | 'danger';

// REMPLISSAGE. `plein` porte la teinte du ton, `doux` sa version atténuée,
// `vide` ne pose aucun fond (le bouton vit sur la surface qui le porte).
export type FondBouton = 'vide' | 'doux' | 'plein';

// TRACÉ du contour. `pointille` dit « ajouter » — un contenant pas encore
// rempli. `aucun` sert aux rangées où quatre bordures côte à côte feraient une
// grille là où il n'y a qu'une liste.
export type TraitBouton = 'aucun' | 'plein' | 'pointille';

// ⚠️ `carre` n'a AUCUN rembourrage, dans aucune direction : sa boîte est un
// carré dimensionné par l'appelant, dont l'icône occupe le centre. Une taille
// avec rembourrage écrasée par un `p-0` dans le `className` ne marche PAS de
// façon fiable — l'ordre des classes dans l'attribut ne décide de rien, c'est
// leur ordre dans la feuille de style qui tranche. D'où une taille à part
// plutôt qu'une annulation après coup.
export type TailleBouton = 'xs' | 'sm' | 'md' | 'carre';

// FORME. `pilule` pour ce qui vit dans une rangée, `boite` pour une action
// posée dans un formulaire ou un dialogue.
export type FormeBouton = 'boite' | 'pilule';

// Retour tactile commun à tout élément pressable.
//
// ⚠️ Un seul endroit à modifier, toute l'app qui accuse réception. Un bouton qui
// ne bouge pas au clic laisse un doute d'un dixième de seconde : est-ce que ça a
// pris ? Voir spec/shared/design.md.
export const PRESSION = 'transition-transform duration-150 ease-out active:scale-[0.97]';

// ⚠️ Le SOCLE ne porte ni couleur ni contour : il pose la géométrie, l'alignement
// et l'état désactivé, que toutes les combinaisons partagent sans exception.
const SOCLE =
  'inline-flex flex-none items-center justify-center gap-1.5 font-semibold select-none ' +
  'transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  PRESSION;

const TAILLES: Record<TailleBouton, string> = {
  // ⚠️ `xs` vit DANS un contenant déjà serré (une carte, une pilule d'en-tête),
  // jamais pour l'action principale d'un écran.
  xs: 'px-2 py-0.5 text-micro',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-sm',
  // Voir la note sur le type : pas de rembourrage du tout, la boîte est un carré.
  carre: 'p-0 text-xs',
};

const FORMES: Record<FormeBouton, string> = {
  boite: 'rounded-lg',
  pilule: 'rounded-full',
};

// Couleur du TEXTE, par ton et par remplissage.
//
// ⚠️ Sur fond peint, le texte passe en `ink` plein : `ink-dim` sur `accent-soft`
// tombait sous le contraste lisible.
//
// ⚠️ TROIS cas et non deux, parce que `plein` ne se comporte pas comme `doux` :
// sur un aplat opaque, la couleur du ton devient celle du FOND, et un texte de
// la même teinte disparaît dedans. C'est ce qui rendait la croix de retrait
// invisible au survol — rouge sur rouge, exactement quand on la vise.
const TEXTES: Record<TonBouton, { nu: string; doux: string; plein: string }> = {
  neutre: { nu: 'text-ink-dim hoverable:text-ink', doux: 'text-ink', plein: 'text-ink' },
  accent: {
    nu: 'text-ink hoverable:brightness-110',
    doux: 'text-ink hoverable:brightness-110',
    plein: 'text-ink hoverable:brightness-110',
  },
  // `text-white` et non `text-ink` : sur l'aplat d'alerte, l'encre du thème
  // clair n'aurait pas le contraste, et cet aplat est le même dans les deux.
  danger: { nu: 'text-ink-dim hoverable:text-bad', doux: 'text-bad', plein: 'text-white' },
};

const FONDS: Record<TonBouton, Record<FondBouton, string>> = {
  neutre: { vide: 'bg-transparent', doux: 'bg-panel', plein: 'bg-panel2' },
  accent: { vide: 'bg-transparent', doux: 'bg-accent-soft', plein: 'bg-accent-soft' },
  // ⚠️ `plein` est OPAQUE, pas une opacité de plus que `doux` : c'est le cran
  // des actions posées SUR autre chose (la croix au coin d'une carte), où un
  // fond translucide laisserait passer l'image dessous et rendrait l'icône
  // illisible. `doux` reste le voile discret d'un bouton posé dans un panneau.
  danger: { vide: 'bg-transparent', doux: 'bg-bad/10', plein: 'bg-bad' },
};

const TRAITS: Record<TonBouton, Record<TraitBouton, string>> = {
  neutre: {
    aucun: 'border border-transparent',
    plein: 'border border-border hoverable:border-accent',
    pointille: 'border border-dashed border-border hoverable:border-accent',
  },
  accent: {
    aucun: 'border border-transparent',
    plein: 'border border-accent',
    pointille: 'border border-dashed border-accent',
  },
  danger: {
    aucun: 'border border-transparent',
    plein: 'border border-bad/50',
    pointille: 'border border-dashed border-bad/50',
  },
};

export interface BoutonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ton?: TonBouton;
  fond?: FondBouton;
  trait?: TraitBouton;
  taille?: TailleBouton;
  forme?: FormeBouton;
  icone?: ReactNode;
  libelle?: ReactNode;
  // Le libellé tombe au doigt et ne reste que l'icône. ⚠️ Sans effet si le
  // bouton n'a pas d'icône : un bouton muet n'est plus un bouton.
  libelleAuDoigt?: boolean;
  // Occupe toute la largeur : l'action qu'on vient faire, posée là où le pouce
  // tombe, et rien à côté d'elle qui puisse être touché par erreur.
  pleineLargeur?: boolean;
  // Le bouton se DÉSHABILLE au doigt : plus de cadre, plus de fond, plus de
  // rembourrage — il ne reste que l'icône.
  //
  // ⚠️ Réservé aux BARRES D'ACTIONS où le même geste se répète cinq ou six fois.
  // Six boutons encadrés faisaient six carrés dans une barre qu'on cherche à
  // compacter, et le cadre n'apprend rien : l'icône dit l'action, sa présence
  // dit qu'on peut la toucher. Il revient à la souris, où la barre a la place et
  // où le survol a besoin d'une surface à colorer.
  //
  // ⚠️ Il pose `cible-tactile`, qui rend 44 px touchables SANS qu'un pixel du
  // dessin ne bouge (pseudo-élément, voir index.css) — sinon la règle des 40 px
  // regonflerait le bouton qu'on vient de déshabiller.
  nuAuDoigt?: boolean;
  // ⚠️ Bouton à DEUX ÉTATS (un mode d'affichage, une option qui reste enclenchée).
  // Il prend le fond du ton et pose `aria-pressed` — sans quoi un lecteur d'écran
  // annonce « bouton » là où l'utilisateur voit un interrupteur. Laisser à
  // `undefined` pour une action ordinaire, qui n'a pas d'état à porter.
  actif?: boolean;
}

const Bouton = forwardRef<HTMLButtonElement, BoutonProps>(function Bouton(
  {
    ton = 'neutre',
    fond = 'doux',
    trait = 'plein',
    taille = 'md',
    forme = 'boite',
    icone,
    libelle,
    libelleAuDoigt = true,
    pleineLargeur = false,
    nuAuDoigt = false,
    actif,
    className = '',
    type = 'button',
    ...reste
  },
  ref,
) {
  // ⚠️ Le libellé ne se masque QUE s'il reste quelque chose à voir. Sans icône,
  // `compact:hidden` produisait un bouton vide de 40 px — cliquable, invisible.
  const masquable = Boolean(icone) && !libelleAuDoigt;

  // Un bouton à état enclenché prend le fond de son ton, quel que soit le fond
  // demandé au repos : c'est ce fond qui PORTE l'état, et lui seul (voir la
  // règle du marqueur unique dans Pastille).
  const fondEffectif: FondBouton = actif === true ? 'doux' : actif === false ? 'vide' : fond;
  const peint = fondEffectif !== 'vide';
  const tonEffectif: TonBouton = actif === true && ton === 'neutre' ? 'accent' : ton;

  // ⚠️ `relative` : la zone étendue de `.cible-tactile` est un pseudo-élément
  // positionné en absolu, qui a besoin de ce référentiel pour se centrer.
  const nu = nuAuDoigt
    ? 'cible-tactile relative compact:gap-0 compact:rounded-none compact:border-0 ' +
      'compact:bg-transparent compact:px-0 compact:py-0'
    : '';

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={actif}
      {...(nuAuDoigt ? { 'data-cible-fine': true } : {})}
      className={`${SOCLE} ${TAILLES[taille]} ${FORMES[forme]} ${TRAITS[ton][trait]} ${nu} ${
        FONDS[tonEffectif][fondEffectif]
      } ${TEXTES[tonEffectif][fondEffectif === 'vide' ? 'nu' : fondEffectif]} ${
        pleineLargeur ? 'w-full' : ''
      } ${className}`}
      {...reste}
    >
      {icone}
      {/* ⚠️ Le libellé est TOUJOURS dans un `<span>`, même visible : c'est cette
          balise que la règle `[data-tiroir] button > span.compact\:hidden` va
          rechercher pour rendre les mots dans le panneau mobile. Un texte nu,
          enfant direct du bouton, ne serait pas rattrapable. */}
      {libelle != null && (
        <span className={masquable ? 'compact:hidden' : undefined}>{libelle}</span>
      )}
    </button>
  );
});

export default Bouton;
