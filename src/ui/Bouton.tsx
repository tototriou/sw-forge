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
//
// ⚠️ `alerte` est différent : il ne dit rien de l'ACTION, il signale l'état des
// DONNÉES (des runes qui ne suivent plus, une équipe incomplète). Le bouton n'y
// est qu'un moyen d'ouvrir l'explication. C'est pourquoi il ne change pas au
// survol : sa couleur est une information, pas une invitation.
//
// ⚠️ **Pas de ton pour le CODE COULEUR DU JEU** (le doré d'une relique, d'un
// lead, d'une étoile). J'en avais ajouté un : il n'a jamais servi. Ces
// éléments-là ne sont pas des composants d'interface — ils se mettent en valeur
// comme dans le jeu, avec halo et éclat, et échappent aux règles de contour de
// cette librairie. Leur donner un ton ici invitait à les y ramener.
export type TonBouton = 'neutre' | 'accent' | 'danger' | 'alerte';

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

// Retour tactile commun à tout élément pressable QUI N'EST PAS un `Bouton`.
//
// ⚠️ Un seul endroit à modifier, toute l'app qui accuse réception. Un bouton qui
// ne bouge pas au clic laisse un doute d'un dixième de seconde : est-ce que ça a
// pris ? Voir spec/shared/design.md.
// ⚠️ Le `Bouton` lui-même ne rétrécit plus : il descend d'1 px (rebranding,
// décision 21), par la règle `button[data-bouton]` d'index.css, posée ici par
// l'attribut. Cette constante reste celle des autres surfaces pressables.
export const PRESSION = 'transition-transform duration-150 ease-out active:scale-[0.97]';

// ⚠️ Le SOCLE ne porte ni couleur ni contour : il pose la géométrie et
// l'alignement, que toutes les combinaisons partagent sans exception. L'état
// désactivé dépend du remplissage (voir `desactive`).
const SOCLE =
  'inline-flex flex-none items-center justify-center gap-1.5 font-semibold select-none ' +
  'transition disabled:cursor-not-allowed';

// ⚠️ **Désactivé : un APLAT de braise devient gris, il ne pâlit pas.** La planche
// « Actions » de la toile le dessine en `panel2` avec une encre éteinte : une
// braise à 40 % d'opacité donnait un brun boueux qui se lisait encore comme
// une invitation. Les autres boutons, sans aplat de couleur, pâlissent comme
// avant.
// ⚠️ `disabled:!bg-panel2` : même raison que `active:!` dans FONDS — sans
// l'important, le survol (émis plus loin) rallumait la braise sur un bouton
// désactivé.
function desactive(ton: TonBouton, fond: FondBouton): string {
  return ton === 'accent' && fond === 'plein'
    ? 'disabled:border-transparent disabled:!bg-panel2 disabled:text-ink-dimmer'
    : 'disabled:opacity-40';
}

