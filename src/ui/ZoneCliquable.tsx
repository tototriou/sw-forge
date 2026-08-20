import { ReactNode, forwardRef } from 'react';

// SURFACE rendue cliquable : la ligne d'une carte qui déplie son détail, le
// corps d'une vignette, une poignée de glisser-déposer.
//
// ⚠️ **Ce n'est pas un bouton, et c'est tout l'intérêt de le distinguer.** Un
// bouton a une forme : un cadre, un fond, un rembourrage, une pression au clic.
// Ces surfaces-là n'en ont aucune — elles épousent le contenu qu'elles rendent
// touchable, et le moindre habillage y ferait un objet de plus sur une carte
// déjà dense. Les écrire en `<button>` nu marchait, mais rien n'empêchait
// d'ajouter « juste une bordure » ; les nommer dit que la nudité est la règle.
//
// ⚠️ **`<button>` malgré tout, jamais un `<div onClick>`.** C'est ce qui donne
// le focus clavier, l'activation à Entrée et à l'Espace, et l'annonce au lecteur
// d'écran — trois choses qu'un `div` cliquable oblige à réécrire, et qu'on
// réécrit toujours à moitié.
//
// ⚠️ **`type="button"` explicite** : dans un `<form>`, un bouton sans type vaut
// `submit` et valide le formulaire au lieu de déplier la ligne.

export interface ZoneCliquableProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  // Curseur de PRÉHENSION, pour une poignée de glisser-déposer : la main se
  // ferme au moment où l'on saisit.
  //
  // ⚠️ Va avec `touch-none` : sans lui, le geste est capté par le défilement de
  // la page et le glissement ne démarre jamais au doigt.
  poignee?: boolean;
  // Rend un `<div role="button">` au lieu d'un `<button>`.
  //
  // ⚠️ **Uniquement quand un vrai bouton serait INVALIDE** : une zone posée à
  // l'intérieur d'une autre zone cliquable, ou qui contient elle-même des
  // éléments interactifs — un `<button>` dans un `<button>` est du HTML invalide,
  // et les navigateurs en font ce qu'ils veulent.
  //
  // Le composant remet alors à la main ce que le navigateur donnait gratuitement :
  // `tabIndex` pour le focus clavier, et l'activation à Entrée et à l'Espace. Un
  // `div onClick` sans ces trois-là est inatteignable au clavier — et c'est
  // toujours la partie qu'on oublie de réécrire.
  imbrique?: boolean;
}

const ZoneCliquable = forwardRef<HTMLElement, ZoneCliquableProps>(function ZoneCliquable(
  {
    children,
    poignee = false,
    imbrique = false,
    onClick,
    disabled,
    className = '',
    type = 'button',
    ...reste
  },
  ref,
) {
  const classes = `text-left transition disabled:cursor-default ${
    poignee ? 'flex-none cursor-grab touch-none active:cursor-grabbing' : ''
  } ${className}`;

  if (imbrique) {
    // ⚠️ Tout ce qu'un `<button>` donnait gratuitement, remis à la main : le
    // focus clavier, l'activation à Entrée et à l'Espace, l'annonce du rôle. Une
    // zone sans action (`onClick` absent, ou désactivée) ne prend NI rôle NI
    // `tabIndex` : un élément focusable qui ne fait rien est un piège au clavier.
    const actif = Boolean(onClick) && !disabled;
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role={actif ? 'button' : undefined}
        tabIndex={actif ? 0 : undefined}
        onClick={actif ? onClick : undefined}
        onKeyDown={
          actif
            ? (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault(); // l'Espace ferait défiler la page
                onClick?.(e as unknown as React.MouseEvent<HTMLElement>);
              }
            : undefined
        }
        className={`${classes} ${actif ? 'cursor-pointer' : ''}`}
        {...(reste as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...reste}
    >
      {children}
    </button>
  );
});

export default ZoneCliquable;
