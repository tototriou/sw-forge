import { forwardRef, ReactNode } from 'react';

// Champ de saisie texte.
//
// ⚠️ **`compact:text-base` n'est pas un choix de taille, c'est un correctif.**
// Sous 16 px, iOS ZOOME sur le champ à la mise au point — et la page ne revient
// pas seule de ce zoom : on se retrouve décalé sur un formulaire dont on ne voit
// plus les boutons. C'est la seule raison pour laquelle un champ grossit au
// doigt alors que tout le reste rétrécit. Écrit ici une fois, ce piège ne peut
// plus être oublié dans un formulaire neuf.
//
// ⚠️ Bordure seule au focus, **sans halo** : voir spec/shared/design.md.

export interface ChampProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Posée à gauche, dans le rembourrage. Le champ décale son texte pour elle.
  icone?: ReactNode;
  // Occupe la largeur de son parent. Défaut : oui — un champ à demi-largeur dans
  // un formulaire est presque toujours un oubli.
  pleineLargeur?: boolean;
  // Classes du conteneur `relative` ajouté quand il y a une icône.
  //
  // ⚠️ Existe parce que ce conteneur est un ANCRAGE, pas seulement une boîte :
  // la recherche RTA suspend sa liste de résultats en `absolute` sous le champ.
  // Sans cette porte, l'appelant devait poser son propre `relative` autour, et
  // deux ancrages imbriqués décalaient la liste du rembourrage de l'icône. Sert
  // aussi à décaler l'icône (`[&>span]:left-4`) quand le champ est plus large
  // que le champ courant.
  classNameConteneur?: string;
}

const Champ = forwardRef<HTMLInputElement, ChampProps>(function Champ(
  { icone, pleineLargeur = true, classNameConteneur = '', className = '', type = 'text', ...reste },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type={type}
      className={`min-w-0 rounded-lg border border-border bg-panel2 px-3 py-2 text-sm text-ink
        outline-none transition placeholder:text-ink-dim focus:border-accent
        compact:text-base ${pleineLargeur ? 'w-full' : ''} ${icone ? 'pl-9' : ''} ${className}`}
      {...reste}
    />
  );

  if (!icone) return input;

  return (
    <div className={`relative ${pleineLargeur ? 'w-full' : ''} ${classNameConteneur}`}>
      {/* `pointer-events-none` : l'icône est un repère, pas une cible — sans
          cela, taper dessus ne met pas le champ au point. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-ink-dim"
      >
        {icone}
      </span>
      {input}
    </div>
  );
});

export default Champ;