// ⚠️ **À la souris, le gabarit des boutons de la MAQUETTE, dans toute l'app**
// (refonte graphique, décision 16 — le mainteneur : « il faut que les boutons soient
// unifiés dans l'application », « le même rendu que sur la maquette ») :
// `md` = `.btn` (32 px, 12 px de côté, 13 px de texte), `sm` = `.btn-sm`
// (28 px, 10 px, 12 px), rayon 8 px ; un bouton d'icône est un carré de la
// même hauteur (`BoutonIcone` = `.btn-icon.btn-sm`, le « ⋯ » d'en-tête =
// `.btn-icon`). `md` valait 37,5 px — un rembourrage autour d'une ligne de
// 19,5 px — et ne tombait juste à côté de rien. `min-h` et non `h` : un
// libellé qui passe à la ligne agrandit le bouton au lieu de déborder. `xs`
// et `BoutonIcone` `serre` restent hors de l'échelle : ils vivent DANS un
// contenant plus petit qu'elle. Au doigt, rien ne change (lot 11).
const TAILLES: Record<TailleBouton, string> = {
  // ⚠️ `xs` vit DANS un contenant déjà serré (une carte, une pilule d'en-tête),
  // jamais pour l'action principale d'un écran.
  xs: 'px-2 py-0.5 text-micro',
  sm: 'px-2.5 py-1 text-xs lg:min-h-7 lg:py-0',
  md: 'px-3.5 py-2 text-sm lg:min-h-8 lg:px-3 lg:py-0',
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
    // « FANTÔME » de la toile (rebranding R3c) : texte braise lisible, sans
    // fond ni contour, le fond braise sombre au survol (voir FONDS). Personne
    // ne l'employait avant — il sert à l'action d'une notification.
    nu: 'text-accent',
    doux: 'text-ink hoverable:brightness-110',
    // Bouton PRINCIPAL (refonte graphique, décision 4) : texte `accent-ink`
    // sur l'aplat de braise, l'encre sombre de la toile. Le survol ne passe
    // plus par un filtre de luminosité : c'est le FOND qui change (voir FONDS,
    // `accent-hover` / `accent-appui`, rebranding R3a).
    plein: 'text-accent-ink',
  },
  // `text-bad-ink` sur l'aplat rouge : blanc en Atelier, SOMBRE en Forge. C'était
  // `text-white` pour les deux thèmes ; depuis le rebranding, le rouge de Forge
  // est clair et le blanc n'y faisait plus que 2.66 (la croix « Retirer » d'une
  // carte RTA). Même logique qu'`accent-ink`.
  danger: { nu: 'text-ink-dim hoverable:text-bad', doux: 'text-bad', plein: 'text-bad-ink' },
  // ⚠️ La teinte est là DÈS LE REPOS et ne bouge pas au survol : elle signale un
  // état des données, et un signal qui s'allume au passage de la souris n'est
  // plus un signal.
  alerte: { nu: 'text-warn', doux: 'text-warn', plein: 'text-bg' },
};

// ⚠️ **Le survol peint le FOND, comme dans la maquette** (décision 16) :
// `.btn-secondary:hover` et `.btn-ghost:hover` y prennent `--hover`, dont
// l'équivalent ici est `panel2` (même écart au panneau, dans les deux thèmes).
// Il allumait le CONTOUR en accent — un signal réservé, depuis, à l'état
// enclenché et au focus. `.btn-danger:hover` prend `--bad-soft`.
const FONDS: Record<TonBouton, Record<FondBouton, string>> = {
  neutre: {
    vide: 'bg-transparent hoverable:bg-panel2',
    doux: 'bg-panel hoverable:bg-panel2',
    plein: 'bg-panel2',
  },
  // ⚠️ `plein` est un VRAI aplat d'accent depuis la refonte (décision 4) : le
  // bouton principal d'un écran, un seul par écran. Il valait `accent-soft`,
  // comme `doux` — l'app n'avait aucun bouton principal qui ressorte.
  // Survol et appui : les états de la toile (R3a) — plus clair puis plus
  // foncé en Forge ; en Atelier, les deux foncent (voir index.css).
  // ⚠️ `active:!` : les variantes du plugin (`hoverable:`) sont émises APRÈS
  // les variantes de base (`active:`, `disabled:`) dans le CSS construit — à
  // spécificité égale, le survol l'emportait sur l'appui, qu'on n'aurait
  // jamais vu à la souris (on survole toujours ce qu'on presse). Vérifié dans
  // `dist/` : `hoverable:bg-accent-hover` après `active:bg-accent-appui`.
  accent: {
    vide: 'bg-transparent hoverable:bg-accent-soft',
    doux: 'bg-accent-soft',
    plein: 'bg-accent hoverable:bg-accent-hover active:!bg-accent-appui',
  },
  // ⚠️ `plein` est OPAQUE, pas une opacité de plus que `doux` : c'est le cran
  // des actions posées SUR autre chose (la croix au coin d'une carte), où un
  // fond translucide laisserait passer l'image dessous et rendrait l'icône
  // illisible. `doux` reste le voile discret d'un bouton posé dans un panneau.
  danger: { vide: 'bg-transparent hoverable:bg-bad-soft', doux: 'bg-bad/10', plein: 'bg-bad' },
  alerte: { vide: 'bg-transparent', doux: 'bg-warn/10', plein: 'bg-warn' },
};

