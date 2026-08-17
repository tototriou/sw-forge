import { forwardRef, ReactNode } from 'react';

// Liste déroulante.
//
// ⚠️ **`appearance-none` + notre propre chevron.** Le contrôle natif dessine sa
// flèche avec les couleurs du SYSTÈME, qui ne suivent ni le thème Forge ni le
// thème Atelier : sur fond sombre, une flèche noire disparaissait. Le chevron
// vient de `--chevron-select` (index.css), donc il suit les tokens comme le
// reste. La LISTE ouverte, elle, reste celle du système — c'est le seul morceau
// de l'app qu'on ne dessine pas, et le remplacer coûterait un menu flottant
// complet à claviériser.
//
// ⚠️ **`dense` n'est pas « plus petit », c'est une EXEMPTION tactile.** Il
// descend à 32 px là où la règle générale impose 40 px, et ne s'emploie que dans
// une carte déjà serrée — une tuile de 150 px qui porte un portrait, un nom, une
// vitesse et trois icônes de set. Voir `data-carte-dense` dans index.css.

export interface SelecteurProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  taille?: 'md' | 'sm' | 'dense';
  pleineLargeur?: boolean;
  children: ReactNode;
}

const TAILLES = {
  md: 'rounded-lg px-3 py-2 text-sm',
  sm: 'rounded-md px-2 py-1 text-xs',
  dense: 'rounded px-1.5 py-0.5 text-micro',
} as const;

const Selecteur = forwardRef<HTMLSelectElement, SelecteurProps>(function Selecteur(
  { taille = 'md', pleineLargeur = true, className = '', children, ...reste },
  ref,
) {
  return (
    <select
      ref={ref}
      // ⚠️ Le chevron est peint en fond, d'où le rembourrage droit réservé
      // (`pr-6`) : sans lui, le texte de l'option passait dessous.
      className={`appearance-none border border-border bg-panel bg-[image:var(--chevron-select)]
        bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat pr-6 text-ink-dim outline-none
        transition focus:border-accent ${TAILLES[taille]} ${
          pleineLargeur ? 'w-full' : ''
        } ${className}`}
      {...(taille === 'dense' ? { 'data-cible-fine': true } : {})}
      {...reste}
    >
      {children}
    </select>
  );
});

export default Selecteur;
