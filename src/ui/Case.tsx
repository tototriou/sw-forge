import { ReactNode, forwardRef } from 'react';

// Case à cocher, avec son libellé.
//
// ⚠️ **La case native est là, seulement invisible** (`sr-only`) — jamais
// remplacée par un `<div>` qu'on rendrait cliquable. C'est elle qui porte
// l'état, le focus clavier, la barre d'espace et l'annonce du lecteur d'écran ;
// le carré dessiné n'est qu'une peinture posée dessus. Une fausse case en `div`
// oblige à réimplémenter tout cela, et on n'en réimplémente jamais que la
// moitié.
//
// ⚠️ Le tout est enveloppé dans un `<label>` : c'est ce qui rend le TEXTE
// cliquable, pas seulement le carré de 15 px. Sur un téléphone, viser le carré
// seul est un exercice ; viser une phrase ne l'est pas.
//
// ⚠️ `peer` sur la case native et `peer-focus-visible:` sur le carré : le focus
// clavier doit se voir sur ce qu'on DESSINE, alors qu'il est reçu par ce qu'on
// cache. Sans cela, tabuler jusqu'à la case ne montre rien.

export interface CaseProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  libelle: ReactNode;
  // Couleur de la coche. `star` pour un choix qu'on RECOMMANDE (la case
  // accompagne alors une réponse mise en avant), `accent` pour un réglage
  // ordinaire.
  ton?: 'accent' | 'star';
}

const Case = forwardRef<HTMLInputElement, CaseProps>(function Case(
  { libelle, ton = 'accent', checked, className = '', ...reste },
  ref,
) {
  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-2 text-micro text-ink-dim ${className}`}
    >
      <input ref={ref} type="checkbox" checked={checked} className="peer sr-only" {...reste} />
      <span
        aria-hidden
        className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded border
          transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent
          peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-panel ${
            checked
              ? ton === 'star'
                ? 'border-star bg-star text-bg'
                : 'border-accent bg-accent text-bg'
              : 'border-border bg-panel2'
          }`}
      >
        {/* Le chevron est dessiné en SVG plutôt qu'importé : à 11 px il ne
            s'agit que de deux segments, et cela évite de faire dépendre un
            composant de base d'une bibliothèque d'icônes. */}
        {checked && (
          <svg viewBox="0 0 12 12" className="h-[11px] w-[11px]" fill="none" stroke="currentColor">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {libelle}
    </label>
  );
});

export default Case;