const TRAITS: Record<TonBouton, Record<TraitBouton, string>> = {
  // Plus de contour d'accent au survol : c'est le fond qui répond (voir FONDS).
  neutre: {
    aucun: 'border border-transparent',
    plein: 'border border-border',
    pointille: 'border border-dashed border-border',
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
  alerte: {
    aucun: 'border border-transparent',
    plein: 'border border-warn/50',
    pointille: 'border border-dashed border-warn/50',
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
  // Libellé COURT, employé sous `lg` à la place du précédent.
  //
  // ⚠️ Ce n'est pas un doublon du masquage : ici les deux formats montrent un
  // mot, mais pas le même. « Créer un monstre » occupe une cellule entière du
  // panneau mobile et y passe à la ligne, alors que « Monstre » suffit — le
  // contexte du panneau porte le reste du sens. La phrase entière reste dans
  // `title` et `aria-label`, qui eux ne changent jamais.
  libelleCourt?: ReactNode;
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
  // ⚠️ **Un LIEN au dessin de bouton** (application de bureau, lot 6 :
  // « Télécharger pour Windows ») : rendu en `<a href>`, même dessin. Un
  // téléchargement, une page externe sont des LIENS — on peut en copier
  // l'adresse, le lecteur d'écran dit « lien ». Sans `href` : un `<button>`.
  href?: string;
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
    libelleCourt,
    libelleAuDoigt = true,
    pleineLargeur = false,
    nuAuDoigt = false,
    actif,
    href,
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

  const classes = `${SOCLE} ${desactive(tonEffectif, fondEffectif)} ${TAILLES[taille]} ${FORMES[forme]} ${
    TRAITS[ton][trait]
  } ${nu} ${FONDS[tonEffectif][fondEffectif]} ${TEXTES[tonEffectif][fondEffectif === 'vide' ? 'nu' : fondEffectif]} ${
    pleineLargeur ? 'w-full' : ''
  } ${className}`;

  const contenu = (
    <>
      {icone}
      {/* ⚠️ Le libellé est TOUJOURS dans un `<span>`, même visible : c'est cette
          balise que la règle `[data-tiroir] button > span.compact\:hidden` va
          rechercher pour rendre les mots dans le panneau mobile. Un texte nu,
          enfant direct du bouton, ne serait pas rattrapable. */}
      {/* ⚠️ Bascule par `lg:` et non par `compact:` : c'est une question de
          PLACE (la largeur de la cellule du panneau), pas de pointeur. Une
          tablette au doigt mais large garde la phrase entière. */}
      {libelleCourt != null && libelle != null ? (
        <>
          <span className="lg:hidden">{libelleCourt}</span>
          <span className="hidden lg:inline">{libelle}</span>
        </>
      ) : (
        libelle != null && (
          <span className={masquable ? 'compact:hidden' : undefined}>{libelle}</span>
        )
      )}
    </>
  );

  // Un lien : mêmes classes, même appui (`[data-bouton]` d'index.css). Les
  // attributs propres au bouton (`type`, `aria-pressed`) n'ont pas de sens ici.
  if (href != null) {
    return (
      <a
        href={href}
        data-bouton=""
        className={classes}
        {...(reste as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {contenu}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={actif}
      // Appui : descend d'1 px (règle `button[data-bouton]` d'index.css).
      data-bouton=""
      {...(nuAuDoigt ? { 'data-cible-fine': true } : {})}
      className={classes}
      {...reste}
    >
      {contenu}
    </button>
  );
});

export default Bouton;
