import { forwardRef, ReactNode } from 'react';

// Champ de saisie texte.
//
// ⚠️ **Le zoom d'iOS ne se traite PAS ici.** Ce composant portait un
// `compact:text-base` censé l'empêcher — sauf que `text-base` vaut 15 px dans
// cette app, sous le seuil de 16 px de Safari : il n'a jamais rien empêché, et
// il ne couvrait que ce composant alors que tout `<input>`, `<select>` ou
// `<textarea>` est concerné. La règle vit désormais dans index.css, sur les
// ÉLÉMENTS et sous `pointer: coarse`.
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
        ${pleineLargeur ? 'w-full' : ''} ${icone ? 'pl-9' : ''} ${className}`}
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
